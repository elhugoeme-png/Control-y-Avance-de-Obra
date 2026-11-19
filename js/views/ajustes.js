/* Ajustes: datos de la obra, criterios de semáforo, respaldo y obra nueva. */
(function () {
  'use strict';
  const { h, formulario, aviso, confirmar } = UI;

  function datosObra(app) {
    const o = Store.s.obra;
    formulario('Datos de la obra', [
      { nombre: 'nombre', etiqueta: 'Nombre de la obra', valor: o.nombre, requerido: true },
      { nombre: 'contrato', etiqueta: 'Contrato', valor: o.contrato },
      { nombre: 'ubicacion', etiqueta: 'Ubicación', valor: o.ubicacion },
      { nombre: 'cliente', etiqueta: 'Cliente', valor: o.cliente },
      { nombre: 'residente', etiqueta: 'Residente', valor: o.residente },
      { nombre: 'inicio', etiqueta: 'Inicio', tipo: 'date', valor: o.inicio, requerido: true },
      { nombre: 'fin', etiqueta: 'Término', tipo: 'date', valor: o.fin, requerido: true },
    ], (d) => {
      if (d.fin < d.inicio) { aviso('El término no puede ser antes del inicio.'); return false; }
      Store.cambiar((s) => Object.assign(s.obra, d)); app.render();
    });
  }

  function criterios(app) {
    const a = Store.s.ajustes;
    formulario('Criterios', [
      { nombre: 'adelantada', etiqueta: 'Adelantada si real supera al programado por (pts)', tipo: 'number', valor: a.umbrales.adelantada },
      { nombre: 'atencion', etiqueta: '“Atención” si va atrás por (pts)', tipo: 'number', valor: a.umbrales.atencion },
      { nombre: 'atrasada', etiqueta: '“Atrasada” si va atrás por (pts)', tipo: 'number', valor: a.umbrales.atrasada },
      { nombre: 'ventanaConsumo', etiqueta: 'Días para promediar consumo', tipo: 'number', valor: a.ventanaConsumo },
      { nombre: 'diasAviso', etiqueta: 'Avisar cuando falten (días) para el mínimo', tipo: 'number', valor: a.diasAviso },
    ], (d) => {
      Store.cambiar((s) => {
        s.ajustes.umbrales = { adelantada: d.adelantada, atencion: d.atencion, atrasada: Math.max(d.atrasada, d.atencion) };
        s.ajustes.ventanaConsumo = Math.max(1, d.ventanaConsumo || 14);
        s.ajustes.diasAviso = Math.max(0, d.diasAviso || 0);
      });
      app.render();
    });
  }

  async function exportar() {
    const ids = Store.s.diario.flatMap((n) => n.fotos || []);
    const fotos = await Fotos.exportar(ids).catch(() => ({}));
    const blob = new Blob([JSON.stringify({ datos: Store.s, fotos })], { type: 'application/json' });
    const a = h('a', { href: URL.createObjectURL(blob), download: `respaldo_${Store.s.obra.nombre.replace(/[^\w-]+/g, '_')}_${Store.hoy()}.json` });
    document.body.append(a); a.click(); a.remove();
    aviso('Respaldo descargado');
  }

  function importar(app) {
    const input = h('input', { type: 'file', accept: '.json,application/json', onchange: async () => {
      try {
        const obj = JSON.parse(await input.files[0].text());
        const datos = obj.datos || obj;
        if (!datos.obra || !Array.isArray(datos.actividades)) throw new Error('formato');
        confirmar('Esto reemplaza la obra actual con el respaldo. ¿Continuar?', async () => {
          await Fotos.importar(obj.fotos);
          Store.reemplazar(datos); aviso('Respaldo restaurado'); app.ir('tablero');
        });
      } catch (e) { aviso('El archivo no es un respaldo válido.'); }
    } });
    input.click();
  }

  function vista(app) {
    const o = Store.s.obra;
    return h('div.vista',
      h('h2', 'AJUSTES'),
      h('section.tarjeta', h('h3', 'Obra'),
        h('p', h('b', o.nombre), h('br'), h('span.peque.tenue', [o.contrato, o.ubicacion, `${UI.fCorta(o.inicio)} – ${UI.fCorta(o.fin)}`].filter(Boolean).join(' · '))),
        h('button.btn.btn-borde.ancho', { onclick: () => datosObra(app) }, '✏ Editar datos de la obra'),
        h('button.btn.btn-borde.ancho', { onclick: () => criterios(app) }, '⚙ Criterios de semáforo e inventario')),
      h('section.tarjeta', h('h3', 'Respaldo'),
        h('p.peque.tenue', 'Los datos viven en este dispositivo. Descarga un respaldo seguido (incluye fotos) y guárdalo en Drive o en tu PC.'),
        h('button.btn.btn-oscuro.ancho', { onclick: exportar }, '⬇ Descargar respaldo'),
        h('button.btn.btn-borde.ancho', { onclick: () => importar(app) }, '⬆ Restaurar respaldo')),
      h('section.tarjeta', h('h3', 'Empezar'),
        h('button.btn.btn-oro.ancho', { onclick: () => confirmar('Se borra la obra actual (descarga antes un respaldo si la necesitas). ¿Crear obra nueva?', () => {
          Store.reemplazar(Store.vacio()); app.ir('ajustes'); setTimeout(() => datosObra(app));
        }) }, '🏗 Nueva obra'),
        h('button.btn.btn-borde.ancho', { onclick: () => confirmar('Se reemplaza la obra actual por la de ejemplo. ¿Continuar?', () => { Store.reemplazar(Store.ejemplo()); app.ir('tablero'); }) }, 'Cargar obra de ejemplo')),
      h('p.peque.tenue.centro', 'JCC Control de Obra · v1.0'));
  }

  window.Vistas.ajustes = { titulo: 'Ajustes', icono: '⚙', render: vista, oculta: true };
})();
