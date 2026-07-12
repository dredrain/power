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
  const zonas = ['lumbar', 'rodilla', 'hombro', 'trapecio'].filter((z) => typeof post[z] === 'number');
  if (!zonas.length) return 'sin registro';
  return zonas.map((z) => `${z} ${post[z]}`).join(', ');
}

// Ultimo peso con dato numerico de las series REALMENTE hechas esta sesion.
function pesoHecho(series) {
  const s = (series || []).slice().reverse().find((x) => typeof x?.peso === 'number');
  return s ? s.peso : null;
}

// Extrae una etiqueta corta del motivo (frase de sugerirCarga anterior a ":").
// La regla de las 24h se destaca aparte porque es la senal de dolor a vigilar.
function motivoCorto(motivo) {
  if (typeof motivo !== 'string' || !motivo) return '';
  if (motivo.includes('24h')) return 'regla 24h';
  const i = motivo.indexOf(':');
  return i > 0 ? motivo.slice(0, i) : motivo;
}

function fmtComparacion(pesoReal, pesoAnterior) {
  if (typeof pesoReal !== 'number' || typeof pesoAnterior !== 'number') return '';
  const diff = +(pesoReal - pesoAnterior).toFixed(2);
  if (diff === 0) return ' (=última sesión)';
  return diff > 0 ? ` (+${diff})` : ` (${diff})`;
}

// Linea de aviso solo para lo accionable: la sugerencia fue bajar (se activo el
// gate de dolor, cualquiera que sea lo que se hizo despues), o lo hecho
// contradice la sugerencia (sugirio bajar y no se bajo, o sugirio mantener y
// se subio). "Sugirio mantener y mantuvo" / "sugirio subir y subio" son
// coherentes y no se marcan: la app SUGIERE, el peso lo escribe el usuario.
function marcaSugerencia(e) {
  const sug = e.sugerencia;
  if (!sug) return null;
  const pesoReal = pesoHecho(e.series);
  const subio = typeof pesoReal === 'number' && typeof sug.pesoAnterior === 'number'
    && pesoReal > sug.pesoAnterior;
  const accionable = sug.accion === 'bajar' || (sug.accion === 'mantener' && subio);
  if (!accionable) return null;
  const motivo = motivoCorto(sug.motivo);
  const pesoTxt = pesoReal == null ? 'sin peso registrado' : `hiciste ${pesoReal}kg`;
  return `  ⚠ sugería ${sug.accion}${motivo ? ` (${motivo})` : ''} · ${pesoTxt}${fmtComparacion(pesoReal, sug.pesoAnterior)}`;
}

function fmtDolor24h(dolor) {
  const post = dolor?.post || {};
  const h24 = dolor?.h24 || {};
  const zonas = ['lumbar', 'rodilla', 'hombro', 'trapecio'].filter((z) => typeof h24[z] === 'number');
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
  L.push(`${registro.fecha} · versión ${registro.version} · bloque ${registro.bloque}`);
  L.push('');
  L.push('**Ejercicios**');
  for (const e of registro.ejercicios || []) {
    const series = (e.series || []).map(fmtSerie).join(', ');
    // F1: nota libre del ejercicio, si la hay.
    const nota = e.notas ? ` — ${e.notas}` : '';
    L.push(`- ${nombreEjercicio(bloque, registro.sesionId, e.ejercicioId)}: ${series || '—'}${nota}`);
    const marca = marcaSugerencia(e);
    if (marca) L.push(marca);
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
  const maxZ = { lumbar: null, rodilla: null, hombro: null, trapecio: null };
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
