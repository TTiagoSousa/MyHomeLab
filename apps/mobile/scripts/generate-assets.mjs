#!/usr/bin/env node
// Gera os ícones (anéis concêntricos do logo do site) e o apito do fim da pausa, sem
// dependências: PNG com zlib e WAV à mão. Corre com `node scripts/generate-assets.mjs`.
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const assets = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets');

const BACKGROUND = [6, 11, 18];
const DEEP = [30, 111, 128];
const ACCENT = [63, 208, 232];
const BRIGHT = [127, 231, 245];
const WHITE = [255, 255, 255];

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buffer) => {
  let c = 0xffffffff;
  for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
};
const encodePng = (size, rgba) => {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  const rows = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    rows[y * (size * 4 + 1)] = 0;
    rgba.copy(rows, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
};

// O logo em unidades do SVG do site (viewBox 0..40): anel exterior, anel tracejado,
// disco suave e ponto central. `scale` é a fração do lado que o logo ocupa.
const shapesOf = (palette) => [
  { kind: 'ring', r: 18, width: 1.6, color: palette.deep },
  { kind: 'dashed', r: 13, width: 1.8, color: palette.accent, dash: 30, gap: 12 },
  { kind: 'disc', r: 6.5, color: palette.accent, alpha: palette.soft },
  { kind: 'disc', r: 3.4, color: palette.bright },
];

const coverage = (shape, x, y) => {
  const d = Math.hypot(x, y);
  if (shape.kind === 'disc') return d <= shape.r ? 1 : 0;
  if (Math.abs(d - shape.r) > shape.width / 2) return 0;
  if (shape.kind === 'ring') return 1;
  const circumference = 2 * Math.PI * shape.r;
  const angle = (Math.atan2(y, x) + 2 * Math.PI) % (2 * Math.PI);
  const along = (angle / (2 * Math.PI)) * circumference;
  return along % (shape.dash + shape.gap) < shape.dash ? 1 : 0;
};

const render = ({ size, scale, background, palette }) => {
  const shapes = shapesOf(palette);
  const rgba = Buffer.alloc(size * size * 4);
  const samples = 4;
  const unit = (size * scale) / 40;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < samples; sy++) {
        for (let sx = 0; sx < samples; sx++) {
          const x = (px + (sx + 0.5) / samples - size / 2) / unit;
          const y = (py + (sy + 0.5) / samples - size / 2) / unit;
          let color = background ? [...background] : [0, 0, 0];
          let alpha = background ? 1 : 0;
          for (const shape of shapes) {
            const hit = coverage(shape, x, y) * (shape.alpha ?? 1);
            if (!hit) continue;
            color = color.map((c, i) => c * (1 - hit) + shape.color[i] * hit);
            alpha = alpha + hit * (1 - alpha);
          }
          r += color[0];
          g += color[1];
          b += color[2];
          a += alpha;
        }
      }
      const n = samples * samples;
      const offset = (py * size + px) * 4;
      rgba[offset] = Math.round(r / n);
      rgba[offset + 1] = Math.round(g / n);
      rgba[offset + 2] = Math.round(b / n);
      rgba[offset + 3] = Math.round((a / n) * 255);
    }
  }
  return encodePng(size, rgba);
};

const colors = { deep: DEEP, accent: ACCENT, bright: BRIGHT, soft: 0.22 };
const mono = { deep: WHITE, accent: WHITE, bright: WHITE, soft: 0.4 };

const files = {
  'icon.png': { size: 1024, scale: 0.78, background: BACKGROUND, palette: colors },
  'android-icon-foreground.png': { size: 1024, scale: 0.5, palette: colors },
  'android-icon-monochrome.png': { size: 1024, scale: 0.5, palette: mono },
  'splash-icon.png': { size: 512, scale: 0.9, palette: colors },
  'notification-icon.png': { size: 96, scale: 0.9, palette: mono },
};
for (const [name, options] of Object.entries(files)) {
  writeFileSync(join(assets, name), render(options));
  console.log(`✓ assets/${name}`);
}

// Dois toques curtos a 880 Hz, como um cronómetro.
const rate = 22050;
const tone = (ms) => Math.round((rate * ms) / 1000);
const parts = [
  [tone(140), 880],
  [tone(80), 0],
  [tone(220), 880],
];
const total = parts.reduce((sum, [n]) => sum + n, 0);
const pcm = Buffer.alloc(total * 2);
let index = 0;
for (const [count, frequency] of parts) {
  for (let i = 0; i < count; i++, index++) {
    const fade = Math.min(1, i / 200, (count - i) / 200);
    const sample = frequency ? Math.sin((2 * Math.PI * frequency * i) / rate) * 0.6 * fade : 0;
    pcm.writeInt16LE(Math.round(sample * 32767), index * 2);
  }
}
const wav = Buffer.alloc(44);
wav.write('RIFF', 0);
wav.writeUInt32LE(36 + pcm.length, 4);
wav.write('WAVE', 8);
wav.write('fmt ', 12);
wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20);
wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(rate, 24);
wav.writeUInt32LE(rate * 2, 28);
wav.writeUInt16LE(2, 32);
wav.writeUInt16LE(16, 34);
wav.write('data', 36);
wav.writeUInt32LE(pcm.length, 40);
writeFileSync(join(assets, 'beep.wav'), Buffer.concat([wav, pcm]));
console.log('✓ assets/beep.wav');
