// almacen.js — capa de datos: carga del plan (network-first + cache) e historial
// de sesiones en localStorage. Sin dependencias. Ver docs/plan/schema.md.

const K = {
  historial: 'power:historial',
  borrador: 'power:borrador',
  config: 'power:config',
  cacheBloque: 'power:cacheBloque',
  cacheHitos: 'power:cacheHitos',
};

// ---- utilidades localStorage ----
function leer(clave, porDefecto) {
  try {
    const s = localStorage.getItem(clave);
    return s ? JSON.parse(s) : porDefecto;
  } catch {
    return porDefecto;
  }
}
function escribir(clave, valor) {
  try {
    localStorage.setItem(clave, JSON.stringify(valor));
    return true;
  } catch {
    return false;
  }
}

// ---- Plan / bloque ----
// Network-first con fallback a la copia cacheada en localStorage. El service
// worker ya cachea la respuesta HTTP; aqui guardamos ademas una copia parseada
// para funcionar aunque falle todo.
export async function cargarBloque() {
  try {
    const resp = await fetch('plan/bloque-actual.json', { cache: 'no-cache' });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const bloque = await resp.json();
    escribir(K.cacheBloque, bloque);
    return { bloque, origen: 'red' };
  } catch (e) {
    const cache = leer(K.cacheBloque, null);
    if (cache) return { bloque: cache, origen: 'cache' };
    throw new Error('No se pudo cargar el bloque ni hay copia local: ' + e.message);
  }
}

// ---- Hitos (gamificacion, S5) ----
export async function cargarHitos() {
  try {
    const resp = await fetch('plan/hitos.json', { cache: 'no-cache' });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const doc = await resp.json();
    escribir(K.cacheHitos, doc);
    return doc;
  } catch {
    return leer(K.cacheHitos, null);
  }
}

// ---- Historial ----
export function getHistorial() {
  const h = leer(K.historial, []);
  return Array.isArray(h) ? h : [];
}

// Guarda (o reemplaza por fecha+sesionId) un RegistroSesion y ordena por iso/fecha.
export function guardarSesion(registro) {
  const h = getHistorial();
  const idx = h.findIndex(
    (r) => r.fecha === registro.fecha && r.sesionId === registro.sesionId,
  );
  if (idx >= 0) h[idx] = registro;
  else h.push(registro);
  h.sort((a, b) => (a.iso || a.fecha).localeCompare(b.iso || b.fecha));
  escribir(K.historial, h);
  return h;
}

// Ultimo RegistroEjercicio de un ejercicio, con el dolor de esa sesion adjunto.
// Es la entrada que consume sugerirCarga(). Devuelve null si nunca se hizo.
export function ultimoRegistroEjercicio(ejercicioId) {
  const h = getHistorial();
  for (let i = h.length - 1; i >= 0; i--) {
    const sesion = h[i];
    const ej = (sesion.ejercicios || []).find((e) => e.ejercicioId === ejercicioId);
    if (ej && Array.isArray(ej.series) && ej.series.length) {
      return { series: ej.series, dolor: sesion.dolor || { post: {}, h24: {} } };
    }
  }
  return null;
}

// Valores de la ultima serie registrada de un ejercicio (para precargar campos).
export function ultimosValores(ejercicioId) {
  const reg = ultimoRegistroEjercicio(ejercicioId);
  if (!reg) return null;
  const conReps = [...reg.series].reverse().find((s) => typeof s.reps === 'number');
  return conReps || reg.series[reg.series.length - 1] || null;
}

// ---- F3: historico por ejercicio ----
// Sesiones pasadas en las que se registro este ejercicio, con sus series, ordenadas
// de mas reciente a mas antigua. Memoria de trabajo (que puse), sin stats de vanidad.
export function historialEjercicio(ejercicioId) {
  const h = getHistorial();
  const out = [];
  for (let i = h.length - 1; i >= 0; i--) {
    const s = h[i];
    const ej = (s.ejercicios || []).find((e) => e.ejercicioId === ejercicioId);
    if (ej && Array.isArray(ej.series) && ej.series.length) {
      out.push({ fecha: s.fecha, iso: s.iso, sesionId: s.sesionId, series: ej.series });
    }
  }
  return out;
}

// ---- F2: exportar una sesion suelta ----
// Lista compacta de las sesiones registradas (para elegir cual exportar).
export function listaSesiones() {
  return getHistorial().map((r) => ({ fecha: r.fecha, sesionId: r.sesionId, iso: r.iso }));
}

// Exporta UNA sesion registrada como JSON (mismo envoltorio que el export completo).
// Devuelve null si no existe.
export function exportarSesion(fecha, sesionId) {
  const r = getHistorial().find((s) => s.fecha === fecha && s.sesionId === sesionId);
  if (!r) return null;
  return JSON.stringify({
    app: 'power-tracker',
    version: 1,
    exportado: new Date().toISOString(),
    sesion: r,
  }, null, 2);
}

// ---- Borrador de sesion en curso ----
export function getBorrador() {
  return leer(K.borrador, null);
}
export function guardarBorrador(borrador) {
  escribir(K.borrador, borrador);
}
export function limpiarBorrador() {
  localStorage.removeItem(K.borrador);
}

// ---- Export / import del historial (S4) ----
export function exportarJSON() {
  return JSON.stringify({
    app: 'power-tracker',
    version: 1,
    exportado: new Date().toISOString(),
    historial: getHistorial(),
    config: getConfig(),
  }, null, 2);
}

// Importa un JSON exportado. modo 'reemplazar' (por defecto) o 'fusionar'.
// Devuelve { ok, mensaje, total }.
export function importarJSON(texto, modo = 'reemplazar') {
  let datos;
  try {
    datos = JSON.parse(texto);
  } catch {
    return { ok: false, mensaje: 'El texto no es un JSON válido.' };
  }
  if (!datos || !Array.isArray(datos.historial)) {
    return { ok: false, mensaje: 'No se encontró un array "historial" en el archivo.' };
  }
  let historial = datos.historial;
  if (modo === 'fusionar') {
    const actual = getHistorial();
    const clave = (r) => `${r.fecha}|${r.sesionId}`;
    const mapa = new Map(actual.map((r) => [clave(r), r]));
    for (const r of historial) mapa.set(clave(r), r);
    historial = [...mapa.values()];
  }
  historial.sort((a, b) => (a.iso || a.fecha).localeCompare(b.iso || b.fecha));
  escribir(K.historial, historial);
  if (datos.config && modo === 'reemplazar') escribir(K.config, datos.config);
  return { ok: true, mensaje: `Importadas ${historial.length} sesiones.`, total: historial.length };
}

// ---- Config ----
export function getConfig() {
  return leer(K.config, {});
}
export function setConfig(parcial) {
  const c = { ...getConfig(), ...parcial };
  escribir(K.config, c);
  return c;
}

// ---- Sesion anterior sin responder la pregunta de 24h ----
// Devuelve la ultima sesion cuyo dolor.h24 aun no se ha rellenado (todos null),
// para preguntar al abrir la siguiente. null si no hay ninguna pendiente.
function hoyStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function sesionPendiente24h(hoy = hoyStr()) {
  const h = getHistorial();
  for (let i = h.length - 1; i >= 0; i--) {
    const s = h[i];
    // solo se pregunta al dia SIGUIENTE o despues (no el mismo dia de la sesion)
    if (s.fecha >= hoy) continue;
    const h24 = s.dolor?.h24 || {};
    const post = s.dolor?.post || {};
    // solo interesa preguntar por zonas que tuvieron dolor real (>0)
    const zonasConDolor = Object.keys(post).filter((z) => post[z] > 0);
    const sinResponder = zonasConDolor.every((z) => h24[z] == null);
    if (zonasConDolor.length && sinResponder) return s;
  }
  return null;
}

// Rellena el dolor.h24 de una sesion concreta (respuesta a la pregunta 24h).
export function responder24h(fecha, sesionId, h24) {
  const h = getHistorial();
  const s = h.find((r) => r.fecha === fecha && r.sesionId === sesionId);
  if (!s) return;
  s.dolor = s.dolor || { post: {}, h24: {} };
  s.dolor.h24 = { ...s.dolor.h24, ...h24 };
  escribir(K.historial, h);
}
