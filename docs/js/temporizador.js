// temporizador.js — temporizador de descanso flotante. Arranca al marcar una serie,
// cuenta atras los segundos de descanso del ejercicio y vibra/suena al acabar.

let intervalo = null;
let ocultarTimeout = null; // timeout que oculta la barra tras "¡Ya!"
let barra = null;
let restante = 0;

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
  b.querySelector('#t-mas').addEventListener('click', () => { restante += 30; pinta(); });
  b.querySelector('#t-saltar').addEventListener('click', parar);
  return b;
}

function pinta() {
  if (barra) barra.querySelector('#t-num').textContent = fmt(Math.max(0, restante));
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

export function iniciar(segundos) {
  if (!segundos || segundos <= 0) return;
  if (!barra) barra = crearBarra();
  parar(true);
  restante = Math.round(segundos);
  barra.classList.remove('oculto');
  pinta();
  intervalo = setInterval(() => {
    restante -= 1;
    pinta();
    if (restante <= 0) {
      finalizar();
    }
  }, 1000);
}

function finalizar() {
  clearInterval(intervalo);
  intervalo = null;
  vibrar([200, 100, 200]);
  pitar();
  if (barra) {
    barra.querySelector('#t-num').textContent = '¡Ya!';
    ocultarTimeout = setTimeout(() => { ocultarTimeout = null; if (barra) barra.classList.add('oculto'); }, 1500);
  }
}

export function parar(silencioso = false) {
  if (intervalo) { clearInterval(intervalo); intervalo = null; }
  if (ocultarTimeout) { clearTimeout(ocultarTimeout); ocultarTimeout = null; }
  if (barra && !silencioso) barra.classList.add('oculto');
}
