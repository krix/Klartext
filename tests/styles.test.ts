import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

/** Regeln der Hintergrund-Punkte, aus der CSS-Datei statt aus gerendertem DOM. */
const dotRules = [...css.matchAll(/nth-child\((\d+)\)\s*\{([^}]*)\}/g)].map((match) => match[2]);
const value = (rule: string, name: string) => new RegExp(`${name}:\\s*(-?\\d+)px`).exec(rule)?.[1];

describe('Heft-Optik', () => {
  it('gibt dem Button „Alle Themen mischen“ sichtbar Luft nach unten', () => {
    const row = /\.topic-mix-row\s*\{([^}]*)\}/.exec(css);
    expect(row, '.topic-mix-row fehlt').toBeTruthy();
    const margin = /margin:\s*0 0 clamp\((\d+)px/.exec(row![1]);
    expect(margin, 'Abstand fehlt').toBeTruthy();
    expect(Number(margin![1])).toBeGreaterThanOrEqual(12);
  });

  it('hält das graue Raster fest', () => {
    const body = /body\s*\{([\s\S]*?)\}/.exec(css);
    expect(body, 'body-Regel fehlt').toBeTruthy();
    expect(body![1]).toMatch(/radial-gradient\([\s\S]*?var\(--ink\) 10%[\s\S]*?fixed/);
    expect(body![1]).not.toMatch(/animation/);
  });

  it('legt einen eigenen Punkt im Markup für jede Bewegung an', () => {
    const container = /<div class="background-dots"[^>]*>([\s\S]*?)<\/div>/.exec(html);
    expect(container, 'Punkt-Ebene fehlt in index.html').toBeTruthy();
    const count = container![1].match(/<i><\/i>/g)?.length ?? 0;
    expect(count).toBeGreaterThanOrEqual(20);
    expect(count, 'für jeden Punkt braucht es eine eigene CSS-Regel').toBe(dotRules.length);
    expect(container![0]).toContain('aria-hidden="true"');
  });

  it('zeichnet alle Punkte einfarbig und hart begrenzt', () => {
    const layer = css.slice(css.indexOf('.background-dots {'), css.indexOf('#app {'));
    expect(layer).not.toMatch(/radial-gradient|filter|blur|box-shadow/);
    const dot = /\.background-dots i\s*\{([^}]*)\}/.exec(css);
    expect(dot, 'Punkt-Grundregel fehlt').toBeTruthy();
    expect(dot![1]).toMatch(/border-radius:\s*50%/);
    expect(dot![1]).toMatch(/background:\s*var\(--dot-color\)/);
    expect(dot![1]).toMatch(/animation:\s*dot-wander/);
  });

  it('mischt kleine, mittlere und große Punkte mit jeweils eigener Bewegung', () => {
    expect(dotRules.length).toBeGreaterThanOrEqual(20);
    const sizes = dotRules.map((rule) => Number(value(rule, '--size')));
    expect(sizes.some((size) => size <= 6), 'kleine Punkte fehlen').toBe(true);
    expect(sizes.some((size) => size >= 10 && size <= 16), 'mittlere Punkte fehlen').toBe(true);
    expect(sizes.some((size) => size >= 20), 'große Punkte fehlen').toBe(true);

    const moves = dotRules.map((rule) => `${value(rule, '--dx')}/${value(rule, '--dy')}`);
    expect(new Set(moves).size, 'zu viele Punkte wandern gleich').toBeGreaterThanOrEqual(20);
    const right = dotRules.filter((rule) => Number(value(rule, '--dx')) > 0).length;
    const left = dotRules.filter((rule) => Number(value(rule, '--dx')) < 0).length;
    expect(right, 'alle Punkte wandern in dieselbe Richtung').toBeGreaterThan(3);
    expect(left, 'alle Punkte wandern in dieselbe Richtung').toBeGreaterThan(3);

    const times = dotRules.map((rule) => /--time:\s*(\d+)s/.exec(rule)?.[1]);
    expect(new Set(times).size, 'zu viele Punkte ticken gleich').toBeGreaterThanOrEqual(12);
  });

  it('schaltet die Bewegung bei reduzierter Bewegung ab', () => {
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*\.background-dots i, main\.shell\.page-enter \{ animation: none/);
  });
});
