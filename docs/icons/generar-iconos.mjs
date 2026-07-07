// Genera los iconos PNG de la PWA sin dependencias externas (solo node:zlib).
// Ejecutar: node docs/icons/generar-iconos.mjs
//
// Diseño (v2): barra (barbell) con degradado naranja y brillo especular sobre un
// fondo con degradado radial oscuro. Renderizado con supersampling 4x para bordes
// suaves (anti-aliasing) y esquinas redondeadas. Pensado como icono maskable en
// Android: el motivo vive dentro del ~70% central y el fondo llena todo el cuadro.

import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = dirname(fileURLToPath(import.meta.url));

// --- paleta (coherente con el tema de la app, #12141c) ---
const BG_CENTRO = [28, 33, 47];   // centro del fondo, algo más claro para dar profundidad
const BG_BORDE = [11, 12, 18];    // esquinas, más oscuras (viñeta)
const ACC_TOP = [255, 125, 78];   // naranja claro (arriba del disco)
const ACC_BOT = [206, 62, 26];    // naranja profundo (abajo)
const BRILLO = [255, 240, 225];   // brillo especular cálido

// --- utilidades de color ---
const lerp = (a, b, t) => a + (b - a) * t;
const mix = (c1, c2, t) => [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (e0, e1, x) => { const t = clamp01((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };

// SDF de rectángulo redondeado centrado en (cx,cy), semiejes (hw,hh), radio r.
// <0 dentro, >0 fuera; el valor es distancia (en unidades [0,1]).
function sdRoundBox(px, py, cx, cy, hw, hh, r) {
  const qx = Math.abs(px - cx) - (hw - r);
  const qy = Math.abs(py - cy) - (hh - r);
  const ax = Math.max(qx, 0), ay = Math.max(qy, 0);
  return Math.hypot(ax, ay) + Math.min(Math.max(qx, qy), 0) - r;
}

// Geometría de la barra (en coordenadas [0,1], y hacia abajo). Simétrica.
const BARRA = { cx: 0.5, cy: 0.5, hw: 0.35, hh: 0.03, r: 0.022 };
const DISCOS = [
  { cx: 0.335, cy: 0.5, hw: 0.035, hh: 0.18, r: 0.022 }, // interior izq (alto)
  { cx: 0.665, cy: 0.5, hw: 0.035, hh: 0.18, r: 0.022 }, // interior der
  { cx: 0.235, cy: 0.5, hw: 0.035, hh: 0.12, r: 0.020 }, // exterior izq (bajo)
  { cx: 0.765, cy: 0.5, hw: 0.035, hh: 0.12, r: 0.020 }, // exterior der
];
const PIEZAS = [BARRA, ...DISCOS];
const Y_TOP = 0.32, Y_BOT = 0.68; // extensión vertical del motivo (para el degradado)

// SDF de la barra completa = unión (mínimo) de todas las piezas.
function sdBarra(px, py) {
  let d = Infinity;
  for (const p of PIEZAS) d = Math.min(d, sdRoundBox(px, py, p.cx, p.cy, p.hw, p.hh, p.r));
  return d;
}

// Color del fondo en (u,v): degradado radial centro→borde con leve viñeta.
function fondo(u, v) {
  const d = Math.hypot(u - 0.5, v - 0.5) / 0.7071; // 0 centro, ~1 esquina
  const base = mix(BG_CENTRO, BG_BORDE, smooth(0.0, 1.05, d));
  // sombra suave proyectada por la barra hacia abajo, para separarla del fondo
  const sombra = sdBarra(u, v - 0.018);
  const sInt = 1 - smooth(-0.004, 0.02, sombra); // 1 justo bajo la barra, 0 lejos
  return mix(base, [0, 0, 0], 0.35 * sInt);
}

// Color de la barra en (u,v): degradado vertical + brillo especular arriba.
function barra(u, v) {
  const t = clamp01((v - Y_TOP) / (Y_BOT - Y_TOP)); // 0 arriba, 1 abajo
  const c = mix(ACC_TOP, ACC_BOT, t);
  const gloss = smooth(0.30, 0.12, t) * 0.45; // banda de brillo en el tercio superior
  return mix(c, BRILLO, gloss);
}

// Muestra el color final (RGB 0-255) en el punto (u,v) de [0,1].
function sample(u, v) {
  const d = sdBarra(u, v);
  const dentro = 1 - smooth(0.0, 0.0015, d); // cobertura suave del borde (fallback al supersampling)
  const c = mix(fondo(u, v), barra(u, v), dentro);
  return c;
}

// --- codificación PNG (RGB truecolor, sin dependencias) ---
function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (~c) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function makePng(S) {
  const SS = 4;                 // factor de supersampling (anti-aliasing)
  const N = S * SS;
  const px = Buffer.alloc(S * S * 3);
  const inv = 1 / (SS * SS);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      let r = 0, g = 0, b = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const u = (x * SS + sx + 0.5) / N;
          const v = (y * SS + sy + 0.5) / N;
          const c = sample(u, v);
          r += c[0]; g += c[1]; b += c[2];
        }
      }
      const i = (y * S + x) * 3;
      px[i] = Math.round(r * inv);
      px[i + 1] = Math.round(g * inv);
      px[i + 2] = Math.round(b * inv);
    }
  }

  // scanlines con byte de filtro 0 por fila
  const raw = Buffer.alloc(S * (S * 3 + 1));
  for (let y = 0; y < S; y++) {
    raw[y * (S * 3 + 1)] = 0;
    px.copy(raw, y * (S * 3 + 1) + 1, y * S * 3, (y + 1) * S * 3);
  }

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(S, 0);
  ihdr.writeUInt32BE(S, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 2;  // color type: truecolor RGB
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const S of [192, 512]) {
  const out = join(dir, `icon-${S}.png`);
  writeFileSync(out, makePng(S));
  console.log('escrito', out);
}
