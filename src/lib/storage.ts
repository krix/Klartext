import type { AppData, AppTheme, Settings, Word, WordState } from './types';

const STORAGE_KEY = 'klartext.state.v1';
const MAX_ATTEMPTS = 3000;

export const DEFAULT_SETTINGS: Settings = {
  pinHash: null,
  pinSalt: null,
  apiKey: '',
  model: 'gemini-3.5-flash-lite',
  handColor: '#173b44',
  handWidth: 3.5,
  ttsRate: 0.85,
  sessionLength: 8,
  privacyOptIn: false,
  theme: 'paper',
};

export function freshState(): AppData {
  return {
    version: 1,
    settings: { ...DEFAULT_SETTINGS },
    progress: {},
    attempts: [],
    customWords: [],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cleanWord(value: unknown): Word | null {
  if (!isRecord(value)) return null;
  const { id, word, ruleId, level, hint, sentence, custom } = value;
  if (typeof id !== 'string' || typeof word !== 'string' || typeof ruleId !== 'string') return null;
  if (typeof hint !== 'string' || !word.trim()) return null;
  const safeLevel = level === 1 || level === 2 || level === 3 ? level : 1;
  return {
    id,
    word,
    ruleId,
    level: safeLevel,
    hint,
    sentence: typeof sentence === 'string' ? sentence : undefined,
    custom: custom === true,
  };
}

function cleanWordState(value: unknown): WordState | null {
  if (!isRecord(value) || typeof value.box !== 'number' || typeof value.due !== 'number') return null;
  return {
    box: Math.max(0, Math.min(5, Math.floor(value.box))),
    due: value.due,
    seen: typeof value.seen === 'number' ? value.seen : 0,
    lapses: typeof value.lapses === 'number' ? value.lapses : 0,
    lastCorrect: typeof value.lastCorrect === 'boolean' ? value.lastCorrect : undefined,
  };
}

/** Liest den lokalen Zustand robust ein; beschädigte Teile werden verworfen. */
export function loadState(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return freshState();
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return freshState();

    const settingsRaw = isRecord(parsed.settings) ? parsed.settings : {};
    const settings: Settings = {
      ...DEFAULT_SETTINGS,
      ...settingsRaw,
      pinHash: typeof settingsRaw.pinHash === 'string' ? settingsRaw.pinHash : null,
      pinSalt: typeof settingsRaw.pinSalt === 'string' ? settingsRaw.pinSalt : null,
      apiKey: typeof settingsRaw.apiKey === 'string' ? settingsRaw.apiKey : '',
      model: typeof settingsRaw.model === 'string' && settingsRaw.model.trim() ? settingsRaw.model : DEFAULT_SETTINGS.model,
      handColor: typeof settingsRaw.handColor === 'string' ? settingsRaw.handColor : DEFAULT_SETTINGS.handColor,
      handWidth: typeof settingsRaw.handWidth === 'number' ? settingsRaw.handWidth : DEFAULT_SETTINGS.handWidth,
      ttsRate: typeof settingsRaw.ttsRate === 'number' ? settingsRaw.ttsRate : DEFAULT_SETTINGS.ttsRate,
      sessionLength: typeof settingsRaw.sessionLength === 'number' ? settingsRaw.sessionLength : DEFAULT_SETTINGS.sessionLength,
      privacyOptIn: settingsRaw.privacyOptIn === true,
      theme: isTheme(settingsRaw.theme) ? settingsRaw.theme : 'paper',
    };

    const progress: Record<string, WordState> = {};
    if (isRecord(parsed.progress)) {
      for (const [id, value] of Object.entries(parsed.progress)) {
        const clean = cleanWordState(value);
        if (clean) progress[id] = clean;
      }
    }

    const attempts = Array.isArray(parsed.attempts)
      ? parsed.attempts.filter(isRecord).slice(-MAX_ATTEMPTS) as unknown as AppData['attempts']
      : [];

    const customWords = Array.isArray(parsed.customWords)
      ? parsed.customWords.map(cleanWord).filter((word): word is Word => word !== null)
      : [];

    return { version: 1, settings, progress, attempts, customWords };
  } catch (error) {
    console.warn('Klartext: gespeicherte Daten konnten nicht gelesen werden.', error);
    return freshState();
  }
}

function isTheme(value: unknown): value is AppTheme {
  return value === 'paper' || value === 'mint' || value === 'night';
}

export function saveState(state: AppData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    // Privater Modus oder voller Speicher: die App bleibt benutzbar, speichert aber nicht.
    console.warn('Klartext: Daten konnten nicht gespeichert werden.', error);
  }
}

export function clearState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn('Klartext: Daten konnten nicht gelöscht werden.', error);
  }
}
