/* Estado de la app y persistencia en localStorage (datos del dispositivo).
   Respaldo/restauración en JSON desde Ajustes. */
(function (root) {
  'use strict';
  const CLAVE = 'jcc-control-obra-v1';
  const C = root.Calc;

  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  const hoy = () => C.aTexto(new Date());

  function vacio() {
    return {
      version: 1,
      obra: { nombre: 'Obra nueva', contrato: '', ubicacion: '', cliente: '', residente: '', inicio: hoy(), fin: C.sumarDias(hoy(), 90) },
      ajustes: { umbrales: { adelantada: 5, atencion: 5, atrasada: 15 }, ventanaConsumo: 14, diasAviso: 7 },
      actividades: [], trabajadores: [], asistencia: {}, diario: [], materiales: [], movimientos: [],
    };
  }

  // Obra de ejemplo con fechas relativas a hoy para que el tablero se vea "vivo".
  function ejemplo() {
    const t = hoy();
    const d = (n) => C.sumarDias(t, n);
    const s = vacio();
    s.obra = { nombre: 'Casa Lote 14 (EJEMPLO)', contrato: 'JCC-EJ-001', ubicacion: 'Alvarado, Ver.', cliente: 'Cliente ejemplo', residente: '', inicio: d(-16), fin: d(43) };
    const act = (clave, nombre, ini, fin, avances) => ({ id: uid(), clave, nombre, inicio: d(ini), fin: d(fin), avances: avances.map(([f, p]) => ({ fecha: d(f), pct: p })) });
    s.actividades = [
      act('A-001', 'Limpieza y trazo', -16, -14, [[-15, 50], [-14, 100]]),
      act('A-002', 'Excavación de cepas', -13, -7, [[-11, 40], [-8, 80], [-7, 100]]),
      act('A-003', 'Cimentación', -9, 2, [[-6, 15], [-3, 35], [-1, 55]]),
      act('A-004', 'Muros de block planta baja', -6, 14, [[-3, 20], [0, 45]]),
      act('A-005', 'Castillos y dalas', -6, 16, [[-1, 10]]),
      act('A-006', 'Instalación hidrosanitaria', -8, -1, [[-4, 30], [-1, 50]]),
      act('A-007', 'Losa de azotea', 19, 31, []),
      act('A-008', 'Instalación eléctrica', -2, 24, [[0, 12]]),
    ];
    s.trabajadores = [
      { id: uid(), nombre: 'Juan Pérez', puesto: 'Maestro de obra', salarioDia: 700, activo: true },
      { id: uid(), nombre: 'Luis Gómez', puesto: 'Albañil', salarioDia: 550, activo: true },
      { id: uid(), nombre: 'Pedro Cruz', puesto: 'Albañil', salarioDia: 550, activo: true },
      { id: uid(), nombre: 'Mario Ruiz', puesto: 'Ayudante', salarioDia: 380, activo: true },
      { id: uid(), nombre: 'José Díaz', puesto: 'Ayudante', salarioDia: 380, activo: true },
    ];
    // Asistencia de los días pasados (domingos se omiten).
    for (let i = -14; i <= -1; i++) {
      const f = d(i);
      if (C.aFecha(f).getDay() === 0) continue;
      s.asistencia[f] = {};
      s.trabajadores.forEach((tr, k) => { s.asistencia[f][tr.id] = (i + k) % 9 === 0 ? 'F' : (i + k) % 7 === 0 ? 'R' : 'P'; });
    }
    const mat = (nombre, unidad, minimo, maximo) => ({ id: uid(), nombre, unidad, minimo, maximo });
    const block = mat('Block 15×20×40', 'pza', 300, 1500);
    const grava = mat('Grava ¾"', 'm³', 3, 12);
    const cemento = mat('Cemento gris CPC 30R', 'bulto', 20, 120);
    const arena = mat('Arena', 'm³', 3, 12);
    const varilla = mat('Varilla #3 (3/8")', 'pza', 40, 200);
    s.materiales = [block, grava, cemento, arena, varilla];
    const mov = (m, tipo, cant, dia, ref) => ({ id: uid(), matId: m.id, tipo, cant, fecha: d(dia), ref: ref || '' });
    s.movimientos = [
      mov(cemento, 'entrada', 80, -8, 'Proveedor A · R-1001'), mov(varilla, 'entrada', 150, -8),
      mov(arena, 'entrada', 14, -7), mov(grava, 'entrada', 14, -7),
      mov(cemento, 'salida', 30, -6, 'A-003'), mov(block, 'entrada', 1200, -6, 'Bloquera'),
      mov(block, 'salida', 500, -4, 'A-004'), mov(varilla, 'salida', 60, -3, 'A-005'),
      mov(cemento, 'salida', 26, -2, 'A-004'), mov(grava, 'salida', 12, -2, 'A-003'),
      mov(arena, 'salida', 5, -1, 'A-004'), mov(arena, 'salida', 7, 0, 'A-004'),
      mov(block, 'salida', 420, 0, 'A-004'),
    ];
    s.diario = [
      { id: uid(), fecha: d(-1), clima: 'Soleado', texto: 'Colado de zapatas corridas eje A–C. Se recibió pipa de agua.', fotos: [], pendiente: false },
      { id: uid(), fecha: d(0), clima: 'Nublado', texto: 'Revisar con proveedor la entrega de grava; quedan 2 m³.', fotos: [], pendiente: true },
    ];
    return s;
  }

  let estado = null;
  const oyentes = [];

  function cargar() {
    try {
      const txt = root.localStorage && localStorage.getItem(CLAVE);
      estado = txt ? Object.assign(vacio(), JSON.parse(txt)) : ejemplo();
    } catch (e) {
      console.warn('No se pudo leer el almacenamiento; se usa la obra de ejemplo.', e);
      estado = ejemplo();
    }
    return estado;
  }

  function guardar() {
    try { localStorage.setItem(CLAVE, JSON.stringify(estado)); }
    catch (e) { root.UI && UI.aviso('No se pudo guardar: el almacenamiento está lleno. Exporta un respaldo y borra fotos antiguas.'); }
    oyentes.forEach((f) => f(estado));
  }

  // Aplica un cambio y guarda. Uso: Store.cambiar(s => { s.materiales.push(...) })
  function cambiar(fn) { fn(estado); guardar(); }

  const Store = {
    uid, hoy, vacio, ejemplo, cargar, guardar, cambiar,
    get s() { return estado; },
    reemplazar(nuevo) { estado = Object.assign(vacio(), nuevo); guardar(); },
    alCambiar(f) { oyentes.push(f); },
    exportar() { return JSON.stringify(estado, null, 2); },
  };
  root.Store = Store;
})(typeof globalThis !== 'undefined' ? globalThis : this);
