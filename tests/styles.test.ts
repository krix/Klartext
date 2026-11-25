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

  it('legt höchstens fünf Punkte an – einen pro Bewegung', () => {
    const container = /<div class="background-dots"[^>]*>([\s\S]*?)<\/div>/.exec(html);
    expect(container, 'Punkt-Ebene fehlt in index.html').toBeTruthy();
    const count = container![1].match(/<i><\/i>/g)?.length ?? 0;
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(5);
    expect(count, 'für jeden Punkt braucht es eine eigene CSS-Regel').toBe(dotRules.length);
    expect(container![0]).toContain('aria-hidden="true"');
  });

  it('zeichnet große Punkte einfarbig, hart begrenzt und leicht transparent', () => {
    const layer = css.slice(css.indexOf('.background-dots {'), css.indexOf('#app {'));
    expect(layer).not.toMatch(/radial-gradient|filter|blur|box-shadow/);
    const dot = /\.background-dots i\s*\{([^}]*)\}/.exec(css);
    expect(dot, 'Punkt-Grundregel fehlt').toBeTruthy();
    expect(dot![1]).toMatch(/border-radius:\s*50%/);
    expect(dot![1]).toMatch(/background:\s*var\(--dot-color\)/);
    const opacity = Number(/opacity:\s*([\d.]+)/.exec(dot![1])?.[1]);
    expect(opacity, 'Punkte müssen leicht transparent sein').toBeGreaterThan(0.15);
    expect(opacity, 'Punkte dürfen nicht fast unsichtbar sein').toBeLessThan(0.45);
    expect(dot![1]).toMatch(/animation-name:\s*var\(--path\)/);
    expect(dot![1]).toMatch(/animation-iteration-count:\s*infinite/);
    expect(dot![1]).not.toMatch(/alternate/);
    expect(dotRules.map((rule) => Number(value(rule, '--size'))).every((size) => size >= 48), 'kleine Punkte sind unerwünscht').toBe(true);
  });

  it('gibt jedem Punkt eine eigene, geschlossene Bewegungsbahn', () => {
    const paths = dotRules.map((rule) => /--path:\s*(\S+);/.exec(rule)?.[1]);
    expect(new Set(paths).size, 'Punkte bewegen sich nicht einzeln').toBe(dotRules.length);
    const times = dotRules.map((rule) => /--time:\s*(\d+)s/.exec(rule)?.[1]);
    expect(new Set(times).size, 'Punkte ticken zu gleich').toBeGreaterThanOrEqual(4);

    const frames = [...css.matchAll(/@keyframes (glide-\d)\s*\{([\s\S]*?)\n\}/g)];
    expect(frames.length).toBe(dotRules.length);
    for (const [, name, body] of frames) {
      expect(paths).toContain(name);
      const transforms = [...body.matchAll(/transform:\s*translate3d\(([^)]*)\)/g)].map((match) => match[1]);
      expect(transforms.length, `${name} hat zu wenige Zwischenschritte`).toBeGreaterThanOrEqual(4);
      expect(body, `${name} springt am Ende zurück`).toMatch(/0%,\s*100%/);
      expect(transforms.some((step) => step.includes('vw') && step.includes('vh')), `${name} bewegt sich kaum`).toBe(true);
    }
  });

  it('schaltet die Bewegung bei reduzierter Bewegung ab', () => {
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*\.background-dots i, main\.shell\.page-enter \{ animation: none/);
  });
});
