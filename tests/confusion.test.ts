import { describe, expect, it } from 'vitest';
import rawAreas from '../src/data/topic-groups.json';
import rawChallenges from '../src/data/challenges.json';
import rawRules from '../src/data/rules.json';
import rawWords from '../src/data/words.json';
import { createSession } from '../src/lib/session';
import { freshState } from '../src/lib/storage';
import type { Challenge, Rule, TopicArea, Word } from '../src/lib/types';
import { practiceView } from '../src/ui/views';

const areas = rawAreas as unknown as TopicArea[];
const rules = rawRules as unknown as Rule[];
const words = rawWords as unknown as Word[];
const challenges = rawChallenges as unknown as Challenge[];

const NEW_RULES = ['e-oder-ae', 'f-oder-v', 'ks-laute', 'y-laute', 'pf-qu', 'dt'] as const;

function topicChallenges(ruleId: string): Challenge[] {
  return challenges.filter((challenge) => challenge.ruleId === ruleId);
}

function sessionFor(ruleId: string) {
  const topicWords = words.filter((word) => word.ruleId === ruleId);
  return createSession(topicWords, rules, {}, freshState().settings, () => 0.5, Date.now(), ruleId);
}

function singleChallenge(challenge: Challenge) {
  const word = words.find((candidate) => candidate.id === challenge.id);
  if (!word) throw new Error(`Wort ${challenge.id} fehlt`);
  const session = createSession([word], rules, {}, freshState().settings, () => 0.5, Date.now());
  if (!session.current) throw new Error(`Keine Aufgabe für ${challenge.id}`);
  return session;
}

describe('Verwechslungsgefahr', () => {
  it('bildet einen eigenen Themenbereich mit drei Regeln', () => {
    expect(areas.some((area) => area.id === 'verwechslung')).toBe(true);
    for (const id of NEW_RULES) {
      const rule = rules.find((candidate) => candidate.id === id);
      expect(rule, id).toBeDefined();
      expect(rule?.area).toBe('verwechslung');
      expect(rule?.rules?.length ?? 0).toBeGreaterThanOrEqual(3);
      expect(rule?.examples?.length ?? 0).toBeGreaterThanOrEqual(3);
    }
  });

  it('bietet zu jeder Verwechslung mehrere Aufgaben mit Tipp und Regel', () => {
    for (const id of NEW_RULES) {
      const tasks = topicChallenges(id);
      expect(tasks.length, id).toBeGreaterThanOrEqual(8);
      for (const task of tasks) {
        expect(task.prompt.length, task.id).toBeGreaterThan(3);
        expect(task.ruleText.length, task.id).toBeGreaterThan(10);
        expect(task.hints.length, task.id).toBeGreaterThanOrEqual(2);
        expect(words.some((word) => word.id === task.id && word.challenge === true), task.id).toBe(true);
      }
    }
  });

  it('markiert bei Fehleraufgaben genau die abweichende Stelle', () => {
    for (const task of challenges.filter((challenge) => NEW_RULES.includes(challenge.ruleId as typeof NEW_RULES[number]) && challenge.kind === 'error')) {
      expect(task.wrong, task.id).toBeTruthy();
      expect(task.answer, task.id).toBeTruthy();
      const index = task.errorIndex ?? -1;
      expect(index, task.id).toBeGreaterThanOrEqual(0);
      expect([...task.wrong!][index], task.id).not.toBe([...task.answer!][index]);
    }
  });

  it('setzt Lückentexte korrekt zusammen und bietet die Lösung als Option', () => {
    const gaps = challenges.filter((challenge) => NEW_RULES.includes(challenge.ruleId as typeof NEW_RULES[number]) && challenge.kind === 'gap');
    expect(gaps.length).toBeGreaterThanOrEqual(13);
    for (const task of gaps) {
      expect(`${task.before ?? ''}${task.answer ?? ''}${task.after ?? ''}`, task.id).toBe(task.word);
      expect(task.options?.includes(task.answer ?? ''), task.id).toBe(true);
    }
  });

  it('bietet bei Ableitungen die Grundform und die erwartete Form', () => {
    const derives = challenges.filter((challenge) =>
      NEW_RULES.includes(challenge.ruleId as typeof NEW_RULES[number]) && challenge.kind === 'derive');
    expect(derives.length).toBeGreaterThanOrEqual(4);
    for (const task of derives) {
      expect(task.from, task.id).toBeTruthy();
      expect(task.answer, task.id).toBe(task.word);
      expect(task.hints.length, task.id).toBeGreaterThanOrEqual(2);
    }
  });

  it('liefert die neuen Aufgaben auch in einer echten Runde', () => {
    for (const id of NEW_RULES) {
      const session = sessionFor(id);
      expect(session.current, id).not.toBeNull();
      expect(session.current?.challenge?.ruleId, id).toBe(id);
      expect(session.queue.length + (session.current ? 1 : 0), id).toBeGreaterThanOrEqual(5);
    }
  });

  it('zeigt Lücke und Fehlerstelle als je eine Aufgabe an', () => {
    const gap = topicChallenges('ks-laute').find((task) => task.kind === 'gap')!;
    const error = topicChallenges('f-oder-v').find((task) => task.kind === 'error')!;

    const gapHtml = practiceView(freshState(), singleChallenge(gap), false, false);
    expect(gapHtml).toContain('gap-blank');
    expect(gapHtml).toContain('data-action="choose"');
    expect(gapHtml).toContain(gap.prompt);

    const errorHtml = practiceView(freshState(), singleChallenge(error), false, false);
    expect(errorHtml).toContain('data-action="mark-error"');
    expect(errorHtml).toContain(error.wrong!);
    expect(errorHtml).toContain('data-action="check-answer"');
  });
});
