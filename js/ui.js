/* Utilidades de interfaz: creación de elementos, formatos, modales y avisos. */
(function (root) {
  'use strict';

  // h('div.clase#id', {atributos}, hijos...)
  function h(sel, attrs, ...hijos) {
    const [tag, ...resto] = sel.split(/(?=[.#])/);
    const el = document.createElement(tag || 'div');
    for (const r of resto) {
      if (r[0] === '.') { if (r.length > 1) el.classList.add(r.slice(1)); }
      else if (r[0] === '#') el.id = r.slice(1);
    }
    // El segundo argumento puede ser atributos {…} o ya un hijo (texto, número, nodo, lista).
    if (attrs !== null && attrs !== undefined && (typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs))) { hijos.unshift(attrs); attrs = null; }
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'html') el.innerHTML = v;
      else if (k in el && k !== 'list') el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    const agregar = (c) => {
      if (c == null || c === false) return;
      if (Array.isArray(c)) c.forEach(agregar);
      else el.append(c instanceof Node ? c : document.createTextNode(String(c)));
    };
    hijos.forEach(agregar);
    return el;
  }

  // Elemento SVG (para gráficas).
  function s(tag, attrs, ...hijos) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [k, v] of Object.entries(attrs || {})) if (v != null) el.setAttribute(k, v);
    hijos.flat().forEach((c) => c != null && el.append(c instanceof Node ? c : document.createTextNode(String(c))));
    return el;
  }

  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const MESES_L = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

  const fCorta = (t) => { const d = Calc.aFecha(t); return `${d.getDate()} ${MESES[d.getMonth()]}`; };
  const fLarga = (t) => { const d = Calc.aFecha(t); return `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES_L[d.getMonth()]} de ${d.getFullYear()}`; };
  const num = (n, dec) => Number(n).toLocaleString('es-MX', { maximumFractionDigits: dec == null ? 1 : dec, minimumFractionDigits: 0 });
  const pct = (n) => `${num(n, 1)}%`;
  const dinero = (n) => Number(n).toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });

  const ETIQ_ACT = {
    terminada: 'Terminada', adelantada: 'Adelantada', 'en-tiempo': 'En tiempo',
    atencion: 'Atención', atrasada: 'Atrasada', 'por-iniciar': 'Por iniciar',
  };
  const ETIQ_MAT = { 'bajo-minimo': 'Bajo mínimo', 'por-llegar': 'Por llegar al mínimo', suficiente: 'Suficiente' };
  const chip = (clase, texto) => h('span.chip.' + clase, texto);

  // Barra de progreso con marcador del programado.
  function barra(real, prog, clase) {
    return h('div.barra', h('div.barra-real.' + (clase || ''), { style: { width: Math.min(100, real) + '%' } }),
      prog != null ? h('div.barra-marca', { style: { left: Math.min(100, prog) + '%' } }) : null);
  }

  // Anillo de porcentaje.
  function anillo(valor, color) {
    const r = 26, c = 2 * Math.PI * r;
    return s('svg', { viewBox: '0 0 64 64', class: 'anillo' },
      s('circle', { cx: 32, cy: 32, r, class: 'anillo-fondo' }),
      s('circle', { cx: 32, cy: 32, r, class: 'anillo-valor', stroke: color, 'stroke-dasharray': `${(Math.min(100, valor) / 100) * c} ${c}`, transform: 'rotate(-90 32 32)' }));
  }

  /* ---- Modal tipo hoja inferior ---- */
  function modal(titulo, contenido, acciones) {
    cerrarModal();
    const fondo = h('div.modal-fondo', { onclick: (e) => e.target === fondo && cerrarModal() },
      h('div.modal', { role: 'dialog', 'aria-label': titulo },
        h('div.modal-tit', titulo),
        h('div.modal-cuerpo', contenido),
        acciones ? h('div.modal-acciones', acciones) : null,
        h('button.btn.btn-borde.ancho', { onclick: cerrarModal }, 'Cerrar')));
    document.body.append(fondo);
    const primero = fondo.querySelector('input,select,textarea');
    if (primero) setTimeout(() => primero.focus(), 50);
    return fondo;
  }
  function cerrarModal() { document.querySelectorAll('.modal-fondo').forEach((m) => m.remove()); }

  // Formulario simple. campos: [{nombre, etiqueta, tipo, valor, opciones, requerido, paso}]
  function formulario(titulo, campos, alGuardar, textoBoton) {
    const inputs = {};
    const cuerpo = h('form.form', {
      onsubmit: (e) => {
        e.preventDefault();
        const datos = {};
        for (const c of campos) {
          const el = inputs[c.nombre];
          let v = c.tipo === 'checkbox' ? el.checked : el.value;
          if (c.tipo === 'number') v = v === '' ? null : Number(v);
          if (c.requerido && (v === '' || v == null)) { el.focus(); return aviso('Falta: ' + c.etiqueta); }
          datos[c.nombre] = v;
        }
        if (alGuardar(datos) !== false) cerrarModal();
      },
    }, campos.map((c) => {
      let el;
      if (c.tipo === 'select') el = h('select', c.opciones.map(([v, t]) => h('option', { value: v, selected: String(v) === String(c.valor) }, t)));
      else if (c.tipo === 'textarea') el = h('textarea', { rows: 4, value: c.valor || '' });
      else if (c.tipo === 'checkbox') el = h('input', { type: 'checkbox', checked: !!c.valor });
      else el = h('input', { type: c.tipo || 'text', value: c.valor == null ? '' : c.valor, step: c.paso || 'any', inputMode: c.tipo === 'number' ? 'decimal' : null });
      inputs[c.nombre] = el;
      return h('label.campo' + (c.tipo === 'checkbox' ? '.campo-check' : ''), h('span', c.etiqueta), el);
    }), h('button.btn.btn-oscuro.ancho', { type: 'submit' }, textoBoton || 'Guardar'));
    return modal(titulo, cuerpo);
  }

  let temporizador;
  function aviso(texto) {
    let t = document.querySelector('.aviso');
    if (!t) { t = h('div.aviso', { role: 'status' }); document.body.append(t); }
    t.textContent = texto;
    t.classList.add('visible');
    clearTimeout(temporizador);
    temporizador = setTimeout(() => t.classList.remove('visible'), 2400);
  }

  function confirmar(texto, siFn) {
    modal('Confirmar', h('p', texto), [h('button.btn.btn-rojo', { onclick: () => { cerrarModal(); siFn(); } }, 'Sí, continuar')]);
  }

  root.UI = { h, s, fCorta, fLarga, num, pct, dinero, ETIQ_ACT, ETIQ_MAT, chip, barra, anillo, modal, cerrarModal, formulario, aviso, confirmar };
})(window);
