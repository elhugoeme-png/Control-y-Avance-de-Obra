/* Inventario: materiales, entradas/salidas, kárdex, conteo físico y pedido sugerido. */
(function () {
  'use strict';
  const { h, num, fCorta, chip, barra, ETIQ_MAT, formulario, modal, cerrarModal, aviso, confirmar } = UI;

  const opc = () => ({ ventana: Store.s.ajustes.ventanaConsumo, diasAviso: Store.s.ajustes.diasAviso });
  const matPorId = (id) => Store.s.materiales.find((m) => m.id === id);
  const CLASE_BARRA = { 'bajo-minimo': 'atrasada', 'por-llegar': 'atencion', suficiente: 'terminada' };

  function movimiento(app, tipo, matId) {
    const st = Store.s;
    if (!st.materiales.length) return aviso('Primero agrega un material.');
    const refs = [['', '— sin actividad —'], ...st.actividades.map((a) => [a.clave, `${a.clave} ${a.nombre}`])];
    formulario(tipo === 'entrada' ? '📥 Entrada de material' : '📤 Salida de material', [
      { nombre: 'matId', etiqueta: 'Material', tipo: 'select', valor: matId, opciones: st.materiales.map((m) => [m.id, `${m.nombre} (${m.unidad})`]) },
      { nombre: 'cant', etiqueta: 'Cantidad', tipo: 'number', requerido: true },
      { nombre: 'fecha', etiqueta: 'Fecha', tipo: 'date', valor: app.fecha, requerido: true },
      tipo === 'salida'
        ? { nombre: 'ref', etiqueta: 'Actividad destino', tipo: 'select', opciones: refs, valor: '' }
        : { nombre: 'ref', etiqueta: 'Proveedor / remisión', valor: '' },
    ], (d) => {
      if (!(d.cant > 0)) { aviso('La cantidad debe ser mayor a cero.'); return false; }
      if (tipo === 'salida') {
        const ex = Calc.existencia(d.matId, st.movimientos);
        if (d.cant > ex) { aviso(`Solo hay ${num(ex)} en existencia.`); return false; }
      }
      Store.cambiar((s) => s.movimientos.push(Object.assign({ id: Store.uid(), tipo }, d)));
      aviso(tipo === 'entrada' ? 'Entrada registrada' : 'Salida registrada');
      app.render();
    }, tipo === 'entrada' ? 'Registrar entrada' : 'Registrar salida');
  }

  function editarMaterial(app, m) {
    const nuevo = !m;
    m = m || { nombre: '', unidad: 'pza', minimo: 0, maximo: null };
    const campos = [
      { nombre: 'nombre', etiqueta: 'Nombre', valor: m.nombre, requerido: true },
      { nombre: 'unidad', etiqueta: 'Unidad (pza, m³, bulto, kg…)', valor: m.unidad, requerido: true },
      { nombre: 'minimo', etiqueta: 'Mínimo', tipo: 'number', valor: m.minimo, requerido: true },
      { nombre: 'maximo', etiqueta: 'Máximo (para pedido sugerido)', tipo: 'number', valor: m.maximo },
    ];
    if (nuevo) campos.push({ nombre: 'inicial', etiqueta: 'Existencia inicial', tipo: 'number', valor: 0 });
    formulario(nuevo ? 'Nuevo material' : 'Editar material', campos, (d) => {
      const inicial = d.inicial; delete d.inicial;
      Store.cambiar((s) => {
        if (nuevo) {
          const id = Store.uid();
          s.materiales.push(Object.assign({ id }, d));
          if (inicial > 0) s.movimientos.push({ id: Store.uid(), matId: id, tipo: 'entrada', cant: inicial, fecha: app.fecha, ref: 'Existencia inicial' });
        } else Object.assign(s.materiales.find((x) => x.id === m.id), d);
      });
      app.render();
    });
  }

  function conteo(app, m) {
    const ex = Calc.existencia(m.id, Store.s.movimientos);
    formulario(`Conteo físico · ${m.nombre}`, [
      { nombre: 'contado', etiqueta: `Cantidad contada (sistema: ${num(ex)} ${m.unidad})`, tipo: 'number', valor: ex, requerido: true },
    ], (d) => {
      const dif = Math.round((d.contado - ex) * 1000) / 1000;
      if (dif === 0) { aviso('Sin diferencias.'); return; }
      Store.cambiar((s) => s.movimientos.push({ id: Store.uid(), matId: m.id, tipo: 'ajuste', cant: dif, fecha: app.fecha, ref: 'Conteo físico' }));
      aviso(`Ajuste de ${dif > 0 ? '+' : ''}${num(dif)} ${m.unidad}`);
      app.render();
    }, 'Ajustar existencia');
  }

  function detalle(app, m) {
    const st = Store.s, e = Calc.estadoMaterial(m, st.movimientos, app.fecha, opc());
    const ents = st.movimientos.filter((x) => x.matId === m.id && x.tipo === 'entrada').reduce((t, x) => t + x.cant, 0);
    const sals = st.movimientos.filter((x) => x.matId === m.id && x.tipo === 'salida').reduce((t, x) => t + x.cant, 0);
    const movs = st.movimientos.filter((x) => x.matId === m.id).sort((p, q) => (p.fecha < q.fecha ? 1 : -1));
    modal(m.nombre, [
      h('div.resumen-caja',
        h('div', h('div.peque.tenue', 'Existencia'), h('div.kpi-grande', `${num(e.exist)} ${m.unidad}`)),
        h('div', h('div.peque.tenue', 'Estado'), chip(e.estado, ETIQ_MAT[e.estado]))),
      h('p.peque.tenue', `Mínimo ${num(m.minimo)} · Máximo ${m.maximo ? num(m.maximo) : '—'} · Entradas ${num(ents)} · Salidas ${num(sals)} · Consumo ≈ ${num(e.consumo)}/día (últimos ${st.ajustes.ventanaConsumo} días) · Alcanza ≈ ${isFinite(e.alcanza) ? e.alcanza + ' días' : 'sin consumo'}`),
      h('h4', 'Movimientos (kárdex)'),
      movs.length ? movs.map((x) => filaMov(x, m, false)) : h('p.tenue', 'Sin movimientos.'),
    ], [
      h('button.btn.btn-oro', { onclick: () => { cerrarModal(); movimiento(app, 'entrada', m.id); } }, '📥 Entrada'),
      h('button.btn.btn-oscuro', { onclick: () => { cerrarModal(); movimiento(app, 'salida', m.id); } }, '📤 Salida'),
      h('button.btn.btn-borde', { onclick: () => { cerrarModal(); conteo(app, m); } }, '🔢 Conteo físico'),
      h('button.btn.btn-borde', { onclick: () => { cerrarModal(); editarMaterial(app, m); } }, '✏ Editar'),
      h('button.btn.btn-borde.rojo', { onclick: () => confirmar(`¿Eliminar ${m.nombre} y todos sus movimientos?`, () => {
        Store.cambiar((s) => { s.materiales = s.materiales.filter((x) => x.id !== m.id); s.movimientos = s.movimientos.filter((x) => x.matId !== m.id); });
        app.render();
      }) }, '🗑'),
    ]);
  }

  function filaMov(x, m, conNombre) {
    const signo = x.tipo === 'salida' ? '−' : x.cant >= 0 ? '+' : '−';
    const etiqueta = { entrada: 'Entrada', salida: 'Salida', ajuste: 'Ajuste' }[x.tipo];
    return h('div.fila-mov',
      chip('mov-' + x.tipo, etiqueta),
      h('div.crece', h('b', `${signo}${num(Math.abs(x.cant))} ${m ? m.unidad : ''}`, conNombre && m ? ' ' + m.nombre : ''),
        h('div.peque.tenue', [fCorta(x.fecha), x.ref].filter(Boolean).join(' · '))),
      h('button.btn-icono', { title: 'Eliminar movimiento', 'aria-label': 'Eliminar movimiento', onclick: () => confirmar('¿Eliminar este movimiento?', () => {
        Store.cambiar((s) => { s.movimientos = s.movimientos.filter((y) => y.id !== x.id); });
        cerrarModal(); window.App.render();
      }) }, '×'));
  }

  function pedido(app) {
    const st = Store.s;
    const lista = st.materiales.map((m) => ({ m, e: Calc.estadoMaterial(m, st.movimientos, app.fecha, opc()) })).filter((x) => x.e.pedido > 0);
    const texto = `Pedido de material · ${st.obra.nombre}\n${UI.fLarga(app.fecha)}\n\n` +
      lista.map((x) => `• ${x.m.nombre}: ${num(x.e.pedido, 0)} ${x.m.unidad}`).join('\n');
    modal('🛒 Pedido sugerido', [
      lista.length ? h('div', lista.map((x) => h('div.fila-mov', h('div.crece', h('b', x.m.nombre), h('div.peque.tenue', `Existencia ${num(x.e.exist)} · llevar a ${num(x.m.maximo || x.m.minimo * 2)}`)), h('b', `${num(x.e.pedido, 0)} ${x.m.unidad}`))))
        : h('p.tenue', 'No hay materiales por pedir.'),
      h('p.peque.tenue', 'Cantidad para llegar al máximo (o al doble del mínimo si no hay máximo).'),
    ], lista.length ? [
      h('button.btn.btn-oscuro', { onclick: () => copiar(texto) }, '📋 Copiar'),
      h('a.btn.btn-oro', { href: 'https://wa.me/?text=' + encodeURIComponent(texto), target: '_blank', rel: 'noopener' }, 'WhatsApp'),
    ] : null);
  }

  function copiar(t) {
    (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => aviso('Pedido copiado'), () => aviso('No se pudo copiar'));
  }

  function vista(app, params) {
    const st = Store.s;
    const q = (params.q || '').toLowerCase();
    const items = st.materiales
      .map((m) => ({ m, e: Calc.estadoMaterial(m, st.movimientos, app.fecha, opc()) }))
      .filter((x) => !q || x.m.nombre.toLowerCase().includes(q))
      .sort((p, q2) => ({ 'bajo-minimo': 0, 'por-llegar': 1, suficiente: 2 }[p.e.estado] - { 'bajo-minimo': 0, 'por-llegar': 1, suficiente: 2 }[q2.e.estado]));
    const enMinimo = st.materiales.filter((m) => Calc.estadoMaterial(m, st.movimientos, app.fecha, opc()).estado !== 'suficiente').length;
    const ultimos = [...st.movimientos].sort((p, q2) => (p.fecha < q2.fecha ? 1 : p.fecha > q2.fecha ? -1 : 0)).slice(0, 15);

    if (params.mov) { const t = params.mov; delete params.mov; setTimeout(() => movimiento(app, t)); }

    const buscador = h('input.buscar', { type: 'search', placeholder: '🔍 Buscar material…', value: params.q || '' });
    buscador.addEventListener('input', () => { params.q = buscador.value; app.render(true); });

    return h('div.vista',
      h('h2', 'INVENTARIO DE MATERIALES'),
      enMinimo ? h('div.alerta.alerta-roja', `⚠ ${enMinimo} material(es) en o cerca de su mínimo. Haz el pedido a tiempo. `,
        h('button.btn.btn-oscuro.btn-chico', { onclick: () => pedido(app) }, '🛒 Pedido sugerido')) : null,
      h('div.rejilla2',
        h('button.btn.btn-oro', { onclick: () => movimiento(app, 'entrada') }, '📥 Entrada'),
        h('button.btn.btn-oscuro', { onclick: () => movimiento(app, 'salida') }, '📤 Salida'),
        h('button.btn.btn-borde', { onclick: () => editarMaterial(app) }, '+ Material'),
        h('button.btn.btn-borde', { onclick: () => pedido(app) }, '🛒 Pedido')),
      buscador,
      items.map(({ m, e }) => h('button.tarjeta.mat.borde-' + e.estado, { onclick: () => detalle(app, m) },
        h('div.fila-tit', h('div', h('b', m.nombre), h('div.peque.tenue', `Mínimo ${num(m.minimo)} ${m.unidad} · consumo ≈ ${num(e.consumo)}/día`)),
          h('div.derecha', h('div.kpi-grande.' + (e.estado === 'bajo-minimo' ? 'rojo' : ''), num(e.exist)), h('div.peque.tenue', m.unidad))),
        barra(m.maximo ? (e.exist / m.maximo) * 100 : Math.min(100, (e.exist / (m.minimo * 3 || 1)) * 100), m.maximo ? (m.minimo / m.maximo) * 100 : 33.3, CLASE_BARRA[e.estado]),
        h('div.peque', chip(e.estado, ETIQ_MAT[e.estado]), h('span.tenue', ' · alcanza para ≈ ' + (isFinite(e.alcanza) ? `${e.alcanza} día(s)` : 'sin consumo reciente'))))),
      h('section.tarjeta', h('h3', 'Últimos movimientos'),
        ultimos.length ? ultimos.map((x) => filaMov(x, matPorId(x.matId), true)) : h('p.tenue', 'Aún no hay movimientos.')));
  }

  window.Vistas.inventario = { titulo: 'Inventario', icono: '⬡', render: vista, alerta: () => {
    const st = Store.s;
    return st.materiales.filter((m) => Calc.estadoMaterial(m, st.movimientos, window.App.fecha, opc()).estado === 'bajo-minimo').length;
  } };
})();
