// temporizador.js — temporizador de descanso flotante. Arranca al marcar una serie,
// cuenta atras los segundos de descanso del ejercicio y vibra/suena al acabar.
//
// B2: el estado vive como TIMESTAMP en localStorage (instante de fin + duracion), no
// como un contador vivo atado a la vista. Asi persiste al cambiar de pestaña
// (Hoy/Adherencia/Plan/Info) y sobrevive incluso a recargar la app (PWA): la barra
// flota sobre <body> y el tiempo restante siempre se recalcula desde el reloj.

const K = 'power:timer';

let intervalo = null;
let ocultarTimeout = null; // timeout que oculta la barra tras "¡Ya!"
let barra = null;

// ---- estado persistente ----
function leerEstado() {
  try { const s = localStorage.getItem(K); return s ? JSON.parse(s) : null; }
  catch { return null; }
}
function guardarEstado(o) {
  try { localStorage.setItem(K, JSON.stringify(o)); } catch { /* no-op */ }
}
function borrarEstado() {
  try { localStorage.removeItem(K); } catch { /* no-op */ }
}

// Segundos que quedan segun el reloj (nunca negativo).
function restante() {
  const e = leerEstado();
  if (!e || typeof e.finMs !== 'number') return 0;
  return Math.max(0, Math.round((e.finMs - Date.now()) / 1000));
}

function fmt(seg) {
  const m = Math.floor(seg / 60);
  const s = seg % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function crearBarra() {
  const b = document.createElement('div');
  b.className = 'temporizador oculto';
  b.innerHTML = `
    <span class="t-num" id="t-num">0:00</span>
    <span style="flex:1;text-align:center;font-weight:600">Descanso</span>
    <span style="display:flex;gap:8px">
      <button type="button" id="t-mas">+30s</button>
      <button type="button" id="t-saltar">Saltar</button>
    </span>`;
  document.body.appendChild(b);
  // +30s: mueve el instante de fin, no un contador en memoria.
  b.querySelector('#t-mas').addEventListener('click', () => {
    const e = leerEstado();
    if (!e) return;
    e.finMs += 30000;
    guardarEstado(e);
    pinta();
  });
  b.querySelector('#t-saltar').addEventListener('click', () => parar());
  return b;
}

// Garantiza que la barra existe y esta enganchada al <body> (tras recargar la
// app el nodo anterior ya no esta): la recrea si hace falta.
function asegurarBarra() {
  if (!barra || !barra.isConnected) barra = crearBarra();
  return barra;
}

function pinta() {
  const seg = restante();
  if (barra) barra.querySelector('#t-num').textContent = fmt(seg);
}

function vibrar(patron) {
  try { if (navigator.vibrate) navigator.vibrate(patron); } catch { /* no-op */ }
}

// Pitido corto con WebAudio (sin ficheros). Silencioso si el navegador lo bloquea.
function pitar() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gan = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    gan.gain.value = 0.15;
    osc.connect(gan).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
    osc.onended = () => ctx.close();
  } catch { /* no-op */ }
}

// Arranca (o retoma) el tick de 1s que refresca la barra hasta llegar a 0.
function arrancarTick() {
  if (intervalo) return;
  intervalo = setInterval(() => {
    pinta();
    if (restante() <= 0) finalizar();
  }, 1000);
}

export function iniciar(segundos) {
  if (!segundos || segundos <= 0) return;
  if (ocultarTimeout) { clearTimeout(ocultarTimeout); ocultarTimeout = null; }
  guardarEstado({ finMs: Date.now() + Math.round(segundos) * 1000, durSeg: Math.round(segundos) });
  asegurarBarra().classList.remove('oculto');
  pinta();
  arrancarTick();
}

function finalizar() {
  if (intervalo) { clearInterval(intervalo); intervalo = null; }
  borrarEstado();
  vibrar([200, 100, 200]);
  pitar();
  if (barra) {
    barra.querySelector('#t-num').textContent = '¡Ya!';
    ocultarTimeout = setTimeout(() => { ocultarTimeout = null; if (barra) barra.classList.add('oculto'); }, 1500);
  }
}

// Para y oculta el temporizador (Saltar, cancelar/terminar sesion).
export function parar(silencioso = false) {
  if (intervalo) { clearInterval(intervalo); intervalo = null; }
  if (ocultarTimeout) { clearTimeout(ocultarTimeout); ocultarTimeout = null; }
  borrarEstado();
  if (barra && !silencioso) barra.classList.add('oculto');
}

// Al arrancar la app (o al montar el shell): si habia un descanso en curso, vuelve a
// mostrar la barra y retoma la cuenta desde el reloj. Si ya expiro mientras la app
// estaba cerrada, limpia el estado sin sonar.
export function restaurar() {
  const e = leerEstado();
  if (!e) return;
  if (restante() <= 0) { borrarEstado(); return; }
  asegurarBarra().classList.remove('oculto');
  pinta();
  arrancarTick();
}
