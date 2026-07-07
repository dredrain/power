// app.js — shell de la PWA: registro del service worker, navegacion por pestañas
// y renderizado de vistas. S1 = scaffolding (nav + plan). S2/S3 amplian "Hoy".

import * as almacen from './almacen.js';
import * as timer from './temporizador.js';

// ---- estado ----
const estado = {
  bloque: null,
  origen: null,
  vista: 'hoy',
  sesionActiva: null, // RegistroSesion en curso (persistido como borrador)
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

// ---- Vista: Hoy ----
// Si hay sesion en curso, muestra la pantalla de registro; si no, la lista.
function vistaHoy() {
  if (!estado.bloque) {
    return el('p', { class: 'cargando', text: 'No hay bloque cargado.' });
  }
  if (estado.sesionActiva) return renderSesionActiva();

  const frag = el('div', { class: 'pila' });
  // gancho S3: pregunta de 24h sobre la sesion anterior
  const banner24h = typeof render24h === 'function' ? render24h() : null;
  if (banner24h) frag.appendChild(banner24h);

  frag.appendChild(
    el('p', { class: 'tenue', text: `${estado.bloque.titulo} · fase ${estado.bloque.fase} · ${estado.bloque.semanas} semanas` }),
  );
  for (const sesion of estado.bloque.sesiones) frag.appendChild(tarjetaSesion(sesion));
  return frag;
}

function defSesion(sesionId) {
  return estado.bloque?.sesiones.find((s) => s.id === sesionId) || null;
}

function tarjetaSesion(sesion) {
  const nEj = sesion.ejercicios.length;
  const borrador = almacen.getBorrador();
  const hayBorrador = borrador && borrador.sesionId === sesion.id;
  return el('div', { class: 'tarjeta' }, [
    el('div', { class: 'fila-sep' }, [
      el('h2', { text: sesion.nombre }),
      sesion.opcional ? el('span', { class: 'chip chip-estimar', text: 'opcional' }) : null,
    ]),
    el('p', { class: 'mini', text: `${nEj} ejercicios · ~${sesion.duracionCompletaMin} min (min ~${sesion.duracionMinimaMin})` }),
    el('button', {
      class: 'btn btn-primario',
      text: hayBorrador ? 'Reanudar sesion' : 'Empezar sesion',
      onclick: () => abrirSesion(sesion.id),
    }),
  ]);
}

// ---- Abrir / construir sesion activa ----
export function abrirSesion(sesionId) {
  const def = defSesion(sesionId);
  if (!def) return;
  const borrador = almacen.getBorrador();
  if (borrador && borrador.sesionId === sesionId) {
    estado.sesionActiva = borrador; // reanudar
  } else {
    estado.sesionActiva = construirSesion(def);
    almacen.guardarBorrador(estado.sesionActiva);
  }
  navegar('hoy');
}

function construirSesion(def) {
  const ejercicios = def.ejercicios.map((e) => {
    const prev = almacen.ultimosValores(e.id);
    const series = [];
    for (let i = 0; i < e.series; i++) {
      series.push({
        peso: prev && typeof prev.peso === 'number' ? prev.peso : null,
        reps: prev && typeof prev.reps === 'number' ? prev.reps : null,
        rir: null,
        hecha: false,
      });
    }
    return { ejercicioId: e.id, series };
  });
  return {
    fecha: hoyISO(),
    iso: new Date().toISOString(),
    bloque: estado.bloque.bloque,
    sesionId: def.id,
    version: 'completa',
    completada: false,
    inicioMs: Date.now(),
    ejercicios,
    dolor: { post: {}, h24: {} },
    notas: '',
  };
}

function persistir() {
  if (estado.sesionActiva) almacen.guardarBorrador(estado.sesionActiva);
}

function ejerciciosVisibles(def, version) {
  return version === 'minima' ? def.ejercicios.filter((e) => !e.recortable) : def.ejercicios;
}

// ---- Pantalla de registro ----
function renderSesionActiva() {
  const sa = estado.sesionActiva;
  const def = defSesion(sa.sesionId);
  const frag = el('div', { class: 'pila' });

  // cabecera con toggle "voy justo" + cancelar
  frag.appendChild(el('div', { class: 'tarjeta' }, [
    el('div', { class: 'fila-sep' }, [
      el('h2', { text: def.nombre }),
      el('span', { class: 'mini', text: sa.version === 'minima' ? 'version minima' : 'version completa' }),
    ]),
    el('div', { class: 'toggle-fila' }, [
      el('span', {}, [
        el('strong', { text: 'Voy justo' }),
        el('div', { class: 'mini', text: 'Deja solo el basico y el trabajo no recortable.' }),
      ]),
      etiquetaSwitch(sa.version === 'minima', (checked) => {
        sa.version = checked ? 'minima' : 'completa';
        persistir();
        render();
      }),
    ]),
    el('button', {
      class: 'btn btn-fantasma', text: 'Cancelar sesion',
      onclick: () => {
        if (confirm('¿Descartar esta sesion sin guardar?')) {
          almacen.limpiarBorrador();
          estado.sesionActiva = null;
          timer.parar();
          navegar('hoy');
        }
      },
    }),
  ]));

  for (const eDef of ejerciciosVisibles(def, sa.version)) {
    frag.appendChild(tarjetaEjercicio(eDef, sa));
  }

  frag.appendChild(el('button', {
    class: 'btn btn-primario', text: 'Terminar sesion',
    onclick: terminarSesion,
  }));
  return frag;
}

function etiquetaSwitch(checked, onChange) {
  const input = el('input', { type: 'checkbox' });
  input.checked = checked;
  input.addEventListener('change', () => onChange(input.checked));
  return el('label', { class: 'switch' }, [input, el('span', { class: 'pista' })]);
}

function tarjetaEjercicio(eDef, sa) {
  const est = sa.ejercicios.find((x) => x.ejercicioId === eDef.id);
  const prev = almacen.ultimosValores(eDef.id);
  const card = el('div', { class: 'tarjeta' });

  card.appendChild(el('div', { class: 'fila-sep' }, [
    el('h3', { text: eDef.nombre }),
    el('span', { class: eDef.tipo === 'basico' ? 'chip chip-subir' : 'mini', text: eDef.tipo }),
  ]));
  card.appendChild(el('p', { class: 'mini', text:
    `${eDef.series}×${eDef.reps} · RIR ${eDef.rirObjetivo} · descanso ${eDef.descansoSeg}s` }));
  card.appendChild(el('p', { class: 'mini', text: prev
    ? `Ultima vez: ${prev.peso ?? '—'} kg × ${prev.reps ?? '—'}${typeof prev.rir === 'number' ? ' @RIR' + prev.rir : ''}`
    : 'Primera vez: elige un peso comodo (RPE ≤6).' }));

  // gancho S3: sugerencia subir/mantener/bajar
  const sug = typeof renderSugerencia === 'function' ? renderSugerencia(eDef) : null;
  if (sug) card.appendChild(sug);

  if (eDef.notas) card.appendChild(el('p', { class: 'mini', text: eDef.notas }));

  est.series.forEach((serie, i) => card.appendChild(filaSerie(eDef, est, serie, i)));
  return card;
}

function campoNum(label, valor, onInput) {
  const input = el('input', { type: 'number', inputmode: 'decimal', step: 'any' });
  if (valor != null) input.value = valor;
  input.addEventListener('input', () => {
    const v = input.value === '' ? null : Number(input.value);
    onInput(Number.isNaN(v) ? null : v);
  });
  return el('div', { class: 'campo' }, [el('label', { text: label }), input]);
}

function filaSerie(eDef, est, serie, i) {
  const check = el('button', { class: 'check-serie' + (serie.hecha ? ' hecha' : ''), text: serie.hecha ? '✓' : '' });
  check.addEventListener('click', () => {
    serie.hecha = !serie.hecha;
    check.classList.toggle('hecha', serie.hecha);
    check.textContent = serie.hecha ? '✓' : '';
    if (serie.hecha) timer.iniciar(eDef.descansoSeg);
    persistir();
  });
  return el('div', { class: 'serie' }, [
    el('span', { class: 'serie-num', text: String(i + 1) }),
    campoNum('kg', serie.peso, (v) => { serie.peso = v; persistir(); }),
    campoNum('reps', serie.reps, (v) => { serie.reps = v; persistir(); }),
    campoNum('RIR', serie.rir, (v) => { serie.rir = v; persistir(); }),
    check,
  ]);
}

// ---- Terminar sesion ----
// S3 instala alCerrarSesion para meter el check de dolor antes de guardar.
export let alCerrarSesion = null;
export function setAlCerrar(fn) { alCerrarSesion = fn; }

function terminarSesion() {
  const sa = estado.sesionActiva;
  if (!sa) return;
  const algoRegistrado = sa.ejercicios.some((e) => e.series.some((s) => typeof s.reps === 'number' || s.hecha));
  if (!algoRegistrado && !confirm('No has registrado ninguna serie. ¿Cerrar igualmente?')) return;
  timer.parar();
  if (typeof alCerrarSesion === 'function') { alCerrarSesion(sa); return; }
  finalizarSesion();
}

// Construye el RegistroSesion definitivo y lo guarda en el historial.
export function finalizarSesion() {
  const sa = estado.sesionActiva;
  if (!sa) return;
  const registro = {
    fecha: sa.fecha,
    iso: new Date().toISOString(),
    bloque: sa.bloque,
    sesionId: sa.sesionId,
    version: sa.version,
    completada: true,
    duracionSeg: Math.max(0, Math.round((Date.now() - (sa.inicioMs || Date.now())) / 1000)),
    ejercicios: sa.ejercicios
      .map((e) => ({
        ejercicioId: e.ejercicioId,
        series: e.series
          .filter((s) => typeof s.reps === 'number' || s.hecha)
          .map((s) => ({ peso: s.peso ?? null, reps: s.reps ?? null, rir: s.rir ?? null })),
      }))
      .filter((e) => e.series.length),
    dolor: sa.dolor || { post: {}, h24: {} },
    notas: sa.notas || '',
  };
  almacen.guardarSesion(registro);
  almacen.limpiarBorrador();
  estado.sesionActiva = null;
  navegar('adherencia');
}

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
  const borrador = almacen.getBorrador();
  if (borrador && estado.bloque && defSesion(borrador.sesionId)) estado.sesionActiva = borrador;
  navegar('hoy');
}

// exponer estado para modulos de S2/S3
export const app = { estado, navegar, iniciarBloque, render };

init();
