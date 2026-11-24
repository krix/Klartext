import { buildChoiceOptions, selectWords, shuffle, updateDifficulty } from './learning';
import type { AttemptSource, Difference, Exercise, ExerciseKind, Rule, Word, WordState } from './types';
import type { Settings } from './types';

/** Ein bearbeitetes Wort inklusive Fehlerdetails für die Abschlussübersicht. */
export interface SessionResult {
  wordId: string;
  word: string;
  ruleId: string;
  correct: boolean;
  sentence?: string;
  /** Was das Kind geschrieben bzw. gewählt hat – nur für die Anzeige, nie an die KI. */
  transcription?: string;
  differences?: Difference[];
  source?: AttemptSource;
}

export interface SessionState {
  /** Alle Wörter, die in dieser Runde vorkommen dürfen (Thema oder alle Themen). */
  poolIds: string[];
  /** Gewähltes Thema; leer bedeutet themenübergreifend. */
  ruleId: string;
  queue: string[];
  retries: string[];
  recentIds: string[];
  /** Nicht eingeplante Wörter aus demselben Pool für den Austausch nach einer Erfolgsserie. */
  reserveIds: string[];
  current: Exercise | null;
  /** Zeigt an, dass das aktuelle Wort eine Wiederholung ist. */
  currentRetry: boolean;
  /** Alle bisherigen Ergebnisse der Runde – auch Wiederholungen. */
  results: SessionResult[];
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
  ruleId = '',
): SessionState {
  // Die Wortbank der Runde steht fest – adaptive Ergänzungen bleiben dadurch im gewählten Thema.
  const pool = words.filter((word) => !ruleId || word.ruleId === ruleId);
  const chosen = selectWords(pool, progress, settings.sessionLength, { now, rng });
  const chosenIds = new Set(chosen.map((word) => word.id));
  // Reserven liegen bereits fest. Bei einer Erfolgsserie wird getauscht, nie nachgelegt –
  // so bleibt „Wörter pro Runde“ die ganze Runde über verlässlich.
  const reserves = selectWords(pool.filter((word) => !chosenIds.has(word.id)), progress, 4, {
    now,
    difficulty: 3,
    rng,
  });
  const initial: SessionState = {
    poolIds: pool.map((word) => word.id),
    ruleId,
    queue: chosen.map((word) => word.id),
    retries: [],
    recentIds: [],
    reserveIds: reserves.map((word) => word.id),
    current: null,
    currentRetry: false,
    results: [],
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

/** Wortbank der laufenden Runde – für Suche, Wiederholungen und adaptive Ergänzungen. */
export function sessionWords(session: SessionState, words: readonly Word[]): Word[] {
  const allowed = new Set(session.poolIds);
  return words.filter((word) =>
    (session.poolIds.length === 0 || allowed.has(word.id)) && (!session.ruleId || word.ruleId === session.ruleId));
}

/**
 * Nach einer Erfolgsserie ein noch kommendes Wort gegen ein schwereres Wort aus
 * demselben Pool tauschen. Die Rundenlänge bleibt unverändert.
 */
export function upgradeQueue(session: SessionState, words: readonly Word[]): SessionState {
  if (session.queue.length === 0 || session.reserveIds.length === 0 || session.difficulty < 2) return session;
  const byId = new Map(sessionWords(session, words).map((word) => [word.id, word]));
  const candidates = session.reserveIds
    .map((id) => byId.get(id))
    .filter((word): word is Word => !!word);
  if (candidates.length === 0) return session;

  const upgrade = [...candidates].sort((a, b) => b.level - a.level)[0];
  // Bevorzugt ein leichteres Wort ersetzen; sonst einfach das letzte offene Wort.
  let index = -1;
  for (let position = session.queue.length - 1; position >= 0; position -= 1) {
    const queued = byId.get(session.queue[position]);
    if (queued && queued.level < upgrade.level) {
      index = position;
      break;
    }
  }
  if (index < 0) index = session.queue.length - 1;

  const queue = [...session.queue];
  queue[index] = upgrade.id;
  return {
    ...session,
    queue,
    reserveIds: session.reserveIds.filter((id) => id !== upgrade.id),
  };
}

/** Zählt unterschiedliche Wörter, Treffer und Wiederholungen der laufenden Runde. */
export function roundStats(session: SessionState): { words: number; total: number; correctWords: number; repeats: number } {
  const byWord = new Map<string, { right: number; wrong: number }>();
  for (const result of session.results) {
    const entry = byWord.get(result.wordId) ?? { right: 0, wrong: 0 };
    if (result.correct) entry.right += 1;
    else entry.wrong += 1;
    byWord.set(result.wordId, entry);
  }
  const entries = [...byWord.values()];
  return {
    words: entries.length,
    total: session.total,
    correctWords: entries.filter((entry) => entry.wrong === 0 && entry.right > 0).length,
    repeats: Math.max(0, session.results.length - entries.length),
  };
}

export function nextExercise(
  session: SessionState,
  words: readonly Word[],
  rules: readonly Rule[],
  rng: () => number = Math.random,
): SessionState {
  // Fehlerhafte Wörter kommen erst nach zwei anderen Wörtern noch einmal dran.
  // Ist die Warteschlange aber leer, darf die Wiederholung nicht auf die Pause warten –
  // sonst bleibt die Runde ohne Übung stehen und zeigt kein Rundenende an.
  const retryReady = session.retries.length > 0 && session.done >= session.retryAfter;
  let useRetry = retryReady;
  let wordId = (useRetry ? session.retries : session.queue)[0];
  if (!wordId && (useRetry ? session.queue : session.retries).length > 0) {
    useRetry = !retryReady;
    wordId = (useRetry ? session.retries : session.queue)[0];
  }
  if (!wordId) return { ...session, current: null };

  const word = sessionWords(session, words).find((candidate) => candidate.id === wordId);
  if (!word) {
    const withoutMissing = {
      ...session,
      queue: useRetry ? session.queue : session.queue.slice(1),
      retries: useRetry ? session.retries.slice(1) : session.retries,
    };
    return nextExercise(withoutMissing, words, rules, rng);
  }

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
    currentRetry: useRetry,
  };
}

export function finishExercise(
  session: SessionState,
  correct: boolean,
  detail: Pick<SessionResult, 'transcription' | 'differences' | 'source'> = {},
): SessionState {
  const current = session.current;
  const wordId = current?.word.id;
  const correctStreak = correct ? session.correctStreak + 1 : 0;
  const errorStreak = correct ? 0 : session.errorStreak + 1;
  const done = session.done + 1;
  const results = current
    ? [...session.results, {
        wordId: current.word.id,
        word: current.word.word,
        ruleId: current.word.ruleId,
        correct,
        sentence: current.word.sentence,
        transcription: detail.transcription,
        differences: detail.differences,
        source: detail.source,
      }]
    : session.results;
  return {
    ...session,
    results,
    done,
    correct: session.correct + (correct ? 1 : 0),
    correctStreak,
    errorStreak,
    difficulty: updateDifficulty(session.difficulty, correctStreak, errorStreak),
    showHelp: errorStreak >= 2,
    retries: correct || !wordId ? session.retries : [...session.retries, wordId],
    retryAfter: correct || !wordId ? session.retryAfter : done + 2,
    current: null,
    currentRetry: false,
  };
}

export function isSessionFinished(session: SessionState): boolean {
  return session.current === null && session.queue.length === 0 && session.retries.length === 0;
}

/** Nur für die Anzeige: abrundende Sortierung der Wörter (Zufall ohne Beeinflussung der Reihenfolge). */
export function previewWords(words: readonly Word[], count: number, rng: () => number = Math.random): Word[] {
  return shuffle(words, rng).slice(0, count);
}
