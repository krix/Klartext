import type { Attempt, Difference, Rule, Word, WordState } from './types';

export const DAY = 24 * 60 * 60 * 1000;
/** Leitner-Fächer: 0 = sofort wiederholen, dann 1, 2, 4, 8, 16 Tage. */
export const LEITNER_DAYS = [0, 1, 2, 4, 8, 16];
export const MAX_BOX = LEITNER_DAYS.length - 1;

export function applyResult(state: WordState | undefined, correct: boolean, now = Date.now()): WordState {
  const box = correct ? Math.min(MAX_BOX, (state?.box ?? 0) + 1) : 0;
  return {
    box,
    due: correct ? now + LEITNER_DAYS[box] * DAY : now,
    seen: (state?.seen ?? 0) + 1,
    lapses: (state?.lapses ?? 0) + (correct ? 0 : 1),
    lastCorrect: correct,
  };
}

export function isDue(state: WordState | undefined, now = Date.now()): boolean {
  return !state || state.due <= now;
}

/** Vergleichstexte: NFC, einfache Leerzeichen, keine Satzzeichen am Rand. */
export function normalizeWord(input: string, caseSensitive = false): string {
  let value = input.normalize('NFC').replace(/[\s\u00a0\u202f]+/g, ' ').trim();
  value = value.replace(/[.,!?;:]+$/g, '').trim();
  if (!caseSensitive) value = value.toLocaleLowerCase('de-DE');
  return value;
}

/** LCS-Differenz: liefert Position (0-basiert), erwartetes und geschriebenes Zeichen. */
export function diffWords(expected: string, written: string, caseSensitive = false): Difference[] {
  const left = normalizeWord(expected, caseSensitive);
  const right = normalizeWord(written, caseSensitive);
  const rows = left.length + 1;
  const cols = right.length + 1;
  const table: Uint16Array[] = Array.from({ length: rows }, () => new Uint16Array(cols));

  for (let i = left.length - 1; i >= 0; i -= 1) {
    for (let j = right.length - 1; j >= 0; j -= 1) {
      table[i][j] = left[i] === right[j]
        ? table[i + 1][j + 1] + 1
        : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }

  const differences: Difference[] = [];
  let i = 0;
  let j = 0;
  while (i < left.length && j < right.length) {
    if (left[i] === right[j]) {
      i += 1;
      j += 1;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      // Zeichen fehlt: Das erwartete Zeichen wurde weggelassen.
      differences.push({ position: i, expected: expected[i] ?? '', written: '' });
      i += 1;
    } else {
      // Zeichen zu viel: ein zusätzliches Zeichen wurde geschrieben.
      differences.push({ position: i, expected: '', written: written[j] ?? '' });
      j += 1;
    }
  }
  while (i < left.length) {
    differences.push({ position: i, expected: expected[i] ?? '', written: '' });
    i += 1;
  }
  while (j < right.length) {
    // Zusätzliche Zeichen stehen hinter dem Wort: Position = Länge des Zielworts.
    differences.push({ position: i, expected: '', written: written[j] ?? '' });
    j += 1;
  }
  return differences;
}

export function evaluateTranscription(expected: string, transcript: string, caseSensitive = false): {
  correct: boolean;
  differences: Difference[];
} {
  const differences = diffWords(expected, transcript, caseSensitive);
  return { correct: differences.length === 0, differences };
}

export function shuffle<T>(items: readonly T[], rng: () => number = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Klassifiziert ein Wort innerhalb seines Themas. So kann eine Runde gezielt
 * verschiedene Varianten enthalten (z. B. ai und ei), statt nur eine Schreibweise zu zeigen.
 */
export function wordVariant(word: Word): string {
  switch (word.ruleId) {
    case 'ie-i':
      if (/ie/i.test(word.word)) return 'ie';
      if (/i/i.test(word.word)) return 'i';
      return 'allgemein';
    case 'ss-oesz':
      if (/ß/.test(word.word)) return 'ß';
      if (/ss/i.test(word.word)) return 'ss';
      return 's';
    case 'ai-ei':
      if (/ai/i.test(word.word)) return 'ai';
      if (/ei/i.test(word.word)) return 'ei';
      return 'allgemein';
    case 'aeu-eu':
      if (/äu/i.test(word.word)) return 'äu';
      if (/eu/i.test(word.word)) return 'eu';
      return 'allgemein';
    case 'dehnung':
      if (/(aa|ee|oo)/i.test(word.word)) return 'doppelvokal';
      if (/ie/i.test(word.word)) return 'ie';
      return 'offene-silbe';
    case 'dehnungs-h':
      return /h[lmnr]/i.test(word.word) ? 'h-vor-lmnr' : 'sonstiges-h';
    case 'doppelkonsonant':
      if (/ck/i.test(word.word)) return 'ck';
      if (/([b-df-hj-np-tv-z])\1/i.test(word.word)) return 'doppelkonsonant';
      return 'einfach';
    case 'sch-s':
      if (/sch/i.test(word.word)) return 'sch';
      if (/(st|sp)/i.test(word.word)) return 'st/sp';
      return 's';
    case 'das-dass':
      if (/^dass/i.test(word.word)) return 'dass';
      if (/^das$/i.test(word.word)) return 'das';
      if (/^da/i.test(word.word)) return 'da-wort';
      return 'de-wort';
    case 'als-wie':
      if (/^als$/i.test(word.word)) return 'als';
      if (/wie/i.test(word.word)) return 'wie';
      if (/(mehr|weniger|anders|desto|verglichen|entsprechend)/i.test(word.word)) return 'vergleich';
      if (/(so|immer|nie|genauso|ebenso)/i.test(word.word)) return 'gleichheit';
      return 'allgemein';
    case 'wieder-wider':
      if (/wieder/i.test(word.word)) return 'wieder';
      if (/wider/i.test(word.word)) return 'wider';
      return 'allgemein';
    case 'ver-vor':
      if (/^ver/i.test(word.word)) return 'ver';
      if (/^vor/i.test(word.word)) return 'vor';
      return 'allgemein';
    case 'emp-ent':
      if (/^emp/i.test(word.word)) return 'emp';
      if (/^ent/i.test(word.word)) return 'ent';
      return 'allgemein';
    case 'ig-lich':
      if (/ig$/i.test(word.word)) return 'ig';
      if (/lich$/i.test(word.word)) return 'lich';
      return 'allgemein';
    case 'heit-keit':
      if (/heit$/i.test(word.word)) return 'heit';
      if (/keit$/i.test(word.word)) return 'keit';
      return 'allgemein';
    case 'grossschreibung':
      return word.word.length >= 10 ? 'zusammengesetzt' : 'einfach';
    default:
      return 'allgemein';
  }
}

export interface SelectionOptions {
  now?: number;
  difficulty?: number;
  recentIds?: string[];
  /** Wörter aus der laufenden Einheit, die noch einmal dran sind. */
  retryIds?: string[];
  rng?: () => number;
}

/** Ersetzt Mehrfach-Varianten durch fehlende Varianten, damit eine Runde gemischt bleibt. */
function balanceVariants(
  chosen: Word[],
  pool: readonly Word[],
  count: number,
  retryIds: readonly string[],
  score: (word: Word) => number,
): Word[] {
  const inPool = new Set(pool.map(wordVariant));
  if (inPool.size <= 1) return chosen;

  const counts = new Map<string, number>();
  for (const word of chosen) counts.set(wordVariant(word), (counts.get(wordVariant(word)) ?? 0) + 1);

  for (const variant of inPool) {
    if ((counts.get(variant) ?? 0) > 0) continue;
    const candidate = pool
      .filter((word) => !chosen.some((item) => item.id === word.id) && wordVariant(word) === variant)
      .sort((a, b) => score(a) - score(b))[0];
    if (!candidate) continue;

    if (chosen.length < count) {
      chosen.push(candidate);
      counts.set(variant, 1);
      continue;
    }

    const replaceable = chosen
      .filter((word) => !retryIds.includes(word.id) && (counts.get(wordVariant(word)) ?? 0) > 1)
      .sort((a, b) => score(b) - score(a))[0];
    if (!replaceable) continue;

    const previousVariant = wordVariant(replaceable);
    counts.set(previousVariant, (counts.get(previousVariant) ?? 1) - 1);
    chosen[chosen.indexOf(replaceable)] = candidate;
    counts.set(variant, 1);
  }
  return chosen;
}

/** Wählt fällige und fehlerhafte Wörter zuerst aus – das ist die Leitner-Logik. */
export function selectWords(
  words: readonly Word[],
  progress: Record<string, WordState>,
  count: number,
  options: SelectionOptions = {},
): Word[] {
  const {
    now = Date.now(),
    difficulty = 1,
    recentIds = [],
    retryIds = [],
    rng = Math.random,
  } = options;
  if (count <= 0 || words.length === 0) return [];

  const allowed = words.filter((word) => retryIds.includes(word.id) || word.level <= difficulty);
  const pool = shuffle(allowed, rng);
  const score = (word: Word): number => {
    const state = progress[word.id];
    const due = state?.due ?? 0;
    return (state?.box ?? 0) * 10_000_000_000 - (state?.lapses ?? 0) * 1_000_000 + due / DAY - (retryIds.includes(word.id) ? 100_000 : 0);
  };

  const retry = pool.filter((word) => retryIds.includes(word.id));
  const due = pool.filter((word) => !retryIds.includes(word.id) && isDue(progress[word.id], now));
  const rest = pool.filter((word) => !retryIds.includes(word.id) && !isDue(progress[word.id], now));

  const chosen: Word[] = [];
  const seenIds = new Set<string>();
  const take = (candidates: Word[], avoidRecent: boolean) => {
    for (const word of [...candidates].sort((a, b) => score(a) - score(b))) {
      if (chosen.length >= count) return;
      if (seenIds.has(word.id)) continue;
      if (avoidRecent && recentIds.includes(word.id)) continue;
      chosen.push(word);
      seenIds.add(word.id);
    }
  };

  take(retry, false);
  take(due, true);
  take(due, false);
  take(rest.filter((word) => !recentIds.includes(word.id)), true);
  take(rest, false);
  return balanceVariants(chosen, pool, count, retryIds, score).slice(0, count);
}

/** Adaptive Schwierigkeit: nach Fehlern leichter, nach einer Erfolgsserie schwerer. */
export function updateDifficulty(difficulty: number, correctStreak: number, errorStreak: number): number {
  if (errorStreak >= 2) return Math.max(1, difficulty - 1);
  if (correctStreak >= 5) return Math.min(3, difficulty + 1);
  return Math.max(1, Math.min(3, difficulty));
}

const CONFUSION_PAIRS: Record<string, string> = {
  'ie|i': 'ie/i',
  'i|ie': 'ie/i',
  'ss|ß': 'ss/ß',
  'ß|ss': 'ss/ß',
  'ai|ei': 'ai/ei',
  'ei|ai': 'ai/ei',
  'äu|eu': 'äu/eu',
  'eu|äu': 'äu/eu',
};

const RULE_CATEGORIES: Record<string, string> = {
  'ie-i': 'ie/i',
  'ss-oesz': 'ss/ß',
  'ai-ei': 'ai/ei',
  'aeu-eu': 'äu/eu',
  'dehnung': 'lange Vokale',
  'dehnungs-h': 'Dehnungs-h',
  'doppelkonsonant': 'Doppelkonsonanten',
  'sch-s': 'sch/s',
  'das-dass': 'das/dass',
  'als-wie': 'als/wie',
  'wieder-wider': 'wieder/wider',
  'ver-vor': 'ver-/vor-',
  'emp-ent': 'emp-/ent-',
  'ig-lich': '-ig/-lich',
  'heit-keit': '-heit/-keit',
  'grossschreibung': 'Nomen großschreiben',
};

export function errorCategories(differences: readonly Difference[], ruleId: string): string[] {
  const categories = new Set<string>();
  const ruleCategory = RULE_CATEGORIES[ruleId];
  if (ruleCategory) categories.add(ruleCategory);

  for (const difference of differences) {
    const expected = normalizeWord(difference.expected, true);
    const written = normalizeWord(difference.written, true);
    const pair = `${expected}|${written}`;
    if (CONFUSION_PAIRS[pair]) categories.add(CONFUSION_PAIRS[pair]);
    if (expected && written && expected !== written && expected.toLocaleLowerCase('de-DE') === written.toLocaleLowerCase('de-DE')) {
      categories.add('Groß-/Kleinschreibung');
    }
  }
  return [...categories];
}

export interface PlanEntry {
  ruleId: string;
  title: string;
  tip: string;
  errors: number;
  total: number;
  rate: number;
}

/** Persönlicher Trainingsplan aus den letzten 90 Tagen. */
export function buildTrainingPlan(attempts: readonly Attempt[], rules: readonly Rule[], limit = 3): PlanEntry[] {
  const cutoff = Date.now() - 90 * DAY;
  const stats = new Map<string, { errors: number; total: number }>();
  for (const attempt of attempts) {
    if (attempt.ts < cutoff || attempt.selfAssessed) continue;
    const entry = stats.get(attempt.ruleId) ?? { errors: 0, total: 0 };
    entry.total += 1;
    if (!attempt.correct) entry.errors += 1;
    stats.set(attempt.ruleId, entry);
  }

  return [...stats.entries()]
    .map(([ruleId, entry]) => ({
      ruleId,
      title: rules.find((rule) => rule.id === ruleId)?.title ?? ruleId,
      tip: rules.find((rule) => rule.id === ruleId)?.tip ?? '',
      errors: entry.errors,
      total: entry.total,
      rate: entry.total === 0 ? 0 : entry.errors / entry.total,
    }))
    .filter((entry) => entry.errors > 0)
    .sort((a, b) => b.errors - a.errors || b.rate - a.rate)
    .slice(0, limit);
}

function dayKey(timestamp: number): string {
  // Lokaler Kalendertag, damit die Tagesserie zur Uhrzeit des Kindes passt.
  const date = new Date(timestamp - new Date(timestamp).getTimezoneOffset() * 60_000);
  return date.toISOString().slice(0, 10);
}

export function computeStreak(attempts: readonly Attempt[], now = Date.now()): number {
  const days = new Set(attempts.filter((attempt) => attempt.correct).map((attempt) => dayKey(attempt.ts)));
  if (days.size === 0) return 0;
  let cursor = now;
  if (!days.has(dayKey(cursor))) cursor -= DAY; // Heute noch nicht geübt: Serie zählt bis gestern.
  let streak = 0;
  while (days.has(dayKey(cursor))) {
    streak += 1;
    cursor -= DAY;
  }
  return streak;
}

export function computeStars(attempts: readonly Attempt[]): number {
  return attempts.filter((attempt) => attempt.correct && !attempt.selfAssessed).length;
}

export const THEME_UNLOCKS: Record<string, number> = { paper: 0, mint: 15, night: 40 };

export function unlockedThemes(stars: number): string[] {
  return Object.entries(THEME_UNLOCKS)
    .filter(([, required]) => stars >= required)
    .map(([theme]) => theme);
}

type Transform = (word: string) => string;
type AlternativePair = readonly [string, string];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Tauscht einen Regel-Laut gegen seinen Gegensatz – in einem Durchgang, damit nichts doppelt tauscht. */
function swapAlternatives(word: string, pairs: readonly AlternativePair[], onlyFirst = false): string {
  const variants = pairs.flat().sort((a, b) => b.length - a.length);
  const regex = new RegExp(variants.map(escapeRegExp).join('|'), onlyFirst ? 'i' : 'gi');
  return word.replace(regex, (match) => {
    const lower = match.toLocaleLowerCase('de-DE');
    const pair = pairs.find(([first, second]) =>
      first.toLocaleLowerCase('de-DE') === lower || second.toLocaleLowerCase('de-DE') === lower);
    if (!pair) return match;
    const [first, second] = pair;
    const next = lower === first.toLocaleLowerCase('de-DE') ? second : first;
    if (match === match.toLocaleUpperCase('de-DE')) return next.toLocaleUpperCase('de-DE');
    if (match[0] === match[0].toLocaleUpperCase('de-DE')) return next[0].toLocaleUpperCase('de-DE') + next.slice(1);
    return next;
  });
}

const both = (pair: AlternativePair): Transform => (word) => swapAlternatives(word, [pair]);
const firstOnly = (pair: AlternativePair): Transform => (word) => swapAlternatives(word, [pair], true);

/** Pro Regel zuerst die typischen Verwechslungen anbieten, nicht zufällige Buchstabenänderungen. */
const RULE_TRANSFORMS: Record<string, Transform[]> = {
  'ie-i': [both(['ie', 'i']), firstOnly(['ie', 'i'])],
  'ss-oesz': [both(['ss', 'ß']), firstOnly(['ss', 'ß'])],
  'ai-ei': [both(['ai', 'ei']), firstOnly(['ai', 'ei'])],
  'aeu-eu': [both(['äu', 'eu']), firstOnly(['äu', 'eu'])],
  'dehnung': [(word) => word.replace(/([aeiouäöü])/i, '$1$1')],
  'dehnungs-h': [(word) => word.replace(/([aeiouäöü])h/i, '$1'), (word) => word.replace(/([aeiouäöü])/i, '$1h')],
  'doppelkonsonant': [
    (word) => word.replace(/([b-df-hj-np-tv-z])\1/i, '$1'),
    (word) => word.replace(/([b-df-hj-np-tv-z])(?![b-df-hj-np-tv-z])/i, '$1$1'),
  ],
  'sch-s': [both(['sch', 's'])],
  'das-dass': [both(['das', 'dass'])],
  'als-wie': [both(['als', 'wie'])],
  'wieder-wider': [both(['wieder', 'wider'])],
  'ver-vor': [both(['ver', 'vor'])],
  'emp-ent': [both(['emp', 'ent'])],
  'ig-lich': [both(['ig', 'lich'])],
  'heit-keit': [both(['heit', 'keit'])],
  'grossschreibung': [
    (word) => word.toLocaleLowerCase('de-DE'),
    (word) => word.toLocaleUpperCase('de-DE'),
  ],
};

const TRANSFORMS: Transform[] = [
  both(['ie', 'i']),
  both(['ss', 'ß']),
  both(['ai', 'ei']),
  both(['äu', 'eu']),
  (word) => word.replace(/([b-df-hj-np-tv-z])\1/i, '$1'),
  (word) => word.replace(/([b-df-hj-np-tv-z])(?![b-df-hj-np-tv-z])/i, '$1$1'),
  (word) => word.charAt(0).toLocaleUpperCase('de-DE') + word.slice(1),
  (word) => word.charAt(0).toLocaleLowerCase('de-DE') + word.slice(1),
];

/** Drei Antwortmöglichkeiten: eine richtig, zwei typische Fehler – möglichst genau zur Regel des Wortes. */
export function buildChoiceOptions(word: Word, rng: () => number = Math.random, rule?: Rule): string[] {
  const options = new Set<string>([word.word]);
  const add = (candidate: string): void => {
    if (candidate && candidate !== word.word) options.add(candidate);
  };

  if (rule) {
    for (const transform of shuffle(RULE_TRANSFORMS[rule.id] ?? [], rng)) {
      if (options.size >= 3) break;
      add(transform(word.word));
    }
  }
  for (const transform of shuffle(TRANSFORMS, rng)) {
    if (options.size >= 3) break;
    add(transform(word.word));
  }
  // fallback: falls kaum Varianten möglich sind, Buchstaben verdoppeln/entfernen.
  let index = 0;
  while (options.size < 3 && index < word.word.length) {
    const char = word.word[index];
    add(`${word.word.slice(0, index)}${char}${char}${word.word.slice(index)}`);
    if (index > 0 && word.word[index - 1] === char) {
      add(`${word.word.slice(0, index)}${word.word.slice(index + 1)}`);
    }
    index += 1;
  }
  return shuffle([...options], rng);
}

/** Kurzes, freundliches Feedback, wenn die KI nicht verfügbar ist oder selbst geprüft wird. */
export function localFeedback(rule: Rule, correct: boolean, illegible = false): string {
  if (illegible) return 'Ich kann die Schrift leider nicht sicher lesen. Schreib das Wort noch einmal groß und langsam.';
  if (correct) return `Super, das stimmt! ${rule.tip}`;
  return `Fast! Schau noch einmal genau hin: ${rule.tip}`;
}
