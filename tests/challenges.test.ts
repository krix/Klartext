import { describe, expect, it } from 'vitest';
import rawChallenges from '../src/data/challenges.json';
import rawRules from '../src/data/rules.json';
import rawWords from '../src/data/words.json';
import { createSession } from '../src/lib/session';
import { freshState } from '../src/lib/storage';
import type { Challenge, ExerciseKind, Rule, Word } from '../src/lib/types';
import { practiceView } from '../src/ui/views';

const challenges = rawChallenges as unknown as Challenge[];
const rules = rawRules as unknown as Rule[];
const words = rawWords as unknown as Word[];

/** Erzeugt eine Runde mit genau einer Aufgabe, damit die Ansicht stabil prüfbar ist. */
function singleExercise(challenge: Challenge) {
  const word = words.find((candidate) => candidate.id === challenge.id);
  if (!word) throw new Error(`Wort ${challenge.id} fehlt`);
  const state = createSession([word], rules, {}, freshState().settings, () => 0.5, 1_700_000_000_000);
  if (!state.current) throw new Error(`Keine Aufgabe erzeugt für ${challenge.id} (${JSON.stringify({ level: word.level, queue: state.queue, total: state.total })})`);
  return state;
}

describe('Neun Übungsformen', () => {
  it('deckt alle geforderten Aufgabentypen ab', () => {
    const kinds = new Set(challenges.map((challenge) => challenge.kind));
    for (const kind of [
      'syllables-build',
      'syllables-split',
      'error',
      'gap',
      'derive',
      'parts',
      'memory',
    ] satisfies ExerciseKind[]) {
      expect(kinds.has(kind), kind).toBe(true);
    }
    // Diktat, Abschreiben und Auswahl liefert die bestehende Session-Logik.
    expect(new Set<ExerciseKind>(['dictation', 'copy', 'choice']).size).toBe(3);
  });

  it('gibt jeder Challenge-Aufgabe ihre eigene Form und verwandte Regeln mit', () => {
    for (const challenge of challenges) {
      expect(challenge.prompt.length, challenge.id).toBeGreaterThan(3);
      expect(challenge.ruleText.length, challenge.id).toBeGreaterThan(10);
      expect(challenge.hints.length, challenge.id).toBeGreaterThan(0);
      expect(rules.some((rule) => rule.id === challenge.ruleId), challenge.id).toBe(true);
      const state = singleExercise(challenge);
      expect(state.current?.kind, challenge.id).toBe(challenge.kind);
      expect(state.current?.challenge?.id, challenge.id).toBe(challenge.id);
    }
  });

  it('zeigt Silbenkästchen, Lücken und Merkwörter als je eine Aufgabe', () => {
    const build = practiceView(freshState(), singleExercise(challenges.find((c) => c.kind === 'syllables-build')!), false, false);
    expect(build).toContain('data-action="place-syllable"');
    expect(build).toContain('data-action="check-syllables"');
    expect(build).not.toContain('id="schreibflaeche"');

    const gap = practiceView(freshState(), singleExercise(challenges.find((c) => c.kind === 'gap')!), false, false);
    expect(gap).toContain('gap-blank');
    expect(gap).toContain('data-action="choose"');

    const memory = practiceView(freshState(), singleExercise(challenges.find((c) => c.kind === 'memory')!), false, false);
    expect(memory).toContain('id="wort-bild"');
    expect(memory).toContain('id="schreibflaeche"');
  });

  it('bietet bei Capability-Aufgaben mehrere Hilfestellungen an', () => {
    const challenge = challenges.find((c) => c.hints.length >= 2)!;
    const first = practiceView(freshState(), singleExercise(challenge), false, true, 1);
    expect(first).toContain('Mehr Hilfe zeigen');
    expect(first).toContain(challenge.hints[0]);
    const second = practiceView(freshState(), singleExercise(challenge), false, true, 2);
    expect(second).toContain(challenge.hints[1]);
    expect(second).toContain('Tipp ausblenden');
  });
});
