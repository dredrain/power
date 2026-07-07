// adherencia.js — unico KPI de fase 1: sesiones completadas/semana y la regla
// "nunca dos semanas perdidas seguidas". Sin rachas de dias, sin stats. Puro,
// sin DOM (lo usan la vista de Adherencia y los tests). Ver progresion.md §4.

export const OBJETIVO_SEMANAL = 3;

export function parseFecha(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function desplaza(fecha, dias) {
  const d = new Date(fecha);
  d.setDate(d.getDate() + dias);
  return d;
}

// Clave de semana ISO: "YYYY-Www" (lunes como primer dia).
export function claveSemana(fecha) {
  const d = new Date(Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()));
  const diaLun0 = (d.getUTCDay() + 6) % 7; // lunes=0
  d.setUTCDate(d.getUTCDate() - diaLun0 + 3); // jueves de esa semana
  const primerJueves = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const semana = 1 + Math.round(
    ((d - primerJueves) / 86400000 - 3 + ((primerJueves.getUTCDay() + 6) % 7)) / 7,
  );
  return `${d.getUTCFullYear()}-W${String(semana).padStart(2, '0')}`;
}

// Estado de adherencia para "hoy". El dia de casa (opcional) NO cuenta ni resta.
export function estadoAdherencia(historial, bloque, hoy = new Date()) {
  const opcionales = new Set((bloque?.sesiones || []).filter((s) => s.opcional).map((s) => s.id));
  const cuenta = {};
  let primera = null;
  let extras = 0;

  for (const r of historial || []) {
    if (!r.completada) continue;
    if (opcionales.has(r.sesionId)) { extras++; continue; } // dia de casa: extra, no computa
    const k = claveSemana(parseFecha(r.fecha));
    cuenta[k] = (cuenta[k] || 0) + 1;
    if (!primera || r.fecha < primera) primera = r.fecha;
  }

  const kActual = claveSemana(hoy);
  const kPasada = claveSemana(desplaza(hoy, -7));
  const kAnte = claveSemana(desplaza(hoy, -14));
  const estaSemana = cuenta[kActual] || 0;
  const pasada = cuenta[kPasada] || 0;
  const ante = cuenta[kAnte] || 0;

  const activoDesde = primera ? claveSemana(parseFecha(primera)) : null;
  const activaPasada = activoDesde != null && activoDesde <= kPasada;
  const activaAnte = activoDesde != null && activoDesde <= kAnte;

  let nivel = 'verde';
  let mensaje;
  if (activaPasada && activaAnte && pasada === 0 && ante === 0 && estaSemana === 0) {
    nivel = 'rojo';
    mensaje = 'Dos semanas perdidas seguidas. Retoma esta semana, aunque sea la version minima.';
  } else if (activaPasada && pasada === 0 && estaSemana === 0) {
    nivel = 'amarillo';
    mensaje = 'La semana pasada no entrenaste: no falles esta. Una sesion (aunque sea minima) rompe el fallo.';
  } else if (estaSemana >= OBJETIVO_SEMANAL) {
    mensaje = 'Objetivo de la semana cumplido. Presentarte es la victoria.';
  } else {
    mensaje = `Vas ${estaSemana}/${OBJETIVO_SEMANAL} esta semana. Sin prisa: la regla es no fallar dos seguidas.`;
  }

  return { objetivo: OBJETIVO_SEMANAL, estaSemana, pasada, extras, nivel, mensaje, semanaActual: kActual };
}
