// app.js — shell de la PWA: registro del service worker, navegacion por pestañas
// y renderizado de vistas. S1 = scaffolding (nav + plan). S2/S3 amplian "Hoy".

import * as almacen from './almacen.js';
import * as timer from './temporizador.js';
import { sugerirCarga, ACCIONES } from './progresion.js';
import { estadoAdherencia } from './adherencia.js';
import { resumenSesion, resumenSemana } from './resumen.js';
import { evaluarVisibles } from './hitos.js';

const ZONAS = [
  { id: 'lumbar', nombre: 'Lumbar' },
  { id: 'rodilla', nombre: 'Rodilla (cara externa)' },
  { id: 'hombro', nombre: 'Hombro' },
];

// ---- estado ----
const estado = {
  bloque: null,
  origen: null,
  vista: 'hoy',
  sesionActiva: null, // RegistroSesion en curso (persistido como borrador)
  hitos: null,        // documento de hitos.json (gamificacion)
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
  // al cambiar de pantalla se detiene el temporizador de descanso (barra flotante
  // sobre <body>): si no, seguiria visible y sonando sobre otras vistas.
  timer.parar();
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
    fatiga: typeof sa.fatiga === 'number' ? sa.fatiga : null,
    notas: sa.notas || '',
  };
  almacen.guardarSesion(registro);
  almacen.limpiarBorrador();
  estado.sesionActiva = null;
  if (typeof evaluarHitosTrasSesion === 'function') evaluarHitosTrasSesion(); // gancho S5
  pantallaResumen(registro);
}

// ---- S4: compartir texto (Web Share API con fallback a portapapeles) ----
async function compartirTexto(texto, boton) {
  try {
    if (navigator.share) { await navigator.share({ text: texto }); return; }
  } catch { /* el usuario cancelo el share: seguimos con copiar */ }
  try {
    await navigator.clipboard.writeText(texto);
    if (boton) { const t = boton.textContent; boton.textContent = '¡Copiado!'; setTimeout(() => (boton.textContent = t), 1500); }
  } catch {
    // ultimo recurso: seleccionar en un textarea
    const ta = document.createElement('textarea');
    ta.value = texto; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch { /* no-op */ }
    ta.remove();
    if (boton) { const t = boton.textContent; boton.textContent = '¡Copiado!'; setTimeout(() => (boton.textContent = t), 1500); }
  }
}

// ---- S4: pantalla de resumen tras cerrar la sesion ----
function pantallaResumen(registro) {
  const md = resumenSesion(registro, estado.bloque);
  const cont = $vista();
  cont.innerHTML = '';
  $titulo().textContent = 'Sesion guardada';

  const pre = el('pre', {
    text: md,
    style: 'white-space:pre-wrap;background:var(--bg);border:1px solid var(--borde);border-radius:10px;padding:12px;font-size:0.82rem;overflow-x:auto',
  });
  const btnCompartir = el('button', { class: 'btn btn-primario', text: 'Copiar / compartir para el entrenador' });
  btnCompartir.addEventListener('click', () => compartirTexto(md, btnCompartir));

  cont.appendChild(el('div', { class: 'pila' }, [
    el('div', { class: 'exito' }, [el('strong', { text: '✓ Sesion registrada. Presentarte es la victoria.' })]),
    el('div', { class: 'tarjeta' }, [
      el('h2', { text: 'Resumen para pegar a Claude' }),
      el('p', { class: 'mini', text: 'Pega esto en la conversacion con el entrenador para la revision.' }),
      pre,
      btnCompartir,
    ]),
    el('button', { class: 'btn btn-fantasma', text: 'Ver adherencia', onclick: () => navegar('adherencia') }),
  ]));
}

// ---- Vista: Adherencia (semaforo semanal, unico KPI de fase 1) ----
function vistaAdherencia() {
  const h = almacen.getHistorial();
  const a = estadoAdherencia(h, estado.bloque);
  const clase = { verde: 'sem-verde', amarillo: 'sem-amarillo', rojo: 'sem-rojo' }[a.nivel];

  const puntos = [];
  for (let i = 0; i < a.objetivo; i++) {
    puntos.push(el('span', {
      style: `width:34px;height:34px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-weight:800;margin-right:8px;background:${i < a.estaSemana ? 'var(--acento)' : 'var(--sup2)'};color:${i < a.estaSemana ? '#fff' : 'var(--txt-tenue)'}`,
      text: i < a.estaSemana ? '✓' : '',
    }));
  }

  return el('div', { class: 'pila' }, [
    el('div', { class: 'tarjeta' }, [
      el('h2', { text: 'Esta semana' }),
      el('div', { style: 'margin:10px 0' }, puntos),
      el('p', { class: 'tenue', text: `${a.estaSemana} de ${a.objetivo} sesiones del nucleo.${a.extras ? ` (+${a.extras} extra de casa)` : ''}` }),
      el('div', { class: `semaforo ${clase}`, text: a.mensaje }),
    ]),
    // gancho S5: hitos activos de la fase actual
    typeof renderHitos === 'function' ? renderHitos() : null,
    el('div', { class: 'tarjeta pila' }, [
      el('h3', { text: 'Revision semanal' }),
      el('p', { class: 'mini', text: 'Genera el resumen de la semana (dolor, sesiones, fatiga) para pegarlo al entrenador.' }),
      (() => {
        const btn = el('button', { class: 'btn btn-fantasma', text: 'Copiar resumen semanal' });
        btn.addEventListener('click', () => compartirTexto(resumenSemana(h, estado.bloque), btn));
        return btn;
      })(),
    ]),
    el('div', { class: 'tarjeta' }, [
      el('h3', { text: 'Como se cuenta' }),
      el('p', { class: 'mini', text: 'Unico KPI: sesiones completadas/semana. La version minima cuenta igual. El dia de casa es un extra: saltarlo no es un fallo. Sin kilos, sin PRs, sin rachas de dias: eso es fase 2.' }),
      el('p', { class: 'mini', text: `${h.length} sesiones registradas en total.` }),
    ]),
  ]);
}

// ---- S5: pantalla de hitos (solo activos de la fase actual) ----
function renderHitos() {
  if (!estado.hitos || !estado.bloque) return null;
  const evals = evaluarVisibles(estado.hitos, almacen.getHistorial(), estado.bloque, estado.bloque.fase);
  if (!evals.length) return null;

  const tarjetas = evals.map((ev) => {
    const barra = el('div', { style: 'height:10px;background:var(--sup2);border-radius:999px;overflow:hidden;margin:8px 0' }, [
      el('div', { style: `height:100%;width:${ev.pct}%;background:${ev.desbloqueado ? 'var(--verde)' : 'var(--acento)'}` }),
    ]);
    return el('div', { class: 'tarjeta' }, [
      el('div', { class: 'fila-sep' }, [
        el('h3', { text: ev.hito.titulo }),
        ev.desbloqueado ? el('span', { class: 'chip chip-subir', text: '✓ logrado' }) : el('span', { class: 'mini', text: `${ev.actual}/${ev.objetivo}` }),
      ]),
      el('p', { class: 'mini', text: ev.hito.descripcion }),
      barra,
      ev.hito.premio ? el('p', { class: 'mini', text: `🎁 Premio: ${ev.hito.premio}` }) : null,
    ]);
  });

  return el('div', {}, [
    el('h2', { style: 'margin:6px 2px', text: 'Hito' + (tarjetas.length > 1 ? 's' : '') }),
    ...tarjetas,
  ]);
}

// Evalua tras cerrar sesion; celebra el primer hito recien desbloqueado.
function evaluarHitosTrasSesion() {
  if (!estado.hitos || !estado.bloque) return;
  const evals = evaluarVisibles(estado.hitos, almacen.getHistorial(), estado.bloque, estado.bloque.fase);
  const yaCelebrados = new Set(almacen.getConfig().hitosDesbloqueados || []);
  const nuevo = evals.find((ev) => ev.desbloqueado && !yaCelebrados.has(ev.id));
  if (nuevo) {
    yaCelebrados.add(nuevo.id);
    almacen.setConfig({ hitosDesbloqueados: [...yaCelebrados] });
    celebrar(nuevo.hito);
  }
}

function celebrar(hito) {
  const overlay = el('div', {
    style: 'position:fixed;inset:0;z-index:50;background:rgba(0,0,0,0.75);display:flex;align-items:center;justify-content:center;padding:24px',
  });
  const tarjeta = el('div', { class: 'tarjeta', style: 'max-width:420px;text-align:center;border-color:var(--acento)' }, [
    el('div', { style: 'font-size:3rem', text: '🏆' }),
    el('h2', { text: '¡Hito desbloqueado!' }),
    el('h3', { style: 'color:var(--acento)', text: hito.titulo }),
    el('p', { class: 'mini', text: hito.descripcion }),
    hito.premio ? el('p', { text: `🎁 ${hito.premio}` }) : null,
    el('button', { class: 'btn btn-primario', text: '¡Genial!', onclick: () => overlay.remove() }),
  ]);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  overlay.appendChild(tarjeta);
  document.body.appendChild(overlay);
}

// ---- S3: sugerencia de carga al abrir cada ejercicio ----
function renderSugerencia(eDef) {
  const reg = almacen.ultimoRegistroEjercicio(eDef.id);
  const s = sugerirCarga(eDef, reg);
  const claseChip = {
    [ACCIONES.SUBIR]: 'chip-subir',
    [ACCIONES.MANTENER]: 'chip-mantener',
    [ACCIONES.BAJAR]: 'chip-bajar',
    [ACCIONES.ESTIMAR]: 'chip-estimar',
  }[s.accion];
  const etiqueta = {
    [ACCIONES.SUBIR]: '▲ Subir',
    [ACCIONES.MANTENER]: '＝ Mantener',
    [ACCIONES.BAJAR]: '▼ Bajar',
    [ACCIONES.ESTIMAR]: '◆ Estimar',
  }[s.accion];
  return el('div', { style: 'margin:6px 0' }, [
    el('span', { class: `chip ${claseChip}`, text: etiqueta + (s.pesoSugerido != null ? ` · ${s.pesoSugerido} kg` : '') }),
    el('p', { class: 'mini', style: 'margin-top:6px', text: s.mensaje }),
  ]);
}

// ---- S3: pregunta de 24h sobre la sesion anterior (al abrir la siguiente) ----
function render24h() {
  const pend = almacen.sesionPendiente24h();
  if (!pend) return null;
  const post = pend.dolor?.post || {};
  const zonas = ZONAS.filter((z) => post[z.id] > 0); // solo zonas con dolor real
  if (!zonas.length) return null;

  const respuestas = {};
  const filas = zonas.map((z) => {
    respuestas[z.id] = post[z.id];
    const val = el('span', { class: 'dolor-val', text: String(post[z.id]) });
    const rng = el('input', { type: 'range', min: '0', max: '10', step: '1' });
    rng.value = post[z.id];
    rng.addEventListener('input', () => { respuestas[z.id] = Number(rng.value); val.textContent = rng.value; });
    return el('div', { class: 'dolor-fila' }, [
      el('label', {}, [el('span', { text: `${z.nombre} (ayer ${post[z.id]}/10)` }), val]),
      rng,
    ]);
  });

  return el('div', { class: 'tarjeta' }, [
    el('h2', { text: 'Como sigues hoy' }),
    el('p', { class: 'mini', text: 'Regla de las 24h: ¿como estan las zonas tras la ultima sesion? Si algo empeoro, la app bajara la carga.' }),
    ...filas,
    el('button', {
      class: 'btn btn-primario', text: 'Guardar y continuar',
      onclick: () => { almacen.responder24h(pend.fecha, pend.sesionId, respuestas); render(); },
    }),
  ]);
}

// ---- S3: check de dolor al cerrar sesion (reemplaza el cierre directo) ----
function pantallaDolor(sa) {
  const respuestas = {};
  const cont = $vista();
  cont.innerHTML = '';
  $titulo().textContent = 'Cierre de sesion';

  const filas = ZONAS.map((z) => {
    respuestas[z.id] = 0;
    const val = el('span', { class: 'dolor-val', text: '0' });
    const rng = el('input', { type: 'range', min: '0', max: '10', step: '1', value: '0' });
    rng.addEventListener('input', () => { respuestas[z.id] = Number(rng.value); val.textContent = rng.value; });
    return el('div', { class: 'dolor-fila' }, [
      el('label', {}, [el('span', { text: z.nombre }), val]),
      rng,
    ]);
  });

  // fatiga general 0-10 (alimenta la revision semanal del entrenador)
  let fatiga = 0;
  const fatVal = el('span', { class: 'dolor-val', text: '0' });
  const fatRng = el('input', { type: 'range', min: '0', max: '10', step: '1', value: '0' });
  fatRng.addEventListener('input', () => { fatiga = Number(fatRng.value); fatVal.textContent = fatRng.value; });

  cont.appendChild(el('div', { class: 'pila' }, [
    el('div', { class: 'tarjeta' }, [
      el('h2', { text: 'Dolor por zona (0-10)' }),
      el('p', { class: 'mini', text: 'Molestia ≤3-4 durante el ejercicio es aceptable si no empeora a 24h. Marca lo que sentiste hoy. Si hubo dolor agudo, punzante, irradiado o nocturno: fisioterapeuta antes de seguir cargando.' }),
      ...filas,
    ]),
    el('div', { class: 'tarjeta' }, [
      el('h3', { text: 'Fatiga general (0-10)' }),
      el('div', { class: 'dolor-fila' }, [
        el('label', {}, [el('span', { text: 'Cansancio al acabar' }), fatVal]),
        fatRng,
      ]),
    ]),
    el('button', {
      class: 'btn btn-primario', text: 'Guardar sesion',
      onclick: () => {
        sa.dolor = { post: respuestas, h24: { lumbar: null, rodilla: null, hombro: null } };
        sa.fatiga = fatiga;
        finalizarSesion();
      },
    }),
    el('button', {
      class: 'btn btn-fantasma', text: 'Volver al registro',
      onclick: () => { navegar('hoy'); },
    }),
  ]));
}
alCerrarSesion = pantallaDolor;

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
  const btnExport = el('button', { class: 'btn btn-fantasma', text: 'Exportar historial (JSON)' });
  btnExport.addEventListener('click', () => descargarJSON());
  const btnCopiar = el('button', { class: 'btn btn-fantasma', text: 'Copiar historial al portapapeles' });
  btnCopiar.addEventListener('click', () => compartirTexto(almacen.exportarJSON(), btnCopiar));

  const areaImport = el('textarea', {
    placeholder: 'Pega aqui un JSON exportado para importarlo…',
    style: 'width:100%;min-height:90px;background:var(--bg);border:1px solid var(--borde);border-radius:10px;color:var(--txt);padding:10px;font-size:0.85rem',
  });
  const btnImport = el('button', { class: 'btn btn-fantasma', text: 'Importar (reemplaza el historial)' });
  btnImport.addEventListener('click', () => {
    if (!areaImport.value.trim()) return;
    if (!confirm('Esto reemplaza el historial actual. ¿Continuar?')) return;
    const r = almacen.importarJSON(areaImport.value, 'reemplazar');
    alert(r.mensaje);
    if (r.ok) navegar('adherencia');
  });

  const acciones = el('div', { class: 'tarjeta pila' }, [
    el('h3', { text: 'Datos' }),
    el('button', {
      class: 'btn btn-fantasma',
      text: 'Recargar plan',
      onclick: async () => { await iniciarBloque(); navegar('hoy'); },
    }),
    btnExport,
    btnCopiar,
    el('hr', { style: 'border:none;border-top:1px solid var(--borde);margin:6px 0' }),
    areaImport,
    btnImport,
  ]);
  return el('div', { class: 'pila' }, [info, acciones]);
}

// Descarga el historial como fichero .json (con fallback a compartir/copiar).
function descargarJSON() {
  const texto = almacen.exportarJSON();
  try {
    const blob = new Blob([texto], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = el('a', { href: url, download: `power-historial-${hoyISO()}.json` });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch {
    compartirTexto(texto);
  }
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
  try { estado.hitos = await almacen.cargarHitos(); } catch { estado.hitos = null; }
  const borrador = almacen.getBorrador();
  if (borrador && estado.bloque && defSesion(borrador.sesionId)) estado.sesionActiva = borrador;
  navegar('hoy');
}

// exponer estado para modulos de S2/S3
export const app = { estado, navegar, iniciarBloque, render };

init();
