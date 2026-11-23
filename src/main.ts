import './styles.css';
import rawRules from './data/rules.json';
import rawTopicGroups from './data/topic-groups.json';
import rawWords from './data/words.json';

import { WritingPad } from './lib/canvas';
import { checkHandwriting, friendlyError, testGeminiConnection, type ConnectionTestResult } from './lib/gemini';
import {
  applyResult,
  buildTrainingPlan,
  computeStars,
  computeStreak,
  diffWords,
  errorCategories,
  localFeedback,
  unlockedThemes,
} from './lib/learning';
import { hashPin, newSalt, verifyPin } from './lib/pin';
import { speakWordAndSentence } from './lib/speech';
import { createSession, finishExercise, isSessionFinished, nextExercise, refillWords, sessionWords, type SessionState } from './lib/session';
import { clearState, freshState, loadState, saveState } from './lib/storage';
import type { AppData, Attempt, Difference, Exercise, Rule, TopicArea, Word, WordState } from './lib/types';
import { feedbackView, homeView, parentGateView, parentView, practiceView, topicView, topicsView, type FeedbackView } from './ui/views';

const rules = rawRules as unknown as Rule[];
const topicAreas = rawTopicGroups as unknown as TopicArea[];
const builtinWords = rawWords as unknown as Word[];

type Route = 'home' | 'practice' | 'feedback' | 'parent' | 'gate' | 'topics' | 'topic';

// Nach dem Ziehen zum Aktualisieren soll die Startseite wieder oben beginnen.
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
let lastRenderedRoute: Route | '' = '';

let data: AppData = loadState();
let route: Route = 'home';
let session: SessionState | null = null;
let feedback: FeedbackView | null = null;
let checking = false;
let helpVisible = false;
let pad: WritingPad | null = null;
let parentUnlocked = false;
let pinSetup = false;
let pinError = '';
let connectionTest: ConnectionTestResult | null = null;
let connectionTesting = false;
let topicId = '';
/** Kontext der aktuellen Rückmeldung – für Wiederholung und „KI irrt“. */
let feedbackContext: { exercise: Exercise; previousState?: WordState } | null = null;

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('App-Container fehlt in index.html.');

function allWords(): Word[] {
  return [...builtinWords, ...data.customWords];
}

function findRule(id: string): Rule {
  return rules.find((rule) => rule.id === id) ?? { id, title: id, tip: 'Schau auf die Stelle, die du unsicher bist.' };
}

/** Liest den gespeicherten Stand neu – sonst kann der Trainingsplan von einem anderen Tab alt sein. */
function refreshState(): void {
  data = loadState();
}

function notice(message: string): void {
  const toast = document.createElement('div');
  toast.className = 'notice';
  toast.setAttribute('role', 'status');
  toast.textContent = message;
  app!.appendChild(toast);
  window.setTimeout(() => toast.remove(), 3600);
}

/** Erzeugt ein kleines Testbild mit lesbarem Wort für den Verbindungstest. */
function makeTestImage(): string {
  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 120;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#d7dee0';
  ctx.fillRect(0, 78, canvas.width, 2);
  ctx.fillStyle = '#173b44';
  ctx.font = 'bold 60px "Trebuchet MS", sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText('Test', 24, 44);
  return canvas.toDataURL('image/png');
}

function render(): void {
  // Sicherheitsnetz: keine Übung mehr, aber noch auf der Übungsroute → Rundenende statt leerer Startseite.
  if (route === 'practice' && session && !session.current) showSummary();
  document.body.dataset.theme = data.settings.theme;
  document.body.dataset.view = route;
  if (lastRenderedRoute !== route) {
    window.scrollTo(0, 0);
    lastRenderedRoute = route;
  }
  const stars = computeStars(data.attempts);
  const plan = buildTrainingPlan(data.attempts, rules);

  switch (route) {
    case 'practice':
      app!.innerHTML = session ? practiceView(data, session, checking, helpVisible) : homeView(data, plan, computeStreak(data.attempts), stars, allWords().length);
      break;
    case 'feedback':
      app!.innerHTML = feedback ? feedbackView(feedback, isLastExercise(), plan) : homeView(data, plan, computeStreak(data.attempts), stars, allWords().length);
      break;
    case 'parent':
      app!.innerHTML = parentView(data, plan, parentStats(), unlockedThemes(stars), connectionTest, connectionTesting);
      break;
    case 'gate':
      app!.innerHTML = parentGateView(pinSetup, pinError);
      break;
    case 'topics':
      app!.innerHTML = topicsView(topicAreas, rules, allWords(), data.progress, parentUnlocked);
      break;
    case 'topic': {
      const rule = findRule(topicId);
      app!.innerHTML = topicView(rule, topicAreas.find((area) => area.id === rule.area), allWords(), data.progress, parentUnlocked);
      break;
    }
    default:
      app!.innerHTML = homeView(data, plan, computeStreak(data.attempts), stars, allWords().length);
  }

  if (route === 'practice' && session?.current && session.current.kind !== 'choice') {
    const canvas = document.querySelector<HTMLCanvasElement>('#schreibflaeche');
    if (canvas) {
      pad = new WritingPad(canvas, { color: data.settings.handColor, width: data.settings.handWidth });
      if (session.current.kind === 'dictation') speakWordAndSentence(session.current.word.word, session.current.word.sentence, data.settings.ttsRate);
    }
  } else {
    pad = null;
  }
}

function isLastExercise(): boolean {
  return !session || (session.queue.length === 0 && session.retries.length === 0);
}

function parentStats(): { seen: number; correctRate: number; streak: number; stars: number; byCategory: Array<{ name: string; errors: number }> } {
  const categories = new Map<string, number>();
  for (const attempt of data.attempts) {
    if (attempt.correct) continue;
    for (const category of attempt.categories) categories.set(category, (categories.get(category) ?? 0) + 1);
  }
  const seen = Object.keys(data.progress).length;
  const rated = data.attempts.filter((attempt) => !attempt.selfAssessed);
  return {
    seen,
    correctRate: rated.length === 0 ? 0 : rated.filter((attempt) => attempt.correct).length / rated.length,
    streak: computeStreak(data.attempts),
    stars: computeStars(data.attempts),
    byCategory: [...categories.entries()].map(([name, errors]) => ({ name, errors })).sort((a, b) => b.errors - a.errors),
  };
}

function startSession(ruleId = ''): void {
  const pool = ruleId ? allWords().filter((word) => word.ruleId === ruleId) : allWords();
  if (pool.length === 0) {
    notice(ruleId ? 'Für dieses Thema sind keine Wörter vorhanden.' : 'Es sind keine Wörter vorhanden.');
    return;
  }
  session = createSession(pool, rules, data.progress, data.settings, Math.random, Date.now(), ruleId);
  topicId = ruleId;
  feedback = null;
  checking = false;
  helpVisible = false;
  route = 'practice';
  render();
}

function showSummary(): void {
  const last = feedbackContext?.exercise;
  feedback = {
    kind: 'summary',
    word: last?.word ?? builtinWords[0],
    rule: last?.rule ?? findRule(''),
    ruleId: session?.ruleId,
    message: session ? `${session.correct} von ${session.total} Wörtern in dieser Runde richtig.` : 'Runde beendet.',
    results: session?.results ?? [],
  };
  route = 'feedback';
}

function goNext(): void {
  if (!session) {
    route = 'home';
    render();
    return;
  }
  session = nextExercise(session, sessionWords(session, allWords()), rules);
  checking = false;
  helpVisible = false;
  if (isSessionFinished(session) || !session.current) showSummary();
  else route = 'practice';
  render();
}

function recordAttempt(exercise: Exercise, correct: boolean, source: Attempt['source'], result?: { confidence?: number; transcription?: string; illegible?: boolean; differences?: Difference[] }): void {
  const word = exercise.word;
  const previousState = data.progress[word.id];
  feedbackContext = { exercise, previousState };
  const differences = result?.differences ?? (result?.transcription
    ? diffWords(word.word, result.transcription, exercise.rule.caseSensitive === true)
    : []);

  const attempt: Attempt = {
    ts: Date.now(),
    wordId: word.id,
    word: word.word,
    ruleId: word.ruleId,
    correct,
    source,
    selfAssessed: source === 'self',
    confidence: result?.confidence,
    transcription: result?.transcription,
    illegible: result?.illegible ?? false,
    categories: correct ? [] : errorCategories(differences, word.ruleId),
  };
  data.attempts.push(attempt);
  if (data.attempts.length > 3000) data.attempts = data.attempts.slice(-3000);
  data.progress[word.id] = applyResult(previousState, correct);
  saveState(data);

  if (session) {
    const before = session.difficulty;
    session = finishExercise(session, correct, { transcription: result?.transcription, differences, source });
    // Erfolgsserie: ein paar schwerere Wörter in die laufende Runde holen – nur aus dem gewählten Thema.
    if (session.difficulty > before && session.queue.length < 4) {
      const harder = refillWords(session, allWords(), data.progress).map((candidate) => candidate.id);
      session = { ...session, queue: [...session.queue, ...harder], total: session.total + harder.length };
    }
  }
}

function showResult(view: FeedbackView): void {
  feedback = view;
  route = 'feedback';
  render();
}

async function checkWithAi(): Promise<void> {
  if (!session?.current || !pad) return;
  if (pad.isEmpty()) {
    notice('Schreib zuerst das Wort auf.');
    return;
  }
  const exercise = session.current;
  const imageDataUrl = pad.toPngDataUrl();
  if (!imageDataUrl) {
    notice('Die Schreibfläche konnte nicht gelesen werden.');
    return;
  }
  checking = true;
  render();
  try {
    const result = await checkHandwriting({
      imageDataUrl,
      targetWord: exercise.word.word,
      caseSensitive: exercise.rule.caseSensitive === true,
      apiKey: data.settings.apiKey,
      model: data.settings.model,
    });
    checking = false;

    // Unleserliche Schrift oder niedrige Sicherheit ist kein Fehler, sondern eine Bitte um Wiederholung.
    if (result.illegible || result.confidence < 0.6) {
      feedbackContext = { exercise };
      showResult({
        kind: 'retry',
        word: exercise.word,
        rule: exercise.rule,
        transcription: result.transcription,
        confidence: result.confidence,
        feedback: result.feedback,
        message: 'Ich konnte die Schrift nicht sicher lesen. Schreib das Wort noch einmal – scharf und in Ruhe.',
      });
      return;
    }

    const aiText = result.feedback.trim();
    const sentenceCount = (aiText.match(/[.!?]/g) ?? []).length;
    const usableFeedback = aiText.length >= 3 && aiText.length <= 240 && sentenceCount <= 2;
    const feedbackText = usableFeedback ? aiText : localFeedback(exercise.rule, result.isCorrect);

    recordAttempt(exercise, result.isCorrect, 'ai', result);
    showResult({
      kind: 'success',
      word: exercise.word,
      rule: exercise.rule,
      correct: result.isCorrect,
      transcription: result.transcription,
      confidence: result.confidence,
      differences: result.differences,
      feedback: feedbackText,
    });
  } catch (error) {
    checking = false;
    feedbackContext = { exercise };
    showResult({
      kind: 'fallback',
      word: exercise.word,
      rule: exercise.rule,
      message: friendlyError(error),
    });
  }
}

function solveBySelf(correct: boolean, retry = false): void {
  if (!feedbackContext) return;
  const { exercise } = feedbackContext;
  if (retry) {
    // Keine Bewertung: die Wiederholung ersetzt den unklaren Versuch.
    route = 'practice';
    helpVisible = true;
    render();
    return;
  }
  recordAttempt(exercise, correct, 'self');
  showResult({
    kind: 'success',
    word: exercise.word,
    rule: exercise.rule,
    correct,
    feedback: localFeedback(exercise.rule, correct),
  });
}

function chooseOption(index: number): void {
  const exercise = session?.current;
  if (!exercise) return;
  const option = exercise.options?.[index];
  if (option === undefined) return;
  const correct = option === exercise.word.word;
  const differences = correct ? [] : diffWords(exercise.word.word, option, exercise.rule.caseSensitive === true);
  recordAttempt(exercise, correct, 'choice', { transcription: option, differences });
  showResult({
    kind: 'success',
    word: exercise.word,
    rule: exercise.rule,
    correct,
    transcription: option,
    differences,
    feedback: localFeedback(exercise.rule, correct),
  });
}

function goHome(): void {
  refreshState();
  route = 'home';
  topicId = '';
  parentUnlocked = false;
  render();
}

function openParent(): void {
  connectionTest = null;
  if (parentUnlocked) {
    route = 'parent';
  } else {
    pinSetup = !data.settings.pinHash;
    pinError = '';
    route = 'gate';
  }
  render();
}

async function submitPin(form: HTMLFormElement): Promise<void> {
  const values = new FormData(form);
  const pin = String(values.get('pin') ?? '');
  if (!/^\d{4,6}$/.test(pin)) {
    pinError = 'Bitte eine PIN mit 4 bis 6 Ziffern eingeben.';
    render();
    return;
  }
  if (pinSetup) {
    if (pin !== String(values.get('pin2') ?? '')) {
      pinError = 'Die beiden PINs stimmen nicht überein.';
      render();
      return;
    }
    try {
      const salt = newSalt();
      data.settings.pinSalt = salt;
      data.settings.pinHash = await hashPin(pin, salt);
      saveState(data);
    } catch (error) {
      pinError = error instanceof Error ? error.message : 'PIN konnte nicht gespeichert werden.';
      render();
      return;
    }
  } else if (!(await verifyPin(pin, data.settings.pinSalt, data.settings.pinHash))) {
    pinError = 'Diese PIN passt nicht. Versuch es noch einmal.';
    render();
    return;
  }
  pinError = '';
  parentUnlocked = true;
  route = 'parent';
  render();
  notice('Elternbereich geöffnet.');
}

function saveSettingsForm(form: HTMLFormElement): void {
  const values = new FormData(form);
  data.settings.privacyOptIn = values.get('privacy') === 'on';
  data.settings.apiKey = String(values.get('apiKey') ?? '').trim();
  data.settings.model = String(values.get('model') ?? 'gemini-3.5-flash-lite').trim() || 'gemini-3.5-flash-lite';
  saveState(data);
  connectionTest = null;
  render();
  notice(data.settings.apiKey && !data.settings.privacyOptIn
    ? 'Key gespeichert. Bitte auch die Zustimmung anhaken – sonst bleibt die KI-Prüfung aus.'
    : 'KI-Einstellungen gespeichert.');
}

async function runConnectionTest(button: HTMLElement): Promise<void> {
  const form = button.closest('form');
  const apiKey = String((form?.querySelector<HTMLInputElement>('#apiKey')?.value ?? data.settings.apiKey)).trim();
  const model = String((form?.querySelector<HTMLInputElement>('#model')?.value ?? data.settings.model)).trim();
  connectionTesting = true;
  connectionTest = null;
  render();
  try {
    connectionTest = await testGeminiConnection({ apiKey, model, imageDataUrl: makeTestImage() });
  } catch (error) {
    connectionTest = { ok: false, message: 'Der Verbindungstest ist fehlgeschlagen.', detail: String(error) };
  } finally {
    connectionTesting = false;
    render();
  }
}

function saveWritingForm(form: HTMLFormElement): void {
  const values = new FormData(form);
  const color = String(values.get('handColor') ?? '#173b44');
  data.settings.handColor = /^#[0-9a-f]{6}$/i.test(color) ? color : '#173b44';
  data.settings.handWidth = Math.max(1.5, Math.min(7, Number(values.get('handWidth')) || 3.5));
  data.settings.ttsRate = Math.max(0.5, Math.min(1.3, Number(values.get('ttsRate')) || 0.85));
  data.settings.sessionLength = [5, 8, 12, 16].includes(Number(values.get('sessionLength'))) ? Number(values.get('sessionLength')) : 8;
  const theme = String(values.get('theme') ?? 'paper');
  if (unlockedThemes(computeStars(data.attempts)).includes(theme)) data.settings.theme = theme as AppData['settings']['theme'];
  saveState(data);
  render();
  notice('Darstellung gespeichert.');
}

function addCustomWords(form: HTMLFormElement): void {
  const values = new FormData(form);
  const lines = String(values.get('customWords') ?? '').split(/\r?\n/);
  let added = 0;
  const existing = new Set(allWords().map((word) => word.word.toLocaleLowerCase('de-DE')));
  for (const line of lines) {
    const [rawWord, rawRule] = line.split('|').map((part) => part.trim());
    if (!rawWord || !rawRule || !rules.some((rule) => rule.id === rawRule)) continue;
    if (existing.has(rawWord.toLocaleLowerCase('de-DE'))) continue;
    const rule = findRule(rawRule);
    data.customWords.push({
      id: `custom-${Date.now()}-${added}`,
      word: rawWord,
      ruleId: rawRule,
      level: 1,
      hint: rule.tip,
      custom: true,
    });
    existing.add(rawWord.toLocaleLowerCase('de-DE'));
    added += 1;
  }
  if (added > 0) {
    saveState(data);
    render();
  }
  notice(added > 0 ? `${added} Wort/Wörter hinzugefügt.` : 'Keine gültigen Wörter gefunden. Format: wort|regelId');
}

function exportData(): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `klartext-daten-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

app.addEventListener('click', (event) => {
  const element = (event.target as HTMLElement).closest<HTMLElement>('[data-action]');
  if (!element) return;
  event.preventDefault();
  const action = element.dataset.action;

  switch (action) {
    case 'home': goHome(); break;
    case 'topics': route = 'topics'; render(); break;
    case 'topic': topicId = element.dataset.id ?? ''; route = 'topic'; render(); break;
    case 'practice-topic': startSession(element.dataset.id ?? ''); break;
    case 'start': startSession(); break;
    case 'quit': goHome(); break;
    case 'speak':
      if (session?.current) speakWordAndSentence(session.current.word.word, session.current.word.sentence, data.settings.ttsRate);
      break;
    case 'clear': pad?.clear(); break;
    case 'undo': pad?.undo(); break;
    case 'check': void checkWithAi(); break;
    case 'test-connection': void runConnectionTest(element); break;
    case 'self-check': {
      const exercise = session?.current;
      if (exercise) feedbackContext = { exercise, previousState: data.progress[exercise.word.id] };
      showResult({
        kind: 'fallback',
        word: exercise?.word ?? feedbackContext?.exercise.word ?? builtinWords[0],
        rule: exercise?.rule ?? feedbackContext?.exercise.rule ?? findRule(''),
        message: 'Vergleiche dein Wort mit der Lösung und entscheide selbst.',
      });
      break;
    }
    case 'choose': chooseOption(Number(element.dataset.index)); break;
    case 'tip':
      helpVisible = !helpVisible;
      render();
      break;
    case 'next': goNext(); break;
    case 'retry-same': solveBySelf(true, true); break;
    case 'self-correct': solveBySelf(element.dataset.value === 'correct'); break;
    case 'disagree': {
      if (feedbackContext?.previousState) {
        const previous = feedbackContext.previousState;
        if (previous.seen === 0) delete data.progress[feedbackContext.exercise.word.id];
        else data.progress[feedbackContext.exercise.word.id] = previous;
      }
      saveState(data);
      showResult({ kind: 'fallback', word: feedbackContext?.exercise.word ?? builtinWords[0], rule: feedbackContext?.exercise.rule ?? findRule(''), message: 'Du entscheidest selbst: War dein Wort richtig?' });
      break;
    }
    case 'parent': openParent(); break;
    case 'parent-home': route = 'parent'; render(); break;
    case 'parent-exit': parentUnlocked = false; goHome(); break;
    case 'change-pin':
      data.settings.pinHash = null;
      data.settings.pinSalt = null;
      saveState(data);
      parentUnlocked = false;
      pinSetup = true;
      route = 'gate';
      render();
      break;
    case 'delete-custom': {
      const id = element.dataset.id;
      data.customWords = data.customWords.filter((word) => word.id !== id);
      saveState(data);
      render();
      notice('Wort entfernt.');
      break;
    }
    case 'export': exportData(); break;
    case 'reset':
      if (window.confirm('Alle Fortschritte, Einstellungen und Wörter wirklich löschen?')) {
        clearState();
        data = freshState();
        parentUnlocked = false;
        session = null;
        goHome();
        notice('Alle Daten wurden gelöscht.');
      }
      break;
    default: break;
  }
});

app.addEventListener('submit', (event) => {
  const form = event.target as HTMLFormElement;
  if (!(form instanceof HTMLFormElement)) return;
  event.preventDefault();
  if (form.dataset.form === 'pin') void submitPin(form);
  if (form.dataset.form === 'settings') saveSettingsForm(form);
  if (form.dataset.form === 'writing') saveWritingForm(form);
  if (form.dataset.form === 'custom') addCustomWords(form);
});

app.addEventListener('input', (event) => {
  const target = event.target as HTMLInputElement;
  if (target.type !== 'range' || !target.name) return;
  document.querySelectorAll(`[data-value-for="${target.name}"]`).forEach((label) => {
    label.textContent = target.value;
  });
});

// Mehrere Tabs teilen sich localStorage: ein Tab übt, der andere zeigt sonst einen leeren Plan.
window.addEventListener('storage', (event) => {
  if (event.key !== 'klartext.state.v1') return;
  refreshState();
  // Während einer Übung darf die Schreibfläche nicht mitten im Schreiben neu gezeichnet werden.
  if (route !== 'practice') render();
});

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch((error: unknown) => {
      console.warn('Klartext: Service Worker konnte nicht registriert werden.', error);
    });
  });
}

render();
