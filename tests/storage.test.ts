import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  activeProfile,
  addProfile,
  deleteProfile,
  freshState,
  loadState,
  makeProfile,
  renameProfile,
  saveState,
  switchProfile,
} from '../src/lib/storage';

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  clear(): void {
    this.values.clear();
  }
}

beforeEach(() => {
  vi.stubGlobal('localStorage', new MemoryStorage());
});

describe('Profile und Speicherung', () => {
  it('legt beim ersten Start ein Profil an', () => {
    const data = freshState();
    expect(data.version).toBe(2);
    expect(data.profiles).toHaveLength(1);
    expect(activeProfile(data).name).toBe('Kind');
  });

  it('übernimmt alte Daten als erstes Profil', () => {
    localStorage.setItem('klartext.state.v1', JSON.stringify({
      version: 1,
      settings: { sessionLength: 5, theme: 'mint' },
      progress: { 'ie-i-01': { box: 2, due: 123, seen: 3, lapses: 1 } },
      attempts: [{ ts: 1, wordId: 'ie-i-01', word: 'Liebe', ruleId: 'ie-i', correct: true, source: 'self', selfAssessed: true, illegible: false, categories: [] }],
      customWords: [],
    }));
    const data = loadState();
    expect(data.version).toBe(2);
    expect(data.profiles).toHaveLength(1);
    expect(data.settings.sessionLength).toBe(5);
    expect(data.settings.theme).toBe('mint');
    expect(activeProfile(data).progress['ie-i-01'].box).toBe(2);
    expect(activeProfile(data).attempts).toHaveLength(1);
  });

  it('legt Profile an, benennt sie um und wechselt zwischen ihnen', () => {
    const data = freshState();
    const lina = addProfile(data, '  Lina  ');
    expect(lina.name).toBe('Lina');
    expect(activeProfile(data).name).toBe('Lina');
    expect(renameProfile(data, lina.id, 'Lina S.')).toBe(true);
    expect(activeProfile(data).name).toBe('Lina S.');
    expect(switchProfile(data, 'kind-1')).toBe(true);
    expect(activeProfile(data).name).toBe('Kind');
    expect(switchProfile(data, 'gibt-es-nicht')).toBe(false);
  });

  it('hält Lernstände getrennt und löscht nur Profile, nicht das letzte', () => {
    const data = freshState();
    const first = activeProfile(data);
    first.progress['a'] = { box: 3, due: 1, seen: 2, lapses: 0 };
    const second = addProfile(data, 'Mia');
    second.progress['b'] = { box: 1, due: 2, seen: 1, lapses: 0 };
    saveState(data);

    const loaded = loadState();
    expect(loaded.profiles).toHaveLength(2);
    expect(loaded.profiles.find((profile) => profile.name === 'Kind')?.progress.a.box).toBe(3);
    expect(loaded.profiles.find((profile) => profile.name === 'Mia')?.progress.b.box).toBe(1);
    expect(activeProfile(loaded).name).toBe('Mia');

    expect(deleteProfile(loaded, second.id)).toBe(true);
    expect(activeProfile(loaded).name).toBe('Kind');
    expect(deleteProfile(loaded, first.id)).toBe(false);
    expect(loaded.profiles).toHaveLength(1);
  });

  it('begrenzt Namen und fängt leere Namen ab', () => {
    const profile = makeProfile('   ');
    expect(profile.name).toBe('Kind');
    expect(makeProfile('x'.repeat(50)).name).toHaveLength(24);
  });
});
