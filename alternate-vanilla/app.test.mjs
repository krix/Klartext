import test from "node:test";
import assert from "node:assert/strict";
import { TOPICS, TASKS, SESSION_SIZE, pickTasks } from "../src/data.js";
import {
  buildRequestBody,
  compareTranscription,
  normalizeForCheck,
  RESULT_SCHEMA,
  GEMINI_MODEL,
} from "../src/gemini.js";

test("jedes Thema hat 8–10 Aufgaben mit Regel und Hilfe", () => {
  assert.equal(TOPICS.length, 9);
  for (const topic of TOPICS) {
    const tasks = TASKS[topic.id];
    assert.ok(tasks.length >= 8 && tasks.length <= 10, `${topic.id}: ${tasks.length} Aufgaben`);
    assert.ok(SESSION_SIZE[topic.id] >= 8 && SESSION_SIZE[topic.id] <= 10);
    for (const task of tasks) {
      assert.ok(task.id, "Aufgabe braucht eine id");
      assert.ok(task.rule?.length > 20, `${task.id}: Regel fehlt`);
      assert.ok(Array.isArray(task.hints) && task.hints.length >= 2, `${task.id}: zu wenig Hilfe`);
      assert.ok(task.answer || task.word || task.text || task.syllables || task.options, `${task.id}: keine Lösung`);
    }
  }
});

test("pickTasks liefert die volle, gemischte Runde", () => {
  for (const topic of TOPICS) {
    const tasks = pickTasks(topic.id);
    assert.equal(tasks.length, SESSION_SIZE[topic.id]);
    assert.equal(new Set(tasks.map((task) => task.id)).size, tasks.length);
  }
});

test("Normalisierung ist fair gegenüber ß/ss und Satzzeichen", () => {
  assert.equal(normalizeForCheck("Füße."), "füsse");
  assert.equal(normalizeForCheck("  DER   HUND  "), "der hund");
  assert.notEqual(normalizeForCheck("Haus"), "Häuser");
});

test("Transkriptionsvergleich erkennt Treffer und konkrete Abweichungen", () => {
  assert.deepEqual(compareTranscription("Füsse", "Füße"), { matches: true, differences: [] });
  const result = compareTranscription("Fahrrat", "Fahrrad");
  assert.equal(result.matches, false);
  assert.ok(result.differences.some((d) => d.expected === "d" && d.written === "t"));
  const extra = compareTranscription("Schuhle", "Schule");
  assert.ok(extra.differences.some((d) => d.type === "extra" && d.written === "h"));
});

test("Gemini-Request nutzt Interactions API, strukturiertes JSON und store=false", () => {
  const body = buildRequestBody({ target: "Schule", imageBase64: "AAAA" });
  assert.equal(body.model, GEMINI_MODEL);
  assert.equal(body.store, false);
  assert.equal(body.input[0].type, "text");
  assert.equal(body.input[1].type, "image");
  assert.equal(body.input[1].mime_type, "image/png");
  assert.match(body.input[0].text, /Schule/);
  assert.match(body.input[0].text, /Korrigiere nichts/);
  assert.deepEqual(body.response_format.schema, RESULT_SCHEMA);
  assert.equal(body.response_format.mime_type, "application/json");
});
