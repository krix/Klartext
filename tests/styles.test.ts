import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');

describe('Heft-Optik', () => {
  it('gibt dem Button „Alle Themen mischen“ sichtbar Luft nach unten', () => {
    const row = /\.topic-mix-row\s*\{([^}]*)\}/.exec(css);
    expect(row, '.topic-mix-row fehlt').toBeTruthy();
    const margin = /margin:\s*0 0 clamp\((\d+)px/.exec(row![1]);
    expect(margin, 'Abstand fehlt').toBeTruthy();
    expect(Number(margin![1])).toBeGreaterThanOrEqual(12);
  });

  it('lässt Punkte und Farbtupfer langsam gleiten', () => {
    expect(css).toContain('body::before');
    expect(css).toContain('body::after');
    expect(css).toMatch(/@keyframes dots-drift\s*\{[\s\S]*translate3d/);
    expect(css).toMatch(/@keyframes color-drift\s*\{[\s\S]*translate3d/);
    expect(css).toMatch(/animation: dots-drift \d+s/);
    expect(css).toMatch(/animation: color-drift \d+s/);
  });

  it('schaltet die Bewegung bei reduzierter Bewegung ab', () => {
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*body::before, body::after, main\.shell\.page-enter \{ animation: none/);
  });
});
