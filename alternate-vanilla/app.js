import { TOPICS, TASKS, pickTasks } from "./data.js";
import {
  isSpeechAvailable,
  isSpeechEnabled,
  hasGermanVoice,
  setSpeechEnabled,
  setSpeechRate,
  speechRateLabel,
  speak,
  stopSpeech,
  speakButton,
  escapeHtml,
  escapeAttr,
} from "./speech.js";
import { HandwritingPad } from "./handwriting.js";
import { transcribeHandwriting, normalizeForCheck, compareTranscription } from "./gemini.js";

const SETTINGS_KEY = "klartext.settings.v1";
const LAST_TOPIC_KEY = "klartext.topic.v1";

const DEFAULT_SETTINGS = {
  font: "lexend",
  size: "normal",
  theme: "cream",
  sound: true,
  rate: 0,
};

const state = {
  view: "home",
  settings: { ...DEFAULT_SETTINGS },
  topicId: null,
  tasks: [],
  index: 0,
  correct: 0,
  attempts: 0,
  hintStep: 0,
  current: null,
  pad: null,
  checking: false,
  apiKey: "",
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function loadSettings() {
  try {
    const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
    state.settings = {
      font: ["lexend", "atkinson", "dyslexic"].includes(stored.font) ? stored.font : DEFAULT_SETTINGS.font,
      size: ["normal", "large", "xl"].includes(stored.size) ? stored.size : DEFAULT_SETTINGS.size,
      theme: ["cream", "blue", "dark"].includes(stored.theme) ? stored.theme : DEFAULT_SETTINGS.theme,
      sound: stored.sound !== false,
      rate: [0, 1, 2].includes(stored.rate) ? stored.rate : DEFAULT_SETTINGS.rate,
    };
  } catch {
    state.settings = { ...DEFAULT_SETTINGS };
  }
}

function applySettings() {
  const { font, size, theme, sound, rate } = state.settings;
  document.body.dataset.font = font;
  document.body.dataset.size = size;
  document.body.dataset.theme = theme;
  setSpeechEnabled(sound && isSpeechAvailable());
  setSpeechRate(rate);
  $$('[data-setting]').forEach((button) => {
    const key = button.dataset.setting;
    button.setAttribute("aria-pressed", String(String(state.settings[key]) === button.dataset.value));
  });
  const toggle = $("#soundToggle");
  toggle.setAttribute("aria-pressed", String(sound));
  toggle.setAttribute("aria-label", sound ? "Vorlesen ausschalten" : "Vorlesen einschalten");
  $("#speechRate").value = String(rate);
  $("#speechRateValue").textContent = speechRateLabel(rate);
}

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
  applySettings();
}

function showView(name) {
  stopSpeech();
  state.view = name;
  $$(".view").forEach((section) => {
    section.hidden = section.id !== `view-${name}`;
  });
  window.scrollTo({ top: 0, behavior: "instant" });
  $("#main").focus?.({ preventScroll: true });
}

function toast(message) {
  const element = $("#toast");
  element.textContent = message;
  element.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => {
    element.hidden = true;
  }, 4200);
}

function shuffle(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function htmlToText(html) {
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.textContent.replace(/\s+/g, " ").trim();
}

// ---------- Aufgaben-Darstellung ----------

function commonHead(task) {
  const instruction = `${htmlToText(task.rule)} ${htmlToText(task.prompt || task.word || task.text || "")}`;
  return `
    <p class="task-kicker">Aufgabe ${state.index + 1} von ${state.tasks.length}</p>
    <div class="task-rule">${task.rule}</div>
    <h2 class="task-prompt">${task.prompt || ""}</h2>
    ${hasGermanVoice() ? `<button type="button" class="speak-btn" data-speak="${escapeAttr(instruction)}">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4Zm12.5 3a4.5 4.5 0 0 0-2.2-3.9v7.8a4.5 4.5 0 0 0 2.2-3.9Z"/></svg>
      Anleitung vorlesen</button>` : ""}
  `;
}

function renderTask(task) {
  const card = $("#taskCard");
  const builders = {
    build: renderBuild,
    split: renderSplit,
    error: renderError,
    gap: renderGap,
    derive: renderDerive,
    parts: renderParts,
    memory: renderMemory,
    dictation: renderDictation,
    handwriting: renderHandwriting,
  };
  card.innerHTML = builders[task.type](task);
  stopSpeech();
}

function renderBuild(task) {
  const answer = task.syllables.join("");
  state.current = {
    type: "build",
    tiles: shuffle(task.syllables.map((text, i) => ({ text, i }))),
    slots: [],
    answer,
  };
  return `${commonHead(task)}
    <p class="field-label">Die Silben – ziehen oder antippen:</p>
    <div id="answerBox" class="answer-box" aria-label="Dein Wort" tabindex="0"></div>
    <div class="tiles" id="tiles">
      ${state.current.tiles.map((tile, pos) => `<button type="button" class="tile" draggable="true" data-pos="${pos}" data-i="${tile.i}">${escapeHtml(tile.text)}</button>`).join("")}
    </div>
    ${speakButton(answer, "Wort vorlesen")}
    <p class="mini-note">Tipp: Du kannst eine Silbe im Wort wieder zurücklegen.</p>
  `;
}

function renderSplit(task) {
  state.current = { type: "split", answer: task.answer };
  return `${commonHead(task)}
    <p class="word-display">${escapeHtml(task.word)}</p>
    ${speakButton(task.word, "Wort vorlesen")}
    <p class="field-label">Welche Trennung ist richtig?</p>
    <div class="choice-row" role="group" aria-label="Silbentrennung wählen">
      ${task.options.map((option) => `<button type="button" class="choice small" data-choice="${escapeAttr(option)}" aria-pressed="false">${escapeHtml(option)}</button>`).join("")}
    </div>
  `;
}

function renderError(task) {
  state.current = { type: "error", answer: task.answer, selected: null };
  return `${commonHead(task)}
    <p class="word-display" role="group" aria-label="Buchstaben zum Anklicken">
      ${[...task.wrong].map((letter, i) => `<button type="button" class="choice" style="min-width:.9em;padding:4px 8px;font-size:1.6em" data-letter="${i}" aria-pressed="false">${escapeHtml(letter)}</button>`).join("")}
    </p>
    ${speakButton(task.wrong, "Wort vorlesen")}
    <label class="field-label" for="answerInput">Jetzt richtig schreiben:</label>
    <input id="answerInput" class="text-input" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="done" />
  `;
}

function renderGap(task) {
  state.current = { type: "gap", answer: task.answer };
  return `${commonHead(task)}
    <p class="word-display" style="font-size:clamp(1.4rem,5vw,2rem);letter-spacing:.02em">
      ${escapeHtml(task.before)} <span class="marked" aria-label="Lücke">______</span> ${escapeHtml(task.after)}
    </p>
    ${speakButton(`${task.before} ... ${task.after}`, "Satz vorlesen")}
    <p class="field-label">Was gehört in die Lücke?</p>
    <div class="choice-row" role="group" aria-label="Antwort wählen">
      ${task.options.map((option) => `<button type="button" class="choice small" data-choice="${escapeAttr(option)}" aria-pressed="false">${escapeHtml(option)}</button>`).join("")}
    </div>
  `;
}

function renderDerive(task) {
  state.current = { type: "derive", answer: task.answer };
  return `${commonHead(task)}
    <p class="syllable-display">${escapeHtml(task.from)} <span aria-hidden="true">→</span> ?</p>
    ${speakButton(task.from, "Grundwort vorlesen")}
    <label class="field-label" for="answerInput">Deine Antwort:</label>
    <input id="answerInput" class="text-input" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="done" />
  `;
}

function renderParts(task) {
  state.current = { type: "parts", answer: task.answer };
  return `${commonHead(task)}
    <div class="word-row"><span class="word-part">${escapeHtml(task.piece)}</span></div>
    <p class="field-label">Welcher Baustein passt?</p>
    <div class="choice-row" role="group" aria-label="Baustein wählen">
      ${task.options.map((option) => `<button type="button" class="choice" data-choice="${escapeAttr(option)}" aria-pressed="false">${escapeHtml(option)}</button>`).join("")}
    </div>
  `;
}

function renderMemory(task) {
  state.current = { type: "memory", answer: task.word, hidden: false };
  return `${commonHead(task)}
    <div id="memoryWord" class="word-display">${escapeHtml(task.word)}</div>
    ${speakButton(task.word, "Wort vorlesen")}
    <button id="hideWord" type="button" class="btn btn-quiet">Weg damit – jetzt schreibe ich es</button>
    <div id="memoryInput" hidden>
      <label class="field-label" for="answerInput">Schreib das Wort aus dem Kopf:</label>
      <input id="answerInput" class="text-input" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="done" />
    </div>
  `;
}

function renderDictation(task) {
  state.current = { type: "dictation", answer: task.text };
  return `${commonHead(task)}
    ${speakButton(task.text, "Vorlesen")}
    ${speakButton(task.text, "Langsam vorlesen", { slow: true })}
    <label class="field-label" for="answerInput">Was hast du gehört?</label>
    <input id="answerInput" class="text-input" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="done" />
    <p class="mini-note">Du darfst beliebig oft zuhören. Der Text erscheint erst nach dem Prüfen.</p>
  `;
}

function renderHandwriting(task) {
  state.current = { type: "handwriting", answer: task.word };
  return `${commonHead(task)}
    <p class="word-display" style="font-size:clamp(1.6rem,6vw,2.4rem)">${escapeHtml(task.word)}</p>
    ${speakButton(task.word, "Wort vorlesen")}
    <div class="canvas-tools" role="group" aria-label="Schreibwerkzeuge">
      <button id="undoStroke" type="button">↶ Rückgängig</button>
      <button id="clearCanvas" type="button">Alles löschen</button>
    </div>
    <div class="handwriting-area"><canvas id="writeCanvas" aria-label="Schreibfläche mit Hilfslinien"></canvas></div>
    <p id="canvasStatus" class="canvas-status" role="status">Noch nichts geschrieben.</p>
  `;
}

// ---------- Interaktion ----------

function setPressed(buttons, selected) {
  buttons.forEach((button) => {
    const value = button.dataset.choice ?? button.dataset.i ?? button.dataset.letter;
    button.setAttribute("aria-pressed", String(String(value) === String(selected)));
  });
}

function updateSlots() {
  const box = $("#answerBox");
  if (!box) return;
  box.innerHTML = state.current.slots
    .map((tilePos, slotIndex) => `<button type="button" class="answer-slot" data-slot="${slotIndex}">${escapeHtml(state.current.tiles[tilePos].text)}</button>`)
    .join("");
  $$("#tiles .tile").forEach((tile) => {
    tile.classList.toggle("used", state.current.slots.includes(Number(tile.dataset.pos)));
  });
}

function wireTask() {
  const type = state.current.type;
  if (type === "build") {
    $$("#tiles .tile").forEach((tile) => {
      tile.addEventListener("click", () => {
        const pos = Number(tile.dataset.pos);
        if (!state.current.slots.includes(pos)) state.current.slots.push(pos);
        updateSlots();
      });
      tile.addEventListener("dragstart", (event) => {
        event.dataTransfer.setData("text/plain", tile.dataset.pos);
      });
    });
    const box = $("#answerBox");
    box.addEventListener("dragover", (event) => event.preventDefault());
    box.addEventListener("drop", (event) => {
      event.preventDefault();
      const pos = Number(event.dataTransfer.getData("text/plain"));
      if (Number.isInteger(pos) && !state.current.slots.includes(pos)) state.current.slots.push(pos);
      updateSlots();
    });
    box.addEventListener("click", (event) => {
      const slot = event.target.closest("[data-slot]");
      if (!slot) return;
      state.current.slots.splice(Number(slot.dataset.slot), 1);
      updateSlots();
    });
  }

  if (["split", "gap", "parts"].includes(type)) {
    $$("[data-choice]").forEach((button) => {
      button.addEventListener("click", () => {
        state.current.selected = button.dataset.choice;
        setPressed($$("[data-choice]"), state.current.selected);
      });
    });
  }

  if (type === "error") {
    $$("[data-letter]").forEach((button) => {
      button.addEventListener("click", () => {
        state.current.selected = Number(button.dataset.letter);
        setPressed($$("[data-letter]"), state.current.selected);
      });
    });
  }

  if (["error", "derive", "memory", "dictation", "handwriting"].includes(type)) {
    $("#answerInput")?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        handleCheck();
      }
    });
  }

  if (type === "memory") {
    $("#hideWord").addEventListener("click", () => {
      state.current.hidden = true;
      $("#memoryWord").hidden = true;
      $("#hideWord").hidden = true;
      $("#memoryInput").hidden = false;
      $("#answerInput").focus();
      speak(state.current.answer);
    });
  }

  if (type === "handwriting") {
    state.pad?.destroy();
    state.pad = new HandwritingPad($("#writeCanvas"), {
      onChange: (hasInk) => {
        $("#canvasStatus").textContent = hasInk ? "Geschrieben. Du kannst es prüfen." : "Noch nichts geschrieben.";
      },
    });
    $("#undoStroke").addEventListener("click", () => state.pad.undo());
    $("#clearCanvas").addEventListener("click", () => state.pad.clear());
  }
}

function startSession(topicId) {
  state.topicId = TOPICS.some((topic) => topic.id === topicId) ? topicId : "silben";
  localStorage.setItem(LAST_TOPIC_KEY, state.topicId);
  state.tasks = pickTasks(state.topicId);
  state.index = 0;
  state.correct = 0;
  state.attempts = 0;
  showView("session");
  renderCurrentTask();
}

function renderCurrentTask() {
  state.hintStep = 0;
  state.attempts = 0;
  state.checking = false;
  $("#feedback").className = "feedback";
  $("#feedback").innerHTML = "";
  $("#hintBox").hidden = true;
  $("#hintBox").innerHTML = "";
  $("#btnHint").hidden = false;
  $("#btnHint").textContent = "Hinweis";
  $("#btnCheck").textContent = "Prüfen";
  $("#btnCheck").disabled = false;
  const total = state.tasks.length;
  $("#progress").innerHTML = state.tasks
    .map((_, i) => `<span class="${i < state.index ? "done" : i === state.index ? "now" : ""}"></span>`)
    .join("");
  $("#progressLabel").textContent = `${state.index + 1} / ${total}`;
  renderTask(state.tasks[state.index]);
  wireTask();
}

function nextTask() {
  if (state.pad) {
    state.pad.destroy();
    state.pad = null;
  }
  if (state.index + 1 >= state.tasks.length) {
    finishSession();
    return;
  }
  state.index += 1;
  renderCurrentTask();
}

function finishSession() {
  const topic = TOPICS.find((item) => item.id === state.topicId);
  const solved = state.correct;
  const total = state.tasks.length;
  $("#summaryText").textContent =
    solved === total
      ? `Du hast alle ${total} Aufgaben geschafft. Das war eine runde Sache.`
      : `Du hast ${solved} von ${total} Aufgaben selbst gelöst. Jede Aufgabe, die du angeschaut hast, zählt.`;
  $("#summaryTip").textContent = `Nächster kleiner Schritt: ${topic?.desc || "Weiter üben, in deinem Tempo."}`;
  showView("summary");
}

function showFeedback({ ok, title, text, detail = "", gentle = false }) {
  const box = $("#feedback");
  box.className = `feedback show ${ok || gentle ? "" : "try"}`;
  box.innerHTML = `<h3>${escapeHtml(title)}</h3>${text ? `<p>${escapeHtml(text)}</p>` : ""}${detail ? `<p>${escapeHtml(detail)}</p>` : ""}`;
}

function valueForCheck() {
  const type = state.current.type;
  if (type === "build") return state.current.slots.map((pos) => state.current.tiles[pos].text).join("");
  if (type === "error") return $("#answerInput")?.value || "";
  if (["split", "gap", "parts"].includes(type)) return state.current.selected ?? "";
  if (["derive", "memory", "dictation"].includes(type)) return $("#answerInput")?.value || "";
  return "";
}

function showSolution(task) {
  const solution = task.answer || task.word || task.text;
  const extra = task.note || task.why || "";
  showFeedback({
    ok: true,
    title: `Richtig wäre: ${solution}`,
    text: extra || "Sieh es dir einmal in Ruhe an. Beim nächsten Mal klappt es.",
    detail: "Du darfst jetzt weitergehen.",
  });
  state.current.done = true;
  $("#btnCheck").textContent = "Weiter →";
}

function handleCheck() {
  if (state.current.done) {
    nextTask();
    return;
  }
  if (state.current.type === "handwriting") {
    checkHandwriting();
    return;
  }
  const task = state.tasks[state.index];
  if (state.current.type === "memory" && !state.current.hidden) {
    showFeedback({ ok: false, title: "Erst weglegen", text: "Klicke auf „Weg damit“ und schreib das Wort dann aus dem Kopf.", gentle: true });
    return;
  }
  const value = valueForCheck();
  if (!String(value).trim()) {
    showFeedback({ ok: false, title: "Noch nichts da", text: "Gib erst eine Antwort – oder hol dir einen Hinweis.", gentle: true });
    return;
  }
  const ok = normalizeForCheck(value) === normalizeForCheck(state.current.answer);
  state.attempts += 1;
  if (ok) {
    state.correct += 1;
    const note = task.note || task.why || "";
    showFeedback({
      ok: true,
      title: "Genau richtig!",
      text: note || "Das hast du gut hingeschaut.",
      detail: "Weiter geht's in deinem Tempo.",
    });
    state.current.done = true;
    $("#btnCheck").textContent = "Weiter →";
    return;
  }
  if (state.attempts >= 2) {
    showSolution(task);
    return;
  }
  const input = $("#answerInput");
  if (input) input.classList.add("try");
  showFeedback({
    ok: false,
    title: "Fast!",
    text: "Schau dir diese Stelle noch mal an. Du darfst es ruhig noch einmal probieren.",
    detail: "Ein Hinweis hilft manchmal weiter.",
  });
  $("#btnCheck").textContent = "Noch mal prüfen";
}

async function checkHandwriting() {
  if (state.checking || !state.pad) return;
  if (!state.pad.hasInk) {
    showFeedback({ ok: false, title: "Noch nichts geschrieben", text: "Schreib das Wort zuerst auf die Linien.", gentle: true });
    return;
  }
  state.checking = true;
  $("#btnCheck").disabled = true;
  $("#btnCheck").innerHTML = '<span class="spinner" aria-hidden="true"></span>Prüfe …';
  showFeedback({ ok: true, title: "Ich schaue mir deine Schrift an", text: "Ein kleiner Moment bitte.", gentle: true });

  try {
    const imageBase64 = state.pad.toPNG();
    if (!imageBase64) throw new Error("Das Bild konnte nicht erstellt werden.");
    const result = await transcribeHandwriting({
      target: state.current.answer,
      imageBase64,
      apiKey: state.apiKey,
    });
    const comparison = compareTranscription(result.transcription, state.current.answer);
    if (!result.legible) {
      showFeedback({
        ok: false,
        title: "Die Schrift war schwer zu lesen",
        text: "Versuch es noch einmal etwas größer und mit mehr Abstand zwischen den Buchstaben.",
        gentle: true,
      });
    } else if (comparison.matches) {
      state.correct += 1;
      showFeedback({
        ok: true,
        title: "Das liest sich genau richtig!",
        text: `Gelesen: ${result.transcription}`,
        detail: "Starke Handschrift. Weiter geht's.",
      });
      state.current.done = true;
      $("#btnCheck").textContent = "Weiter →";
    } else {
      const first = comparison.differences[0];
      const hint = first
        ? first.type === "extra"
          ? `Hier steht ein extra Buchstabe: „${first.written}“.`
          : first.type === "missing"
            ? `Hier fehlt ein Buchstabe: „${first.expected}“.`
            : `An dieser Stelle steht „${first.written}“, erwartet wird „${first.expected}“.`
        : "Schau dir die Stelle noch einmal an.";
      state.attempts += 1;
      if (state.attempts >= 2) {
        showSolution(state.tasks[state.index]);
      } else {
        showFeedback({
          ok: false,
          title: "Fast!",
          text: "Die Prüfung liest genau, was du geschrieben hast – ohne zu korrigieren.",
          detail: `Gelesen: ${result.transcription}. ${hint} Schreib es gern noch einmal.`,
        });
        $("#btnCheck").textContent = "Noch mal prüfen";
      }
    }
  } catch (error) {
    showFeedback({
      ok: false,
      title: "Prüfen gerade nicht möglich",
      text: error?.message || "Die Verbindung zur Prüfung ist unterbrochen.",
      detail: "Das zählt dir nicht als Fehler. Du kannst weitergehen.",
      gentle: true,
    });
    state.current.done = true;
    $("#btnCheck").textContent = "Weiter →";
  } finally {
    state.checking = false;
    $("#btnCheck").disabled = false;
    if (!state.current.done) $("#btnCheck").textContent = "Noch mal prüfen";
  }
}

function showHint() {
  const task = state.tasks[state.index];
  state.hintStep += 1;
  const hints = task.hints || [];
  const index = Math.min(state.hintStep - 1, hints.length - 1);
  const box = $("#hintBox");
  box.hidden = false;
  let text = hints[index] || "Schritt für Schritt: Sprich das Wort leise vor und schau es dir noch einmal an.";

  if (task.type === "dictation" && state.hintStep === 1) {
    text = `${text} Das Wort hat ${task.text.replace(/\s/g, "").length} Zeichen.`;
  }
  if (state.hintStep >= hints.length) {
    if (task.type === "dictation" || task.type === "memory") {
      text += ` Hier ist das Wort: ${task.text || task.word}`;
    } else if (task.answer) {
      text += ` Lösung: ${task.answer}`;
    }
    $("#btnHint").textContent = "Hilfe ist da";
  } else {
    $("#btnHint").textContent = "Mehr Hilfe";
  }
  box.innerHTML = `<h3><span class="hint-step">Hilfe ${state.hintStep}</span></h3><p>${escapeHtml(text)}</p>`;
  if (task.type === "memory" && state.hintStep >= hints.length) {
    $("#memoryWord").hidden = false;
    $("#memoryWord").textContent = task.word;
  }
}

// ---------- Initialisierung ----------

function renderTopics() {
  $("#topicGrid").innerHTML = TOPICS.map(
    (topic) => `<button type="button" class="topic-card" data-topic="${topic.id}">
      <span class="topic-num">${topic.num}</span>
      <span class="topic-name">${escapeHtml(topic.name)}</span>
      <span class="topic-desc">${escapeHtml(topic.desc)}</span>
    </button>`,
  ).join("");
  $$("[data-topic]").forEach((button) => button.addEventListener("click", () => startSession(button.dataset.topic)));
}

function bindGlobalEvents() {
  document.addEventListener("click", (event) => {
    const speakTrigger = event.target.closest("[data-speak]");
    if (speakTrigger) {
      const rate = speakTrigger.dataset.slow === "1" ? 0 : state.settings.rate;
      speak(speakTrigger.dataset.speak, { rate });
      return;
    }
    const go = event.target.closest("[data-go]");
    if (go) showView(go.dataset.go);
  });

  $("#btnStart").addEventListener("click", () => {
    const last = localStorage.getItem(LAST_TOPIC_KEY) || "silben";
    startSession(last);
  });
  $("#btnTopics").addEventListener("click", () => showView("topics"));
  $("#btnExit").addEventListener("click", () => showView("home"));
  $("#btnHint").addEventListener("click", showHint);
  $("#btnCheck").addEventListener("click", handleCheck);
  $("#btnAgain").addEventListener("click", () => startSession(state.topicId));
  $("#btnSummaryHome").addEventListener("click", () => showView("home"));
  $("#settingsOpen").addEventListener("click", () => showView("settings"));

  $("#soundToggle").addEventListener("click", () => {
    state.settings.sound = !state.settings.sound;
    saveSettings();
    if (state.settings.sound) {
      speak("Vorlesen ist an.");
    } else {
      stopSpeech();
      toast("Vorlesen ist aus.");
    }
  });

  $$("[data-setting]").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.setting;
      state.settings[key] = button.dataset.value;
      saveSettings();
    });
  });

  $("#speechRate").addEventListener("input", (event) => {
    state.settings.rate = Number(event.target.value);
    saveSettings();
    speak("So klingt die Geschwindigkeit.");
  });

  $("#apiKey").addEventListener("input", (event) => {
    state.apiKey = event.target.value.trim();
  });

  $("#btnResetSettings").addEventListener("click", () => {
    state.settings = { ...DEFAULT_SETTINGS };
    state.apiKey = "";
    $("#apiKey").value = "";
    saveSettings();
    toast("Einstellungen zurückgesetzt.");
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.view === "session") showView("home");
  });
}

async function registerServiceWorker() {
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    try {
      await navigator.serviceWorker.register("./sw.js");
    } catch {
      // Die App funktioniert auch ohne Service Worker.
    }
  }
}

function init() {
  loadSettings();
  applySettings();
  if (!isSpeechAvailable()) {
    $("#soundToggle").disabled = true;
    $("#soundToggle").title = "Vorlesen wird von diesem Gerät nicht unterstützt";
  }
  renderTopics();
  bindGlobalEvents();
  registerServiceWorker();
}

init();
