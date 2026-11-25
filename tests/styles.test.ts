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

  it('hält das graue Raster fest und lässt die bunten Punkte deutlich wandern', () => {
    const body = /body\s*\{([\s\S]*?)\}/.exec(css);
    expect(body, 'body-Regel fehlt').toBeTruthy();
    expect(body![1]).toMatch(/radial-gradient\([\s\S]*?var\(--ink\) 10%[\s\S]*?fixed/);
    expect(body![1]).not.toMatch(/animation/);

    const before = /body::before\s*\{([\s\S]*?)\}/.exec(css);
    expect(before, 'Ebene der bunten Punkte fehlt').toBeTruthy();
    expect(before![1]).not.toContain('var(--ink) 10%');
    // Gleiche Farb- und Transparentstopps ergeben eine harte, nicht verwaschene Kante.
    expect(before![1]).toMatch(/transparent 2\.4px\)/);
    expect(before![1]).toMatch(/animation: dots-drift \d+s/);
    expect(css).toMatch(/@keyframes color-drift\s*\{[\s\S]*translate3d/);
    expect(css).toMatch(/animation: color-drift \d+s/);

    const drift = /@keyframes dots-drift\s*\{([\s\S]*?)\n\}/.exec(css)?.[1] ?? '';
    const match = drift.match(/translate3d\((\d+)px, (\d+)px/);
    const x = Number(match?.[1]);
    const y = Number(match?.[2]);
    expect(x, 'zu wenig horizontale Bewegung').toBeGreaterThanOrEqual(20);
    expect(y, 'zu wenig vertikale Bewegung').toBeGreaterThanOrEqual(24);
  });

  it('schaltet die Bewegung bei reduzierter Bewegung ab', () => {
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*body::before, body::after, main\.shell\.page-enter \{ animation: none/);
  });
});
