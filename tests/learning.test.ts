import { describe, expect, it } from 'vitest';
import {
  applyResult,
  buildChoiceOptions,
  buildTrainingPlan,
  computeStars,
  computeStreak,
  diffWords,
  errorCategories,
  evaluateTranscription,
  normalizeWord,
  selectWords,
  updateDifficulty,
} from '../src/lib/learning';
import type { Attempt, Rule, Word, WordState } from '../src/lib/types';

const word = (id: string, level: 1 | 2 | 3 = 1, ruleId = 'ie-i'): Word => ({
  id, word: `wort-${id}`, ruleId, level, hint: 'Tipp', sentence: `Das ist wort-${id}.`,
});

describe('Textvergleich', () => {
  it('normalisiert Leerzeichen, Satzzeichen und Großschreibung', () => {
    expect(normalizeWord('  Liebe.  ')).toBe('liebe');
    expect(normalizeWord('Liebe', true)).toBe('Liebe');
  });

  it('findetAuslassungen und überzählige Zeichen', () => {
    expect(diffWords('Liebe', 'Liebe')).toEqual([]);
    expect(diffWords('Liebe', 'Lieb')).toEqual([{ position: 4, expected: 'e', written: '' }]);
    expect(diffWords('Liebe', 'Lieber')).toEqual([{ position: 5, expected: '', written: 'r' }]);
    expect(evaluateTranscription('Liebe', 'liebe').correct).toBe(true);
    expect(evaluateTranscription('Liebe', 'liebe', true).correct).toBe(false);
  });
});

describe('Leitner-System', () => {
  it('befördert richtige Wörter und setzt fehlerhafte zurück', () => {
    const now = 1_000_000;
    const first = applyResult(undefined, true, now);
    expect(first.box).toBe(1);
    expect(first.due).toBe(now + 24 * 60 * 60 * 1000);
    const second = applyResult(first, true, now);
    expect(second.box).toBe(2);
    const failed = applyResult(second, false, now);
    expect(failed.box).toBe(0);
    expect(failed.due).toBe(now);
    expect(failed.lapses).toBe(1);
  });
});

describe('Wortauswahl', () => {
  const progress: Record<string, WordState> = {
    a: { box: 0, due: 0, seen: 1, lapses: 3 },
    b: { box: 4, due: Date.now() + 100_000, seen: 4, lapses: 0 },
  };
  const words = [word('b', 3), word('a'), word('c'), word('d')];

  it('zieht fällige und fehlerhafte Wörter zuerst', () => {
    const selected = selectWords(words, progress, 2, { rng: () => 0.5 });
    expect(selected[0].id).toBe('a');
    expect(selected).toHaveLength(2);
  });

  it('beachtet retryIds auch wenn das Wort noch nicht fällig ist', () => {
    const selected = selectWords(words, progress, 1, { retryIds: ['b'], rng: () => 0.5 });
    expect(selected[0].id).toBe('b');
  });

  it('begrenzt die Auswahl auf die gewünschte Schwierigkeit', () => {
    const selected = selectWords(words, {}, 4, { difficulty: 1, rng: () => 0.5 });
    expect(selected.every((entry) => entry.level <= 1)).toBe(true);
  });
});

describe('Lernlogik', () => {
  it('passt die Schwierigkeit an Fehler- und Erfolgsserien an', () => {
    expect(updateDifficulty(2, 0, 2)).toBe(1);
    expect(updateDifficulty(1, 5, 0)).toBe(2);
    expect(updateDifficulty(2, 2, 1)).toBe(2);
  });

  it('erkennt Fehlerkategorien aus Regel und Zeichen', () => {
    expect(errorCategories([{ position: 1, expected: 'ie', written: 'i' }], 'ie-i')).toContain('ie/i');
    expect(errorCategories([{ position: 0, expected: 'H', written: 'h' }], 'grossschreibung')).toContain('Groß-/Kleinschreibung');
  });

  it('baut einen Trainingsplan aus Fehlern', () => {
    const now = Date.now();
    const attempts: Attempt[] = [
      { ts: now, wordId: 'x', word: 'x', ruleId: 'ie-i', correct: false, source: 'ai', selfAssessed: false, illegible: false, categories: ['ie/i'] },
      { ts: now, wordId: 'y', word: 'y', ruleId: 'ie-i', correct: false, source: 'ai', selfAssessed: false, illegible: false, categories: ['ie/i'] },
      { ts: now, wordId: 'z', word: 'z', ruleId: 'ss-oesz', correct: true, source: 'ai', selfAssessed: false, illegible: false, categories: [] },
    ];
    const plan = buildTrainingPlan(attempts, [{ id: 'ie-i', title: 'ie oder i', tip: 'Lang gesprochen: ie.' }]);
    expect(plan[0].ruleId).toBe('ie-i');
    expect(plan[0].errors).toBe(2);
    expect(computeStars(attempts)).toBe(1);
  });

  it('zählt Tagesserien bis gestern', () => {
    const now = Date.now();
    const attempts: Attempt[] = [1, 2, 3].map((days) => ({
      ts: now - days * 24 * 60 * 60 * 1000,
      wordId: `w${days}`, word: 'w', ruleId: 'ie-i', correct: true,
      source: 'ai', selfAssessed: false, illegible: false, categories: [],
    }));
    expect(computeStreak(attempts, now)).toBe(3);
  });

  it('bietet bei Auswahlübungen genau eine richtige Antwort', () => {
    const target = word('1');
    target.word = 'Liebe';
    const options = buildChoiceOptions(target, () => 0.3);
    expect(options).toHaveLength(3);
    expect(new Set(options).size).toBe(3);
    expect(options).toContain('Liebe');
  });

  it('stellt bei ei/ai beide Schreibweisen zur Auswahl', () => {
    const target: Word = { id: 'mai', word: 'Mai', ruleId: 'ai-ei', level: 1, hint: '' };
    const rule: Rule = { id: 'ai-ei', title: 'ei oder ai', tip: 'ai wie Mai.' };
    const options = buildChoiceOptions(target, () => 0.3, rule);
    expect(options).toContain('Mai');
    expect(options.some((option) => /ei/i.test(option))).toBe(true);
  });

  it('bietet bei ie/i und ss/ß die regelrichtige Variante an', () => {
    const liebe: Word = { id: 'liebe', word: 'Liebe', ruleId: 'ie-i', level: 1, hint: '' };
    const ruleIe: Rule = { id: 'ie-i', title: 'ie oder i', tip: 'ie ist lang.' };
    expect(buildChoiceOptions(liebe, () => 0.3, ruleIe)).toContain('Libe');

    const strasse: Word = { id: 'strasse', word: 'Straße', ruleId: 'ss-oesz', level: 1, hint: '' };
    const ruleSs: Rule = { id: 'ss-oesz', title: 'ss oder ß', tip: 'ß nach langem Vokal.' };
    expect(buildChoiceOptions(strasse, () => 0.3, ruleSs)).toContain('Strasse');
  });
});
