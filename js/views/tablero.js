/* Tablero: resumen de la obra, alertas, curva S y avance por actividad. */
(function () {
  'use strict';
  const { h, s, pct, num, fCorta, fLarga, chip, barra, anillo, ETIQ_ACT } = UI;

  const TIPS = [
    ['Instalaciones', 'Antes de trabajar en un circuito, desenergiza, bloquea y verifica ausencia de tensión.'],
    ['Concreto', 'Cura el concreto al menos 7 días manteniéndolo húmedo; evita colar con lluvia sin protección.'],
    ['Alturas', 'Arriba de 1.80 m usa arnés y línea de vida; revisa andamios antes de cada turno.'],
    ['Almacén', 'Estiba el cemento sobre tarimas, a no más de 10 bultos de alto y lejos de la humedad.'],
    ['Excavación', 'Ademar o taludear cepas de más de 1.50 m; no acopies material al borde.'],
    ['Acero', 'Revisa recubrimientos y separadores antes de colar; toma foto del armado.'],
  ];
  let tip = new Date().getDate() % TIPS.length;

  function curvaS(datos, hoy) {
    const W = 320, H = 170, ml = 30, mr = 8, mt = 8, mb = 22;
    const n = datos.length - 1 || 1;
    const x = (i) => ml + (i / n) * (W - ml - mr);
    const y = (v) => mt + (1 - v / 100) * (H - mt - mb);
    const linea = (clave) => datos.map((p, i) => (p[clave] == null ? null : `${x(i).toFixed(1)},${y(p[clave]).toFixed(1)}`)).filter(Boolean).join(' ');
    const iHoy = datos.findIndex((p) => p.fecha === hoy);
    const g = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'curva', role: 'img', 'aria-label': 'Curva S de avance acumulado' });
    for (const v of [0, 25, 50, 75, 100]) {
      g.append(s('line', { x1: ml, x2: W - mr, y1: y(v), y2: y(v), class: 'rejilla' }), s('text', { x: ml - 4, y: y(v) + 3, class: 'eje', 'text-anchor': 'end' }, v + '%'));
    }
    g.append(s('text', { x: ml, y: H - 6, class: 'eje' }, fCorta(datos[0].fecha)), s('text', { x: W - mr, y: H - 6, class: 'eje', 'text-anchor': 'end' }, fCorta(datos[n].fecha)));
    if (iHoy >= 0) g.append(s('line', { x1: x(iHoy), x2: x(iHoy), y1: mt, y2: H - mb, class: 'hoy' }), s('text', { x: x(iHoy), y: H - 6, class: 'eje', 'text-anchor': 'middle' }, 'hoy'));
    g.append(s('polyline', { points: linea('prog'), class: 'serie-prog' }), s('polyline', { points: linea('real'), class: 'serie-real' }));
    return g;
  }

  function vista(app) {
    const st = Store.s, hoy = app.fecha, aj = st.ajustes;
    const r = Calc.resumenObra(st.obra, st.actividades, hoy);
    const estados = st.actividades.map((a) => ({ a, e: Calc.estadoActividad(a, hoy, aj.umbrales) }));
    const atrasadas = estados.filter((x) => x.e.estado === 'atrasada');
    const mats = st.materiales.map((m) => ({ m, e: Calc.estadoMaterial(m, st.movimientos, hoy, { ventana: aj.ventanaConsumo, diasAviso: aj.diasAviso }) }));
    const bajos = mats.filter((x) => x.e.estado === 'bajo-minimo');
    const asis = Calc.resumenAsistencia(st.trabajadores, st.asistencia[hoy]);
    const fotosHoy = st.diario.filter((d) => d.fecha === hoy).reduce((t, d) => t + (d.fotos || []).length, 0);
    const pendientes = st.diario.filter((d) => d.pendiente).length;
    const cuenta = Calc.conteoEstados(st.actividades, hoy, aj.umbrales);

    const orden = { atrasada: 0, atencion: 1, 'en-tiempo': 2, adelantada: 3, 'por-iniciar': 4, terminada: 5 };
    const ordenadas = [...estados].sort((p, q) => orden[p.e.estado] - orden[q.e.estado] || (p.a.clave > q.a.clave ? 1 : -1));
    const tarjetaKpi = (valor, texto, clase) => h('div.kpi', h('div.kpi-num.' + (clase || ''), valor), h('div.kpi-txt', texto));

    return h('div.vista',
      h('section.cabecera-obra',
        h('div.obra-nombre', st.obra.nombre),
        h('div.obra-meta', [st.obra.contrato && 'Contrato ' + st.obra.contrato, st.obra.ubicacion].filter(Boolean).join(' · ')),
        h('div.obra-meta', fLarga(hoy))),

      bajos.length ? h('button.alerta.alerta-roja', { onclick: () => app.ir('inventario') },
        `📦 ${bajos.length} material(es) por agotarse: ` + bajos.map((x) => `${x.m.nombre} (${num(x.e.exist)} ${x.m.unidad})`).join(', ')) : null,
      atrasadas.length ? h('button.alerta.alerta-ambar', { onclick: () => app.ir('programa', { filtro: 'atrasada' }) },
        `⏱ ${atrasadas.length} actividad(es) atrasada(s) — toca para verlas`) : null,

      h('section.tarjeta',
        h('div.anillos',
          h('div.anillo-caja', anillo(r.real, 'var(--oro)'), h('div', h('div.kpi-grande', pct(r.real)), h('div.kpi-txt', 'Avance real'))),
          h('div.anillo-caja', anillo(r.prog, 'var(--gris)'), h('div', h('div.kpi-grande', pct(r.prog)), h('div.kpi-txt', 'Programado a hoy')))),
        h('div.rejilla2',
          tarjetaKpi((r.desviacion > 0 ? '+' : '') + num(r.desviacion), 'Desviación (puntos %)', r.desviacion < -2 ? 'rojo' : r.desviacion > 2 ? 'verde' : ''),
          tarjetaKpi(r.diasAtraso, 'Días de atraso (aprox.)', r.diasAtraso ? 'rojo' : ''),
          tarjetaKpi(pct(Math.round(r.pctPlazo)), `Plazo transcurrido · ${r.transcurridos}/${r.plazo} d`),
          tarjetaKpi(r.restantes, `Días restantes (término ${fCorta(st.obra.fin)})`))),

      h('section.tarjeta',
        h('h3', `Estado de las actividades (${st.actividades.length})`),
        h('div.rejilla3', ['terminada', 'adelantada', 'en-tiempo', 'atencion', 'atrasada', 'por-iniciar'].map((k) =>
          h('button.estado-caja.borde-' + k, { onclick: () => app.ir('programa', { filtro: k }) }, h('div.kpi-num', cuenta[k]), h('div.kpi-txt', ETIQ_ACT[k]))))),

      h('section.tarjeta',
        h('h3', 'Curva S · avance acumulado'),
        st.actividades.length ? curvaS(Calc.curvaS(st.obra, st.actividades, hoy), hoy) : h('p.tenue', 'Agrega actividades en Programa para ver la curva.'),
        h('div.leyenda', h('span.ley-prog', 'Programado'), h('span.ley-real', 'Real')),
        h('p.tenue.peque', 'El real se arma con el historial de avances que registras.')),

      h('section.tarjeta',
        h('h3', 'Avance por actividad'),
        ordenadas.map(({ a, e }) => h('button.fila-act', { onclick: () => app.ir('programa', { abrir: a.id }) },
          h('div.fila-tit', h('b', `${a.clave} ${a.nombre}`), chip(e.estado, ETIQ_ACT[e.estado])),
          barra(e.real, e.prog, e.estado),
          h('div.peque.tenue', `Real ${pct(Math.round(e.real))} · Prog. ${pct(Math.round(e.prog))} · `,
            e.diasAtraso ? h('span.rojo', `${e.diasAtraso} día(s) de atraso`) : e.diasAdelanto ? h('span.azul', `${e.diasAdelanto} día(s) adelantada`) : 'sin desviación',
            ` · ${fCorta(a.inicio)}–${fCorta(a.fin)}`)))),

      h('div.rejilla2',
        tarjetaKpi(h('span', asis.presentes, h('small', '/' + asis.total)), 'Personal hoy'),
        tarjetaKpi(fotosHoy, 'Fotos de hoy'),
        tarjetaKpi(bajos.length, 'Materiales en mínimo', bajos.length ? 'rojo' : ''),
        tarjetaKpi(pendientes, 'Notas pendientes')),

      h('div.rejilla2',
        h('button.btn.btn-oscuro', { onclick: () => app.ir('asistencia') }, '✔ Pasar lista'),
        h('button.btn.btn-oro', { onclick: () => app.ir('diario', { nueva: true }) }, '📷 Foto / nota'),
        h('button.btn.btn-borde', { onclick: () => app.ir('inventario', { mov: 'salida' }) }, '📤 Salida material'),
        h('button.btn.btn-borde', { onclick: () => app.ir('reporte') }, '📄 Reporte')),

      h('section.tarjeta',
        h('h3', `📅 Programado para hoy (${Calc.programadasPara(st.actividades, hoy).length})`),
        Calc.programadasPara(st.actividades, hoy).map((a) => {
          const e = Calc.estadoActividad(a, hoy, aj.umbrales);
          return h('button.fila-simple', { onclick: () => app.ir('programa', { abrir: a.id }) },
            h('div', h('b', `${a.clave} ${a.nombre}`), h('div.peque.tenue', `Prog. ${pct(Math.round(e.prog))} · Real ${pct(Math.round(e.real))} · termina ${fCorta(a.fin)}`)),
            chip(e.estado, ETIQ_ACT[e.estado]));
        })),

      h('section.tarjeta.tip',
        h('h3', '💡 Tip del día'),
        h('div.tip-cuerpo', h('div.tip-cat', TIPS[tip][0].toUpperCase()), h('div', TIPS[tip][1])),
        h('div.rejilla2',
          h('button.btn.btn-borde', { onclick: () => { tip = (tip + TIPS.length - 1) % TIPS.length; app.render(); } }, '◀ Anterior'),
          h('button.btn.btn-borde', { onclick: () => { tip = (tip + 1) % TIPS.length; app.render(); } }, 'Siguiente ▶'))),

      siguientePaso(st, app));
  }

  function siguientePaso(st, app) {
    let txt = null, destino = null;
    if (!st.actividades.length) { txt = 'Da de alta las actividades de tu programa en Programa ▸ + Actividad.'; destino = 'programa'; }
    else if (!st.trabajadores.length) { txt = 'Da de alta a tu personal en Asistencia ▸ + Trabajador.'; destino = 'asistencia'; }
    else if (!st.materiales.length) { txt = 'Registra tus materiales en Inventario ▸ + Material.'; destino = 'inventario'; }
    else if (/EJEMPLO/i.test(st.obra.nombre)) { txt = 'Estás viendo una obra de ejemplo. Cuando quieras empezar la tuya: Ajustes ▸ Nueva obra.'; destino = 'ajustes'; }
    return txt ? h('button.alerta.alerta-azul', { onclick: () => app.ir(destino) }, 'Siguiente paso: ' + txt) : null;
  }

  window.Vistas = window.Vistas || {};
  window.Vistas.tablero = { titulo: 'Tablero', icono: '⌂', render: vista };
})();
