import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { brand, header } from '../src/ui/html';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url));
const pngSize = (path: string) => {
  const buffer = read(path);
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20), bytes: buffer.length };
};

describe('Logo und Icons', () => {
  it('zeigt das Logo statt der gezeichneten Marke in der Kopfleiste', () => {
    expect(brand()).toContain('<img src="./logo.png" alt="" />');
    expect(brand()).not.toContain('<svg');
    expect(header()).toContain('brand-mark');
    expect(header()).toContain('logo.png');
  });

  it('verlinkt Favicon, Apple-Icon und Manifest', () => {
    const html = read('index.html').toString('utf8');
    expect(html).toContain('href="./manifest.webmanifest"');
    expect(html).toContain('href="./icon-192.png"');
    expect(html).toContain('href="./icon-512.png"');
    expect(html).toContain('href="./apple-touch-icon.png"');
  });

  it('führt alle Icons im Manifest mit der richtigen Purpose', () => {
    const manifest = JSON.parse(read('public/manifest.webmanifest').toString('utf8'));
    expect(manifest.icons.map((icon: { src: string }) => icon.src).sort()).toEqual([
      'icon-192.png',
      'icon-512.png',
      'icon-maskable-512.png',
    ]);
    expect(manifest.icons.some((icon: { purpose: string }) => icon.purpose === 'maskable')).toBe(true);
  });

  it('liefert eine kleine Web-Kopie und quadratische Icons in den erwarteten Größen', () => {
    expect(pngSize('logo.png').width).toBeGreaterThan(512);
    expect(pngSize('public/logo.png')).toMatchObject({ width: 256, height: 256 });
    expect(pngSize('public/logo.png').bytes).toBeLessThan(pngSize('logo.png').bytes);
    for (const [path, size] of [
      ['public/icon-192.png', 192],
      ['public/icon-512.png', 512],
      ['public/icon-maskable-512.png', 512],
      ['public/apple-touch-icon.png', 180],
    ] as const) {
      expect(pngSize(path)).toMatchObject({ width: size, height: size });
      expect(pngSize(path).bytes).toBeGreaterThan(1000);
    }
  });

  it('erzeugt Web-Logo und Icons aus dem hinterlegten Original', () => {
    const script = read('scripts/make-icons.mjs').toString('utf8');
    expect(script).toContain("const SOURCE = 'logo.png'");
    expect(script).toContain("'public/logo.png'");
    expect(script).toContain('icon-maskable-512.png');
    expect(script).toContain('apple-touch-icon.png');
  });
});
