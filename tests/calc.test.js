// Pruebas de los cálculos. Ejecutar:  node tests/calc.test.js
const assert = require('assert');
const C = require('../js/calc.js');

let ok = 0;
function prueba(nombre, fn) {
  try { fn(); ok++; console.log('✔', nombre); }
  catch (e) { console.error('✘', nombre, '\n  ', e.message); process.exitCode = 1; }
}
const cerca = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol, `${a} ≠ ${b}`);

prueba('fechas: días entre y sumar días (cruce de mes y horario de verano)', () => {
  assert.strictEqual(C.diasEntre('2026-11-02', '2026-11-04'), 2);
  assert.strictEqual(C.sumarDias('2026-10-30', 3), '2026-11-02');
  assert.strictEqual(C.diasEntre('2026-03-01', '2026-04-01'), 31);
  assert.strictEqual(C.duracion({ inicio: '2026-11-02', fin: '2026-11-04' }), 3);
});

const act = { inicio: '2026-11-01', fin: '2026-11-10', avances: [{ fecha: '2026-11-03', pct: 20 }, { fecha: '2026-11-05', pct: 40 }] };

prueba('avance programado lineal, limitado a 0–100', () => {
  cerca(C.avanceProgramado(act, '2026-10-30'), 0);
  cerca(C.avanceProgramado(act, '2026-11-01'), 10);
  cerca(C.avanceProgramado(act, '2026-11-05'), 50);
  cerca(C.avanceProgramado(act, '2026-11-10'), 100);
  cerca(C.avanceProgramado(act, '2026-12-01'), 100);
});

prueba('avance real toma el último registro hasta la fecha (sin importar el orden)', () => {
  const a = { avances: [{ fecha: '2026-11-05', pct: 40 }, { fecha: '2026-11-03', pct: 20 }] };
  assert.strictEqual(C.avanceReal(a, '2026-11-04'), 20);
  assert.strictEqual(C.avanceReal(a, '2026-11-09'), 40);
  assert.strictEqual(C.avanceReal(a, '2026-11-01'), 0);
});

prueba('estados de actividad', () => {
  assert.strictEqual(C.estadoActividad(act, '2026-11-05').estado, 'atencion'); // 40 vs 50
  assert.strictEqual(C.estadoActividad(act, '2026-11-07').estado, 'atrasada'); // 40 vs 70
  assert.strictEqual(C.estadoActividad(act, '2026-11-03').estado, 'atencion'); // 20 vs 30
  const adel = { inicio: '2026-11-01', fin: '2026-11-10', avances: [{ fecha: '2026-11-02', pct: 40 }] };
  const e = C.estadoActividad(adel, '2026-11-02'); // 40 vs 20
  assert.strictEqual(e.estado, 'adelantada');
  assert.strictEqual(e.diasAdelanto, 2);
  assert.strictEqual(C.estadoActividad({ inicio: '2026-12-01', fin: '2026-12-05', avances: [] }, '2026-11-20').estado, 'por-iniciar');
  assert.strictEqual(C.estadoActividad({ inicio: '2026-11-01', fin: '2026-11-05', avances: [{ fecha: '2026-11-05', pct: 100 }] }, '2026-11-20').estado, 'terminada');
  const vencida = C.estadoActividad({ inicio: '2026-11-01', fin: '2026-11-05', avances: [{ fecha: '2026-11-05', pct: 97 }] }, '2026-11-12');
  assert.strictEqual(vencida.estado, 'atrasada'); // pasó su término sin terminar
  assert.strictEqual(vencida.diasAtraso, 7);
  assert.strictEqual(C.estadoActividad(act, '2026-11-07', { atrasada: 40 }).estado, 'atencion'); // umbral configurable
});

prueba('resumen de obra ponderado por duración', () => {
  const obra = { inicio: '2026-11-01', fin: '2026-11-30' };
  const acts = [
    { inicio: '2026-11-01', fin: '2026-11-10', avances: [{ fecha: '2026-11-10', pct: 100 }] }, // 10 d
    { inicio: '2026-11-11', fin: '2026-11-30', avances: [] }, // 20 d
  ];
  const r = C.resumenObra(obra, acts, '2026-11-10');
  cerca(r.prog, 100 * 10 / 30);
  cerca(r.real, 100 * 10 / 30);
  cerca(r.desviacion, 0);
  assert.strictEqual(r.plazo, 30);
  assert.strictEqual(r.transcurridos, 10);
  assert.strictEqual(r.restantes, 20);
  const r2 = C.resumenObra(obra, acts, '2026-11-20'); // prog 20/30, real 10/30 → -33.3 pts → 10 días
  assert.strictEqual(r2.diasAtraso, 10);
});

prueba('curva S: programado todo el plazo, real solo hasta hoy', () => {
  const obra = { inicio: '2026-11-01', fin: '2026-11-05' };
  const pts = C.curvaS(obra, [{ inicio: '2026-11-01', fin: '2026-11-05', avances: [{ fecha: '2026-11-02', pct: 30 }] }], '2026-11-03');
  assert.strictEqual(pts.length, 5);
  cerca(pts[4].prog, 100);
  assert.strictEqual(pts[3].real, null);
  cerca(pts[2].real, 30);
});

const movs = [
  { matId: 'a', tipo: 'entrada', cant: 14, fecha: '2026-11-01' },
  { matId: 'a', tipo: 'salida', cant: 5, fecha: '2026-11-10' },
  { matId: 'a', tipo: 'salida', cant: 7, fecha: '2026-11-14' },
  { matId: 'a', tipo: 'ajuste', cant: 0.5, fecha: '2026-11-14' },
  { matId: 'b', tipo: 'entrada', cant: 100, fecha: '2026-11-01' },
];

prueba('existencia y consumo diario', () => {
  cerca(C.existencia('a', movs), 2.5);
  cerca(C.consumoDiario('a', movs, '2026-11-14', 14), 12 / 14);
  cerca(C.consumoDiario('a', movs, '2026-11-14', 4), 7 / 4); // solo 11–14 nov
});

prueba('estado de material y pedido sugerido', () => {
  const e = C.estadoMaterial({ id: 'a', minimo: 3, maximo: 12 }, movs, '2026-11-14');
  assert.strictEqual(e.estado, 'bajo-minimo');
  assert.strictEqual(e.pedido, 10); // 12 - 2.5 → 9.5 → 10
  assert.strictEqual(e.alcanza, 2);
  const b = C.estadoMaterial({ id: 'b', minimo: 10, maximo: 0 }, movs, '2026-11-14');
  assert.strictEqual(b.estado, 'suficiente');
  assert.strictEqual(b.alcanza, Infinity);
  const m2 = [{ matId: 'c', tipo: 'entrada', cant: 30, fecha: '2026-11-01' }, { matId: 'c', tipo: 'salida', cant: 14, fecha: '2026-11-14' }];
  const c = C.estadoMaterial({ id: 'c', minimo: 10 }, m2, '2026-11-14'); // 16 hay, 1/día → 6 días al mínimo
  assert.strictEqual(c.estado, 'por-llegar');
  assert.strictEqual(c.pedido, 4); // sin máximo: 2×mínimo − existencia
});

prueba('asistencia y raya', () => {
  const ts = [{ id: 1, nombre: 'A', salarioDia: 500 }, { id: 2, nombre: 'B', salarioDia: 400 }, { id: 3, nombre: 'C', activo: false }];
  const asis = { '2026-11-16': { 1: 'P', 2: 'R' }, '2026-11-17': { 1: 'F', 2: 'P' } };
  const r = C.resumenAsistencia(ts, asis['2026-11-16']);
  assert.deepStrictEqual(r, { total: 2, presentes: 2, retardos: 1, faltas: 0, sinRegistro: 0 });
  const raya = C.raya(ts.slice(0, 2), asis, '2026-11-16', '2026-11-22');
  assert.strictEqual(raya[0].importe, 500);
  assert.strictEqual(raya[1].importe, 800);
});

console.log(`\n${ok} prueba(s) correctas`);
