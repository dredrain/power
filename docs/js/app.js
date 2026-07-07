// app.js — shell de la PWA: registro del service worker, navegacion por pestañas
// y renderizado de vistas. S1 = scaffolding (nav + plan). S2/S3 amplian "Hoy".

import * as almacen from './almacen.js';

// ---- estado ----
const estado = {
  bloque: null,
  origen: null,
  vista: 'hoy',
};

// ---- helpers DOM ----
export function el(tag, attrs = {}, hijos = []) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') n.className = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k === 'text') n.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
    else if (v != null && v !== false) n.setAttribute(k, v);
  }
  for (const h of [].concat(hijos)) {
    if (h == null || h === false) continue;
    n.appendChild(typeof h === 'string' ? document.createTextNode(h) : h);
  }
  return n;
}

const $vista = () => document.getElementById('vista');
const $titulo = () => document.getElementById('titulo-vista');

// ---- fecha / semana ----
export function hoyISO(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ---- navegacion ----
const TITULOS = { hoy: 'Hoy', adherencia: 'Adherencia', plan: 'Plan', ajustes: 'Ajustes' };

export function navegar(vista) {
  estado.vista = vista;
  $titulo().textContent = TITULOS[vista] || 'Power';
  document.querySelectorAll('.tab').forEach((t) =>
    t.classList.toggle('activa', t.dataset.vista === vista),
  );
  render();
}

function render() {
  const cont = $vista();
  cont.innerHTML = '';
  const fn = VISTAS[estado.vista] || VISTAS.hoy;
  cont.appendChild(fn());
  cont.scrollTop = 0;
  window.scrollTo(0, 0);
}

// Punto de extension: S2/S3 sobreescriben VISTAS.hoy con la pantalla real.
export const VISTAS = {
  hoy: vistaHoy,
  adherencia: vistaAdherencia,
  plan: vistaPlan,
  ajustes: vistaAjustes,
};

// ---- Vista: Hoy (S1: lista de sesiones; S2/S3 amplian) ----
function vistaHoy() {
  const frag = el('div', { class: 'pila' });
  if (!estado.bloque) {
    frag.appendChild(el('p', { class: 'cargando', text: 'No hay bloque cargado.' }));
    return frag;
  }
  frag.appendChild(
    el('p', { class: 'tenue', text: `${estado.bloque.titulo} · fase ${estado.bloque.fase} · ${estado.bloque.semanas} semanas` }),
  );

  for (const sesion of estado.bloque.sesiones) {
    frag.appendChild(tarjetaSesion(sesion));
  }
  return frag;
}

function tarjetaSesion(sesion) {
  const nEj = sesion.ejercicios.length;
  const card = el('div', { class: 'tarjeta' }, [
    el('div', { class: 'fila-sep' }, [
      el('h2', { text: sesion.nombre }),
      sesion.opcional ? el('span', { class: 'chip chip-estimar', text: 'opcional' }) : null,
    ]),
    el('p', { class: 'mini', text: `${nEj} ejercicios · ~${sesion.duracionCompletaMin} min (min ~${sesion.duracionMinimaMin})` }),
    el('button', {
      class: 'btn btn-primario',
      text: 'Empezar sesion',
      onclick: () => abrirSesion(sesion.id),
    }),
  ]);
  return card;
}

// abrirSesion: S2 lo implementa de verdad. En S1 avisa que llega en S2.
export let abrirSesion = (sesionId) => {
  alert('La pantalla de registro llega en S2. Sesion: ' + sesionId);
};
export function setAbrirSesion(fn) { abrirSesion = fn; }

// ---- Vista: Adherencia (S3 la amplia con el semaforo real) ----
function vistaAdherencia() {
  const h = almacen.getHistorial();
  return el('div', { class: 'pila' }, [
    el('div', { class: 'tarjeta' }, [
      el('h2', { text: 'Sesiones registradas' }),
      el('p', { class: 'tenue', text: `${h.length} en total. El detalle semanal llega en S3.` }),
    ]),
  ]);
}

// ---- Vista: Plan ----
function vistaPlan() {
  const frag = el('div', { class: 'pila' });
  if (!estado.bloque) return el('p', { class: 'cargando', text: 'Sin bloque.' });
  frag.appendChild(el('p', { class: 'tenue', text: estado.bloque.notas }));
  for (const sesion of estado.bloque.sesiones) {
    const items = sesion.ejercicios.map((e) =>
      el('li', { class: 'fila-sep', style: 'padding:6px 0;border-bottom:1px solid var(--borde)' }, [
        el('span', {}, [
          el('strong', { text: e.nombre }),
          el('span', { class: 'mini', text: ` ${e.series}×${e.reps} · RIR ${e.rirObjetivo}` }),
        ]),
        e.recortable ? el('span', { class: 'mini', text: 'recortable' }) : el('span', { class: 'chip chip-subir', text: 'fijo' }),
      ]),
    );
    frag.appendChild(el('div', { class: 'tarjeta' }, [
      el('h2', { text: sesion.nombre }),
      el('ul', { class: 'limpia' }, items),
    ]));
  }
  return frag;
}

// ---- Vista: Ajustes ----
function vistaAjustes() {
  const info = el('div', { class: 'tarjeta' }, [
    el('h2', { text: 'Power Tracker' }),
    el('p', { class: 'tenue', text: `Bloque cargado desde: ${estado.origen || '—'}` }),
    el('p', { class: 'mini', text: 'PWA sin conexion. El plan lo edita el entrenador; el historial vive en este movil.' }),
  ]);
  const acciones = el('div', { class: 'tarjeta pila' }, [
    el('h3', { text: 'Datos' }),
    el('button', {
      class: 'btn btn-fantasma',
      text: 'Recargar plan',
      onclick: async () => { await iniciarBloque(); navegar('hoy'); },
    }),
  ]);
  return el('div', { class: 'pila' }, [info, acciones]);
}

// ---- arranque ----
async function iniciarBloque() {
  try {
    const { bloque, origen } = await almacen.cargarBloque();
    estado.bloque = bloque;
    estado.origen = origen;
  } catch (e) {
    estado.bloque = null;
    $vista().innerHTML = `<p class="aviso">${e.message}</p>`;
  }
}

function registrarSW() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
  const badge = document.getElementById('sin-conexion');
  const pinta = () => badge.classList.toggle('oculto', navigator.onLine);
  window.addEventListener('online', pinta);
  window.addEventListener('offline', pinta);
  pinta();
}

function conectarTabs() {
  document.querySelectorAll('.tab').forEach((t) =>
    t.addEventListener('click', () => navegar(t.dataset.vista)),
  );
}

async function init() {
  registrarSW();
  conectarTabs();
  await iniciarBloque();
  navegar('hoy');
}

// exponer estado para modulos de S2/S3
export const app = { estado, navegar, iniciarBloque, render };

init();
