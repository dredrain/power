// Tests del algoritmo de progresión (O1). Ejecutar: node docs/tests/progresion.test.mjs
// Sin dependencias externas: usa node:assert. Cubre la tabla de docs/plan/progresion.md.

import assert from 'node:assert/strict';
import { sugerirCarga, ACCIONES, repsObjetivoMin, contextoDolor } from '../js/progresion.js';

let pasados = 0;
let fallidos = 0;

function test(nombre, fn) {
  try {
    fn();
    pasados++;
    console.log(`  ✓ ${nombre}`);
  } catch (e) {
    fallidos++;
    console.error(`  ✗ ${nombre}`);
    console.error(`    ${e.message}`);
  }
}

// Fábrica de ejercicio con valores por defecto.
function ejercicio(overrides = {}) {
  return {
    rirObjetivo: 3,
    reps: '5',
    zonas: ['rodilla'],
    progresion: { incrementoKg: 2.5 },
    ...overrides,
  };
}

// Fábrica de registro: series + dolor de rodilla post/h24.
function registro(series, rodPost = 1, rodH24 = 1) {
  return {
    series,
    dolor: {
      post: { lumbar: 0, rodilla: rodPost, hombro: 0 },
      h24: { lumbar: null, rodilla: rodH24, hombro: null },
    },
  };
}

console.log('\nAlgoritmo de progresión — casos de la tabla:\n');

// #1 Primer día
test('#1 primer día (registro null) → ESTIMAR', () => {
  const r = sugerirCarga(ejercicio(), null);
  assert.equal(r.accion, ACCIONES.ESTIMAR);
});

// #2 Sin RIR en ninguna serie
test('#2 sin RIR en ninguna serie → MANTENER', () => {
  const r = sugerirCarga(ejercicio(), registro([{ peso: 60, reps: 5, rir: null }]));
  assert.equal(r.accion, ACCIONES.MANTENER);
});

// #3 Se quedó fácil, sin dolor → SUBIR
test('#3 RIR 4 > obj 3, sin dolor → SUBIR (→62.5)', () => {
  const r = sugerirCarga(ejercicio(), registro([{ peso: 60, reps: 5, rir: 4 }], 1, 1));
  assert.equal(r.accion, ACCIONES.SUBIR);
  assert.equal(r.pesoSugerido, 62.5);
});

// #4 Se quedó fácil pero dolor post >4 → MANTENER (gate)
test('#4 RIR 4 pero dolor rodilla 6 → MANTENER (gate de dolor)', () => {
  const r = sugerirCarga(ejercicio(), registro([{ peso: 60, reps: 5, rir: 4 }], 6, 6));
  assert.equal(r.accion, ACCIONES.MANTENER);
  assert.equal(r.dolorAlto, true);
});

// #5 Dolor post = 4 (límite, no es >4) → SUBIR
test('#5 RIR 4, dolor rodilla 4 (=límite) → SUBIR', () => {
  const r = sugerirCarga(ejercicio(), registro([{ peso: 60, reps: 5, rir: 4 }], 4, 4));
  assert.equal(r.accion, ACCIONES.SUBIR);
});

// #6 En el objetivo → MANTENER
test('#6 RIR 3 = obj 3 → MANTENER', () => {
  const r = sugerirCarga(ejercicio(), registro([{ peso: 60, reps: 5, rir: 3 }]));
  assert.equal(r.accion, ACCIONES.MANTENER);
});

// #7 delta -1 → MANTENER
test('#7 RIR 2 (delta -1) → MANTENER', () => {
  const r = sugerirCarga(ejercicio(), registro([{ peso: 60, reps: 5, rir: 2 }]));
  assert.equal(r.accion, ACCIONES.MANTENER);
});

// #8 delta <= -2 → BAJAR
test('#8 RIR 1 (delta -2) → BAJAR (→57.5)', () => {
  const r = sugerirCarga(ejercicio(), registro([{ peso: 60, reps: 5, rir: 1 }]));
  assert.equal(r.accion, ACCIONES.BAJAR);
  assert.equal(r.pesoSugerido, 57.5);
});

// #9 No completó reps → BAJAR
test('#9 reps 3 < 5 → BAJAR (→57.5)', () => {
  const r = sugerirCarga(ejercicio(), registro([{ peso: 60, reps: 3, rir: 3 }]));
  assert.equal(r.accion, ACCIONES.BAJAR);
  assert.equal(r.pesoSugerido, 57.5);
});

// #10 Empeoró a 24h → BAJAR (aunque RIR alto)
test('#10 empeoró a 24h (post 2 → h24 5) → BAJAR (regla 24h)', () => {
  const r = sugerirCarga(ejercicio(), registro([{ peso: 60, reps: 5, rir: 4 }], 2, 5));
  assert.equal(r.accion, ACCIONES.BAJAR);
  assert.equal(r.empeoro24h, true);
});

// #11 Accesorio, incremento 1, rango 8-10, sube
test('#11 accesorio inc 1, reps "8-10", RIR 5 → SUBIR (→21)', () => {
  const ej = ejercicio({ reps: '8-10', zonas: [], progresion: { incrementoKg: 1 } });
  const reg = { series: [{ peso: 20, reps: 10, rir: 5 }], dolor: { post: {}, h24: {} } };
  const r = sugerirCarga(ej, reg);
  assert.equal(r.accion, ACCIONES.SUBIR);
  assert.equal(r.pesoSugerido, 21);
});

// #12 Última serie sin RIR pero otra sí → MANTENER
test('#12 última serie sin RIR → MANTENER', () => {
  const r = sugerirCarga(
    ejercicio(),
    registro([{ peso: 60, reps: 5, rir: 3 }, { peso: 60, reps: 5, rir: null }]),
  );
  assert.equal(r.accion, ACCIONES.MANTENER);
});

// #13 Zona no relevante con dolor alto → SUBIR
test('#13 dolor rodilla 8 pero ejercicio de hombro → SUBIR', () => {
  const ej = ejercicio({ zonas: ['hombro'] });
  const r = sugerirCarga(ej, registro([{ peso: 60, reps: 5, rir: 4 }], 8, 8));
  assert.equal(r.accion, ACCIONES.SUBIR);
});

console.log('\nUtilidades:\n');

test('repsObjetivoMin("5")=5, ("8-10")=8, ("AMRAP")=null', () => {
  assert.equal(repsObjetivoMin('5'), 5);
  assert.equal(repsObjetivoMin('8-10'), 8);
  assert.equal(repsObjetivoMin('AMRAP'), null);
});

test('contextoDolor detecta empeora a 24h en zona relevante', () => {
  const c = contextoDolor(['lumbar'], { post: { lumbar: 3 }, h24: { lumbar: 5 } });
  assert.equal(c.maxPost, 3);
  assert.equal(c.empeoro24h, true);
});

test('contextoDolor ignora zonas no declaradas', () => {
  const c = contextoDolor(['hombro'], { post: { rodilla: 9 }, h24: { rodilla: 10 } });
  assert.equal(c.maxPost, 0);
  assert.equal(c.empeoro24h, false);
});

console.log(`\nResultado: ${pasados} pasados, ${fallidos} fallidos\n`);
process.exit(fallidos === 0 ? 0 : 1);
