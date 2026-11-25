import { describe, expect, it } from 'vitest';
import { computeHomeStats } from '../src/lib/stats';
import type { Attempt, Challenge, Rule, Word, WordState } from '../src/lib/types';

const rules: Rule[] = [
  { id: 'ie-i', title: 'ie oder i', tip: 'Lang: ie.' },
  { id: 'grossschreibung', title: 'Nomen', tip: 'Nomen groß.' },
  { id: 'dehnung', title: 'Lange Vokale', tip: 'Dehnen.' },
];
const words: Word[] = [
  { id: 'w1', word: 'Liebe', ruleId: 'ie-i', level: 1, hint: '' },
  { id: 'w2', word: 'Wiese', ruleId: 'ie-i', level: 1, hint: '' },
  { id: 'c1', word: 'Haus', ruleId: 'grossschreibung', level: 1, hint: '', challenge: true },
  { id: 'c2', word: 'Oase', ruleId: 'dehnung', level: 1, hint: '', challenge: true },
];
const challenges = ['c1', 'c2'].map((id) => ({ id, ruleId: words.find((word) => word.id === id)!.ruleId }) as unknown as Challenge);

function attempt(wordId: string, ruleId: string, correct: boolean, extra: Partial<Attempt> = {}): Attempt {
  return {
    ts: Date.now(), wordId, word: wordId, ruleId, correct,
    source: 'self', selfAssessed: true, illegible: false, categories: [], ...extra,
  };
}

describe('Startseiten-Statistik', () => {
  it('zählt Bestand und trainierte Themen und Übungen', () => {
    const progress: Record<string, WordState> = {
      w1: { box: 4, due: 0, seen: 3, lapses: 1 },
      c1: { box: 5, due: 0, seen: 2, lapses: 0 },
    };
    const stats = computeHomeStats(words, rules, challenges, progress, [
      attempt('w2', 'ie-i', false, { categories: ['ie/i'] }),
      attempt('c1', 'grossschreibung', true),
    ]);
    expect(stats.totalWords).toBe(4);
    expect(stats.learned).toBe(2);
    expect(stats.percent).toBe(50);
    expect(stats.totalTopics).toBe(3);
    expect(stats.trainedTopics).toBe(2);
    expect(stats.totalExercises).toBe(2);
    expect(stats.trainedExercises).toBe(1);
    expect(stats.secureWords).toBe(2);
  });

  it('findet häufige Stolperstellen und gut verstandene Themen', () => {
    const stats = computeHomeStats(words, rules, challenges, {}, [
      attempt('w1', 'ie-i', false, { categories: ['ie/i'] }),
      attempt('w2', 'ie-i', false, { categories: ['ie/i'] }),
      attempt('w1', 'ie-i', false, { categories: ['ie/i'] }),
      attempt('w1', 'ie-i', false, { categories: ['ie/i'], illegible: true }),
      attempt('c2', 'dehnung', true),
      attempt('c2', 'dehnung', true),
      attempt('c2', 'dehnung', true),
    ]);
    expect(stats.toughSpots).toEqual([{ name: 'ie/i', count: 3 }]);
    expect(stats.strengths).toEqual([{ name: 'Lange Vokale', count: 3, detail: '3 von 3 richtig' }]);
  });

  it('fällt vor genug Versuchen auf sichere Wörter zurück', () => {
    const progress: Record<string, WordState> = {
      w1: { box: 5, due: 0, seen: 2, lapses: 0 },
      w2: { box: 4, due: 0, seen: 1, lapses: 0 },
    };
    const stats = computeHomeStats(words, rules, challenges, progress, []);
    expect(stats.strengths).toEqual([{ name: 'ie oder i', count: 2, detail: '2 Wörter sitzen sicher' }]);
  });

  it('bleibt bei leerer Auswertung ruhig', () => {
    const stats = computeHomeStats([], [], [], {}, []);
    expect(stats).toMatchObject({ totalWords: 0, percent: 0, trainedTopics: 0, trainedExercises: 0 });
    expect(stats.toughSpots).toEqual([]);
    expect(stats.strengths).toEqual([]);
  });
});
