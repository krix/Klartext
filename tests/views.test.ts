import { describe, expect, it } from 'vitest';
import { createSession } from '../src/lib/session';
import { freshState } from '../src/lib/storage';
import type { Rule, Word } from '../src/lib/types';
import { feedbackView, maskedSentence, parentView, practiceView } from '../src/ui/views';

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

describe('Übungsansicht', () => {
  it('zeigt den Beispielsatz mit Lücke und kündigt die Sprachausgabe an', () => {
    const withSentence: Word[] = [{ ...words[0], sentence: 'Wir Liebe gern Obst.' }];
    const data = freshState();
    const session = createSession(withSentence, [rule], {}, data.settings, () => 0.1);
    const html = practiceView(data, session, false, false);
    expect(html).toContain('Wort und Satz anhören');
    expect(html).toContain('Wir _____ gern Obst.');
  });

  it('verdeckt das Wort im Satz nur an seiner eigenen Stelle', () => {
    expect(maskedSentence('essen', 'Wir essen gern Obst.')).toBe('Wir _____ gern Obst.');
    expect(maskedSentence('Mai', 'Im Mai ist es schön.')).toBe('Im _____ ist es schön.');
    expect(maskedSentence('Mai', 'Der Main fließt.')).toBe('');
    expect(maskedSentence('weiß', 'Der Schnee ist weiß.')).toBe('Der Schnee ist _____.');
    expect(maskedSentence('Äußerung', 'Das ist meine Äußerung.')).toBe('Das ist meine _____.');
  });
});

describe('Rückmeldung', () => {
  it('zeigt die genaue Fehlerstelle und die richtige Schreibweise', () => {
    const html = feedbackView({
      kind: 'success', word: words[0], rule, correct: false,
      transcription: 'Libe',
      differences: [{ position: 2, expected: 'e', written: '' }],
      feedback: 'Fast!',
    }, false);
    expect(html).toContain('Genau hier war der Fehler');
    expect(html).toContain('An Stelle 3 fehlt <b>e</b>.');
    expect(html).toContain('letter-wrong');
  });

  it('zeigt am Rundenende alle geübten Wörter mit Ergebnis, Fehlerstelle und Trainingsplan', () => {
    const html = feedbackView({
      kind: 'summary', word: words[0], rule,
      message: '1 von 2 Wörtern in dieser Runde richtig.',
      results: [
        { wordId: 'a', word: 'Liebe', ruleId: 'ie-i', correct: true, sentence: 'Liebe macht froh.' },
        {
          wordId: 'b', word: 'Wiese', ruleId: 'ie-i', correct: false,
          sentence: 'Auf der Wiese blühen Blumen.',
          transcription: ' Wiesse',
          differences: [
            { position: 0, expected: '', written: ' ' },
            { position: 2, expected: 'e', written: 'a' },
          ],
          source: 'ai',
        },
      ],
    }, true, [{
      ruleId: 'ie-i', title: 'ie oder i', tip: 'Lang: ie.', errors: 2, total: 3, rate: 2 / 3,
    }]);
    expect(html).toContain('Deine Wörter in dieser Runde');
    expect(html).toContain('Liebe macht froh.');
    expect(html).toContain('Auf der Wiese blühen Blumen.');
    expect(html).toContain('1 richtig · 1 noch üben');
    expect(html).toContain('An Stelle 1 war <b>␣</b> zu viel.');
    expect(html).toContain('An Stelle 3 muss <b>e</b> stehen, nicht <b>a</b>.');
    expect(html).toContain('class="review-item is-wrong"');
    expect(html).toContain('Dein Trainingsplan');
    expect(html).toContain('2 × üben');
  });

  it('behält einen zunächst falschen Wortversuch in der Übersicht sichtbar', () => {
    const html = feedbackView({
      kind: 'summary', word: words[0], rule,
      results: [
        { wordId: 'a', word: 'Liebe', ruleId: 'ie-i', correct: false, source: 'self' },
        { wordId: 'a', word: 'Liebe', ruleId: 'ie-i', correct: true, source: 'self' },
      ],
    }, true);
    expect(html).toContain('0 richtig · 1 noch üben');
    expect(html).toContain('2×');
    expect(html).toContain('Du hast selbst entschieden');
  });
});

describe('Elternbereich', () => {
  it('bietet vier Reiter für die Bereiche', () => {
    const html = parentView(
      freshState(),
      [],
      { seen: 0, correctRate: 0, streak: 0, stars: 0, byCategory: [] },
      [],
    );
    expect(html.match(/type="radio" name="parent-tab"/g)).toHaveLength(4);
    for (const id of ['ki', 'writing', 'words', 'progress']) {
      expect(html).toContain(`for="parent-tab-${id}"`);
      expect(html).toContain(`id="panel-${id}"`);
    }
  });
});
