/* Asistencia: pase de lista diario, alta de trabajadores y raya semanal. */
(function () {
  'use strict';
  const { h, fCorta, fLarga, dinero, formulario, aviso, confirmar } = UI;

  const ESTADOS = [['P', 'Presente'], ['R', 'Retardo'], ['F', 'Falta']];

  function editarTrabajador(app, t) {
    const nuevo = !t;
    t = t || { nombre: '', puesto: 'Albañil', salarioDia: 0, activo: true };
    formulario(nuevo ? 'Nuevo trabajador' : 'Editar trabajador', [
      { nombre: 'nombre', etiqueta: 'Nombre', valor: t.nombre, requerido: true },
      { nombre: 'puesto', etiqueta: 'Puesto', valor: t.puesto },
      { nombre: 'salarioDia', etiqueta: 'Salario por día ($)', tipo: 'number', valor: t.salarioDia },
      { nombre: 'activo', etiqueta: 'Activo en la obra', tipo: 'checkbox', valor: t.activo !== false },
    ], (d) => {
      Store.cambiar((s) => {
        if (nuevo) s.trabajadores.push(Object.assign({ id: Store.uid() }, d));
        else Object.assign(s.trabajadores.find((x) => x.id === t.id), d);
      });
      app.render();
    });
  }

  function marcar(app, fecha, id, valor) {
    Store.cambiar((s) => {
      s.asistencia[fecha] = s.asistencia[fecha] || {};
      if (s.asistencia[fecha][id] === valor) delete s.asistencia[fecha][id];
      else s.asistencia[fecha][id] = valor;
    });
    app.render();
  }

  // Lunes de la semana de una fecha.
  function lunes(f) {
    const d = Calc.aFecha(f).getDay();
    return Calc.sumarDias(f, -((d + 6) % 7));
  }

  function vista(app, params) {
    const st = Store.s;
    const fecha = params.fecha || app.fecha;
    const reg = st.asistencia[fecha] || {};
    const activos = st.trabajadores.filter((t) => t.activo !== false);
    const res = Calc.resumenAsistencia(st.trabajadores, reg);
    const ini = lunes(fecha), fin = Calc.sumarDias(ini, 6);
    const raya = Calc.raya(activos, st.asistencia, ini, fin);
    const total = raya.reduce((t, r) => t + r.importe, 0);

    const selFecha = h('input', { type: 'date', value: fecha, onchange: (e) => app.ir('asistencia', { fecha: e.target.value }) });

    return h('div.vista',
      h('h2', 'ASISTENCIA'),
      h('div.tarjeta',
        h('label.campo', h('span', 'Fecha'), selFecha),
        h('div.peque.tenue', fLarga(fecha)),
        h('div.rejilla3.mt',
          h('div.kpi', h('div.kpi-num.verde', res.presentes), h('div.kpi-txt', 'Presentes')),
          h('div.kpi', h('div.kpi-num.ambar', res.retardos), h('div.kpi-txt', 'Retardos')),
          h('div.kpi', h('div.kpi-num.rojo', res.faltas), h('div.kpi-txt', 'Faltas')))),
      h('div.rejilla2',
        h('button.btn.btn-oscuro', { onclick: () => {
          Store.cambiar((s) => { s.asistencia[fecha] = s.asistencia[fecha] || {}; activos.forEach((t) => { if (!s.asistencia[fecha][t.id]) s.asistencia[fecha][t.id] = 'P'; }); });
          aviso('Todos los pendientes marcados presentes'); app.render();
        } }, '✔ Todos presentes'),
        h('button.btn.btn-borde', { onclick: () => editarTrabajador(app) }, '+ Trabajador')),
      activos.length ? null : h('p.tenue.centro', 'Aún no hay trabajadores. Agrega el primero con “+ Trabajador”.'),
      activos.map((t) => h('div.tarjeta.trab',
        h('button.trab-nombre', { onclick: () => editarTrabajador(app, t) }, h('b', t.nombre), h('div.peque.tenue', t.puesto || '')),
        h('div.segmentos', ESTADOS.map(([v, txt]) => h('button.seg.seg-' + v + (reg[t.id] === v ? '.activo' : ''), { onclick: () => marcar(app, fecha, t.id, v), 'aria-pressed': reg[t.id] === v }, txt))))),
      h('section.tarjeta',
        h('h3', `Raya semanal · ${fCorta(ini)} – ${fCorta(fin)}`),
        raya.map((r) => h('div.fila-mov', h('div.crece', h('b', r.nombre), h('div.peque.tenue', `${r.puesto || ''} · ${r.dias} día(s)`)), h('b', dinero(r.importe)))),
        h('div.fila-mov.total', h('div.crece', h('b', 'Total')), h('b', dinero(total))),
        h('p.peque.tenue', 'Retardos cuentan como día trabajado.')),
      st.trabajadores.some((t) => t.activo === false) ? h('section.tarjeta', h('h3', 'Inactivos'),
        st.trabajadores.filter((t) => t.activo === false).map((t) => h('div.fila-mov', h('div.crece', t.nombre),
          h('button.btn.btn-borde.btn-chico', { onclick: () => editarTrabajador(app, t) }, 'Editar'),
          h('button.btn-icono', { 'aria-label': 'Eliminar', onclick: () => confirmar(`¿Eliminar a ${t.nombre}?`, () => { Store.cambiar((s) => { s.trabajadores = s.trabajadores.filter((x) => x.id !== t.id); }); app.render(); }) }, '×')))) : null);
  }

  window.Vistas.asistencia = { titulo: 'Asistencia', icono: '☑', render: vista };
})();
