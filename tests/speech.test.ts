import { afterEach, describe, expect, it, vi } from 'vitest';
import { speakWordAndSentence } from '../src/lib/speech';

class FakeUtterance {
  text: string;
  lang = '';
  rate = 1;
  pitch = 1;
  voice?: unknown;

  constructor(text: string) {
    this.text = text;
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Sprachausgabe', () => {
  it('liest erst das Wort und dann der Beispielsatz vor', () => {
    const spoken: string[] = [];
    vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
    vi.stubGlobal('window', {
      speechSynthesis: {
        cancel: vi.fn(),
        getVoices: () => [],
        speak: (utterance: FakeUtterance) => spoken.push(utterance.text),
      },
    });

    expect(speakWordAndSentence('essen', 'Wir essen gern Obst.', 0.8)).toBe(true);
    expect(spoken).toEqual(['essen', 'Wir essen gern Obst.']);
  });

  it('spricht nur das Wort, wenn kein Satz vorhanden ist', () => {
    const spoken: string[] = [];
    vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
    vi.stubGlobal('window', {
      speechSynthesis: {
        cancel: vi.fn(),
        getVoices: () => [],
        speak: (utterance: FakeUtterance) => spoken.push(utterance.text),
      },
    });

    expect(speakWordAndSentence('Straße')).toBe(true);
    expect(spoken).toEqual(['Straße']);
  });
});
