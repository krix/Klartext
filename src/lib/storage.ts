import type { AppData, AppFont, AppTheme, Attempt, Profile, Settings, Word, WordState } from './types';

const STORAGE_KEY = 'klartext.state.v1';
const MAX_ATTEMPTS = 3000;
const MAX_NAME_LENGTH = 24;
export const DEFAULT_PROFILE_NAME = 'Kind';

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
  font: 'lexend',
};

function newProfileId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return `kind-${crypto.randomUUID()}`;
  return `kind-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function makeProfile(name: string, progress: Record<string, WordState> = {}, attempts: Attempt[] = []): Profile {
  return {
    id: newProfileId(),
    name: cleanName(name) || DEFAULT_PROFILE_NAME,
    progress,
    attempts: attempts.slice(-MAX_ATTEMPTS),
  };
}

function cleanName(value: unknown): string {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, MAX_NAME_LENGTH) : '';
}

export function freshState(): AppData {
  const profile = makeProfile(DEFAULT_PROFILE_NAME);
  profile.id = 'kind-1';
  return {
    version: 2,
    settings: { ...DEFAULT_SETTINGS },
    activeProfileId: profile.id,
    profiles: [profile],
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

function cleanProgress(value: unknown): Record<string, WordState> {
  const progress: Record<string, WordState> = {};
  if (isRecord(value)) {
    for (const [id, entry] of Object.entries(value)) {
      const clean = cleanWordState(entry);
      if (clean) progress[id] = clean;
    }
  }
  return progress;
}

function cleanAttempts(value: unknown): Attempt[] {
  return Array.isArray(value)
    ? value.filter(isRecord).slice(-MAX_ATTEMPTS) as unknown as Attempt[]
    : [];
}

function cleanProfile(value: unknown): Profile | null {
  if (!isRecord(value)) return null;
  const id = typeof value.id === 'string' && value.id.trim() ? value.id : newProfileId();
  return {
    id,
    name: cleanName(value.name) || DEFAULT_PROFILE_NAME,
    progress: cleanProgress(value.progress),
    attempts: cleanAttempts(value.attempts),
  };
}

function cleanSettings(raw: unknown): Settings {
  const settingsRaw = isRecord(raw) ? raw : {};
  return {
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
    // "mint" hieß das Hellblau-Thema in früheren Versionen.
    theme: settingsRaw.theme === 'mint' ? 'sky' : isTheme(settingsRaw.theme) ? settingsRaw.theme : 'paper',
    font: isFont(settingsRaw.font) ? settingsRaw.font : 'lexend',
  };
}

/** Liest den lokalen Zustand robust ein; alte Daten werden als erstes Profil übernommen. */
export function loadState(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return freshState();
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return freshState();

    const settings = cleanSettings(parsed.settings);
    const customWords = Array.isArray(parsed.customWords)
      ? parsed.customWords.map(cleanWord).filter((word): word is Word => word !== null)
      : [];

    // Version 1 hatte genau einen Lernstand direkt im Wurzelobjekt.
    if (parsed.version === 1 || !Array.isArray(parsed.profiles) || parsed.profiles.length === 0) {
      const legacy = makeProfile(DEFAULT_PROFILE_NAME, cleanProgress(parsed.progress), cleanAttempts(parsed.attempts));
      legacy.id = 'kind-1';
      return { version: 2, settings, activeProfileId: legacy.id, profiles: [legacy], customWords };
    }

    const profiles = parsed.profiles.map(cleanProfile).filter((profile): profile is Profile => profile !== null);
    if (profiles.length === 0) return freshState();
    const activeId = typeof parsed.activeProfileId === 'string' && profiles.some((profile) => profile.id === parsed.activeProfileId)
      ? parsed.activeProfileId
      : profiles[0].id;
    return { version: 2, settings, activeProfileId: activeId, profiles, customWords };
  } catch (error) {
    console.warn('Klartext: gespeicherte Daten konnten nicht gelesen werden.', error);
    return freshState();
  }
}

function isTheme(value: unknown): value is AppTheme {
  return value === 'paper' || value === 'sky' || value === 'night';
}

function isFont(value: unknown): value is AppFont {
  return value === 'lexend' || value === 'atkinson' || value === 'dyslexic' || value === 'system';
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

export function activeProfile(data: AppData): Profile {
  return data.profiles.find((profile) => profile.id === data.activeProfileId) ?? data.profiles[0];
}

export function addProfile(data: AppData, name: string): Profile {
  const profile = makeProfile(name);
  data.profiles.push(profile);
  data.activeProfileId = profile.id;
  return profile;
}

export function switchProfile(data: AppData, id: string): boolean {
  if (!data.profiles.some((profile) => profile.id === id)) return false;
  data.activeProfileId = id;
  return true;
}

export function renameProfile(data: AppData, id: string, name: string): boolean {
  const profile = data.profiles.find((entry) => entry.id === id);
  if (!profile) return false;
  const clean = cleanName(name);
  if (!clean) return false;
  profile.name = clean;
  return true;
}

export function deleteProfile(data: AppData, id: string): boolean {
  if (data.profiles.length <= 1) return false;
  const index = data.profiles.findIndex((profile) => profile.id === id);
  if (index < 0) return false;
  data.profiles.splice(index, 1);
  if (data.activeProfileId === id) data.activeProfileId = data.profiles[Math.min(index, data.profiles.length - 1)].id;
  return true;
}
