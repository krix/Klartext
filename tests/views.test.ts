import { describe, expect, it } from 'vitest';
import { createSession } from '../src/lib/session';
import { freshState } from '../src/lib/storage';
import type { Rule, Word } from '../src/lib/types';
import { practiceView } from '../src/ui/views';

const rule: Rule = { id: 'ie-i', title: 'ie oder i', tip: 'Lang: ie.' };
const words: Word[] = [{ id: 'a', word: 'Liebe', ruleId: 'ie-i', level: 1, hint: 'Tipp' }];

function renderPractice(checking: boolean, kiReady = true): string {
  const data = freshState();
  if (kiReady) {
    data.settings.apiKey = 'test-key';
    data.settings.privacyOptIn = true;
  }
  // rng = 0.1 erzwingt ein Diktat, also die Ansicht mit Schreibfläche und Prüfen-Button.
  const session = createSession(words, [rule], {}, data.settings, () => 0.1);
  return practiceView(data, session, checking, false);
}

function checkButton(html: string): string {
  const match = /<button[^>]*data-action="check"[^>]*>/.exec(html);
  if (!match) throw new Error('Prüfen-Button fehlt.');
  return match[0];
}

describe('Prüfen-Button', () => {
  it('ist im Normalzustand aktiv', () => {
    expect(checkButton(renderPractice(false))).not.toContain('disabled');
  });

  it('ist nur während der laufenden Prüfung deaktiviert', () => {
    expect(checkButton(renderPractice(true))).toContain('disabled');
  });

  it('erscheint ohne Key oder Zustimmung gar nicht', () => {
    expect(() => checkButton(renderPractice(false, false))).toThrow('Prüfen-Button fehlt.');
  });
});
