// Tests de la regla de adherencia (S3). Ejecutar: node docs/tests/adherencia.test.mjs
import assert from 'node:assert/strict';
import { estadoAdherencia, claveSemana, parseFecha } from '../js/adherencia.js';

let ok = 0, ko = 0;
function test(n, f) { try { f(); ok++; console.log(`  ✓ ${n}`); } catch (e) { ko++; console.error(`  ✗ ${n}\n    ${e.message}`); } }

const bloque = { sesiones: [{ id: 'A', opcional: false }, { id: 'D', opcional: true }] };
const ses = (fecha, sesionId = 'A') => ({ fecha, sesionId, completada: true });

console.log('\nAdherencia:\n');

// hoy fijo: jueves 2026-07-09
const HOY = new Date(2026, 6, 9);

test('semana ISO estable dentro de la misma semana', () => {
  assert.equal(claveSemana(parseFecha('2026-07-06')), claveSemana(parseFecha('2026-07-09')));
});

test('3 sesiones esta semana → verde, objetivo cumplido', () => {
  const h = [ses('2026-07-06'), ses('2026-07-07'), ses('2026-07-09')];
  const a = estadoAdherencia(h, bloque, HOY);
  assert.equal(a.estaSemana, 3);
  assert.equal(a.nivel, 'verde');
});

test('el dia de casa (opcional) no cuenta como sesion del nucleo', () => {
  const h = [ses('2026-07-06'), ses('2026-07-08', 'D')];
  const a = estadoAdherencia(h, bloque, HOY);
  assert.equal(a.estaSemana, 1);
  assert.equal(a.extras, 1);
});

test('semana pasada 0 y esta 0 (activo antes) → amarillo', () => {
  const h = [ses('2026-06-22'), ses('2026-06-24')]; // hace ~2-3 semanas
  const a = estadoAdherencia(h, bloque, HOY);
  assert.equal(a.nivel, 'amarillo');
});

test('dos semanas seguidas a 0 → rojo', () => {
  // activo hace 4 semanas, nada en las dos ultimas ni en esta
  const h = [ses('2026-06-08'), ses('2026-06-10')];
  const a = estadoAdherencia(h, bloque, HOY);
  assert.equal(a.nivel, 'rojo');
});

test('primera semana de uso sin fallos previos → verde', () => {
  const h = [ses('2026-07-06')];
  const a = estadoAdherencia(h, bloque, HOY);
  assert.equal(a.nivel, 'verde');
  assert.equal(a.estaSemana, 1);
});

console.log(`\nResultado: ${ok} pasados, ${ko} fallidos\n`);
process.exit(ko === 0 ? 0 : 1);
