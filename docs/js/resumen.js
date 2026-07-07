// resumen.js — genera el texto markdown para pegar al entrenador (Claude).
// Puro, sin DOM: lo usan la app (S4) y los tests. Ver instrucciones.md: la
// revision semanal necesita dolor por zona, sesiones completadas y fatiga.

import { estadoAdherencia, claveSemana, parseFecha } from './adherencia.js';

function nombreSesion(bloque, sesionId) {
  return bloque?.sesiones?.find((s) => s.id === sesionId)?.nombre || sesionId;
}
function nombreEjercicio(bloque, sesionId, ejercicioId) {
  const ses = bloque?.sesiones?.find((s) => s.id === sesionId);
  return ses?.ejercicios?.find((e) => e.id === ejercicioId)?.nombre || ejercicioId;
}

function fmtSerie(s) {
  const peso = s.peso == null ? '—' : s.peso;
  const reps = s.reps == null ? '—' : s.reps;
  const rir = typeof s.rir === 'number' ? `@RIR${s.rir}` : '';
  return `${peso}×${reps}${rir}`;
}

function fmtDolor(dolor) {
  const post = dolor?.post || {};
  const zonas = ['lumbar', 'rodilla', 'hombro'].filter((z) => typeof post[z] === 'number');
  if (!zonas.length) return 'sin registro';
  return zonas.map((z) => `${z} ${post[z]}`).join(', ');
}

function fmtDolor24h(dolor) {
  const post = dolor?.post || {};
  const h24 = dolor?.h24 || {};
  const zonas = ['lumbar', 'rodilla', 'hombro'].filter((z) => typeof h24[z] === 'number');
  if (!zonas.length) return null;
  return zonas.map((z) => {
    const flecha = typeof post[z] === 'number'
      ? (h24[z] > post[z] ? ' (empeoró)' : h24[z] < post[z] ? ' (mejoró)' : ' (igual)')
      : '';
    return `${z} ${h24[z]}${flecha}`;
  }).join(', ');
}

// Resumen de UNA sesion.
export function resumenSesion(registro, bloque) {
  const L = [];
  L.push(`## ${nombreSesion(bloque, registro.sesionId)}`);
  const min = Math.round((registro.duracionSeg || 0) / 60);
  L.push(`${registro.fecha} · versión ${registro.version} · ${min} min · bloque ${registro.bloque}`);
  L.push('');
  L.push('**Ejercicios**');
  for (const e of registro.ejercicios || []) {
    const series = (e.series || []).map(fmtSerie).join(', ');
    L.push(`- ${nombreEjercicio(bloque, registro.sesionId, e.ejercicioId)}: ${series || '—'}`);
  }
  L.push('');
  L.push(`**Dolor (0-10)**: ${fmtDolor(registro.dolor)}`);
  const d24 = fmtDolor24h(registro.dolor);
  if (d24) L.push(`**A 24h**: ${d24}`);
  if (typeof registro.fatiga === 'number') L.push(`**Fatiga general**: ${registro.fatiga}/10`);
  if (registro.notas) L.push(`**Notas**: ${registro.notas}`);
  return L.join('\n');
}

// Resumen de la SEMANA en curso (para la revision semanal con el entrenador).
export function resumenSemana(historial, bloque, hoy = new Date()) {
  const a = estadoAdherencia(historial, bloque, hoy);
  const semana = claveSemana(hoy);
  const opcionales = new Set((bloque?.sesiones || []).filter((s) => s.opcional).map((s) => s.id));
  const deLaSemana = (historial || []).filter((r) => claveSemana(parseFecha(r.fecha)) === semana);

  const L = [];
  L.push(`# Revisión semanal — ${semana}`);
  L.push('');
  L.push(`**Adherencia**: ${a.estaSemana}/${a.objetivo} sesiones del núcleo` +
    `${a.extras ? ` (+${a.extras} extra de casa)` : ''} · estado ${a.nivel}`);
  L.push(`> ${a.mensaje}`);

  // dolor maximo por zona en la semana
  const maxZ = { lumbar: null, rodilla: null, hombro: null };
  let maxFatiga = null;
  for (const r of deLaSemana) {
    const post = r.dolor?.post || {};
    for (const z of Object.keys(maxZ)) {
      if (typeof post[z] === 'number') maxZ[z] = Math.max(maxZ[z] ?? 0, post[z]);
    }
    if (typeof r.fatiga === 'number') maxFatiga = Math.max(maxFatiga ?? 0, r.fatiga);
  }
  const dolorTxt = Object.entries(maxZ)
    .filter(([, v]) => v != null)
    .map(([z, v]) => `${z} ${v}`)
    .join(', ') || 'sin registro';
  L.push('');
  L.push(`**Dolor máximo por zona**: ${dolorTxt}`);
  if (maxFatiga != null) L.push(`**Fatiga máxima**: ${maxFatiga}/10`);
  L.push('');
  L.push('## Sesiones de la semana');
  if (!deLaSemana.length) L.push('_(ninguna registrada)_');
  for (const r of deLaSemana) L.push('', resumenSesion(r, bloque));
  return L.join('\n');
}
