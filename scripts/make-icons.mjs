import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

/** Kleiner PNG-Encoder ohne Abhängigkeiten. Gezeichnet wird 4× überabgetastet und dann geglättet. */
const SS = 4;

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeBuffer = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function downsample(buffer, size) {
  const out = Buffer.alloc(size * size * 4);
  const wide = size * SS;
  const count = SS * SS;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let sumA = 0;
      let sumR = 0;
      let sumG = 0;
      let sumB = 0;
      for (let dy = 0; dy < SS; dy += 1) {
        for (let dx = 0; dx < SS; dx += 1) {
          const i = ((y * SS + dy) * wide + (x * SS + dx)) * 4;
          const alpha = buffer[i + 3] / 255;
          sumA += alpha;
          sumR += buffer[i] * alpha;
          sumG += buffer[i + 1] * alpha;
          sumB += buffer[i + 2] * alpha;
        }
      }
      const o = (y * size + x) * 4;
      out[o + 3] = Math.round((sumA / count) * 255);
      if (sumA > 0) {
        out[o] = Math.round(sumR / sumA);
        out[o + 1] = Math.round(sumG / sumA);
        out[o + 2] = Math.round(sumB / sumA);
      }
    }
  }
  return out;
}

function png(size, pixels) {
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y += 1) {
    raw[y * (stride + 1)] = 0;
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const INK = [23, 59, 68];
const CREAM = [251, 252, 249];
const YELLOW = [255, 201, 74];
const CORAL = [255, 125, 99];

function makeIcon(size, { maskable }) {
  const wide = size * SS;
  const pixels = Buffer.alloc(wide * wide * 4);

  const blend = (x, y, rgb, alpha = 1) => {
    if (x < 0 || y < 0 || x >= wide || y >= wide || alpha <= 0) return;
    const i = (y * wide + x) * 4;
    const src = Math.min(1, alpha);
    const dst = pixels[i + 3] / 255;
    const total = src + dst * (1 - src);
    if (total <= 0) return;
    for (let c = 0; c < 3; c += 1) {
      pixels[i + c] = Math.round((rgb[c] * src + pixels[i + c] * dst * (1 - src)) / total);
    }
    pixels[i + 3] = Math.round(total * 255);
  };

  const roundRect = (x0n, y0n, x1n, y1n, rn, rgb, alpha = 1) => {
    const x0 = Math.max(0, Math.floor(x0n * wide));
    const x1 = Math.min(wide, Math.ceil(x1n * wide));
    const y0 = Math.max(0, Math.floor(y0n * wide));
    const y1 = Math.min(wide, Math.ceil(y1n * wide));
    const r = rn * wide;
    for (let y = y0; y < y1; y += 1) {
      for (let x = x0; x < x1; x += 1) {
        const px = x + 0.5;
        const py = y + 0.5;
        const nx = Math.min(Math.max(px, x0 + r), x1 - r);
        const ny = Math.min(Math.max(py, y0 + r), y1 - r);
        if (Math.hypot(px - nx, py - ny) <= r) blend(x, y, rgb, alpha);
      }
    }
  };

  /** Linie mit runden Enden – genau richtig für handschriftliche Buchstaben. */
  const stroke = (x1, y1, x2, y2, width, rgb) => {
    const ax = x1 * wide;
    const ay = y1 * wide;
    const bx = x2 * wide;
    const by = y2 * wide;
    const dx = bx - ax;
    const dy = by - ay;
    const lengthSq = dx * dx + dy * dy || 1;
    const radius = (width / 2) * wide;
    const x0 = Math.max(0, Math.floor((Math.min(x1, x2) - width) * wide));
    const x1b = Math.min(wide, Math.ceil((Math.max(x1, x2) + width) * wide));
    const y0 = Math.max(0, Math.floor((Math.min(y1, y2) - width) * wide));
    const y1b = Math.min(wide, Math.ceil((Math.max(y1, y2) + width) * wide));
    for (let y = y0; y < y1b; y += 1) {
      for (let x = x0; x < x1b; x += 1) {
        const px = x + 0.5;
        const py = y + 0.5;
        const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq));
        if (Math.hypot(px - (ax + t * dx), py - (ay + t * dy)) <= radius) blend(x, y, rgb);
      }
    }
  };

  const polygon = (points, rgb) => {
    const xs = points.map((p) => p[0] * wide);
    const ys = points.map((p) => p[1] * wide);
    const minX = Math.max(0, Math.floor(Math.min(...xs)));
    const maxX = Math.min(wide, Math.ceil(Math.max(...xs)));
    const minY = Math.max(0, Math.floor(Math.min(...ys)));
    const maxY = Math.min(wide, Math.ceil(Math.max(...ys)));
    for (let y = minY; y < maxY; y += 1) {
      for (let x = minX; x < maxX; x += 1) {
        let inside = false;
        for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
          if ((ys[i] > y + 0.5) !== (ys[j] > y + 0.5)
            && x + 0.5 < ((xs[j] - xs[i]) * (y + 0.5 - ys[i])) / (ys[j] - ys[i]) + xs[i]) inside = !inside;
        }
        if (inside) blend(x, y, rgb);
      }
    }
  };

  // Hintergrund: bei maskablen Icons bleibt er vollflächig (sicherer Bereich für Launcher-Masken).
  roundRect(0, 0, 1, 1, maskable ? 0 : 0.22, INK);

  // Inhalt bei maskablen Icons etwas verkleinern, damit keine Ecke abgeschnitten wird.
  const scale = maskable ? 0.78 : 1;
  const shift = (1 - scale) / 2;
  const p = (v) => shift + v * scale;
  const s = (v) => v * scale;

  // Papierkärtchen, Buchstabe und Unterstreichung.
  roundRect(p(0.20), p(0.17), p(0.78), p(0.84), s(0.05), CREAM);
  stroke(p(0.40), p(0.29), p(0.40), p(0.71), s(0.085), INK);
  stroke(p(0.66), p(0.29), p(0.41), p(0.515), s(0.085), INK);
  stroke(p(0.43), p(0.50), p(0.68), p(0.71), s(0.085), INK);
  stroke(p(0.34), p(0.79), p(0.71), p(0.77), s(0.033), CORAL);

  // Gelber Aufkleber-Stern oben rechts.
  const cx = p(0.80);
  const cy = p(0.24);
  const outer = s(0.115);
  const inner = s(0.052);
  const star = [];
  for (let i = 0; i < 10; i += 1) {
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    const radius = i % 2 === 0 ? outer : inner;
    star.push([cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius]);
  }
  polygon(star, YELLOW);

  return png(size, downsample(pixels, size));
}

writeFileSync('public/icon-192.png', makeIcon(192, { maskable: false }));
writeFileSync('public/icon-512.png', makeIcon(512, { maskable: false }));
writeFileSync('public/icon-maskable-512.png', makeIcon(512, { maskable: true }));
console.log('Icons erzeugt: 192, 512, maskable 512.');
