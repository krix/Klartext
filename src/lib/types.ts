/** Zentrale Datenmodelle der App. Alles liegt lokal im Browser, es gibt kein Backend. */

export interface RuleExample {
  word: string;
  note: string;
}

export interface Rule {
  id: string;
  title: string;
  tip: string;
  /** Nur wenn die Übung Groß-/Kleinschreibung trainiert, wird sie bewertet. */
  caseSensitive?: boolean;
  /** Themenbereich für die Lernseiten. */
  area?: string;
  /** Kurzbeschreibung auf der Themenübersicht. */
  summary?: string;
  /** Lernziel auf der Detailseite. */
  goal?: string;
  /** Merkregeln auf der Detailseite. */
  rules?: string[];
  /** Beispielwörter mit kurzer Erklärung. */
  examples?: RuleExample[];
}

export interface TopicArea {
  id: string;
  title: string;
  subtitle: string;
}

export interface Word {
  id: string;
  word: string;
  ruleId: string;
  level: 1 | 2 | 3;
  hint: string;
  sentence?: string;
  /** Eigene Wortlisten aus dem Elternbereich werden markiert. */
  custom?: boolean;
}

export interface Difference {
  /** Nullbasierter Index im Zielwort. */
  position: number;
  expected: string;
  written: string;
}

export interface CheckResult {
  transcription: string;
  isCorrect: boolean;
  confidence: number;
  differences: Difference[];
  feedback: string;
  illegible: boolean;
}

export type AttemptSource = 'ai' | 'self' | 'choice';

export interface Attempt {
  ts: number;
  wordId: string;
  word: string;
  ruleId: string;
  correct: boolean;
  source: AttemptSource;
  selfAssessed: boolean;
  confidence?: number;
  transcription?: string;
  illegible: boolean;
  /** Fehlerkategorien, z. B. „ie/i" oder Regel-Titel. */
  categories: string[];
}

export interface WordState {
  /** Leitner-Fach 0 = neu/fehlerhaft, 5 = sicher. */
  box: number;
  /** Zeitpunkt (Epoch-ms), ab dem das Wort wieder fällig ist. */
  due: number;
  seen: number;
  lapses: number;
  lastCorrect?: boolean;
}

export type AppTheme = 'paper' | 'sky' | 'night';
export type AppFont = 'lexend' | 'atkinson' | 'dyslexic' | 'system';

export interface Settings {
  pinHash: string | null;
  pinSalt: string | null;
  apiKey: string;
  model: string;
  handColor: string;
  handWidth: number;
  ttsRate: number;
  sessionLength: number;
  privacyOptIn: boolean;
  theme: AppTheme;
  /** Lokal eingebundene Leseschrift – nie ein externer Font-Dienst. */
  font: AppFont;
}

/** Lernstand eines Kindes. Einstellungen und eigene Wörter bleiben geräteweit gemeinsam. */
export interface Profile {
  id: string;
  name: string;
  progress: Record<string, WordState>;
  attempts: Attempt[];
}

export interface AppData {
  version: 2;
  settings: Settings;
  activeProfileId: string;
  profiles: Profile[];
  customWords: Word[];
}

export type ExerciseKind = 'dictation' | 'copy' | 'choice';

export interface Exercise {
  word: Word;
  rule: Rule;
  kind: ExerciseKind;
  options?: string[];
}
