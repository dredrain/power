// Tests de las funciones de datos nuevas del Sprint 2 (F2 export suelto, F3 historico
// por ejercicio). Ejecutar: node docs/tests/almacen.test.mjs
import assert from 'node:assert/strict';

// Shim minimo de localStorage ANTES de importar almacen.js (que solo lo usa dentro
// de funciones, nunca al cargar el modulo).
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
const almacen = await import('../js/almacen.js');

let ok = 0, ko = 0;
function test(n, f) { try { f(); ok++; console.log(`  ✓ ${n}`); } catch (e) { ko++; console.error(`  ✗ ${n}\n    ${e.message}`); } }

const sesion1 = {
  fecha: '2026-07-01', iso: '2026-07-01T10:00:00.000Z', bloque: 1, sesionId: 'A', version: 'completa', completada: true,
  ejercicios: [{ ejercicioId: 'sentadilla', series: [{ peso: 60, reps: 5, rir: 3 }] }],
  dolor: { post: {}, h24: {} }, fatiga: 4, notas: '',
};
const sesion2 = {
  fecha: '2026-07-03', iso: '2026-07-03T10:00:00.000Z', bloque: 1, sesionId: 'A', version: 'completa', completada: true,
  ejercicios: [{ ejercicioId: 'sentadilla', series: [{ peso: 62, reps: 5, rir: 2 }, { peso: 62, reps: 4, rir: 1 }], notas: 'subio bien' }],
  dolor: { post: {}, h24: {} }, fatiga: 5, notas: '',
};
almacen.guardarSesion(sesion1);
almacen.guardarSesion(sesion2);

console.log('\nAlmacen (Sprint 2):\n');

test('historialEjercicio devuelve sesiones de mas reciente a mas antigua (F3)', () => {
  const h = almacen.historialEjercicio('sentadilla');
  assert.equal(h.length, 2);
  assert.equal(h[0].fecha, '2026-07-03');
  assert.equal(h[0].series.length, 2);
  assert.equal(h[0].series[0].peso, 62);
  assert.equal(h[1].fecha, '2026-07-01');
});

test('historialEjercicio vacio para un ejercicio nunca hecho', () => {
  assert.deepEqual(almacen.historialEjercicio('no-existe'), []);
});

test('exportarSesion serializa una sola sesion (F2)', () => {
  const txt = almacen.exportarSesion('2026-07-01', 'A');
  const obj = JSON.parse(txt);
  assert.equal(obj.app, 'power-tracker');
  assert.equal(obj.sesion.fecha, '2026-07-01');
  assert.equal(obj.sesion.sesionId, 'A');
  assert.ok(!Array.isArray(obj.historial), 'no debe exportar el historial completo');
});

test('exportarSesion devuelve null si la sesion no existe (F2)', () => {
  assert.equal(almacen.exportarSesion('2020-01-01', 'Z'), null);
});

test('listaSesiones lista fecha+sesionId de cada registro (F2)', () => {
  const l = almacen.listaSesiones();
  assert.equal(l.length, 2);
  assert.deepEqual(l.map((s) => s.fecha), ['2026-07-01', '2026-07-03']);
});

console.log(`\nResultado: ${ok} pasados, ${ko} fallidos\n`);
process.exit(ko === 0 ? 0 : 1);
