/* Programa: alta de actividades, registro de avances y filtro por estado. */
(function () {
  'use strict';
  const { h, pct, fCorta, chip, barra, ETIQ_ACT, formulario, modal, cerrarModal, aviso, confirmar } = UI;

  function editar(app, a) {
    const nueva = !a;
    a = a || { clave: siguienteClave(), nombre: '', inicio: app.fecha, fin: Calc.sumarDias(app.fecha, 7) };
    formulario(nueva ? 'Nueva actividad' : 'Editar actividad', [
      { nombre: 'clave', etiqueta: 'Clave', valor: a.clave, requerido: true },
      { nombre: 'nombre', etiqueta: 'Descripción', valor: a.nombre, requerido: true },
      { nombre: 'inicio', etiqueta: 'Inicio', tipo: 'date', valor: a.inicio, requerido: true },
      { nombre: 'fin', etiqueta: 'Término', tipo: 'date', valor: a.fin, requerido: true },
    ], (d) => {
      if (d.fin < d.inicio) { aviso('El término no puede ser antes del inicio.'); return false; }
      Store.cambiar((s) => {
        if (nueva) s.actividades.push(Object.assign({ id: Store.uid(), avances: [] }, d));
        else Object.assign(s.actividades.find((x) => x.id === a.id), d);
      });
      aviso(nueva ? 'Actividad agregada' : 'Actividad actualizada');
      app.render();
    });
  }

  function siguienteClave() {
    const nums = Store.s.actividades.map((a) => Number(String(a.clave).replace(/\D/g, '')) || 0);
    return 'A-' + String((nums.length ? Math.max(...nums) : 0) + 1).padStart(3, '0');
  }

  function registrarAvance(app, a) {
    const actual = Calc.avanceReal(a, app.fecha);
    formulario(`Avance · ${a.clave}`, [
      { nombre: 'fecha', etiqueta: 'Fecha', tipo: 'date', valor: app.fecha, requerido: true },
      { nombre: 'pct', etiqueta: `Avance acumulado (%) — actual ${Math.round(actual)}%`, tipo: 'number', valor: Math.round(actual), requerido: true },
    ], (d) => {
      if (d.pct < 0 || d.pct > 100) { aviso('El avance va de 0 a 100.'); return false; }
      Store.cambiar((s) => {
        const act = s.actividades.find((x) => x.id === a.id);
        act.avances = act.avances.filter((r) => r.fecha !== d.fecha); // un registro por día
        act.avances.push({ fecha: d.fecha, pct: d.pct });
      });
      aviso('Avance registrado');
      app.render();
    }, 'Registrar avance');
  }

  function detalle(app, a) {
    const e = Calc.estadoActividad(a, app.fecha, Store.s.ajustes.umbrales);
    const hist = [...(a.avances || [])].sort((p, q) => (p.fecha < q.fecha ? 1 : -1));
    modal(`${a.clave} ${a.nombre}`, [
      h('div.resumen-caja',
        h('div', h('div.peque.tenue', 'Real'), h('div.kpi-grande', pct(Math.round(e.real)))),
        h('div', h('div.peque.tenue', 'Programado'), h('div.kpi-grande', pct(Math.round(e.prog)))),
        h('div', h('div.peque.tenue', 'Estado'), chip(e.estado, ETIQ_ACT[e.estado]))),
      h('p.peque.tenue', `${fCorta(a.inicio)} – ${fCorta(a.fin)} · ${e.duracion} día(s)`),
      h('h4', 'Historial de avances'),
      hist.length ? hist.map((r) => h('div.fila-mov', h('span', fCorta(r.fecha)), h('b', r.pct + '%'))) : h('p.tenue', 'Sin avances registrados.'),
    ], [
      h('button.btn.btn-oro', { onclick: () => { cerrarModal(); registrarAvance(app, a); } }, '+ Avance'),
      h('button.btn.btn-borde', { onclick: () => { cerrarModal(); editar(app, a); } }, '✏ Editar'),
      h('button.btn.btn-borde.rojo', { onclick: () => confirmar(`¿Eliminar ${a.clave}? Se borra su historial de avances.`, () => {
        Store.cambiar((s) => { s.actividades = s.actividades.filter((x) => x.id !== a.id); });
        app.render();
      }) }, '🗑 Eliminar'),
    ]);
  }

  function vista(app, params) {
    const st = Store.s, hoy = app.fecha;
    const filtro = params.filtro || 'todas';
    const lista = st.actividades
      .map((a) => ({ a, e: Calc.estadoActividad(a, hoy, st.ajustes.umbrales) }))
      .filter((x) => filtro === 'todas' || x.e.estado === filtro)
      .sort((p, q) => (p.a.inicio < q.a.inicio ? -1 : p.a.inicio > q.a.inicio ? 1 : p.a.clave > q.a.clave ? 1 : -1));

    if (params.abrir) {
      const a = st.actividades.find((x) => x.id === params.abrir);
      delete params.abrir;
      if (a) setTimeout(() => detalle(app, a));
    }

    // Diagrama de barras (Gantt simple) sobre el plazo de la obra.
    const plazo = Calc.diasEntre(st.obra.inicio, st.obra.fin) + 1;
    const pos = (f) => Math.max(0, Math.min(100, (Calc.diasEntre(st.obra.inicio, f) / plazo) * 100));

    return h('div.vista',
      h('h2', 'PROGRAMA DE OBRA'),
      h('div.rejilla2',
        h('button.btn.btn-oscuro', { onclick: () => editar(app) }, '+ Actividad'),
        h('button.btn.btn-borde', { onclick: () => app.ir('reporte') }, '📄 Reporte')),
      h('div.filtros', ['todas', 'atrasada', 'atencion', 'en-tiempo', 'adelantada', 'por-iniciar', 'terminada'].map((k) =>
        h('button.filtro' + (k === filtro ? '.activo' : ''), { onclick: () => app.ir('programa', { filtro: k }) }, k === 'todas' ? 'Todas' : ETIQ_ACT[k]))),
      lista.length ? null : h('p.tenue.centro', 'No hay actividades con este filtro.'),
      lista.map(({ a, e }) => h('div.tarjeta.act',
        h('button.fila-act', { onclick: () => detalle(app, a) },
          h('div.fila-tit', h('b', `${a.clave} ${a.nombre}`), chip(e.estado, ETIQ_ACT[e.estado])),
          barra(e.real, e.prog, e.estado),
          h('div.peque.tenue', `Real ${pct(Math.round(e.real))} · Prog. ${pct(Math.round(e.prog))} · ${fCorta(a.inicio)}–${fCorta(a.fin)}`),
          h('div.gantt', h('div.gantt-barra.' + e.estado, { style: { left: pos(a.inicio) + '%', width: Math.max(1.5, pos(Calc.sumarDias(a.fin, 1)) - pos(a.inicio)) + '%' } }),
            h('div.gantt-hoy', { style: { left: pos(hoy) + '%' } }))),
        h('button.btn.btn-oro.btn-chico', { onclick: () => registrarAvance(app, a) }, '+ Avance'))));
  }

  window.Vistas.programa = { titulo: 'Programa', icono: '☰', render: vista };
})();
