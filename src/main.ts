import './styles.css';
import rawRules from './data/rules.json';
import rawTopicGroups from './data/topic-groups.json';
import rawWords from './data/words.json';

import { WritingPad } from './lib/canvas';
import { checkHandwriting, friendlyError, isRetryableCheckError, MIN_CONFIDENCE, testGeminiConnection, type ConnectionTestResult } from './lib/gemini';
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
import { createSession, finishExercise, isSessionFinished, nextExercise, roundStats, sessionWords, upgradeQueue, type SessionState } from './lib/session';
import { activeProfile, addProfile, clearState, deleteProfile, freshState, loadState, renameProfile, saveState, switchProfile } from './lib/storage';
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
/** Wie viele Hinweise aus der jeweiligen Aufgabe bereits sichtbar sind. */
let helpStep = 0;
/** Silben in der Reihenfolge, in der das Kind sie hingelegt hat. */
let placedSyllables: string[] = [];
let markedError = -1;
let pad: WritingPad | null = null;
/** Letztes Bild für den Fall, dass der Prüfdienst kurzzeitig nicht erreichbar war. */
let retryImageDataUrl: string | null = null;
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

/** Zeigt die vom Kind gelegten Silben in den Kästchen. */
function renderPlacedSyllables(): void {
  const slots = document.querySelectorAll<HTMLElement>('.syllable-slot');
  slots.forEach((slot, index) => {
    slot.textContent = placedSyllables[index] ?? '';
    slot.classList.toggle('is-filled', Boolean(placedSyllables[index]));
  });
  document.querySelectorAll<HTMLElement>('.syllable-tile').forEach((tile, index) => {
    tile.classList.toggle('is-used', placedSyllables.includes(tile.textContent ?? ''));
    tile.setAttribute('aria-label', `Silbe ${index + 1}: ${tile.textContent ?? ''}`);
  });
}

/** Hebt die angeklickte Stelle im fehlerhaften Wort hervor. */
function renderMarkedError(): void {
  document.querySelectorAll<HTMLElement>('.error-letter').forEach((letter, index) => {
    letter.classList.toggle('is-marked', index === markedError);
    letter.setAttribute('aria-pressed', String(index === markedError));
  });
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
  document.body.dataset.font = data.settings.font;
  document.body.dataset.view = route;
  if (lastRenderedRoute !== route) {
    window.scrollTo(0, 0);
    lastRenderedRoute = route;
  }
  const profile = activeProfile(data);
  const stars = computeStars(profile.attempts);
  const plan = buildTrainingPlan(profile.attempts, rules);
  const home = () => homeView(data, plan, computeStreak(profile.attempts), stars, allWords().length);

  switch (route) {
    case 'practice':
      app!.innerHTML = session ? practiceView(data, session, checking, helpVisible, helpStep) : home();
      break;
    case 'feedback':
      app!.innerHTML = feedback ? feedbackView(feedback, isLastExercise(), plan) : home();
      break;
    case 'parent':
      app!.innerHTML = parentView(data, plan, parentStats(), unlockedThemes(stars), connectionTest, connectionTesting);
      break;
    case 'gate':
      app!.innerHTML = parentGateView(pinSetup, pinError);
      break;
    case 'topics':
      app!.innerHTML = topicsView(topicAreas, rules, allWords(), profile.progress, parentUnlocked);
      break;
    case 'topic': {
      const rule = findRule(topicId);
      app!.innerHTML = topicView(rule, topicAreas.find((area) => area.id === rule.area), allWords(), profile.progress, parentUnlocked);
      break;
    }
    default:
      app!.innerHTML = home();
  }

  const kind = route === 'practice' ? session?.current?.kind : undefined;
  const needsPad = kind === 'dictation' || kind === 'copy' || kind === 'memory';
  if (needsPad) {
    const canvas = document.querySelector<HTMLCanvasElement>('#schreibflaeche');
    if (canvas) {
      pad = new WritingPad(canvas, { color: data.settings.handColor, width: data.settings.handWidth });
      if (kind === 'dictation') speakWordAndSentence(session!.current!.word.word, session!.current!.word.sentence, data.settings.ttsRate);
    }
  } else {
    pad = null;
  }

  if (kind === 'memory') {
    // Das Wort bleibt kurz sichtbar, verschwindet dann aber für das Aus-der-Erinnerung-Schreiben.
    window.setTimeout(() => document.querySelector('#wort-bild')?.classList.add('is-hidden'), 2400);
  }
  if (kind === 'syllables-build') renderPlacedSyllables();
  if (kind === 'error') renderMarkedError();
}

function isLastExercise(): boolean {
  return !session || (session.queue.length === 0 && session.retries.length === 0);
}

function parentStats(): { seen: number; correctRate: number; streak: number; stars: number; byCategory: Array<{ name: string; errors: number }> } {
  const profile = activeProfile(data);
  const categories = new Map<string, number>();
  for (const attempt of profile.attempts) {
    if (attempt.correct) continue;
    for (const category of attempt.categories) categories.set(category, (categories.get(category) ?? 0) + 1);
  }
  const seen = Object.keys(profile.progress).length;
  const rated = profile.attempts.filter((attempt) => !attempt.selfAssessed);
  return {
    seen,
    correctRate: rated.length === 0 ? 0 : rated.filter((attempt) => attempt.correct).length / rated.length,
    streak: computeStreak(profile.attempts),
    stars: computeStars(profile.attempts),
    byCategory: [...categories.entries()].map(([name, errors]) => ({ name, errors })).sort((a, b) => b.errors - a.errors),
  };
}

function startSession(ruleId = ''): void {
  const pool = ruleId ? allWords().filter((word) => word.ruleId === ruleId) : allWords();
  if (pool.length === 0) {
    notice(ruleId ? 'Für dieses Thema sind keine Wörter vorhanden.' : 'Es sind keine Wörter vorhanden.');
    return;
  }
  session = createSession(pool, rules, activeProfile(data).progress, data.settings, Math.random, Date.now(), ruleId);
  topicId = ruleId;
  feedback = null;
  retryImageDataUrl = null;
  checking = false;
  resetExerciseView();
  route = 'practice';
  render();
}

/** Neue Aufgabe: Hilfe, Silben und Markierungen gehören nur zur vorherigen Aufgabe. */
function resetExerciseView(): void {
  helpVisible = false;
  helpStep = 0;
  placedSyllables = [];
  markedError = -1;
}

function showSummary(): void {
  const last = feedbackContext?.exercise;
  feedback = {
    kind: 'summary',
    word: last?.word ?? builtinWords[0],
    rule: last?.rule ?? findRule(''),
    ruleId: session?.ruleId,
    message: session
      ? `${roundStats(session).correctWords} von ${session.total} Wörtern in dieser Runde richtig.`
      : 'Runde beendet.',
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
  retryImageDataUrl = null;
  checking = false;
  resetExerciseView();
  if (isSessionFinished(session) || !session.current) showSummary();
  else route = 'practice';
  render();
}

function recordAttempt(exercise: Exercise, correct: boolean, source: Attempt['source'], result?: { confidence?: number; transcription?: string; illegible?: boolean; differences?: Difference[] }): void {
  const word = exercise.word;
  const profile = activeProfile(data);
  const previousState = profile.progress[word.id];
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
  profile.attempts.push(attempt);
  if (profile.attempts.length > 3000) profile.attempts = profile.attempts.slice(-3000);
  profile.progress[word.id] = applyResult(previousState, correct);
  saveState(data);

  if (session) {
    const before = session.difficulty;
    session = finishExercise(session, correct, { transcription: result?.transcription, differences, source });
    // Erfolgsserie: ein kommendes Wort gegen ein schwereres tauschen – die Rundenlänge bleibt fest.
    if (session.difficulty > before) session = upgradeQueue(session, allWords());
  }
}

function showResult(view: FeedbackView): void {
  feedback = view;
  route = 'feedback';
  render();
}

async function checkWithAi(storedImage?: string): Promise<void> {
  if (!session?.current) return;
  const exercise = session.current;
  if (!storedImage && (!pad || pad.isEmpty())) {
    notice('Schreib zuerst das Wort auf.');
    return;
  }
  const imageDataUrl = storedImage ?? pad?.toPngDataUrl();
  if (!imageDataUrl) {
    notice('Die Schreibfläche konnte nicht gelesen werden.');
    return;
  }
  // Bild behalten, damit ein kurzer Dienstausfall nicht zum Neuschreiben zwingt.
  retryImageDataUrl = imageDataUrl;
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
    if (result.illegible || result.transcription.trim() === '' || result.confidence < MIN_CONFIDENCE) {
      feedbackContext = { exercise };
      retryImageDataUrl = null;
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
    retryImageDataUrl = null;
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
      canRetryCheck: isRetryableCheckError(error),
    });
  }
}

function solveBySelf(correct: boolean, retry = false): void {
  if (!feedbackContext) return;
  retryImageDataUrl = null;
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

function exerciseFeedback(exercise: Exercise, correct: boolean): string {
  const note = correct
    ? (exercise.challenge?.why ?? exercise.challenge?.note ?? '')
    : (exercise.challenge?.hints[0] ?? '');
  const base = localFeedback(exercise.rule, correct);
  return note ? `${base} ${note}` : base;
}

/** Vergleicht eine geschriebene Antwort mit der erwarteten Form. */
function evaluateAnswer(answer: string, expected: string, caseSensitive: boolean): boolean {
  const clean = answer.trim().replace(/\s+/g, ' ');
  return caseSensitive ? clean === expected : clean.toLocaleLowerCase('de-DE') === expected.toLocaleLowerCase('de-DE');
}

function submitAnswer(answer: string): void {
  const exercise = session?.current;
  if (!exercise) return;
  const expected = exercise.answer ?? exercise.word.word;
  const correct = evaluateAnswer(answer, expected, exercise.rule.caseSensitive === true);
  const differences = correct ? [] : diffWords(expected, answer, exercise.rule.caseSensitive === true);
  recordAttempt(exercise, correct, 'self', { transcription: answer, differences });
  showResult({
    kind: 'success',
    word: exercise.word,
    rule: exercise.rule,
    correct,
    transcription: answer,
    differences,
    feedback: exerciseFeedback(exercise, correct),
  });
}

function chooseOption(index: number): void {
  const exercise = session?.current;
  if (!exercise) return;
  const option = exercise.options?.[index];
  if (option === undefined) return;
  const expected = exercise.answer ?? exercise.word.word;
  const correct = option === expected;
  const differences = correct ? [] : diffWords(expected, option, exercise.rule.caseSensitive === true);
  recordAttempt(exercise, correct, 'choice', { transcription: option, differences });
  showResult({
    kind: 'success',
    word: exercise.word,
    rule: exercise.rule,
    correct,
    transcription: option,
    differences,
    feedback: exerciseFeedback(exercise, correct),
  });
}

function placeSyllable(index: number): void {
  const exercise = session?.current;
  const syllable = exercise?.challenge?.syllables?.[index];
  if (!syllable || placedSyllables.includes(syllable)) return;
  const count = exercise?.challenge?.syllables?.length ?? 0;
  if (placedSyllables.length >= count) return;
  placedSyllables.push(syllable);
  renderPlacedSyllables();
}

function submitSyllables(): void {
  const exercise = session?.current;
  if (!exercise) return;
  const expected = (exercise.challenge?.syllables ?? [exercise.word.word]).join('');
  const answer = placedSyllables.join('');
  if (!answer) {
    notice('Setz zuerst die Silben in die Kästchen.');
    return;
  }
  const correct = answer === expected;
  const differences = correct ? [] : diffWords(expected, answer, false);
  recordAttempt(exercise, correct, 'choice', { transcription: answer, differences });
  showResult({
    kind: 'success',
    word: exercise.word,
    rule: exercise.rule,
    correct,
    transcription: answer,
    differences,
    feedback: exerciseFeedback(exercise, correct),
  });
}

function setActiveProfile(id: string, keepRoute = false): void {
  if (!switchProfile(data, id)) {
    notice('Dieses Profil gibt es nicht mehr.');
    return;
  }
  saveState(data);
  session = null;
  feedback = null;
  feedbackContext = null;
  retryImageDataUrl = null;
  checking = false;
  helpVisible = false;
  if (!keepRoute) {
    route = 'home';
    topicId = '';
    parentUnlocked = false;
  }
  render();
  notice(`Profil „${activeProfile(data).name}“ ist jetzt aktiv.`);
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
  if (unlockedThemes(computeStars(activeProfile(data).attempts)).includes(theme)) data.settings.theme = theme as AppData['settings']['theme'];
  const font = String(values.get('font') ?? 'lexend');
  if (['lexend', 'atkinson', 'dyslexic', 'system'].includes(font)) data.settings.font = font as AppData['settings']['font'];
  saveState(data);
  render();
  notice('Darstellung gespeichert.');
}

function saveProfileForm(form: HTMLFormElement): void {
  const values = new FormData(form);
  const name = String(values.get('name') ?? '').trim();
  if (form.dataset.form === 'add-profile') {
    if (!name) {
      notice('Bitte einen Namen eingeben.');
      return;
    }
    const profile = addProfile(data, name);
    saveState(data);
    session = null;
    feedback = null;
    feedbackContext = null;
    retryImageDataUrl = null;
    checking = false;
    helpVisible = false;
    render();
    notice(`Profil „${profile.name}“ angelegt und aktiviert.`);
    return;
  }
  if (form.dataset.form === 'rename-profile') {
    if (!renameProfile(data, form.dataset.id ?? '', name)) {
      notice('Bitte einen gültigen Namen eingeben.');
      return;
    }
    saveState(data);
    render();
    notice('Profilname gespeichert.');
  }
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
    case 'switch-profile': setActiveProfile(element.dataset.id ?? '', element.dataset.keep === 'true'); break;
    case 'delete-profile': {
      const id = element.dataset.id ?? '';
      const profile = data.profiles.find((entry) => entry.id === id);
      if (!profile) break;
      if (!window.confirm(`Profil „${profile.name}“ und sein Lernstand wirklich löschen?`)) break;
      const wasActive = data.activeProfileId === id;
      if (deleteProfile(data, id)) {
        saveState(data);
        if (wasActive) {
          session = null;
          feedback = null;
          feedbackContext = null;
        }
        render();
        notice(`Profil „${profile.name}“ gelöscht.`);
      } else notice('Das letzte Profil kann nicht gelöscht werden.');
      break;
    }
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
    case 'retry-check': void checkWithAi(retryImageDataUrl ?? undefined); break;
    case 'test-connection': void runConnectionTest(element); break;
    case 'self-check': {
      const exercise = session?.current;
      if (exercise) feedbackContext = { exercise, previousState: activeProfile(data).progress[exercise.word.id] };
      showResult({
        kind: 'fallback',
        word: exercise?.word ?? feedbackContext?.exercise.word ?? builtinWords[0],
        rule: exercise?.rule ?? feedbackContext?.exercise.rule ?? findRule(''),
        message: 'Vergleiche dein Wort mit der Lösung und entscheide selbst.',
      });
      break;
    }
    case 'choose': chooseOption(Number(element.dataset.index)); break;
    case 'check-answer': {
      const input = document.querySelector<HTMLInputElement>('#antwort');
      if (input) submitAnswer(input.value);
      break;
    }
    case 'mark-error':
      markedError = Number(element.dataset.index);
      renderMarkedError();
      break;
    case 'place-syllable': placeSyllable(Number(element.dataset.index)); break;
    case 'check-syllables': submitSyllables(); break;
    case 'clear-syllables':
      placedSyllables = [];
      renderPlacedSyllables();
      break;
    case 'show-memory-word':
      document.querySelector('#wort-bild')?.classList.remove('is-hidden');
      break;
    case 'tip': {
      const hints = session?.current?.challenge?.hints.length ?? 0;
      if (!helpVisible) {
        helpVisible = true;
        helpStep = 1;
      } else if (hints > 0 && helpStep < hints) {
        helpStep += 1;
      } else {
        helpVisible = false;
        helpStep = 0;
      }
      render();
      break;
    }
    case 'next': goNext(); break;
    case 'retry-same': solveBySelf(true, true); break;
    case 'self-correct': solveBySelf(element.dataset.value === 'correct'); break;
    case 'disagree': {
      if (feedbackContext?.previousState) {
        const previous = feedbackContext.previousState;
        const profile = activeProfile(data);
        if (previous.seen === 0) delete profile.progress[feedbackContext.exercise.word.id];
        else profile.progress[feedbackContext.exercise.word.id] = previous;
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

// Silben lassen sich auf Tablets antippen und am Desktop in die Kästchen ziehen.
app.addEventListener('dragstart', (event) => {
  const tile = (event.target as HTMLElement).closest<HTMLElement>('.syllable-tile');
  if (tile && event.dataTransfer) event.dataTransfer.setData('text/plain', tile.dataset.index ?? '0');
});
app.addEventListener('dragover', (event) => {
  if ((event.target as HTMLElement).closest('.syllable-slot')) event.preventDefault();
});
app.addEventListener('drop', (event) => {
  const slot = (event.target as HTMLElement).closest<HTMLElement>('.syllable-slot');
  if (!slot) return;
  event.preventDefault();
  placeSyllable(Number(event.dataTransfer?.getData('text/plain')));
});

app.addEventListener('submit', (event) => {
  const form = event.target as HTMLFormElement;
  if (!(form instanceof HTMLFormElement)) return;
  event.preventDefault();
  if (form.dataset.form === 'pin') void submitPin(form);
  if (form.dataset.form === 'settings') saveSettingsForm(form);
  if (form.dataset.form === 'writing') saveWritingForm(form);
  if (form.dataset.form === 'custom') addCustomWords(form);
  if (form.dataset.form === 'add-profile' || form.dataset.form === 'rename-profile') saveProfileForm(form);
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
  const previousProfileId = data.activeProfileId;
  refreshState();
  if (previousProfileId !== data.activeProfileId) {
    // Ein anderer Tab hat das Kind gewechselt: keine Versuche mehr dem falschen Profil zuschreiben.
    session = null;
    feedback = null;
    feedbackContext = null;
    retryImageDataUrl = null;
    checking = false;
    helpVisible = false;
    if (route === 'practice' || route === 'feedback') route = 'home';
    render();
    notice(`Profil „${activeProfile(data).name}“ ist jetzt aktiv.`);
    return;
  }
  // Während einer Übung darf die Schreibfläche nicht mitten im Schreiben neu gezeichnet werden.
  if (route !== 'practice') render();
});

let updateRegistration: ServiceWorkerRegistration | null = null;
let updateBannerShown = false;

function showUpdateBanner(): void {
  if (updateBannerShown || document.getElementById('update-banner')) return;
  updateBannerShown = true;
  const banner = document.createElement('div');
  banner.id = 'update-banner';
  banner.className = 'update-banner';
  banner.setAttribute('role', 'status');
  banner.innerHTML = '<span><strong>Neue Version da!</strong> Jetzt übernehmen, um sie zu nutzen.</span><button type="button">Aktualisieren</button>';
  banner.querySelector('button')?.addEventListener('click', () => {
    updateRegistration?.waiting?.postMessage({ type: 'SKIP_WAITING' });
    window.location.reload();
  });
  document.body.appendChild(banner);
}

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    // Den-controllerchange zuerst abonnieren: ein schnelles Update kann sonst vor dem
    // aufgelösten register()-Promise passieren und der Hinweis geht verloren.
    let alreadyControlled = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (alreadyControlled) showUpdateBanner();
      alreadyControlled = true;
    });
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then((registration) => {
      updateRegistration = registration;
      if (registration.waiting && alreadyControlled) showUpdateBanner();
      registration.addEventListener('updatefound', () => {
        const installing = registration.installing;
        if (!installing) return;
        installing.addEventListener('statechange', () => {
          if (installing.state === 'installed' && alreadyControlled) showUpdateBanner();
        });
      });
      registration.update().catch(() => {});
    }).catch((error: unknown) => {
      console.warn('Klartext: Service Worker konnte nicht registriert werden.', error);
    });
  });
}

render();
