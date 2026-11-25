import { readFileSync, writeFileSync } from 'node:fs';
import { deflateSync, inflateSync } from 'node:zlib';

/**
 * Web-Logo und App-Icons aus dem hinterlegten Logo erzeugen. Das Original liegt
 * als großes PNG mit Alpha-Kanal im Projektstamm; für die Kopfleiste reicht eine
 * kleine Kopie. Für die Icons wird es auf den dunklen Markenhintergrund gesetzt,
 * damit die hellen Teile auch auf hellen Browser-Tabs sichtbar bleiben. Ohne
 * Bildbibliothek: PNG lesen (8 Bit RGBA, nicht interlaced), flächenhaft
 * verkleinern, PNG schreiben.
 */
const SOURCE = 'logo.png';
const INK = [23, 59, 68];

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

function png(size, pixels) {
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y += 1) {
    raw[y * (stride + 1)] = 0; // Filter: keine Zeilen-Vorhersage
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
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** PNG in RGBA-Zeilen zerlegen, inklusive der fünf Filterarten. */
function decodeLogo(path) {
  const buffer = readFileSync(path);
  let offset = 8;
  let width = 0;
  let height = 0;
  const idat = [];
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      if (data[8] !== 8 || data[9] !== 6 || data[12] !== 0) throw new Error('Logo muss 8-Bit-RGBA ohne Interlacing sein');
    }
    if (type === 'IDAT') idat.push(data);
    offset += 12 + length;
    if (type === 'IEND') break;
  }
  if (!width || !height || idat.length === 0) throw new Error('Logo enthält keine Bilddaten');

  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * 4;
  const pixels = Buffer.alloc(stride * height);
  let source = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = raw[source++];
    for (let x = 0; x < stride; x += 1) {
      const value = raw[source++];
      const left = x >= 4 ? pixels[y * stride + x - 4] : 0;
      const above = y > 0 ? pixels[(y - 1) * stride + x] : 0;
      const corner = x >= 4 && y > 0 ? pixels[(y - 1) * stride + x - 4] : 0;
      let predicted = 0;
      if (filter === 1) predicted = left;
      else if (filter === 2) predicted = above;
      else if (filter === 3) predicted = Math.floor((left + above) / 2);
      else if (filter === 4) {
        const estimate = left + above - corner;
        const dl = Math.abs(estimate - left);
        const da = Math.abs(estimate - above);
        const dc = Math.abs(estimate - corner);
        predicted = dl <= da && dl <= dc ? left : da <= dc ? above : corner;
      } else if (filter !== 0) throw new Error(`Unbekannter PNG-Filter: ${filter}`);
      pixels[y * stride + x] = (value + predicted) & 255;
    }
  }
  return { width, height, pixels };
}

/** Flächenmittelung mit 4×4 Stichproben pro Zielpixel – kantenglatte Icons. */
function downsample(logo, size) {
  const out = Buffer.alloc(size * size * 4);
  const samples = 4;
  // Seitenverhältnis beibehalten: das Logo wird zentriert und nicht gestaucht.
  const scale = Math.min(size / logo.width, size / logo.height);
  const drawWidth = logo.width * scale;
  const drawHeight = logo.height * scale;
  const padX = (size - drawWidth) / 2;
  const padY = (size - drawHeight) / 2;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let alpha = 0;
      let red = 0;
      let green = 0;
      let blue = 0;
      for (let sy = 0; sy < samples; sy += 1) {
        const sampleY = y + (sy + 0.5) / samples - padY;
        if (sampleY < 0 || sampleY >= drawHeight) continue;
        const sourceY = Math.min(logo.height - 1, Math.floor((sampleY / drawHeight) * logo.height));
        for (let sx = 0; sx < samples; sx += 1) {
          const sampleX = x + (sx + 0.5) / samples - padX;
          if (sampleX < 0 || sampleX >= drawWidth) continue;
          const sourceX = Math.min(logo.width - 1, Math.floor((sampleX / drawWidth) * logo.width));
          const i = (sourceY * logo.width + sourceX) * 4;
          const a = logo.pixels[i + 3] / 255;
          alpha += a;
          red += logo.pixels[i] * a;
          green += logo.pixels[i + 1] * a;
          blue += logo.pixels[i + 2] * a;
        }
      }
      const count = samples * samples;
      const o = (y * size + x) * 4;
      out[o + 3] = Math.round((alpha / count) * 255);
      if (alpha > 0) {
        out[o] = Math.round(red / alpha);
        out[o + 1] = Math.round(green / alpha);
        out[o + 2] = Math.round(blue / alpha);
      }
    }
  }
  return out;
}

/** Logo zentriert auf vollfächigen Markenhintergrund legen. */
function makeIcon(logo, size, scale) {
  const innerSize = Math.round(size * scale);
  const inner = downsample(logo, innerSize);
  const pixels = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const o = (y * size + x) * 4;
      pixels[o] = INK[0];
      pixels[o + 1] = INK[1];
      pixels[o + 2] = INK[2];
      pixels[o + 3] = 255;
    }
  }
  const offset = Math.round((size - innerSize) / 2);
  for (let y = 0; y < innerSize; y += 1) {
    for (let x = 0; x < innerSize; x += 1) {
      const s = (y * innerSize + x) * 4;
      const a = inner[s + 3] / 255;
      if (a === 0) continue;
      const d = ((y + offset) * size + x + offset) * 4;
      for (let c = 0; c < 3; c += 1) pixels[d + c] = Math.round(inner[s + c] * a + INK[c] * (1 - a));
    }
  }
  return png(size, pixels);
}

const logo = decodeLogo(SOURCE);
// Die Kopfleiste braucht nur wenige Pixel – das Original bleibt als Quelle erhalten.
writeFileSync('public/logo.png', png(256, downsample(logo, 256)));
writeFileSync('public/icon-192.png', makeIcon(logo, 192, 0.86));
writeFileSync('public/icon-512.png', makeIcon(logo, 512, 0.86));
// Masken (z. B. Android) beschneiden die Ecken: Logo in der sicheren Zone.
writeFileSync('public/icon-maskable-512.png', makeIcon(logo, 512, 0.7));
writeFileSync('public/apple-touch-icon.png', makeIcon(logo, 180, 0.86));
console.log('Web-Logo (256) und Icons aus logo.png erzeugt: 192, 512, maskable 512, Apple 180.');
