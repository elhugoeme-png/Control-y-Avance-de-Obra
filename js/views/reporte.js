/* Reporte: resumen imprimible (Guardar como PDF desde el navegador) y texto para WhatsApp. */
(function () {
  'use strict';
  const { h, pct, num, fCorta, fLarga, dinero, ETIQ_ACT, ETIQ_MAT, aviso } = UI;

  function datos(app, desde, hasta) {
    const st = Store.s, aj = st.ajustes, f = hasta;
    const r = Calc.resumenObra(st.obra, st.actividades, f);
    const acts = st.actividades.map((a) => ({ a, e: Calc.estadoActividad(a, f, aj.umbrales) }));
    const mats = st.materiales.map((m) => ({ m, e: Calc.estadoMaterial(m, st.movimientos, f, { ventana: aj.ventanaConsumo, diasAviso: aj.diasAviso }) }));
    const notas = st.diario.filter((n) => n.fecha >= desde && n.fecha <= hasta).sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
    const raya = Calc.raya(st.trabajadores.filter((t) => t.activo !== false), st.asistencia, desde, hasta);
    const consumos = {};
    st.movimientos.filter((m) => m.tipo === 'salida' && m.fecha >= desde && m.fecha <= hasta).forEach((m) => { consumos[m.matId] = (consumos[m.matId] || 0) + m.cant; });
    return { st, r, acts, mats, notas, raya, consumos };
  }

  function textoWhatsApp(d, desde, hasta) {
    const { st, r, acts, mats } = d;
    const lineas = [
      `*${st.obra.nombre}* — Reporte ${fCorta(desde)} a ${fCorta(hasta)}`,
      `Avance real ${pct(r.real)} vs programado ${pct(r.prog)} (desv. ${num(r.desviacion)} pts)`,
      `Plazo: ${r.transcurridos}/${r.plazo} días · restan ${r.restantes}`,
      '', '*Actividades con atención:*',
      ...acts.filter((x) => ['atrasada', 'atencion'].includes(x.e.estado)).map((x) => `• ${x.a.clave} ${x.a.nombre}: ${Math.round(x.e.real)}% (prog. ${Math.round(x.e.prog)}%) — ${x.e.diasAtraso} d atraso`),
      '', '*Materiales por pedir:*',
      ...mats.filter((x) => x.e.pedido > 0).map((x) => `• ${x.m.nombre}: hay ${num(x.e.exist)} ${x.m.unidad}, pedir ${num(x.e.pedido, 0)}`),
    ];
    return lineas.join('\n');
  }

  function vista(app, params) {
    const hasta = params.hasta || app.fecha;
    const desde = params.desde || Calc.sumarDias(hasta, -6);
    const d = datos(app, desde, hasta);
    const { st, r, acts, mats, notas, raya, consumos } = d;
    const totalRaya = raya.reduce((t, x) => t + x.importe, 0);
    const tabla = (cab, filas) => h('table.tabla', h('thead', h('tr', cab.map((c) => h('th', c)))), h('tbody', filas.map((f) => h('tr', f.map((c) => h('td', c))))));
    const fotos = notas.flatMap((n) => (n.fotos || []).map((id) => ({ id, n })));

    const txt = textoWhatsApp(d, desde, hasta);

    return h('div.vista',
      h('div.no-imprimir',
        h('h2', 'REPORTE'),
        h('div.tarjeta.rejilla2',
          h('label.campo', h('span', 'Desde'), h('input', { type: 'date', value: desde, onchange: (e) => app.ir('reporte', { desde: e.target.value, hasta }) })),
          h('label.campo', h('span', 'Hasta'), h('input', { type: 'date', value: hasta, onchange: (e) => app.ir('reporte', { desde, hasta: e.target.value }) }))),
        h('div.rejilla2',
          h('button.btn.btn-oscuro', { onclick: () => window.print() }, '🖨 Imprimir / PDF'),
          h('a.btn.btn-oro', { href: 'https://wa.me/?text=' + encodeURIComponent(txt), target: '_blank', rel: 'noopener' }, 'Resumen por WhatsApp')),
        h('button.btn.btn-borde.ancho', { onclick: () => navigator.clipboard.writeText(txt).then(() => aviso('Resumen copiado'), () => aviso('No se pudo copiar')) }, '📋 Copiar resumen')),

      h('article.reporte',
        h('header.rep-cab',
          h('div', h('div.rep-marca', 'JCC CONTROL DE OBRA'), h('h1', st.obra.nombre),
            h('div.peque', [st.obra.contrato && 'Contrato ' + st.obra.contrato, st.obra.ubicacion, st.obra.cliente && 'Cliente: ' + st.obra.cliente].filter(Boolean).join(' · '))),
          h('div.derecha.peque', `Periodo: ${fCorta(desde)} – ${fCorta(hasta)}`, h('br'), `Emitido: ${fLarga(app.fecha)}`)),
        h('section', h('h2', '1. Resumen'),
          tabla(['Avance real', 'Programado', 'Desviación', 'Atraso aprox.', 'Plazo'], [[pct(r.real), pct(r.prog), `${num(r.desviacion)} pts`, `${r.diasAtraso} días`, `${r.transcurridos}/${r.plazo} días (restan ${r.restantes})`]])),
        h('section', h('h2', '2. Avance por actividad'),
          tabla(['Clave', 'Actividad', 'Periodo', 'Prog.', 'Real', 'Estado'], acts.map(({ a, e }) => [a.clave, a.nombre, `${fCorta(a.inicio)}–${fCorta(a.fin)}`, pct(Math.round(e.prog)), pct(Math.round(e.real)), ETIQ_ACT[e.estado] + (e.diasAtraso ? ` (${e.diasAtraso} d)` : '')]))),
        h('section', h('h2', '3. Materiales'),
          tabla(['Material', 'Existencia', 'Consumo periodo', 'Mínimo', 'Estado', 'Pedir'], mats.map(({ m, e }) => [m.nombre, `${num(e.exist)} ${m.unidad}`, `${num(consumos[m.id] || 0)} ${m.unidad}`, num(m.minimo), ETIQ_MAT[e.estado], e.pedido ? `${num(e.pedido, 0)} ${m.unidad}` : '—']))),
        h('section', h('h2', '4. Personal'),
          raya.length ? tabla(['Nombre', 'Puesto', 'Días', 'Importe'], [...raya.map((x) => [x.nombre, x.puesto || '', x.dias, dinero(x.importe)]), ['', 'Total', raya.reduce((t, x) => t + x.dias, 0), dinero(totalRaya)]]) : h('p', 'Sin personal registrado.')),
        h('section', h('h2', '5. Bitácora'),
          notas.length ? notas.map((n) => h('p', h('b', fCorta(n.fecha) + (n.clima ? ` (${n.clima})` : '') + ': '), n.texto || '(foto)', n.pendiente ? ' [PENDIENTE]' : '')) : h('p', 'Sin notas en el periodo.')),
        fotos.length ? h('section', h('h2', '6. Reporte fotográfico'),
          h('div.rep-fotos', fotos.map(({ id, n }) => h('figure', Fotos.pintar(h('img', { alt: 'Foto' }), id), h('figcaption', `${fCorta(n.fecha)} · ${n.actividad || 'General'}`))))) : null,
        h('footer.rep-firmas', h('div', 'Residente de obra'), h('div', 'Supervisión'))));
  }

  window.Vistas.reporte = { titulo: 'Reporte', icono: '▤', render: vista };
})();
