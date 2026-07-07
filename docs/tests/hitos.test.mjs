// Tests del motor de hitos (S5). Ejecutar: node docs/tests/hitos.test.mjs
import assert from 'node:assert/strict';
import { evaluarHito, hitosVisibles, evaluarVisibles, diasDeHabito } from '../js/hitos.js';

let ok = 0, ko = 0;
function test(n, f) { try { f(); ok++; console.log(`  ✓ ${n}`); } catch (e) { ko++; console.error(`  ✗ ${n}\n    ${e.message}`); } }

const bloque = { fase: 1, sesiones: [{ id: 'A', opcional: false }, { id: 'B', opcional: false }, { id: 'D', opcional: true }] };
const ses = (fecha, sesionId = 'A', extra = {}) => ({ fecha, sesionId, completada: true, ejercicios: [], ...extra });

const doc = {
  hitos: [
    { id: 'adherencia-66', titulo: 'Habito', fase: 1, activo: true, condicion: { tipo: 'adherencia_habito', dias: 66 } },
    { id: 'ses-24', titulo: 'Sesiones', fase: 2, activo: false, condicion: { tipo: 'sesiones_totales', n: 24 } },
    { id: 'dom-10', titulo: 'Dominadas', fase: 2, activo: true, condicion: { tipo: 'reps_ejercicio', ejercicioId: 'dominadas', reps: 10 } },
  ],
};

console.log('\nHitos:\n');

test('hitosVisibles: fase 1 solo devuelve los activos de fase 1', () => {
  const v = hitosVisibles(doc, 1);
  assert.equal(v.length, 1);
  assert.equal(v[0].id, 'adherencia-66');
});

test('evaluarVisibles fase 2 excluye inactivos (ses-24) e incluye activos (dom-10)', () => {
  const v = evaluarVisibles(doc, [], bloque, 2, new Date(2026, 6, 9));
  assert.deepEqual(v.map((e) => e.id), ['dom-10']);
});

test('sesiones_totales cuenta solo el nucleo (no el dia de casa)', () => {
  const h = [ses('2026-07-06', 'A'), ses('2026-07-08', 'D'), ses('2026-07-09', 'B')];
  const ev = evaluarHito({ id: 'x', condicion: { tipo: 'sesiones_totales', n: 2 } }, h, bloque, new Date(2026, 6, 9));
  assert.equal(ev.actual, 2);
  assert.equal(ev.desbloqueado, true);
});

test('reps_ejercicio detecta el maximo de reps de un ejercicio', () => {
  const h = [ses('2026-07-06', 'A', { ejercicios: [{ ejercicioId: 'dominadas', series: [{ peso: 0, reps: 8, rir: 2 }, { peso: 0, reps: 11, rir: 0 }] }] })];
  const ev = evaluarHito({ id: 'x', condicion: { tipo: 'reps_ejercicio', ejercicioId: 'dominadas', reps: 10 } }, h, bloque, new Date(2026, 6, 9));
  assert.equal(ev.actual, 11);
  assert.equal(ev.desbloqueado, true);
});

test('carga_ejercicio detecta el maximo de peso', () => {
  const h = [ses('2026-07-06', 'A', { ejercicios: [{ ejercicioId: 'sentadilla', series: [{ peso: 100, reps: 5, rir: 2 }, { peso: 120, reps: 3, rir: 1 }] }] })];
  const ev = evaluarHito({ id: 'x', condicion: { tipo: 'carga_ejercicio', ejercicioId: 'sentadilla', kg: 110 } }, h, bloque, new Date(2026, 6, 9));
  assert.equal(ev.actual, 120);
  assert.equal(ev.desbloqueado, true);
});

test('diasDeHabito cuenta desde la primera sesion (semana en curso no penaliza)', () => {
  // primera sesion hoy mismo → 1 dia
  const HOY = new Date(2026, 6, 9);
  assert.equal(diasDeHabito([ses('2026-07-09')], bloque, HOY), 1);
  // primera hace 10 dias, con actividad la semana pasada → ~11 dias
  const h = [ses('2026-06-29'), ses('2026-07-01'), ses('2026-07-06')];
  const d = diasDeHabito(h, bloque, HOY);
  assert.ok(d >= 10 && d <= 12, `esperado ~11, obtenido ${d}`);
});

test('diasDeHabito se reinicia tras dos semanas cerradas perdidas', () => {
  // actividad hace 5 semanas, luego dos semanas vacias, luego retoma la semana pasada
  const HOY = new Date(2026, 6, 9); // 2026-W28
  const h = [ses('2026-06-01'), ses('2026-07-02')]; // hueco de >2 semanas entre ambas
  const d = diasDeHabito(h, bloque, HOY);
  // el conteo debe reflejar la reanudacion, no las 5 semanas completas
  assert.ok(d < 20, `tras romperse deberia reiniciar, obtenido ${d}`);
});

test('progreso pct se calcula y se limita a 100', () => {
  const ev = evaluarHito({ id: 'x', condicion: { tipo: 'sesiones_totales', n: 10 } },
    Array.from({ length: 15 }, (_, i) => ses(`2026-07-0${(i % 9) + 1}`)), bloque, new Date(2026, 6, 9));
  assert.equal(ev.pct, 100);
});

console.log(`\nResultado: ${ok} pasados, ${ko} fallidos\n`);
process.exit(ko === 0 ? 0 : 1);
