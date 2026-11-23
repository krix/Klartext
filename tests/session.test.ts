import { describe, expect, it } from 'vitest';
import { createSession, finishExercise, isSessionFinished, nextExercise, refillWords } from '../src/lib/session';
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

  it('ergänzt nach einer Erfolgsserie nur aus dem Pool der Themenrunde', () => {
    const topicWords: Word[] = [
      { id: 't1', word: 'Liebe', ruleId: 'ie-i', level: 1, hint: 'Tipp' },
      { id: 't2', word: 'Antike', ruleId: 'ie-i', level: 1, hint: 'Tipp' },
      { id: 't3', word: 'Tier', ruleId: 'ie-i', level: 2, hint: 'Tipp' },
      { id: 't4', word: 'Wiese', ruleId: 'ie-i', level: 2, hint: 'Tipp' },
      { id: 't5', word: 'Krise', ruleId: 'ie-i', level: 3, hint: 'Tipp' },
    ];
    const mixed = [...topicWords, words[2]];
    const session = createSession(mixed, rules, {}, { ...settings, sessionLength: 2 }, () => 0.5, Date.now(), 'ie-i');
    const improved = { ...session, difficulty: 3 };
    const refilled = refillWords(improved, mixed, {});
    expect(refilled.length).toBeGreaterThan(0);
    expect(refilled.every((word) => word.ruleId === 'ie-i')).toBe(true);
    expect(refilled.every((word) => topicWords.some((topic) => topic.id === word.id))).toBe(true);
  });
});
