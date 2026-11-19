/* Diario (bitácora): notas por día, clima, fotos y pendientes. */
(function () {
  'use strict';
  const { h, fCorta, fLarga, modal, cerrarModal, aviso, confirmar } = UI;
  const CLIMAS = ['Soleado', 'Nublado', 'Lluvia ligera', 'Lluvia fuerte', 'Viento', 'Calor extremo'];

  function editar(app, nota) {
    const nueva = !nota;
    nota = nota || { fecha: app.fecha, clima: 'Soleado', texto: '', fotos: [], pendiente: false, actividad: '' };
    const fotos = [...(nota.fotos || [])];
    const nuevas = [];
    const galeria = h('div.galeria');
    const pintar = () => {
      galeria.replaceChildren(...fotos.map((id) => h('div.mini',
        Fotos.pintar(h('img', { alt: 'Foto' }), id),
        h('button.mini-x', { type: 'button', 'aria-label': 'Quitar foto', onclick: () => { fotos.splice(fotos.indexOf(id), 1); pintar(); } }, '×'))));
    };
    pintar();
    const archivo = h('input', { type: 'file', accept: 'image/*', capture: 'environment', multiple: true, hidden: true, onchange: async (e) => {
      for (const f of e.target.files) {
        try { const id = await Fotos.guardar(f); fotos.push(id); nuevas.push(id); } catch (err) { aviso('No se pudo guardar una foto.'); }
      }
      archivo.value = '';
      pintar();
    } });
    const fecha = h('input', { type: 'date', value: nota.fecha });
    const clima = h('select', CLIMAS.map((c) => h('option', { selected: c === nota.clima }, c)));
    const act = h('select', [h('option', { value: '' }, '— general —'), ...Store.s.actividades.map((a) => h('option', { value: a.clave, selected: a.clave === nota.actividad }, `${a.clave} ${a.nombre}`))]);
    const texto = h('textarea', { rows: 5, placeholder: '¿Qué pasó hoy en la obra?', value: nota.texto });
    const pend = h('input', { type: 'checkbox', checked: nota.pendiente });

    const fondo = modal(nueva ? 'Nueva nota' : 'Editar nota', [
      h('label.campo', h('span', 'Fecha'), fecha),
      h('label.campo', h('span', 'Clima'), clima),
      h('label.campo', h('span', 'Actividad'), act),
      h('label.campo', h('span', 'Nota'), texto),
      h('label.campo.campo-check', h('span', 'Marcar como pendiente'), pend),
      galeria, archivo,
      h('button.btn.btn-borde.ancho', { type: 'button', onclick: () => archivo.click() }, '📷 Agregar fotos'),
    ], [
      h('button.btn.btn-oscuro', { onclick: () => {
        if (!texto.value.trim() && !fotos.length) return aviso('Escribe una nota o agrega una foto.');
        const quitadas = (nota.fotos || []).filter((id) => !fotos.includes(id));
        quitadas.forEach((id) => Fotos.borrar(id));
        const datos = { fecha: fecha.value, clima: clima.value, actividad: act.value, texto: texto.value.trim(), fotos, pendiente: pend.checked };
        Store.cambiar((s) => {
          if (nueva) s.diario.push(Object.assign({ id: Store.uid() }, datos));
          else Object.assign(s.diario.find((x) => x.id === nota.id), datos);
        });
        nuevas.length = 0;
        cerrarModal(); aviso('Nota guardada'); app.render();
      } }, 'Guardar'),
    ]);
    // Si se cierra sin guardar, borrar fotos recién subidas.
    new MutationObserver((_, obs) => { if (!document.body.contains(fondo)) { nuevas.forEach((id) => Fotos.borrar(id)); obs.disconnect(); } })
      .observe(document.body, { childList: true });
  }

  function verFoto(id) {
    modal('Foto', Fotos.pintar(h('img.foto-grande', { alt: 'Foto de obra' }), id));
  }

  function vista(app, params) {
    const st = Store.s;
    if (params.nueva) { delete params.nueva; setTimeout(() => editar(app)); }
    const soloPend = !!params.pendientes;
    const notas = st.diario.filter((n) => !soloPend || n.pendiente).sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));
    const porDia = {};
    notas.forEach((n) => (porDia[n.fecha] = porDia[n.fecha] || []).push(n));

    return h('div.vista',
      h('h2', 'DIARIO DE OBRA'),
      h('div.rejilla2',
        h('button.btn.btn-oro', { onclick: () => editar(app) }, '📷 Nueva nota / foto'),
        h('button.btn.btn-borde' + (soloPend ? '.activo' : ''), { onclick: () => app.ir('diario', { pendientes: !soloPend }) }, soloPend ? 'Ver todas' : `Pendientes (${st.diario.filter((n) => n.pendiente).length})`)),
      notas.length ? null : h('p.tenue.centro', soloPend ? 'No hay pendientes. 👍' : 'Aún no hay notas. Registra lo que pasa en la obra cada día.'),
      Object.entries(porDia).map(([fecha, lista]) => h('section.tarjeta',
        h('h3', fLarga(fecha)),
        lista.map((n) => h('div.nota' + (n.pendiente ? '.pendiente' : ''),
          h('div.fila-tit',
            h('div.peque.tenue', [n.clima, n.actividad].filter(Boolean).join(' · ')),
            h('div.acciones-mini',
              n.pendiente ? h('button.chip.atencion', { onclick: () => { Store.cambiar((s) => { s.diario.find((x) => x.id === n.id).pendiente = false; }); aviso('Pendiente resuelto'); app.render(); } }, 'Pendiente ✓') : null,
              h('button.btn-icono', { 'aria-label': 'Editar', onclick: () => editar(app, n) }, '✏'),
              h('button.btn-icono', { 'aria-label': 'Eliminar', onclick: () => confirmar('¿Eliminar esta nota y sus fotos?', () => {
                (n.fotos || []).forEach((id) => Fotos.borrar(id));
                Store.cambiar((s) => { s.diario = s.diario.filter((x) => x.id !== n.id); }); app.render();
              }) }, '×'))),
          n.texto ? h('p', n.texto) : null,
          (n.fotos || []).length ? h('div.galeria', n.fotos.map((id) => h('button.mini', { onclick: () => verFoto(id) }, Fotos.pintar(h('img', { alt: 'Foto ' + fCorta(n.fecha) }), id)))) : null)))));
  }

  window.Vistas.diario = { titulo: 'Diario', icono: '◉', render: vista };
})();
