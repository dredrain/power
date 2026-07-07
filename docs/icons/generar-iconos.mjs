// Genera iconos PNG simples para la PWA sin dependencias externas (solo node:zlib).
// Ejecutar: node docs/icons/generar-iconos.mjs
// Dibuja una barra (barbell) naranja sobre fondo oscuro, dentro del 80% central
// para que se vea bien como icono maskable en Android.

import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = dirname(fileURLToPath(import.meta.url));

const BG = [18, 20, 28]; // #12141c
const ACCENT = [232, 85, 45]; // #e8552d

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
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function rect(px, S, x0, y0, x1, y1, color) {
  for (let y = Math.round(y0 * S); y < Math.round(y1 * S); y++) {
    for (let x = Math.round(x0 * S); x < Math.round(x1 * S); x++) {
      const i = (y * S + x) * 3;
      px[i] = color[0];
      px[i + 1] = color[1];
      px[i + 2] = color[2];
    }
  }
}

function makePng(S) {
  // Buffer de pixeles RGB.
  const px = Buffer.alloc(S * S * 3);
  rect(px, S, 0, 0, 1, 1, BG); // fondo
  // barra horizontal
  rect(px, S, 0.15, 0.47, 0.85, 0.53, ACCENT);
  // discos interiores (altos)
  rect(px, S, 0.30, 0.32, 0.37, 0.68, ACCENT);
  rect(px, S, 0.63, 0.32, 0.70, 0.68, ACCENT);
  // discos exteriores (mas bajos)
  rect(px, S, 0.20, 0.38, 0.27, 0.62, ACCENT);
  rect(px, S, 0.73, 0.38, 0.80, 0.62, ACCENT);

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
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: truecolor RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const S of [192, 512]) {
  const out = join(dir, `icon-${S}.png`);
  writeFileSync(out, makePng(S));
  console.log('escrito', out);
}
