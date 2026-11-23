import { describe, expect, it } from 'vitest';
import rawAreas from '../src/data/topic-groups.json';
import rawRules from '../src/data/rules.json';
import rawWords from '../src/data/words.json';
import { wordVariant } from '../src/lib/learning';
import { createSession, finishExercise, nextExercise } from '../src/lib/session';
import { freshState } from '../src/lib/storage';
import type { Rule, TopicArea, Word } from '../src/lib/types';
import { topicView, topicsView } from '../src/ui/views';

const areas = rawAreas as unknown as TopicArea[];
const rules = rawRules as unknown as Rule[];
const words = rawWords as unknown as Word[];

describe('Themen', () => {
  it('sortiert jedes Regelthema in genau einen Bereich ein', () => {
    const areaIds = new Set(areas.map((area) => area.id));
    expect(areaIds.size).toBe(areas.length);
    expect(rules).toHaveLength(16);
    for (const rule of rules) {
      expect(areaIds.has(rule.area ?? '')).toBe(true);
    }
  });

  it('liefert zu jedem Thema Erklärung, Lernziel, Regeln und Beispiele', () => {
    for (const rule of rules) {
      expect(rule.summary && rule.summary.length > 10, `${rule.id}: summary`).toBeTruthy();
      expect(rule.goal && rule.goal.length > 10, `${rule.id}: goal`).toBeTruthy();
      expect(rule.rules && rule.rules.length >= 3, `${rule.id}: rules`).toBeTruthy();
      expect(rule.examples && rule.examples.length >= 3, `${rule.id}: examples`).toBeTruthy();
      for (const example of rule.examples ?? []) {
        expect(example.word && example.note, `${rule.id}: example`).toBeTruthy();
      }
    }
  });

  it('zeigt in der Übersicht alle Bereiche und Themen', () => {
    const html = topicsView(areas, rules, words, {});
    for (const area of areas) expect(html).toContain(`id="area-${area.id}"`);
    for (const rule of rules) expect(html).toContain(`data-id="${rule.id}"`);
    expect(html).toContain('Wörter nach Themen');
  });

  it('zeigt auf der Detailseite Erklärung, Lernziel, Regeln, Beispiele und einen Üben-Button', () => {
    const rule = rules.find((candidate) => candidate.id === 'ai-ei')!;
    const html = topicView(rule, areas.find((area) => area.id === rule.area), words, {});
    expect(html).toContain('Worum geht’s?');
    expect(html).toContain('Das lernst du');
    expect(html).toContain('Regeln zum Merken');
    expect(html).toContain('Beispiele');
    expect(html).toContain('data-action="practice-topic" data-id="ai-ei"');
    expect(html).toContain('20 Wörter');
  });

  it('bietet in der Übersicht einen bewusst themenübergreifenden Start', () => {
    const html = topicsView(areas, rules, words, {});
    expect(html).toContain('Alle Themen mischen');
    expect(html).toContain('data-action="start"');
  });

  it('bildet eine Übung nur aus den Wörtern des gewählten Themas', () => {
    const topicWords = words.filter((word) => word.ruleId === 'ai-ei');
    const session = createSession(topicWords, rules, {}, freshState().settings, () => 0.5, Date.now(), 'ai-ei');
    const ids = new Set(topicWords.map((word) => word.id));
    expect(session.queue.length).toBeGreaterThan(0);
    expect(session.queue.every((id) => ids.has(id))).toBe(true);
    expect(session.poolIds.every((id) => ids.has(id))).toBe(true);
  });

  it('misst innerhalb jeder Themenrunde verschiedene Varianten, sofern vorhanden', () => {
    const settings = { ...freshState().settings, sessionLength: 8 };
    for (const rule of rules) {
      const topicWords = words.filter((word) => word.ruleId === rule.id);
      const available = new Set(topicWords.map(wordVariant));
      if (available.size < 2) continue;

      let session = createSession(topicWords, rules, {}, settings, () => 0.5);
      const seen = new Set<string>();
      for (let index = 0; index < 20 && session.current; index += 1) {
        seen.add(session.current.word.id);
        session = nextExercise(finishExercise(session, true), topicWords, rules, () => 0.5);
      }
      const variants = new Set(
        [...seen].map((id) => wordVariant(topicWords.find((word) => word.id === id)!)),
      );
      expect(variants.size, `${rule.id}: nur ${[...variants].join(', ')}`).toBeGreaterThan(1);
    }
  });

  it('verwendet quellengeprüfte Formulierungen ohne bekannte Fehler', () => {
    const text = JSON.stringify(rules);
    expect(text).toContain('Das h macht den Vokal nicht erst lang');
    expect(text).toContain('In der Schweiz und in Liechtenstein');
    expect(text).toContain('-ie, -ier und -ieren');
    expect(text).toContain('in der Regel lang: Oase, Idee, Museum');
    expect(text).toContain('Möglichkeit, Freundlichkeit, Wichtigkeit');
    expect(text).toContain('Eigennamen, Substantive und Substantivierungen');
    expect(text).not.toContain('Uhu');
    expect(text).not.toContain('Ohne das h wäre der Vokal kurz');
    expect(text).not.toContain('Schnelligkeit');
    expect(text).not.toContain('Eigennamen, Zusammensetzungen');
    expect(words.some((word) => word.word === 'Uhu')).toBe(false);
    expect(words.some((word) => word.word === 'Sohn')).toBe(true);
  });
});
