import { describe, expect, it } from 'vitest';
import toc from '../themen-und-uebungen.md?raw';
import { pdfSections } from '../scripts/pdf-sections.mjs';
import rawChallenges from '../src/data/challenges.json';
import rawRules from '../src/data/rules.json';
import rawWords from '../src/data/words.json';
import type { Challenge, Rule, Word } from '../src/lib/types';

const challenges = rawChallenges as unknown as Challenge[];
const rules = rawRules as unknown as Rule[];
const words = rawWords as unknown as Word[];
const ruleIds = new Set(rules.map((rule) => rule.id));

describe('Inhalte aus Loesungen.pdf', () => {
  it('deckt jedes Unterkapitel des Inhaltsverzeichnisses mit richtiger Seite ab', () => {
    const entries = [...toc.matchAll(/^- (\d+(?:\.\d+)*) .*?\[S\. (\d+)\]\(Loesungen\.pdf#page=\d+\)$/gm)];
    expect(entries.length).toBe(97);
    for (const [, number, page] of entries) {
      const section = pdfSections.find((candidate) => candidate.no === number);
      expect(section, number).toBeDefined();
      expect(section?.page, number).toBe(Number(page));
      expect(ruleIds.has(section?.rule ?? ''), number).toBe(true);
    }
  });

  it('liefert zu jedem ergänzten Unterkapitel Wörter und Übungen', () => {
    for (const section of pdfSections.filter((candidate) => candidate.words.length > 0)) {
      const sectionWords = words.filter((word) => word.ruleId === section.rule && word.id.startsWith(`pdf-${section.no.replaceAll('.', '-')}-w`));
      expect(sectionWords.length, section.no).toBe(section.words.length);
      for (const word of section.words) {
        expect(sectionWords.some((candidate) => candidate.word === word), `${section.no}: ${word}`).toBe(true);
      }
      const ref = section.no.replaceAll('.', '-');
      const prefix = new RegExp(`^pdf(mem|ableit|err|silbe)-${ref}-`);
      const tasks = challenges.filter((task) => prefix.test(task.id));
      // Sehr lange Wörter bleiben Lernwortbank, bekommen aber keine Aufgabe.
      const expected = Math.min(2, section.words.filter((word) => word.length <= 18).length);
      expect(tasks.length, section.no).toBeGreaterThanOrEqual(expected);
      for (const task of tasks) {
        expect(task.hints.length, task.id).toBeGreaterThanOrEqual(2);
        expect(task.ruleText.length, task.id).toBeGreaterThan(10);
        expect(words.some((word) => word.id === task.id && word.challenge === true), task.id).toBe(true);
      }
    }
  });

  it('übernimmt keine Kunstwörter oder das früher entfernte Uhu', () => {
    const banned = ['Uhu', 'Kohne', 'Krul', 'Hiek', 'Druhl', 'Weff', 'Schel', 'Naz', 'Funn', 'Püll'];
    for (const word of words) expect(banned.includes(word.word), word.word).toBe(false);
  });
});
