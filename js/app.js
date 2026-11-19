/* Arranque, navegación por hash (#tablero, #inventario…) y barra inferior. */
(function () {
  'use strict';
  const { h } = UI;
  const ORDEN = ['tablero', 'asistencia', 'diario', 'programa', 'inventario', 'reporte'];
  const params = {};

  const App = {
    fecha: Store.hoy(),
    actual: 'tablero',
    ir(vista, p) {
      params[vista] = Object.assign({}, p || {});
      if (location.hash !== '#' + vista) location.hash = vista; // dispara render por hashchange
      else App.render();
      window.scrollTo(0, 0);
    },
    render(conservarFoco) {
      App.fecha = Store.hoy();
      const nombre = Vistas[App.actual] ? App.actual : 'tablero';
      const activo = document.activeElement;
      const selFoco = conservarFoco && activo && activo.classList.contains('buscar') ? '.buscar' : null;
      const pos = selFoco ? activo.selectionStart : 0;

      const main = document.getElementById('principal');
      main.replaceChildren(Vistas[nombre].render(App, params[nombre] = params[nombre] || {}));
      cabecera();
      barra(nombre);
      if (selFoco) { const el = main.querySelector(selFoco); if (el) { el.focus(); el.setSelectionRange(pos, pos); } }
    },
  };
  window.App = App;

  function cabecera() {
    const o = Store.s.obra;
    document.getElementById('cabecera').replaceChildren(
      h('button.cab-logo', { onclick: () => App.ir('tablero'), 'aria-label': 'Ir al tablero' }, '⌂'),
      h('div.cab-txt', h('div.cab-tit', 'JCC CONTROL DE OBRA'), h('div.cab-sub', [o.nombre, o.contrato].filter(Boolean).join(' · '))),
      h('button.cab-btn', { onclick: () => App.ir('ajustes'), 'aria-label': 'Ajustes' }, '⚙'));
  }

  function barra(actual) {
    document.getElementById('barra').replaceChildren(...ORDEN.map((k) => {
      const v = Vistas[k];
      const n = v.alerta ? v.alerta() : 0;
      return h('button.nav' + (k === actual ? '.activo' : ''), { onclick: () => App.ir(k), 'aria-current': k === actual ? 'page' : null },
        h('span.nav-ico', v.icono, n ? h('span.nav-badge', n) : null), h('span.nav-txt', v.titulo));
    }));
  }

  function desdeHash() {
    App.actual = (location.hash || '#tablero').slice(1);
    App.render();
  }

  Store.cargar();
  window.addEventListener('hashchange', desdeHash);
  // Si la app queda abierta y cambia el día, refrescar al volver.
  document.addEventListener('visibilitychange', () => { if (!document.hidden && Store.hoy() !== App.fecha) App.render(); });
  desdeHash();

  // Instalable/offline cuando se sirve por http(s). Abierto como archivo local no aplica.
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
