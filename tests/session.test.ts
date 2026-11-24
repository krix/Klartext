import { describe, expect, it } from 'vitest';
import { createSession, finishExercise, isSessionFinished, nextExercise, roundStats, upgradeQueue } from '../src/lib/session';
import { DEFAULT_SETTINGS } from '../src/lib/storage';
import type { Rule, Word } from '../src/lib/types';

const rules: Rule[] = [
  { id: 'ie-i', title: 'ie oder i', tip: 'Lang: ie.' },
  { id: 'grossschreibung', title: 'Nomen', tip: 'Nomen groß.', caseSensitive: true },
];
const words: Word[] = [
  { id: 'a', word: 'Liebe', ruleId: 'ie-i', level: 1, hint: 'Tipp' },
  { id: 'b', word: 'Wiese', ruleId: 'ie-i', level: 1, hint: 'Tipp' },
  { id: 'c', word: 'Haus', ruleId: 'grossschreibung', level: 1, hint: 'Tipp' },
];
const settings = { ...DEFAULT_SETTINGS, sessionLength: 3 };

describe('Übungssitzung', () => {
  it('erstellt eine Runde mit der konfigurierten Länge', () => {
    const session = createSession(words, rules, {}, settings, () => 0.5);
    expect(session.total).toBe(3);
    expect(session.current?.word.id).toBeDefined();
  });

  it('bringt falsche Wörter erneut, nachdem zwei andere kamen', () => {
    let session = createSession(words, rules, {}, settings, () => 0.5);
    const firstId = session.current!.word.id;
    session = finishExercise(session, false);
    expect(session.retries).toContain(firstId);
    session = nextExercise(session, words, rules, () => 0.5);
    session = finishExercise(session, true);
    session = nextExercise(session, words, rules, () => 0.5);
    session = finishExercise(session, true);
    session = nextExercise(session, words, rules, () => 0.5);
    expect(session.current?.word.id).toBe(firstId);
  });

  it('behält Fehlerdetails für die Abschlussübersicht', () => {
    let session = createSession(words, rules, {}, settings, () => 0.5);
    const first = session.current!;
    session = finishExercise(session, false, {
      transcription: 'Libe',
      differences: [{ position: 2, expected: 'e', written: '' }],
      source: 'ai',
    });
    expect(session.results[0]).toMatchObject({
      wordId: first.word.id,
      word: first.word.word,
      correct: false,
      transcription: 'Libe',
      differences: [{ position: 2, expected: 'e', written: '' }],
      source: 'ai',
    });
  });

  it('holt eine wartende Wiederholung, wenn die Warteschlange leer ist', () => {
    const session = createSession(words, rules, {}, settings, () => 0.5);
    const stalled: typeof session = {
      ...session,
      queue: [],
      retries: [session.current!.word.id],
      done: 1,
      retryAfter: 99,
      current: null,
    };
    const next = nextExercise(stalled, words, rules, () => 0.5);
    expect(next.current).not.toBeNull();
    expect(next.retries).toEqual([]);
    expect(isSessionFinished({ ...next, current: null })).toBe(true);
  });

  it('nutzt bei der Großschreibung eine sichtbare Übung', () => {
    const onlyNoun = [words[2]];
    const session = createSession(onlyNoun, rules, {}, settings, () => 0.5);
    expect(['choice', 'copy']).toContain(session.current!.kind);
  });

  it('endet, wenn alle Wörter und Wiederholungen erledigt sind', () => {
    let session = createSession(words, rules, {}, settings, () => 0.5);
    for (let index = 0; index < 6 && session.current; index += 1) {
      session = nextExercise(finishExercise(session, true), words, rules, () => 0.5);
    }
    expect(isSessionFinished(session)).toBe(true);
  });

  it('merkt sich den Pool einer Themenrunde', () => {
    const session = createSession(words, rules, {}, settings, () => 0.5, Date.now(), 'ie-i');
    expect(session.ruleId).toBe('ie-i');
    expect(session.poolIds).toEqual(['a', 'b']);
    expect(session.queue.every((id) => ['a', 'b'].includes(id))).toBe(true);
  });

  it('bleibt auch bei folgenden Wörtern im gewählten Thema', () => {
    let session = createSession(words, rules, {}, settings, () => 0.5, Date.now(), 'ie-i');
    const seen = new Set<string>();
    for (let index = 0; index < 6 && session.current; index += 1) {
      seen.add(session.current.word.id);
      session = nextExercise(finishExercise(session, true), words, rules, () => 0.5);
    }
    expect(seen.size).toBeGreaterThan(0);
    expect([...seen].every((id) => id === 'a' || id === 'b')).toBe(true);
  });

  it('tauscht nach einer Erfolgsserie, ohne die Rundenlänge zu vergrößern', () => {
    const topicWords: Word[] = [
      { id: 't1', word: 'Liebe', ruleId: 'ie-i', level: 1, hint: 'Tipp' },
      { id: 't2', word: 'Antike', ruleId: 'ie-i', level: 1, hint: 'Tipp' },
      { id: 't3', word: 'Tier', ruleId: 'ie-i', level: 2, hint: 'Tipp' },
      { id: 't4', word: 'Wiese', ruleId: 'ie-i', level: 2, hint: 'Tipp' },
      { id: 't5', word: 'Krise', ruleId: 'ie-i', level: 3, hint: 'Tipp' },
    ];
    const mixed = [...topicWords, words[2]];
    const session = createSession(mixed, rules, {}, { ...settings, sessionLength: 2 }, () => 0.5, Date.now(), 'ie-i');
    const upcoming = session.queue[0];
    const upgraded = upgradeQueue({ ...session, difficulty: 3 }, mixed);
    expect(upgraded.total).toBe(session.total);
    expect(upgraded.queue).toHaveLength(1);
    expect(upgraded.queue[0]).not.toBe(upcoming);
    expect(mixed.find((word) => word.id === upgraded.queue[0])?.ruleId).toBe('ie-i');
    expect(upgraded.reserveIds).not.toContain(upgraded.queue[0]);
  });

  it('zählt Wörter, Treffer und Wiederholungen unabhängig von der Rundenlänge', () => {
    let session = createSession(words, rules, {}, settings, () => 0.5);
    session = finishExercise(session, false);
    session = nextExercise(session, words, rules, () => 0.5);
    session = finishExercise(session, true);
    session = nextExercise(session, words, rules, () => 0.5);
    session = finishExercise(session, true);
    session = nextExercise(session, words, rules, () => 0.5);
    expect(session.currentRetry).toBe(true);
    expect(roundStats(session)).toMatchObject({ words: 3, total: 3, correctWords: 2, repeats: 0 });
    session = finishExercise(session, true);
    expect(roundStats(session)).toMatchObject({ words: 3, total: 3, correctWords: 2, repeats: 1 });
  });
});
