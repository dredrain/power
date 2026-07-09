// app.js — shell de la PWA: registro del service worker, navegacion por pestañas
// y renderizado de vistas. S1 = scaffolding (nav + plan). S2/S3 amplian "Hoy".

import * as almacen from './almacen.js';
import * as timer from './temporizador.js';
import { sugerirCarga, ACCIONES } from './progresion.js';
import { estadoAdherencia } from './adherencia.js';
import { resumenSesion, resumenSemana } from './resumen.js';
import { evaluarVisibles } from './hitos.js';
import { ACLARACIONES, FICHAS, esquemaSVG } from './guia.js';

const ZONAS = [
  { id: 'lumbar', nombre: 'Lumbar' },
  { id: 'rodilla', nombre: 'Rodilla (cara externa)' },
  { id: 'hombro', nombre: 'Hombro' },
  { id: 'trapecio', nombre: 'Trapecio' },
];

// ---- estado ----
const estado = {
  bloque: null,
  origen: null,
  vista: 'hoy',
  sesionActiva: null, // RegistroSesion en curso (persistido como borrador)
  hitos: null,        // documento de hitos.json (gamificacion)
  planSub: 'sesiones', // sub-vista de Plan: 'sesiones' | 'ejercicios'
  fichaFoco: null,    // id de ejercicio a resaltar al abrir su ficha
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
const TITULOS = { hoy: 'Hoy', adherencia: 'Adherencia', plan: 'Plan', aclaraciones: 'Aclaraciones', ajustes: 'Ajustes' };

export function navegar(vista) {
  // B2: NO se para el temporizador al cambiar de pestaña. La barra flota sobre
  // <body> (render() solo limpia #vista) y su estado vive como timestamp, asi que
  // el descanso persiste y se ve en cualquier pantalla. Solo se para de forma
  // explicita al terminar/cancelar la sesion o al pulsar "Saltar".
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
  aclaraciones: vistaAclaraciones,
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

  // B1: aviso de sesion sin terminar (en vez de abrirla por encima del bloque).
  const avisoReanudar = bannerReanudar();
  if (avisoReanudar) frag.appendChild(avisoReanudar);

  frag.appendChild(
    el('p', { class: 'tenue', text: `${estado.bloque.titulo} · fase ${estado.bloque.fase} · ${estado.bloque.semanas} semanas` }),
  );
  for (const sesion of estado.bloque.sesiones) frag.appendChild(tarjetaSesion(sesion));
  return frag;
}

// Aviso superior si hay un borrador a medias: lo hace visible sin tapar el bloque.
function bannerReanudar() {
  const b = almacen.getBorrador();
  if (!b || !defSesion(b.sesionId) || !tieneAlgoRegistrado(b)) return null;
  const nombre = defSesion(b.sesionId).nombre;
  return el('div', { class: 'tarjeta aviso-reanudar' }, [
    el('div', { class: 'fila-sep' }, [
      el('span', {}, [
        el('strong', { text: 'Sesion sin terminar' }),
        el('div', { class: 'mini', text: nombre }),
      ]),
      el('button', { class: 'btn btn-primario btn-compacto', text: 'Reanudar', onclick: () => abrirSesion(b.sesionId) }),
    ]),
  ]);
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
    estado.sesionActiva = borrador; // reanudar la misma sesion
  } else {
    // hay un borrador de OTRA sesion sin terminar: no lo pisamos sin avisar
    if (borrador && tieneAlgoRegistrado(borrador)) {
      const otra = defSesion(borrador.sesionId);
      const ok = confirm(`Tienes "${otra ? otra.nombre : borrador.sesionId}" sin terminar. ¿Descartarla y empezar esta?`);
      if (!ok) { estado.sesionActiva = borrador; navegar('hoy'); return; }
    }
    estado.sesionActiva = construirSesion(def);
    almacen.guardarBorrador(estado.sesionActiva);
  }
  navegar('hoy');
}

// Registro en blanco de un ejercicio, con peso/reps precargados de la ultima vez.
function nuevoRegistroEjercicio(e) {
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
}

// Si el entrenador anadio ejercicios al plan despues de crear el borrador, los
// incorpora a la sesion en curso (evita que el registro se quede corto o casque).
function reconciliarEjercicios(def, sa) {
  const existentes = new Set(sa.ejercicios.map((e) => e.ejercicioId));
  let cambio = false;
  for (const e of def.ejercicios) {
    if (existentes.has(e.id)) continue;
    sa.ejercicios.push(nuevoRegistroEjercicio(e));
    cambio = true;
  }
  if (cambio) persistir();
}

function construirSesion(def) {
  const ejercicios = def.ejercicios.map(nuevoRegistroEjercicio);
  return {
    fecha: hoyISO(),
    iso: new Date().toISOString(),
    bloque: estado.bloque.bloque,
    sesionId: def.id,
    version: 'completa',
    completada: false,
    inicioMs: Date.now(),
    ejercicios,
    calentamiento: (def.calentamiento?.items || []).map(() => false),
    dolor: { post: {}, h24: {} },
    notas: '',
  };
}

function persistir() {
  if (estado.sesionActiva) almacen.guardarBorrador(estado.sesionActiva);
}

// ¿el borrador tiene alguna serie realizada (marcada o con RIR)?
function tieneAlgoRegistrado(b) {
  return (b?.ejercicios || []).some((e) => (e.series || []).some((s) => s.hecha || typeof s.rir === 'number'));
}

function ejerciciosVisibles(def, version) {
  return version === 'minima' ? def.ejercicios.filter((e) => !e.recortable) : def.ejercicios;
}

// El borrador apunta a una sesion que ya no existe en el plan (el entrenador lo cambio).
function sesionHuerfana() {
  return el('div', { class: 'pila' }, [
    el('p', { class: 'aviso', text: 'La sesion guardada ya no existe en el plan actual. Descartala para volver a empezar.' }),
    el('button', {
      class: 'btn btn-primario', text: 'Descartar y volver',
      onclick: () => {
        almacen.limpiarBorrador();
        estado.sesionActiva = null;
        timer.parar();
        navegar('hoy');
      },
    }),
  ]);
}

// ---- Pantalla de registro ----
function renderSesionActiva() {
  const sa = estado.sesionActiva;
  const def = defSesion(sa.sesionId);
  if (!def) return sesionHuerfana();
  reconciliarEjercicios(def, sa);
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

  // F4: notas puntuales de esta sesion-dia (viven en el bloque, no repetidas por ejercicio)
  const notaSes = tarjetaNotaSesion(def);
  if (notaSes) frag.appendChild(notaSes);

  const cal = tarjetaCalentamiento(def, sa);
  if (cal) frag.appendChild(cal);

  const visibles = ejerciciosVisibles(def, sa.version);
  if (!visibles.length) {
    frag.appendChild(el('p', { class: 'mini', text: 'En "voy justo" no queda ningun ejercicio en esta sesion. Desactiva "voy justo" para la version completa.' }));
  }
  for (const eDef of visibles) {
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

// ---- Calentamiento / movilidad integrada al inicio de la sesion ----
// No es un bloque recortable: se muestra tambien en "voy justo" porque el trabajo
// correctivo va en el calentamiento, no se corta (ver instrucciones, fase 1). El
// estado de los checks vive en el borrador y NO entra al historial ni al KPI.
function tarjetaCalentamiento(def, sa) {
  const cal = def.calentamiento;
  if (!cal || !Array.isArray(cal.items) || !cal.items.length) return null;
  if (!Array.isArray(sa.calentamiento) || sa.calentamiento.length !== cal.items.length) {
    sa.calentamiento = cal.items.map((_, i) => !!(sa.calentamiento && sa.calentamiento[i]));
    persistir();
  }
  const hechos = () => sa.calentamiento.filter(Boolean).length;
  const contador = el('span', { class: 'mini', text: `${hechos()}/${cal.items.length}` });

  const filas = cal.items.map((item, i) => {
    const fila = el('div', { class: 'calent-item' + (sa.calentamiento[i] ? ' hecho' : '') }, [
      el('span', { class: 'calent-check', text: sa.calentamiento[i] ? '✓' : '' }),
      el('span', { class: 'calent-txt' }, [
        el('div', { class: 'calent-nom', text: item.nombre }),
        item.detalle ? el('div', { class: 'calent-det', text: item.detalle }) : null,
      ]),
      item.esquema ? botonEsquema(item) : null,
    ]);
    fila.addEventListener('click', () => {
      sa.calentamiento[i] = !sa.calentamiento[i];
      fila.classList.toggle('hecho', sa.calentamiento[i]);
      fila.querySelector('.calent-check').textContent = sa.calentamiento[i] ? '✓' : '';
      contador.textContent = `${hechos()}/${cal.items.length}`;
      persistir();
    });
    return fila;
  });

  const det = el('details', { class: 'tarjeta calent' });
  det.open = hechos() < cal.items.length; // colapsado cuando ya esta completo
  det.appendChild(el('summary', { class: 'calent-sum' }, [
    el('span', { text: `Calentamiento · movilidad${cal.duracionMin ? ` (~${cal.duracionMin} min)` : ''}` }),
    contador,
  ]));
  if (cal.nota) det.appendChild(el('p', { class: 'mini', style: 'margin:8px 0 2px', text: cal.nota }));
  filas.forEach((f) => det.appendChild(f));
  return det;
}

// F4: ¿es la primera vez que se hace esta sesion-dia? (no hay ningun registro suyo)
function esPrimeraVezSesion(sesionId) {
  return !almacen.getHistorial().some((r) => r.sesionId === sesionId && (r.ejercicios || []).length);
}

// F4: nota(s) de la sesion-dia. `notaPrimeraVez` solo la 1a vez (p.ej. "elige peso
// con RPE ≤6"); `notaSesion` siempre (p.ej. "estirar al acabar"). Antes este tipo
// de texto se repetia en cada tarjeta de ejercicio; ahora vive una sola vez aqui.
function tarjetaNotaSesion(def) {
  const notas = [];
  if (def.notaPrimeraVez && esPrimeraVezSesion(def.id)) notas.push(def.notaPrimeraVez);
  if (def.notaSesion) notas.push(def.notaSesion);
  if (!notas.length) return null;
  return el('div', { class: 'tarjeta nota-sesion' },
    notas.map((t) => el('p', { class: 'nota-sesion-txt', text: t })));
}

function tarjetaEjercicio(eDef, sa) {
  const est = sa.ejercicios.find((x) => x.ejercicioId === eDef.id);
  if (!est) return el('div'); // no deberia pasar tras reconciliarEjercicios; guarda defensiva
  const prev = almacen.ultimosValores(eDef.id);
  const card = el('div', { class: 'tarjeta' });

  card.appendChild(el('div', { class: 'fila-sep' }, [
    el('h3', { text: eDef.nombre }),
    el('span', { class: eDef.tipo === 'basico' ? 'chip chip-subir' : 'mini', text: eDef.tipo }),
  ]));
  card.appendChild(el('p', { class: 'mini', text:
    `${eDef.series}×${eDef.reps} · RIR ${eDef.rirObjetivo} · descanso ${eDef.descansoSeg}s` }));
  // F4: la instruccion de "primera vez" (RPE ≤6) ya no se repite aqui: vive en la
  // nota de la sesion-dia. Solo se muestra el dato util por ejercicio: la ultima vez.
  card.appendChild(el('p', { class: 'mini', text: prev
    ? `Ultima vez: ${prev.peso ?? '—'} kg × ${prev.reps ?? '—'}${typeof prev.rir === 'number' ? ' @RIR' + prev.rir : ''}`
    : 'Primera vez con este ejercicio.' }));

  // gancho S3: sugerencia subir/mantener/bajar
  const sug = typeof renderSugerencia === 'function' ? renderSugerencia(eDef) : null;
  if (sug) card.appendChild(sug);

  const enlaces = el('div', { class: 'fila-enlaces' });
  if (FICHAS[eDef.id]) {
    const link = el('button', { class: 'ficha-link', text: 'Ver ficha ›' });
    link.addEventListener('click', () => abrirFicha(eDef.id));
    enlaces.appendChild(link);
  }
  // F3: histórico por ejercicio (memoria de trabajo: qué puse las veces pasadas)
  const linkHist = el('button', { class: 'ficha-link', text: 'Ver histórico ›' });
  linkHist.addEventListener('click', () => abrirHistorico(eDef.id, eDef.nombre));
  enlaces.appendChild(linkHist);
  card.appendChild(enlaces);

  est.series.forEach((serie, i) => card.appendChild(filaSerie(eDef, est, serie, i)));

  // F1: nota libre por ejercicio (persistida en el log e incluida en el resumen)
  const ta = el('textarea', {
    class: 'nota-ej-input', rows: '2',
    placeholder: 'Nota (opcional): sensaciones, ajustes, molestias…',
  });
  if (est.notas) ta.value = est.notas;
  ta.addEventListener('input', () => { est.notas = ta.value; persistir(); });
  card.appendChild(ta);
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
  const algoRegistrado = sa.ejercicios.some((e) => e.series.some((s) => s.hecha || typeof s.rir === 'number'));
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
    // cap a 6h: una sesion reanudada al dia siguiente no debe reportar horas al entrenador
    duracionSeg: Math.min(6 * 3600, Math.max(0, Math.round((Date.now() - (sa.inicioMs || Date.now())) / 1000))),
    ejercicios: sa.ejercicios
      .map((e) => {
        const nota = (e.notas || '').trim();
        return {
          ejercicioId: e.ejercicioId,
          // Solo se guardan las series REALIZADAS: marcada (hecha) o con RIR introducido.
          // Los valores precargados (peso/reps de la ultima vez, sin tocar) NO cuentan,
          // asi los ejercicios ocultos en "voy justo" o las series no hechas no ensucian
          // el historial ni la progresion/adherencia.
          series: e.series
            .filter((s) => s.hecha || typeof s.rir === 'number')
            .map((s) => ({ peso: s.peso ?? null, reps: s.reps ?? null, rir: s.rir ?? null })),
          // F1: nota libre del ejercicio (solo si el usuario escribio algo).
          ...(nota ? { notas: nota } : {}),
        };
      })
      // Se conserva el ejercicio si tiene series realizadas o una nota escrita.
      .filter((e) => e.series.length || e.notas),
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
  // F2: exportar SOLO esta sesion como JSON (ademas del texto para el entrenador).
  const btnExpSesion = el('button', { class: 'btn btn-fantasma', text: 'Exportar esta sesion (JSON)' });
  btnExpSesion.addEventListener('click', () => {
    const texto = almacen.exportarSesion(registro.fecha, registro.sesionId);
    if (texto) descargarTexto(texto, `power-sesion-${registro.fecha}-${registro.sesionId}.json`);
  });

  cont.appendChild(el('div', { class: 'pila' }, [
    el('div', { class: 'exito' }, [el('strong', { text: '✓ Sesion registrada. Presentarte es la victoria.' })]),
    el('div', { class: 'tarjeta' }, [
      el('h2', { text: 'Resumen para pegar a Claude' }),
      el('p', { class: 'mini', text: 'Pega esto en la conversacion con el entrenador para la revision.' }),
      pre,
      btnCompartir,
      btnExpSesion,
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
      el('p', { class: 'mini', text: `${h.length} sesiones registradas en total. Unico KPI: sesiones/semana.` }),
      (() => {
        const b = el('button', { class: 'ficha-link', text: 'Como se cuenta la adherencia ›' });
        b.addEventListener('click', () => navegar('aclaraciones'));
        return b;
      })(),
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
      el('label', {}, [el('span', { text: `${z.nombre} (ultima sesion ${post[z.id]}/10)` }), val]),
      rng,
    ]);
  });

  return el('div', { class: 'tarjeta' }, [
    el('h2', { text: 'Como sigues hoy' }),
    el('p', { class: 'mini', text: '¿Como estan hoy las zonas de la ultima sesion? Si algo empeoro, la app baja la carga.' }),
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
      el('p', { class: 'mini', text: 'Molestia ≤3-4 es aceptable si no empeora a 24h. Si hubo dolor agudo, punzante o irradiado: fisio antes de seguir cargando.' }),
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

// ---- Vista: Plan (Sesiones | Ejercicios) ----
function vistaPlan() {
  if (!estado.bloque) return el('p', { class: 'cargando', text: 'Sin bloque.' });
  const frag = el('div', { class: 'pila' });
  const sub = estado.planSub || 'sesiones';

  const mkSub = (id, txt) => {
    const b = el('button', { class: 'subtab' + (sub === id ? ' activa' : ''), text: txt });
    b.addEventListener('click', () => { estado.planSub = id; if (id !== 'ejercicios') estado.fichaFoco = null; render(); });
    return b;
  };
  frag.appendChild(el('div', { class: 'subtabs' }, [mkSub('sesiones', 'Sesiones'), mkSub('ejercicios', 'Ejercicios')]));

  if (sub === 'ejercicios') { frag.appendChild(planEjercicios()); return frag; }

  frag.appendChild(el('p', { class: 'tenue', text: estado.bloque.notas }));
  for (const sesion of estado.bloque.sesiones) {
    const cal = sesion.calentamiento;
    const items = sesion.ejercicios.map((e) => {
      const fila = el('li', { class: 'fila-sep', style: 'padding:8px 0;border-bottom:1px solid var(--borde)' }, [
        el('span', {}, [
          el('strong', { text: e.nombre }),
          el('span', { class: 'mini', text: ` ${e.series}×${e.reps} · RIR ${e.rirObjetivo}` }),
          FICHAS[e.id] ? el('span', { class: 'info-i', text: ' ⓘ' }) : null,
        ]),
        e.recortable ? el('span', { class: 'mini', text: 'recortable' }) : el('span', { class: 'chip chip-subir', text: 'fijo' }),
      ]);
      if (FICHAS[e.id]) { fila.style.cursor = 'pointer'; fila.addEventListener('click', () => abrirFicha(e.id)); }
      return fila;
    });
    frag.appendChild(el('div', { class: 'tarjeta' }, [
      el('h2', { text: sesion.nombre }),
      cal && cal.items && cal.items.length
        ? el('p', { class: 'mini', text: `Calentamiento (~${cal.duracionMin} min): ` + cal.items.map((x) => x.nombre).join(' · ') })
        : null,
      el('ul', { class: 'limpia' }, items),
    ]));
  }
  return frag;
}

// Contenido de una ficha (reutilizado por la sub-vista Ejercicios y el modal).
// Si se pasa `id`, añade el enlace al histórico del ejercicio (F3).
function contenidoFicha(f, id) {
  const arr = [
    el('h3', { text: f.nombre }),
    el('div', { class: 'esquema-wrap', html: esquemaSVG(f.patron) }),
    el('p', { class: 'ficha-tit', text: 'Claves' }),
    el('ul', { class: 'ficha-lista claves' }, f.claves.map((c) => el('li', { text: c }))),
    f.evita && f.evita.length ? el('p', { class: 'ficha-tit', text: 'Evita' }) : null,
    f.evita && f.evita.length ? el('ul', { class: 'ficha-lista evita' }, f.evita.map((c) => el('li', { text: c }))) : null,
  ];
  if (id) {
    const b = el('button', { class: 'ficha-link', text: 'Ver histórico ›' });
    b.addEventListener('click', () => abrirHistorico(id, f.nombre));
    arr.push(b);
  }
  return arr;
}

// Sub-vista Ejercicios: lista de ejercicios del bloque. Toca uno para ver tu
// historico (F3); el boton ⓘ abre la ficha con el esquema y las claves.
function planEjercicios() {
  const wrap = el('div', { class: 'pila' });
  wrap.appendChild(el('p', { class: 'tenue', text: 'Toca un ejercicio para ver tu historico. El boton ⓘ abre el esquema y las claves.' }));
  const ids = [];
  const nombres = {};
  for (const s of estado.bloque.sesiones) {
    for (const e of s.ejercicios) {
      if (!ids.includes(e.id)) { ids.push(e.id); nombres[e.id] = (FICHAS[e.id] && FICHAS[e.id].nombre) || e.nombre; }
    }
  }
  const filas = ids.map((id) => {
    const nombre = nombres[id];
    const hijos = [el('span', { text: nombre })];
    if (FICHAS[id]) {
      const btn = el('button', { class: 'calent-info', text: 'ⓘ', 'aria-label': 'Ver esquema' });
      btn.addEventListener('click', (e) => { e.stopPropagation(); abrirFicha(id); });
      hijos.push(btn);
    }
    const fila = el('li', { class: 'fila-sep', style: 'padding:10px 0;border-bottom:1px solid var(--borde);cursor:pointer' }, hijos);
    fila.addEventListener('click', () => abrirHistorico(id, nombre));
    return fila;
  });
  wrap.appendChild(el('ul', { class: 'limpia' }, filas));
  return wrap;
}

// Abre la ficha en un modal. No navega: asi el temporizador de descanso sigue vivo
// si consultas la tecnica en pleno descanso.
function abrirFicha(id) {
  const f = FICHAS[id];
  if (!f) return;
  const overlay = el('div', { class: 'overlay-ficha' });
  const cerrar = () => overlay.remove();
  overlay.appendChild(el('div', { class: 'tarjeta ficha modal-ficha' }, [
    ...contenidoFicha(f, id),
    el('button', { class: 'btn btn-fantasma', text: 'Cerrar', onclick: cerrar }),
  ]));
  overlay.addEventListener('click', (e) => { if (e.target === overlay) cerrar(); });
  document.body.appendChild(overlay);
}

// F3: histórico por ejercicio. Modal con tabla fecha/peso/reps/RIR de cada sesion
// pasada. Memoria de trabajo (saber qué puse), no stats de vanidad: sin graficas ni PRs.
function abrirHistorico(id, nombre) {
  const hist = almacen.historialEjercicio(id);
  const overlay = el('div', { class: 'overlay-ficha' });
  const cerrar = () => overlay.remove();

  let cuerpo;
  if (!hist.length) {
    cuerpo = el('p', { class: 'mini', text: 'Aun no hay registros de este ejercicio.' });
  } else {
    const filas = [];
    for (const s of hist) {
      s.series.forEach((serie, i) => {
        filas.push(el('tr', {}, [
          el('td', { class: 'td-fecha', text: i === 0 ? s.fecha : '' }),
          el('td', { text: serie.peso == null ? '—' : String(serie.peso) }),
          el('td', { text: serie.reps == null ? '—' : String(serie.reps) }),
          el('td', { text: typeof serie.rir === 'number' ? String(serie.rir) : '—' }),
        ]));
      });
    }
    cuerpo = el('table', { class: 'tabla-hist' }, [
      el('thead', {}, [el('tr', {}, [
        el('th', { text: 'Fecha' }), el('th', { text: 'kg' }), el('th', { text: 'reps' }), el('th', { text: 'RIR' }),
      ])]),
      el('tbody', {}, filas),
    ]);
  }

  overlay.appendChild(el('div', { class: 'tarjeta ficha modal-ficha' }, [
    el('h3', { text: nombre }),
    el('p', { class: 'mini', text: 'Histórico: qué pusiste en sesiones anteriores.' }),
    cuerpo,
    el('button', { class: 'btn btn-fantasma', text: 'Cerrar', onclick: cerrar }),
  ]));
  overlay.addEventListener('click', (e) => { if (e.target === overlay) cerrar(); });
  document.body.appendChild(overlay);
}

// Boton ⓘ de un item de calentamiento: abre su esquema sin togglear el check.
function botonEsquema(item) {
  const b = el('button', { class: 'calent-info', text: 'ⓘ', 'aria-label': 'Ver esquema' });
  b.addEventListener('click', (e) => { e.stopPropagation(); modalEsquema(item.nombre, item.detalle, item.esquema); });
  return b;
}

// Modal con el esquema de un movimiento de movilidad (nombre + esquema + detalle).
function modalEsquema(nombre, detalle, patron) {
  const overlay = el('div', { class: 'overlay-ficha' });
  const cerrar = () => overlay.remove();
  overlay.appendChild(el('div', { class: 'tarjeta ficha modal-ficha' }, [
    el('h3', { text: nombre }),
    el('div', { class: 'esquema-wrap', html: esquemaSVG(patron) }),
    detalle ? el('p', { class: 'mini', text: detalle }) : null,
    el('button', { class: 'btn btn-fantasma', text: 'Cerrar', onclick: cerrar }),
  ]));
  overlay.addEventListener('click', (e) => { if (e.target === overlay) cerrar(); });
  document.body.appendChild(overlay);
}

// ---- Vista: Aclaraciones (explicaciones sacadas del flujo de entreno) ----
function vistaAclaraciones() {
  const frag = el('div', { class: 'pila' });
  frag.appendChild(el('p', { class: 'tenue', text: 'Como funciona la app y por que, sin ocupar el flujo del entreno.' }));
  for (const a of ACLARACIONES) {
    frag.appendChild(el('div', { class: 'tarjeta' }, [
      el('h3', { text: a.titulo }),
      el('p', { class: 'mini', style: 'font-size:0.85rem', text: a.cuerpo }),
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
  return el('div', { class: 'pila' }, [info, tarjetaExportSesion(), acciones]);
}

// F2: exportar una sesion suelta (elegida de las registradas), ademas del historial completo.
function tarjetaExportSesion() {
  const lista = almacen.listaSesiones().slice().reverse(); // mas reciente primero
  if (!lista.length) {
    return el('div', { class: 'tarjeta pila' }, [
      el('h3', { text: 'Exportar una sesion' }),
      el('p', { class: 'mini', text: 'Aun no hay sesiones registradas.' }),
    ]);
  }
  const sel = el('select', { class: 'sel-sesion' });
  lista.forEach((s, i) => {
    const nombre = defSesion(s.sesionId)?.nombre || s.sesionId;
    sel.appendChild(el('option', { value: String(i), text: `${s.fecha} · ${nombre}` }));
  });
  const sesionDe = () => lista[Number(sel.value) || 0];
  const btnDesc = el('button', { class: 'btn btn-fantasma', text: 'Exportar sesion (JSON)' });
  btnDesc.addEventListener('click', () => {
    const s = sesionDe();
    const texto = almacen.exportarSesion(s.fecha, s.sesionId);
    if (texto) descargarTexto(texto, `power-sesion-${s.fecha}-${s.sesionId}.json`);
  });
  const btnCopiar = el('button', { class: 'btn btn-fantasma', text: 'Copiar sesion' });
  btnCopiar.addEventListener('click', () => {
    const s = sesionDe();
    const texto = almacen.exportarSesion(s.fecha, s.sesionId);
    if (texto) compartirTexto(texto, btnCopiar);
  });
  return el('div', { class: 'tarjeta pila' }, [
    el('h3', { text: 'Exportar una sesion' }),
    el('p', { class: 'mini', text: 'Exporta una sesion concreta como JSON (ademas del historial completo).' }),
    sel, btnDesc, btnCopiar,
  ]);
}

// Descarga un texto como fichero .json (con fallback a compartir/copiar).
function descargarTexto(texto, nombre) {
  try {
    const blob = new Blob([texto], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = el('a', { href: url, download: nombre });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch {
    compartirTexto(texto);
  }
}

// Descarga el historial completo como fichero .json.
function descargarJSON() {
  descargarTexto(almacen.exportarJSON(), `power-historial-${hoyISO()}.json`);
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
  const btnAj = document.getElementById('btn-ajustes');
  if (btnAj) btnAj.addEventListener('click', () => navegar('ajustes'));
}

async function init() {
  registrarSW();
  conectarTabs();
  await iniciarBloque();
  try { estado.hitos = await almacen.cargarHitos(); } catch { estado.hitos = null; }
  // B1: NO se auto-abre el borrador al arrancar. Antes, un borrador a medias tapaba
  // el bloque en "Hoy" (aparecia la pantalla de registro en su lugar). Ahora se
  // aterriza siempre en el resumen del bloque; la sesion a medias se reanuda desde
  // su tarjeta ("Reanudar sesion") o desde el aviso superior.
  estado.sesionActiva = null;
  timer.restaurar(); // B2: si habia un descanso en curso, retoma la barra flotante
  navegar('hoy');
}

// exponer estado para modulos de S2/S3
export const app = { estado, navegar, iniciarBloque, render };

init();
