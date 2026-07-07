// Tests del generador de resumen (S4). Ejecutar: node docs/tests/resumen.test.mjs
import assert from 'node:assert/strict';
import { resumenSesion, resumenSemana } from '../js/resumen.js';

let ok = 0, ko = 0;
function test(n, f) { try { f(); ok++; console.log(`  ✓ ${n}`); } catch (e) { ko++; console.error(`  ✗ ${n}\n    ${e.message}`); } }

const bloque = {
  sesiones: [
    { id: 'A', nombre: 'Sentadilla + bisagra', opcional: false, ejercicios: [
      { id: 'sentadilla', nombre: 'Sentadilla' },
      { id: 'rdl', nombre: 'Peso muerto rumano' },
    ] },
    { id: 'D', nombre: 'Dia de casa', opcional: true, ejercicios: [] },
  ],
};

const registro = {
  fecha: '2026-07-08', bloque: 1, sesionId: 'A', version: 'completa', completada: true, duracionSeg: 3480,
  ejercicios: [
    { ejercicioId: 'sentadilla', series: [{ peso: 60, reps: 5, rir: 4 }, { peso: 60, reps: 5, rir: 3 }] },
    { ejercicioId: 'rdl', series: [{ peso: 50, reps: 8, rir: 3 }] },
  ],
  dolor: { post: { lumbar: 3, rodilla: 1, hombro: 0 }, h24: { lumbar: 5, rodilla: 1, hombro: 0 } },
  fatiga: 6, notas: 'buen dia',
};

console.log('\nResumen:\n');

test('resumenSesion incluye nombre, series, dolor, 24h, fatiga', () => {
  const md = resumenSesion(registro, bloque);
  assert.match(md, /Sentadilla \+ bisagra/);
  assert.match(md, /Sentadilla: 60×5@RIR4, 60×5@RIR3/);
  assert.match(md, /Peso muerto rumano: 50×8@RIR3/);
  assert.match(md, /Dolor \(0-10\)\*\*: lumbar 3, rodilla 1, hombro 0/);
  assert.match(md, /A 24h\*\*: lumbar 5 \(empeoró\)/);
  assert.match(md, /Fatiga general\*\*: 6\/10/);
  assert.match(md, /buen dia/);
});

test('resumenSesion tolera series con nulos', () => {
  const r = { ...registro, ejercicios: [{ ejercicioId: 'sentadilla', series: [{ peso: null, reps: null, rir: null }] }], dolor: { post: {}, h24: {} }, fatiga: null };
  const md = resumenSesion(r, bloque);
  assert.match(md, /Sentadilla: —×—/);
  assert.match(md, /Dolor \(0-10\)\*\*: sin registro/);
});

test('resumenSemana agrega adherencia y dolor maximo', () => {
  const HOY = new Date(2026, 6, 9); // misma semana que 2026-07-08
  const md = resumenSemana([registro], bloque, HOY);
  assert.match(md, /Revisión semanal/);
  assert.match(md, /Adherencia.*1\/3/);
  assert.match(md, /Dolor máximo por zona.*lumbar 3/);
  assert.match(md, /Fatiga máxima.*6\/10/);
});

console.log(`\nResultado: ${ok} pasados, ${ko} fallidos\n`);
process.exit(ko === 0 ? 0 : 1);
