/* Cálculos puros de control de obra. Sin acceso al DOM ni al almacenamiento,
   para poder probarlos con Node (tests/calc.test.js). */
(function (root) {
  'use strict';

  const DIA = 86400000;

  // Fechas en formato 'AAAA-MM-DD' tratadas como días locales sin hora.
  function aFecha(s) {
    if (s instanceof Date) return new Date(s.getFullYear(), s.getMonth(), s.getDate());
    const [a, m, d] = String(s).split('-').map(Number);
    return new Date(a, m - 1, d);
  }
  function aTexto(f) {
    const d = aFecha(f);
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }
  function sumarDias(f, n) {
    const d = aFecha(f);
    d.setDate(d.getDate() + n);
    return aTexto(d);
  }
  // Días entre a y b (b - a), redondeado para evitar problemas de horario de verano.
  function diasEntre(a, b) {
    return Math.round((aFecha(b) - aFecha(a)) / DIA);
  }
  // Duración inclusiva: del 2 al 4 de noviembre son 3 días.
  function duracion(act) {
    return Math.max(1, diasEntre(act.inicio, act.fin) + 1);
  }
  const limitar = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

  /* ---------- Actividades ---------- */

  // Avance programado (%) a una fecha, con avance lineal entre inicio y fin.
  // Al cierre del día 'fecha' se considera transcurrido ese día completo.
  function avanceProgramado(act, fecha) {
    const transcurridos = diasEntre(act.inicio, fecha) + 1;
    return limitar((transcurridos / duracion(act)) * 100, 0, 100);
  }

  // Avance real (%) registrado hasta una fecha (último registro con fecha <= fecha).
  function avanceReal(act, fecha) {
    const regs = (act.avances || []).filter((r) => !fecha || r.fecha <= fecha);
    if (!regs.length) return 0;
    regs.sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));
    return limitar(Number(regs[regs.length - 1].pct) || 0, 0, 100);
  }

  // Estado de una actividad comparando real contra programado.
  // Umbrales en puntos porcentuales; se pueden ajustar desde la configuración.
  const UMBRALES = { adelantada: 5, atencion: 5, atrasada: 15 };

  function estadoActividad(act, fecha, umbrales) {
    const u = Object.assign({}, UMBRALES, umbrales || {});
    const prog = avanceProgramado(act, fecha);
    const real = avanceReal(act, fecha);
    const dif = real - prog;
    const dur = duracion(act);
    // Días de diferencia equivalentes: puntos de desviación convertidos a días de la actividad.
    const dias = Math.round((Math.abs(dif) / 100) * dur);
    let estado;
    if (real >= 100) estado = 'terminada';
    else if (fecha < act.inicio && real === 0) estado = 'por-iniciar';
    else if (fecha > act.fin) estado = 'atrasada';
    else if (dif >= u.adelantada) estado = 'adelantada';
    else if (-dif >= u.atrasada) estado = 'atrasada';
    else if (-dif >= u.atencion) estado = 'atencion';
    else estado = 'en-tiempo';
    let diasAtraso = 0;
    if (estado === 'atrasada' || estado === 'atencion') {
      diasAtraso = fecha > act.fin ? Math.max(dias, diasEntre(act.fin, fecha)) : dias;
    }
    const diasAdelanto = estado === 'adelantada' ? dias : 0;
    return { estado, prog, real, dif, diasAtraso, diasAdelanto, duracion: dur };
  }

  /* ---------- Obra completa ---------- */

  // Avance ponderado por duración de cada actividad.
  function resumenObra(obra, actividades, fecha) {
    let peso = 0, prog = 0, real = 0;
    for (const a of actividades) {
      const w = duracion(a);
      peso += w;
      prog += avanceProgramado(a, fecha) * w;
      real += avanceReal(a, fecha) * w;
    }
    prog = peso ? prog / peso : 0;
    real = peso ? real / peso : 0;
    const plazo = Math.max(1, diasEntre(obra.inicio, obra.fin) + 1);
    const transcurridos = limitar(diasEntre(obra.inicio, fecha) + 1, 0, plazo);
    const restantes = Math.max(0, diasEntre(fecha, obra.fin));
    const desviacion = real - prog;
    const diasAtraso = desviacion < 0 ? Math.round((-desviacion / 100) * plazo) : 0;
    return {
      prog, real, desviacion, diasAtraso, plazo, transcurridos, restantes,
      pctPlazo: (transcurridos / plazo) * 100,
    };
  }

  function conteoEstados(actividades, fecha, umbrales) {
    const c = { terminada: 0, adelantada: 0, 'en-tiempo': 0, atencion: 0, atrasada: 0, 'por-iniciar': 0 };
    for (const a of actividades) c[estadoActividad(a, fecha, umbrales).estado]++;
    return c;
  }

  // Serie de la curva S: programado para todo el plazo; real solo hasta 'hoy'.
  function curvaS(obra, actividades, hoy) {
    const puntos = [];
    const plazo = diasEntre(obra.inicio, obra.fin);
    for (let i = 0; i <= plazo; i++) {
      const f = sumarDias(obra.inicio, i);
      const r = resumenObra(obra, actividades, f);
      puntos.push({ fecha: f, prog: r.prog, real: f <= hoy ? r.real : null });
    }
    return puntos;
  }

  // Actividades cuyo periodo incluye la fecha y no están terminadas.
  function programadasPara(actividades, fecha) {
    return actividades.filter((a) => a.inicio <= fecha && fecha <= a.fin && avanceReal(a, fecha) < 100);
  }

  /* ---------- Inventario ---------- */

  function existencia(matId, movimientos) {
    let s = 0;
    for (const m of movimientos) {
      if (m.matId !== matId) continue;
      if (m.tipo === 'entrada') s += Number(m.cant);
      else if (m.tipo === 'salida') s -= Number(m.cant);
      else if (m.tipo === 'ajuste') s += Number(m.cant); // ajuste por conteo físico (+/-)
    }
    return Math.round(s * 1000) / 1000;
  }

  // Consumo promedio diario: salidas de los últimos 'ventana' días (incluye hoy).
  function consumoDiario(matId, movimientos, hoy, ventana) {
    const v = ventana || 14;
    const desde = sumarDias(hoy, -(v - 1));
    let s = 0;
    for (const m of movimientos) {
      if (m.matId === matId && m.tipo === 'salida' && m.fecha >= desde && m.fecha <= hoy) s += Number(m.cant);
    }
    return s / v;
  }

  // Estado de un material. 'diasAviso': cuántos días antes de tocar el mínimo se avisa.
  function estadoMaterial(mat, movimientos, hoy, opciones) {
    const o = Object.assign({ ventana: 14, diasAviso: 7 }, opciones || {});
    const exist = existencia(mat.id, movimientos);
    const consumo = consumoDiario(mat.id, movimientos, hoy, o.ventana);
    const alcanza = consumo > 0 ? Math.floor(exist / consumo) : Infinity;
    const diasAlMinimo = consumo > 0 ? (exist - mat.minimo) / consumo : Infinity;
    let estado;
    if (exist <= mat.minimo) estado = 'bajo-minimo';
    else if (diasAlMinimo <= o.diasAviso) estado = 'por-llegar';
    else estado = 'suficiente';
    const tope = mat.maximo && mat.maximo > mat.minimo ? mat.maximo : mat.minimo * 2;
    const pedido = estado === 'suficiente' ? 0 : Math.max(0, Math.ceil(tope - exist));
    return { exist, consumo, alcanza, estado, pedido };
  }

  /* ---------- Asistencia ---------- */

  function resumenAsistencia(trabajadores, registroDia) {
    const activos = trabajadores.filter((t) => t.activo !== false);
    const r = registroDia || {};
    let presentes = 0, retardos = 0, faltas = 0;
    for (const t of activos) {
      if (r[t.id] === 'P') presentes++;
      else if (r[t.id] === 'R') { presentes++; retardos++; }
      else if (r[t.id] === 'F') faltas++;
    }
    return { total: activos.length, presentes, retardos, faltas, sinRegistro: activos.length - presentes - faltas };
  }

  // Raya semanal: días pagables (presente o retardo) por trabajador entre dos fechas.
  function raya(trabajadores, asistencia, desde, hasta) {
    return trabajadores.map((t) => {
      let dias = 0;
      for (let f = desde; f <= hasta; f = sumarDias(f, 1)) {
        const v = (asistencia[f] || {})[t.id];
        if (v === 'P' || v === 'R') dias++;
      }
      return { id: t.id, nombre: t.nombre, puesto: t.puesto, dias, importe: dias * (Number(t.salarioDia) || 0) };
    });
  }

  const Calc = {
    aFecha, aTexto, sumarDias, diasEntre, duracion,
    avanceProgramado, avanceReal, estadoActividad, resumenObra, conteoEstados, curvaS, programadasPara,
    existencia, consumoDiario, estadoMaterial, resumenAsistencia, raya, UMBRALES,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Calc;
  root.Calc = Calc;
})(typeof globalThis !== 'undefined' ? globalThis : this);
