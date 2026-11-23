import { buildChoiceOptions, selectWords, shuffle, updateDifficulty } from './learning';
import type { Exercise, ExerciseKind, Rule, Word, WordState } from './types';
import type { Settings } from './types';

export interface SessionState {
  queue: string[];
  retries: string[];
  recentIds: string[];
  current: Exercise | null;
  done: number;
  total: number;
  correct: number;
  correctStreak: number;
  errorStreak: number;
  difficulty: number;
  /** true, wenn gerade eine Hilfestellung angezeigt wird (nach Fehlerserie). */
  showHelp: boolean;
  /** Erst ab dieser Übungsnummer darf ein fehlerhaftes Wort wiederkommen. */
  retryAfter: number;
}

function pickKind(word: Word, errorStreak: number, rng: () => number): ExerciseKind {
  // Das Nomen-Thema braucht eine sichtbare Übung: Diktate können Großschreibung nicht übertragen.
  if (word.ruleId === 'grossschreibung') return rng() < 0.75 ? 'choice' : 'copy';
  if (errorStreak >= 2) return rng() < 0.6 ? 'copy' : 'choice';
  const draw = rng();
  if (draw < 0.6) return 'dictation';
  return draw < 0.8 ? 'copy' : 'choice';
}

export function createSession(
  words: readonly Word[],
  rules: readonly Rule[],
  progress: Record<string, WordState>,
  settings: Settings,
  rng: () => number = Math.random,
  now = Date.now(),
): SessionState {
  const chosen = selectWords(words, progress, settings.sessionLength, { now, rng });
  const initial: SessionState = {
    queue: chosen.map((word) => word.id),
    retries: [],
    recentIds: [],
    current: null,
    done: 0,
    total: chosen.length,
    correct: 0,
    correctStreak: 0,
    errorStreak: 0,
    difficulty: 1,
    showHelp: false,
    retryAfter: Number.POSITIVE_INFINITY,
  };
  return nextExercise(initial, words, rules, rng);
}

export function nextExercise(
  session: SessionState,
  words: readonly Word[],
  rules: readonly Rule[],
  rng: () => number = Math.random,
): SessionState {
  // Fehlerhafte Wörter kommen erst nach zwei anderen Wörtern noch einmal dran.
  const useRetry = session.retries.length > 0 && session.done >= session.retryAfter;
  const source = useRetry ? session.retries : session.queue;
  const wordId = source[0];
  if (!wordId) return { ...session, current: null };

  const word = words.find((candidate) => candidate.id === wordId);
  if (!word) return nextExercise({ ...session, queue: session.queue.slice(1), retries: session.retries.slice(1) }, words, rules, rng);

  const rule = rules.find((candidate) => candidate.id === word.ruleId) ?? {
    id: word.ruleId,
    title: word.ruleId,
    tip: 'Schau genau auf die Stelle, die du unsicher bist.',
  };
  const kind = pickKind(word, session.errorStreak, rng);
  const exercise: Exercise = {
    word,
    rule,
    kind,
    options: kind === 'choice' ? buildChoiceOptions(word, rng, rule) : undefined,
  };

  return {
    ...session,
    queue: useRetry ? session.queue : session.queue.slice(1),
    retries: useRetry ? session.retries.slice(1) : session.retries,
    recentIds: [...session.recentIds.slice(-6), wordId],
    current: exercise,
  };
}

export function finishExercise(session: SessionState, correct: boolean): SessionState {
  const wordId = session.current?.word.id;
  const correctStreak = correct ? session.correctStreak + 1 : 0;
  const errorStreak = correct ? 0 : session.errorStreak + 1;
  const done = session.done + 1;
  return {
    ...session,
    done,
    correct: session.correct + (correct ? 1 : 0),
    correctStreak,
    errorStreak,
    difficulty: updateDifficulty(session.difficulty, correctStreak, errorStreak),
    showHelp: errorStreak >= 2,
    retries: correct || !wordId ? session.retries : [...session.retries, wordId],
    retryAfter: correct || !wordId ? session.retryAfter : done + 2,
    current: null,
  };
}

export function isSessionFinished(session: SessionState): boolean {
  return session.current === null && session.queue.length === 0 && session.retries.length === 0;
}

/** Nur für die Anzeige: abrundende Sortierung der Wörter (Zufall ohne Beeinflussung der Reihenfolge). */
export function previewWords(words: readonly Word[], count: number, rng: () => number = Math.random): Word[] {
  return shuffle(words, rng).slice(0, count);
}
