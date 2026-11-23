import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

/** Mini-PNG-Encoder: genügt für flache Icons ohne weitere Abhängigkeiten. */
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
    raw[y * (stride + 1)] = 0;
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // Bit-Tiefe
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const INK = [23, 59, 68];
const GOLD = [244, 194, 78];
const K = [
  '10001',
  '10010',
  '10100',
  '11000',
  '10100',
  '10010',
  '10001',
];

function makeIcon(size, { maskable }) {
  const pixels = Buffer.alloc(size * size * 4);
  const radius = maskable ? 0 : size * 0.22;
  const set = (x, y, rgb) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const index = (y * size + x) * 4;
    pixels[index] = rgb[0];
    pixels[index + 1] = rgb[1];
    pixels[index + 2] = rgb[2];
    pixels[index + 3] = 255;
  };

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (radius > 0) {
        const cx = Math.min(Math.max(x, radius), size - 1 - radius);
        const cy = Math.min(Math.max(y, radius), size - 1 - radius);
        if ((x - cx) ** 2 + (y - cy) ** 2 > radius ** 2) continue;
      }
      set(x, y, INK);
    }
  }

  const glyphSize = Math.floor(size * (maskable ? 0.5 : 0.62));
  const pixelSize = Math.max(2, Math.floor(glyphSize / 5));
  const offsetX = Math.floor((size - pixelSize * 5) / 2);
  const offsetY = Math.floor((size - pixelSize * 7) / 2);
  for (let row = 0; row < 7; row += 1) {
    for (let col = 0; col < 5; col += 1) {
      if (K[row][col] !== '1') continue;
      for (let dy = 0; dy < pixelSize; dy += 1) {
        for (let dx = 0; dx < pixelSize; dx += 1) {
          set(offsetX + col * pixelSize + dx, offsetY + row * pixelSize + dy, GOLD);
        }
      }
    }
  }
  return png(size, pixels);
}

writeFileSync('public/icon-192.png', makeIcon(192, { maskable: false }));
writeFileSync('public/icon-512.png', makeIcon(512, { maskable: false }));
writeFileSync('public/icon-maskable-512.png', makeIcon(512, { maskable: true }));
console.log('Icons erzeugt: 192, 512, maskable 512.');
