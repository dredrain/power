// progresion.js — algoritmo de sugerencia de carga (subir / mantener / bajar).
//
// Lógica pura, sin DOM: la importan tanto la app (S3) como los tests
// (docs/tests/progresion.test.mjs). Ver docs/plan/progresion.md para el
// pseudocódigo, las reglas y la tabla de casos.
//
// Principios de fase 1 (instrucciones.md):
//  - RPE ≤7  ⇒  RIR objetivo ≥3, sin fallos.
//  - Regla de las 24h: si una zona relevante empeora a 24h, se baja carga o rango.
//  - NUNCA sugerir subida con dolor >4/10 en zona relevante o si empeoró a 24h.

export const ZONAS = ['lumbar', 'rodilla', 'hombro'];

export const ACCIONES = Object.freeze({
  SUBIR: 'subir',
  MANTENER: 'mantener',
  BAJAR: 'bajar',
  ESTIMAR: 'estimar',
});

// Extrae el nº de reps mínimo exigible de un campo reps ("5", "8-10", "AMRAP").
// Devuelve null si no hay mínimo evaluable (AMRAP / texto libre).
export function repsObjetivoMin(reps) {
  if (reps == null) return null;
  const m = String(reps).match(/\d+/);
  return m ? parseInt(m[0], 10) : null;
}

// Contexto de dolor para las zonas relevantes de un ejercicio.
//   dolor = { post: {zona:0-10}, h24: {zona:0-10|null} }
// Devuelve { maxPost, empeoro24h }.
export function contextoDolor(zonas, dolor) {
  const zs = Array.isArray(zonas) ? zonas : [];
  let maxPost = 0;
  let empeoro24h = false;
  for (const z of zs) {
    const post = dolor?.post?.[z];
    const h24 = dolor?.h24?.[z];
    if (typeof post === 'number') maxPost = Math.max(maxPost, post);
    if (typeof post === 'number' && typeof h24 === 'number' && h24 > post) {
      empeoro24h = true;
    }
  }
  return { maxPost, empeoro24h };
}

// Última serie con datos utilizables (reps registradas) de un RegistroEjercicio.
function ultimaSerie(series) {
  if (!Array.isArray(series)) return null;
  for (let i = series.length - 1; i >= 0; i--) {
    const s = series[i];
    if (s && typeof s.reps === 'number') return s;
  }
  return null;
}

// ¿Se registró RIR en alguna serie?
function hayRir(series) {
  return Array.isArray(series) && series.some((s) => s && typeof s.rir === 'number');
}

/**
 * sugerirCarga — decide subir / mantener / bajar / estimar para un ejercicio.
 *
 * @param {object} ejercicio  { rirObjetivo, reps, zonas, progresion:{incrementoKg} }
 * @param {object|null} registro  Último RegistroEjercicio de este ejercicio, con el
 *        dolor de esa sesión adjunto: { series:[{peso,reps,rir}], dolor:{post,h24} }.
 *        null = nunca se ha hecho (primer día).
 * @returns {{accion, mensaje, incrementoKg, pesoSugerido, dolorAlto, empeoro24h}}
 */
export function sugerirCarga(ejercicio, registro) {
  const rirObjetivo = ejercicio?.rirObjetivo ?? 3;
  const incrementoKg = ejercicio?.progresion?.incrementoKg ?? 2.5;
  const zonas = ejercicio?.zonas ?? [];

  // 1) Primer día / sin historial → estimar con RPE ≤6.
  if (!registro || !Array.isArray(registro.series) || registro.series.length === 0) {
    return {
      accion: ACCIONES.ESTIMAR,
      mensaje: 'Primera vez: elige un peso con RPE ≤6 (RIR ≥4). Se afina en la próxima sesión.',
      incrementoKg,
      pesoSugerido: null,
      dolorAlto: false,
      empeoro24h: false,
    };
  }

  const dolor = contextoDolor(zonas, registro.dolor);
  const serie = ultimaSerie(registro.series);
  const pesoPrevio = serie && typeof serie.peso === 'number' ? serie.peso : null;

  // 2) Datos incompletos: sin RIR registrado → mantener y pedir registrar el RIR.
  if (!hayRir(registro.series) || !serie) {
    return {
      accion: ACCIONES.MANTENER,
      mensaje: 'Sin RIR de la última vez: repite el mismo peso y registra el RIR esta vez.',
      incrementoKg,
      pesoSugerido: pesoPrevio,
      dolorAlto: dolor.maxPost > 4,
      empeoro24h: dolor.empeoro24h,
    };
  }

  // 3) Regla de las 24h: si una zona relevante empeoró a 24h → bajar carga o rango.
  if (dolor.empeoro24h) {
    return {
      accion: ACCIONES.BAJAR,
      mensaje: 'Una zona empeoró a 24h: baja carga o rango en este ejercicio (regla de las 24h).',
      incrementoKg,
      pesoSugerido: pesoPrevio != null ? Math.max(0, +(pesoPrevio - incrementoKg).toFixed(2)) : null,
      dolorAlto: dolor.maxPost > 4,
      empeoro24h: true,
    };
  }

  // 4) ¿Completó las reps mínimas? Si no, bajar.
  const repsMin = repsObjetivoMin(ejercicio?.reps);
  const ultimoRir = serie.rir;
  if (repsMin != null && typeof serie.reps === 'number' && serie.reps < repsMin) {
    return {
      accion: ACCIONES.BAJAR,
      mensaje: `No se completaron las reps (${serie.reps}/${repsMin}): baja carga para volver al rango.`,
      incrementoKg,
      pesoSugerido: pesoPrevio != null ? Math.max(0, +(pesoPrevio - incrementoKg).toFixed(2)) : null,
      dolorAlto: dolor.maxPost > 4,
      empeoro24h: false,
    };
  }

  // 5) Si no hay RIR utilizable en la última serie → mantener.
  if (typeof ultimoRir !== 'number') {
    return {
      accion: ACCIONES.MANTENER,
      mensaje: 'Sin RIR en la última serie: mantén el peso y regístralo esta vez.',
      incrementoKg,
      pesoSugerido: pesoPrevio,
      dolorAlto: dolor.maxPost > 4,
      empeoro24h: false,
    };
  }

  // 6) Progresión autorregulada por RIR.
  const delta = ultimoRir - rirObjetivo; // >0 = se quedó fácil; <0 = fue más duro
  const dolorAlto = dolor.maxPost > 4;

  if (delta >= 1) {
    if (dolorAlto) {
      return {
        accion: ACCIONES.MANTENER,
        mensaje: `Podría subir (RIR ${ultimoRir} > objetivo ${rirObjetivo}), pero dolor >4/10 en zona relevante: mantén el peso.`,
        incrementoKg,
        pesoSugerido: pesoPrevio,
        dolorAlto: true,
        empeoro24h: false,
      };
    }
    return {
      accion: ACCIONES.SUBIR,
      mensaje: `Se quedó fácil (RIR ${ultimoRir} > objetivo ${rirObjetivo}): sube +${incrementoKg} kg.`,
      incrementoKg,
      pesoSugerido: pesoPrevio != null ? +(pesoPrevio + incrementoKg).toFixed(2) : null,
      dolorAlto: false,
      empeoro24h: false,
    };
  }

  if (delta <= -2) {
    return {
      accion: ACCIONES.BAJAR,
      mensaje: `Fue muy duro (RIR ${ultimoRir} < objetivo ${rirObjetivo}): baja -${incrementoKg} kg para no acercarte al fallo.`,
      incrementoKg,
      pesoSugerido: pesoPrevio != null ? Math.max(0, +(pesoPrevio - incrementoKg).toFixed(2)) : null,
      dolorAlto,
      empeoro24h: false,
    };
  }

  // delta === 0 (en objetivo) o delta === -1 (algo más duro, tolerable) → mantener.
  return {
    accion: ACCIONES.MANTENER,
    mensaje: delta === 0
      ? `En el objetivo (RIR ${ultimoRir} = ${rirObjetivo}): mantén el peso.`
      : `Cerca del objetivo (RIR ${ultimoRir} vs ${rirObjetivo}): mantén el peso otra sesión.`,
    incrementoKg,
    pesoSugerido: pesoPrevio,
    dolorAlto,
    empeoro24h: false,
  };
}
