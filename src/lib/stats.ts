/** Auswertungen für die Startseite: Bestand, Trainingsstand und Lernmuster. */

import type { Attempt, Challenge, Rule, Word, WordState } from './types';

export interface NamedCount {
  name: string;
  count: number;
}

export interface Strength extends NamedCount {
  /** Freundliche Kurzbeschreibung, z. B. „4 von 5 richtig“. */
  detail: string;
}

/** Für den seltenen Fall, dass eine Übungsansicht ohne Aufgabe geöffnet wird. */
export const EMPTY_LEARNING_STATS: LearningStats = {
  totalWords: 0, learned: 0, percent: 0, totalTopics: 0, trainedTopics: 0,
  totalExercises: 0, trainedExercises: 0, secureWords: 0, toughSpots: [], strengths: [],
};

export interface LearningStats {
  totalWords: number;
  learned: number;
  percent: number;
  totalTopics: number;
  trainedTopics: number;
  totalExercises: number;
  trainedExercises: number;
  secureWords: number;
  /** Häufige Stolperstellen – positiv formuliert als „noch knifflig“. */
  toughSpots: NamedCount[];
  strengths: Strength[];
}

/**
 * Zählt den Bestand und wertet die Versuche eines Profils aus.
 * Gelesen wird nur lokal: Wörter, Themen, Aufgaben und die gespeicherten Versuche.
 */
export function computeHomeStats(
  words: readonly Word[],
  rules: readonly Rule[],
  challenges: readonly Challenge[],
  progress: Record<string, WordState>,
  attempts: readonly Attempt[],
): LearningStats {
  const wordById = new Map(words.map((word) => [word.id, word]));
  const ruleById = new Map(rules.map((rule) => [rule.id, rule]));
  const challengeIds = new Set(challenges.map((challenge) => challenge.id));
  const learned = Object.keys(progress).length;
  const practicedIds = new Set([...Object.keys(progress), ...attempts.map((attempt) => attempt.wordId)]);

  const topicIds = new Set<string>();
  for (const attempt of attempts) if (ruleById.has(attempt.ruleId)) topicIds.add(attempt.ruleId);
  for (const id of practicedIds) {
    const ruleId = wordById.get(id)?.ruleId;
    if (ruleId && ruleById.has(ruleId)) topicIds.add(ruleId);
  }
  let trainedExercises = 0;
  for (const id of practicedIds) if (challengeIds.has(id)) trainedExercises += 1;

  const secureWords = Object.values(progress).filter((state) => state.box >= 4 && state.seen > 0).length;

  const tough = new Map<string, number>();
  for (const attempt of attempts) {
    // Nicht lesbare Handschrift ist kein Rechtschreibfehler.
    if (attempt.correct || attempt.illegible) continue;
    const name = attempt.categories[0] ?? ruleById.get(attempt.ruleId)?.title ?? attempt.ruleId;
    tough.set(name, (tough.get(name) ?? 0) + 1);
  }
  const toughSpots = [...tough.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'de-DE'))
    .slice(0, 3);

  const byRule = new Map<string, { correct: number; total: number }>();
  for (const attempt of attempts) {
    const entry = byRule.get(attempt.ruleId) ?? { correct: 0, total: 0 };
    entry.total += 1;
    if (attempt.correct) entry.correct += 1;
    byRule.set(attempt.ruleId, entry);
  }
  let strengths = [...byRule.entries()]
    .filter(([, entry]) => entry.total >= 2 && entry.correct / entry.total >= 0.7)
    .sort((a, b) => b[1].correct / b[1].total - a[1].correct / a[1].total || b[1].total - a[1].total)
    .slice(0, 3)
    .map(([ruleId, entry]) => ({
      name: ruleById.get(ruleId)?.title ?? ruleId,
      count: entry.correct,
      detail: `${entry.correct} von ${entry.total} richtig`,
    }));

  if (strengths.length === 0) {
    // Bevor genug Versuche zusammenkommen, zeigen sichere Wörter aus dem Leitner-Fach.
    const secureByRule = new Map<string, number>();
    for (const [id, state] of Object.entries(progress)) {
      if (state.box < 4) continue;
      const ruleId = wordById.get(id)?.ruleId;
      if (ruleId) secureByRule.set(ruleId, (secureByRule.get(ruleId) ?? 0) + 1);
    }
    strengths = [...secureByRule.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'de-DE'))
      .slice(0, 3)
      .map(([ruleId, count]) => ({
        name: ruleById.get(ruleId)?.title ?? ruleId,
        count,
        detail: `${count} Wörter sitzen sicher`,
      }));
  }

  return {
    totalWords: words.length,
    learned,
    percent: words.length === 0 ? 0 : Math.round((learned / words.length) * 100),
    totalTopics: rules.length,
    trainedTopics: topicIds.size,
    totalExercises: challenges.length,
    trainedExercises,
    secureWords,
    toughSpots,
    strengths,
  };
}
