// hitos.js — motor de gamificacion (S5). Evalua las condiciones de docs/plan/hitos.json
// contra el historial local. Puro, sin DOM: lo usan la app y los tests.
// En fase 1 solo se muestra y evalua UN hito activo: adherencia ~66 dias.

import { claveSemana, parseFecha } from './adherencia.js';

function truncar(f) { return new Date(f.getFullYear(), f.getMonth(), f.getDate()); }
function lunesDe(f) {
  const d = truncar(f);
  const off = (d.getDay() + 6) % 7; // lunes=0
  d.setDate(d.getDate() - off);
  return d;
}
function coreDe(historial, bloque) {
  const opcionales = new Set((bloque?.sesiones || []).filter((s) => s.opcional).map((s) => s.id));
  return (historial || []).filter((r) => r.completada && !opcionales.has(r.sesionId));
}

// Dias de habito con la regla "nunca dos semanas perdidas seguidas". No es racha de
// dias consecutivos: cuenta dias desde la primera sesion mientras no se rompa la regla.
// Si en algun momento hubo dos semanas (pasadas y completas) sin entrenar, el conteo
// se reinicia. La semana en curso no se considera "perdida" hasta que termina.
export function diasDeHabito(historial, bloque, hoy = new Date()) {
  const fechas = coreDe(historial, bloque).map((r) => parseFecha(r.fecha)).sort((a, b) => a - b);
  if (!fechas.length) return 0;

  const cuenta = {};
  for (const f of fechas) { const k = claveSemana(f); cuenta[k] = (cuenta[k] || 0) + 1; }

  const finLunes = lunesDe(hoy);
  let cursor = lunesDe(fechas[0]);
  let inicioRacha = truncar(fechas[0]);
  let prevFallo = false;
  let resetPendiente = false;

  // Solo semanas YA cerradas (anteriores a la actual) cuentan como perdidas.
  while (cursor < finLunes) {
    const n = cuenta[claveSemana(cursor)] || 0;
    const fallo = n === 0;
    if (resetPendiente && n > 0) { inicioRacha = new Date(cursor); resetPendiente = false; }
    if (fallo && prevFallo) resetPendiente = true;
    prevFallo = fallo;
    cursor = new Date(cursor.getTime() + 7 * 86400000);
  }
  if (resetPendiente) inicioRacha = finLunes; // habito roto: se reinicia esta semana

  return Math.max(0, Math.floor((truncar(hoy) - inicioRacha) / 86400000) + 1);
}

function maxSerie(historial, ejercicioId, campo) {
  let m = 0;
  for (const r of historial || []) {
    for (const e of r.ejercicios || []) {
      if (e.ejercicioId !== ejercicioId) continue;
      for (const s of e.series || []) {
        if (typeof s[campo] === 'number') m = Math.max(m, s[campo]);
      }
    }
  }
  return m;
}

// Evalua un hito → { id, hito, tipo, actual, objetivo, desbloqueado, pct }.
export function evaluarHito(hito, historial, bloque, hoy = new Date()) {
  const c = hito.condicion || {};
  let actual = 0;
  let objetivo = 1;
  switch (c.tipo) {
    case 'adherencia_habito':
      objetivo = c.dias || 66;
      actual = diasDeHabito(historial, bloque, hoy);
      break;
    case 'sesiones_totales':
      objetivo = c.n || 1;
      actual = coreDe(historial, bloque).length;
      break;
    case 'reps_ejercicio':
      objetivo = c.reps || 1;
      actual = maxSerie(historial, c.ejercicioId, 'reps');
      break;
    case 'carga_ejercicio':
      objetivo = c.kg || 1;
      actual = maxSerie(historial, c.ejercicioId, 'peso');
      break;
    default:
      objetivo = 1;
      actual = 0;
  }
  const desbloqueado = actual >= objetivo;
  const pct = objetivo > 0 ? Math.min(100, Math.round((actual / objetivo) * 100)) : 0;
  return { id: hito.id, hito, tipo: c.tipo, actual, objetivo, desbloqueado, pct };
}

// Hitos visibles = activos y de la fase actual. En fase 1: solo adherencia-66.
export function hitosVisibles(doc, fase) {
  return (doc?.hitos || []).filter((h) => h.activo && h.fase === fase);
}

export function evaluarVisibles(doc, historial, bloque, fase, hoy = new Date()) {
  return hitosVisibles(doc, fase).map((h) => evaluarHito(h, historial, bloque, hoy));
}
