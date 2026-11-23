import { escapeHtml, header } from './html';
import type { ConnectionTestResult } from '../lib/gemini';
import type { AppData, Difference, Exercise, Rule, TopicArea, Word } from '../lib/types';
import { diffWords, type PlanEntry } from '../lib/learning';
import type { SessionResult, SessionState } from '../lib/session';

export interface FeedbackView {
  kind: 'success' | 'retry' | 'fallback' | 'summary';
  word: Word;
  rule: Rule;
  /** Runs nach einer Themenrunde erneut im gleichen Thema starten. */
  ruleId?: string;
  correct?: boolean;
  transcription?: string;
  confidence?: number;
  differences?: Difference[];
  feedback?: string;
  message?: string;
  /** Ergebnisse für die Abschlussübersicht. */
  results?: SessionResult[];
}

const lockSymbol = '<span aria-hidden="true">🔒</span>';

/** Zeigt den Beispielsatz mit Lücke, damit das Wort nicht einfach abgeschrieben wird. */
export function maskedSentence(word: string, sentence?: string): string {
  if (!sentence?.trim()) return '';
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // \\b wäre bei ß/Umlauten wirkungslos: hier zählen alle Buchstaben als Wortzeichen.
  const match = new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'iu').exec(sentence);
  if (!match) return '';
  return `${sentence.slice(0, match.index)}_____${sentence.slice(match.index + match[0].length)}`;
}

function visibleChar(value: string): string {
  if (!value) return 'nichts';
  return value.replace(/ /g, '␣');
}

function renderErrorDetail(expected: string, differences: readonly Difference[]): string {
  if (differences.length === 0) return '';
  const wrongPositions = new Set(differences.filter((item) => item.expected).map((item) => item.position));
  const markedWord = [...expected]
    .map((char, index) => `<span class="letter${wrongPositions.has(index) ? ' letter-wrong' : ''}">${escapeHtml(visibleChar(char))}</span>`)
    .join('');
  const extras = new Map<number, string>();
  const notes: Array<{ position: number; html: string }> = [];
  for (const item of differences) {
    const position = item.position + 1;
    if (!item.expected && item.written) {
      extras.set(position, (extras.get(position) ?? '') + item.written);
    } else if (item.expected && item.written) {
      notes.push({ position, html: `An Stelle ${position} muss <b>${escapeHtml(visibleChar(item.expected))}</b> stehen, nicht <b>${escapeHtml(visibleChar(item.written))}</b>.` });
    } else if (item.expected) {
      notes.push({ position, html: `An Stelle ${position} fehlt <b>${escapeHtml(visibleChar(item.expected))}</b>.` });
    }
  }
  for (const [position, text] of extras) {
    notes.push({ position, html: `An Stelle ${position} war <b>${escapeHtml(visibleChar(text))}</b> zu viel.` });
  }
  notes.sort((a, b) => a.position - b.position);
  const notesHtml = notes.map((note) => `<li>${note.html}</li>`).join('');
  return `<section class="error-detail" aria-label="So war es richtig">
    <p class="kicker">Genau hier war der Fehler</p>
    <p class="marked-word" aria-hidden="true">${markedWord}</p>
    <ul class="error-list">${notesHtml}</ul>
  </section>`;
}

function renderSummaryOverview(results: readonly SessionResult[]): string {
  const byWord = new Map<string, { word: string; correct: boolean; tries: number }>();
  for (const result of results) {
    const previous = byWord.get(result.wordId);
    byWord.set(result.wordId, {
      word: result.word,
      correct: result.correct,
      tries: (previous?.tries ?? 0) + 1,
    });
  }
  const entries = [...byWord.values()];
  if (entries.length === 0) return '';
  const right = entries.filter((entry) => entry.correct).length;
  const list = entries.map((entry) => `<li class="review-item ${entry.correct ? 'is-right' : 'is-wrong'}" aria-label="${escapeHtml(entry.word)} ${entry.correct ? 'richtig' : 'noch üben'}">
      <span class="review-mark" aria-hidden="true">${entry.correct ? '✓' : '✗'}</span>
      <strong>${escapeHtml(entry.word)}</strong>
      ${entry.tries > 1 ? `<small>${entry.tries}×</small>` : ''}
    </li>`).join('');
  return `<section class="summary-overview" aria-labelledby="review-title">
    <h2 id="review-title">Deine Wörter in dieser Runde</h2>
    <p class="panel-note">${right} richtig · ${entries.length - right} noch üben</p>
    <ul class="word-review">${list}</ul>
  </section>`;
}

export function homeView(data: AppData, plan: PlanEntry[], streak: number, stars: number, totalWords: number): string {
  const learned = Object.keys(data.progress).length;
  const percent = totalWords === 0 ? 0 : Math.round((learned / totalWords) * 100);
  const hasKey = data.settings.apiKey.trim().length > 0 && data.settings.privacyOptIn;

  return `${header()}<main id="hauptinhalt" class="shell" tabindex="-1">
    <div class="home-grid">
      <section class="hero">
        <p class="kicker">Deine Übung für heute</p>
        <h1>Worte kommen klar.</h1>
        <div class="hero-word" aria-hidden="true">Liebe.<span class="doodle-star">✦</span></div>
        <p class="lead">Hör dir ein Wort an, schreib es auf und bekomm eine freundliche Rückmeldung. Ganz ohne Druck.</p>
        <div class="button-row">
          <button class="button primary" type="button" data-action="start">Übung starten <span aria-hidden="true">→</span></button>
          <span class="panel-note">${hasKey ? 'KI-Prüfung ist bereit.' : 'Ohne KI geht es auch: mit dem Lösungswort selbst vergleichen.'}</span>
        </div>
        <div class="stat-row">
          <div class="stat stat-stars"><b>${stars}</b><span>Sterne gesammelt</span></div>
          <div class="stat"><b>${streak}</b><span>Tage in Folge</span></div>
          <div class="stat"><b>${learned}</b><span>Wörter geübt</span></div>
        </div>
      </section>
      <aside class="rail" aria-label="Lernübersicht">
        <section class="panel">
          <h2>Dein Trainingsplan</h2>
          ${plan.length === 0
            ? `<p class="panel-note">${data.attempts.length === 0
                ? 'Üb ein paar Wörter – dann zeige ich dir hier, was sich besonders lohnt.'
                : 'In den letzten Runden ist alles gut gelaufen. Weiter so!'}</p>`
            : `<ul class="plan-list">${plan.map((entry) => `<li><span>${escapeHtml(entry.title)}</span><small>${entry.errors} × üben</small></li>`).join('')}</ul>`}
          <div class="progress-track" role="progressbar" aria-label="Anteil der geübten Wörter" aria-valuenow="${percent}" aria-valuemin="0" aria-valuemax="100"><span style="width:${percent}%"></span></div>
          <p class="panel-note">${percent}% der Wortbank schon gesehen</p>
        </section>
        ${data.settings.privacyOptIn ? '' : `<section class="panel">
          <h3>${lockSymbol} Für die Eltern</h3>
          <p class="panel-note">Bilder werden nur mit Zustimmung an die KI gesendet. Ohne Zustimmung funktioniert Klartext komplett offline mit Selbstprüfung.</p>
          <button class="button small" type="button" data-action="parent">Einstellungen öffnen</button>
        </section>`}
      </aside>
    </div>
  </main>`;
}

function topicStats(ruleId: string, words: readonly Word[], progress: AppData['progress']): { total: number; learned: number } {
  const topicWords = words.filter((word) => word.ruleId === ruleId);
  return {
    total: topicWords.length,
    learned: topicWords.filter((word) => progress[word.id] !== undefined).length,
  };
}

/** Übersicht: die 16 Themen in vier Bereichen, jeweils mit Kurzbeschreibung und Lernstand. */
export function topicsView(areas: readonly TopicArea[], rules: readonly Rule[], words: readonly Word[], progress: AppData['progress'], parentUnlocked = false): string {
  const areaSections = areas.map((area) => {
    const areaRules = rules.filter((rule) => rule.area === area.id);
    if (areaRules.length === 0) return '';
    return `<section class="panel topic-area" aria-labelledby="area-${escapeHtml(area.id)}">
      <h2 id="area-${escapeHtml(area.id)}">${escapeHtml(area.title)}</h2>
      <p class="panel-note">${escapeHtml(area.subtitle)}</p>
      <ul class="topic-cards">
        ${areaRules.map((rule) => {
          const { total, learned } = topicStats(rule.id, words, progress);
          const percent = total === 0 ? 0 : Math.round((learned / total) * 100);
          return `<li><button class="topic-card" type="button" data-action="topic" data-id="${escapeHtml(rule.id)}" aria-label="Thema ${escapeHtml(rule.title)} öffnen">
            <span class="topic-card-top"><strong>${escapeHtml(rule.title)}</strong><span aria-hidden="true">→</span></span>
            <span class="panel-note">${escapeHtml(rule.summary ?? rule.tip)}</span>
            <span class="topic-card-meta"><span class="mini-track" aria-hidden="true"><span style="width:${percent}%"></span></span>${learned}/${total} Wörter geübt</span>
          </button></li>`;
        }).join('')}
      </ul>
    </section>`;
  }).join('');

  return `${header(parentUnlocked, 'topics')}<main id="hauptinhalt" class="shell topics-shell" tabindex="-1">
    <p class="kicker">Lern-Themen</p>
    <h1>Wörter nach Themen</h1>
    <p class="lead">Wähle ein Thema – oder lass alle Themen mischen.</p>
    <div class="button-row topic-mix-row">
      <button class="button primary" type="button" data-action="start">Alle Themen mischen <span aria-hidden="true">→</span></button>
      <span class="panel-note">Dann kommen Wörter aus allen Themen in einer Runde vor.</span>
    </div>
    <div class="topic-areas">${areaSections}</div>
  </main>`;
}

/** Detailseite: Erklärung, Lernziel, Regeln und Beispiele zu einem Thema. */
export function topicView(rule: Rule, area: TopicArea | undefined, words: readonly Word[], progress: AppData['progress'], parentUnlocked = false): string {
  const summary = rule.summary ?? rule.tip;
  const goal = rule.goal ?? rule.tip;
  const rules = rule.rules?.length ? rule.rules : [rule.tip];
  const examples = rule.examples ?? [];
  const areaTitle = area?.title ?? 'Rechtschreibung';
  const { total, learned } = topicStats(rule.id, words, progress);

  return `${header(parentUnlocked, 'topics')}<main id="hauptinhalt" class="shell topic-shell" tabindex="-1">
    <button class="link-button topic-back" type="button" data-action="topics">← Alle Themen</button>
    <p class="kicker">Thema · ${escapeHtml(areaTitle)}</p>
    <h1>${escapeHtml(rule.title)}</h1>
    <p class="lead">${escapeHtml(area?.subtitle ?? 'Regeln und Beispiele zum Nachschlagen.')}</p>
    <div class="topic-detail-grid">
      <section class="panel topic-main">
        <h2>Worum geht’s?</h2>
        <p>${escapeHtml(summary)}</p>
        <h3 class="section-gap">Das lernst du</h3>
        <p>${escapeHtml(goal)}</p>
        <h3 class="section-gap">Regeln zum Merken</h3>
        <ol class="rule-list">${rules.map((text) => `<li>${escapeHtml(text)}</li>`).join('')}</ol>
        <p class="tip-box"><strong>Kurz gesagt:</strong> ${escapeHtml(rule.tip)}</p>
      </section>
      <aside class="topic-side">
        ${examples.length ? `<section class="panel">
          <h2>Beispiele</h2>
          <ul class="example-list">
            ${examples.map((example) => `<li><span class="example-word">${escapeHtml(example.word)}</span><span class="panel-note">${escapeHtml(example.note)}</span></li>`).join('')}
          </ul>
        </section>` : ''}
        <section class="panel topic-cta">
          <p class="panel-note"><strong>${total} Wörter</strong> in diesem Thema · ${learned} schon geübt</p>
          <div class="button-row">
            <button class="button primary" type="button" data-action="practice-topic" data-id="${escapeHtml(rule.id)}">Dieses Thema üben <span aria-hidden="true">→</span></button>
            <button class="button small" type="button" data-action="topics">Alle Themen</button>
          </div>
        </section>
      </aside>
    </div>
  </main>`;
}

function promptBlock(exercise: Exercise, showHelp: boolean): string {
  const { word, rule, kind } = exercise;
  if (kind === 'choice') {
    return `<p class="kicker">Welche Schreibung ist richtig?</p>
      <p class="prompt-hint">${escapeHtml(rule.title)} – ${escapeHtml(word.sentence ?? 'Wähle das Wort aus.')}</p>
      <div class="choice-grid" role="group" aria-label="Antwortmöglichkeiten">
        ${(exercise.options ?? []).map((option, index) => `<button class="choice" type="button" data-action="choose" data-index="${index}" aria-label="Antwort ${escapeHtml(option)}">${escapeHtml(option)}</button>`).join('')}
      </div>`;
  }
  if (kind === 'dictation') {
    const context = maskedSentence(word.word, word.sentence);
    return `<p class="kicker">Hör dir das Wort und den Satz an</p>
      <div class="button-row prompt-actions">
        <button class="button accent" type="button" data-action="speak"><span aria-hidden="true">🔊</span> Wort und Satz anhören</button>
        ${showHelp ? `<span class="prompt-word">${escapeHtml(word.word)}</span>` : ''}
      </div>
      ${context ? `<p class="prompt-sentence">${escapeHtml(context)}</p>` : ''}`;
  }
  return `<p class="kicker">Schreib das Wort ab – achte auf jede Stelle</p>
    <p class="prompt-word">${escapeHtml(word.word)}</p>`;
}

export function practiceView(data: AppData, session: SessionState, checking: boolean, helpVisible: boolean): string {
  const exercise = session.current;
  if (!exercise) return homeView(data, [], 0, 0, 0);
  const percent = Math.round((session.done / Math.max(1, session.total)) * 100);
  const isChoice = exercise.kind === 'choice';
  const canUseAi = data.settings.apiKey.trim().length > 0 && data.settings.privacyOptIn;

  return `${header()}<main id="hauptinhalt" class="shell" tabindex="-1">
    <div class="practice-head">
      <span>Wort ${session.done + 1} von ${session.total}</span>
      <button class="link-button" type="button" data-action="quit">Übung beenden</button>
    </div>
    <div class="progress-track" role="progressbar" aria-label="Fortschritt der Übung" aria-valuenow="${percent}" aria-valuemin="0" aria-valuemax="100"><span style="width:${percent}%"></span></div>
    <section class="stage" aria-labelledby="aufgabe">
      <h1 id="aufgabe" class="kicker" style="font-size:1rem">${escapeHtml(exercise.rule.title)}</h1>
      ${promptBlock(exercise, helpVisible || session.showHelp)}
      ${isChoice ? '' : `<div class="pad-wrap">
        <canvas id="schreibflaeche" aria-label="Schreibfläche für das gesuchte Wort" role="img"></canvas>
      </div>`}
      ${helpVisible || session.showHelp ? `<p class="tip-box"><strong>Tipp:</strong> ${escapeHtml(exercise.rule.tip)} ${escapeHtml(exercise.word.hint)}</p>` : ''}
      <div class="button-row stage-actions">
        ${!isChoice && canUseAi ? `<button class="button primary" type="button" data-action="check" ${checking ? 'disabled' : ''}>${checking ? 'Klartext schaut nach …' : 'Prüfen lassen'}</button>` : ''}
        <button class="button ${canUseAi || isChoice ? '' : 'primary'}" type="button" data-action="self-check">${isChoice ? ' Antwort kontrollieren' : 'Lösung zeigen & selbst prüfen'}</button>
        ${!isChoice && canUseAi ? '<button class="button small" type="button" data-action="clear">Löschen</button><button class="button small" type="button" data-action="undo">Rückgängig</button>' : ''}
        <button class="button small" type="button" data-action="tip">${helpVisible || session.showHelp ? 'Tipp ausblenden' : 'Tipp zeigen'}</button>
      </div>
      ${!canUseAi ? `<p class="panel-note note-gap">${data.settings.apiKey.trim()
        ? 'KI-Prüfung ist aus: Bitte im Elternbereich die Zustimmung anhaken.'
        : 'KI-Prüfung ist aus. Du vergleichst dein Wort selbst mit der Lösung.'}</p>` : ''}
    </section>
  </main>`;
}

export function feedbackView(view: FeedbackView, isLast: boolean): string {
  const { word, rule } = view;
  const differences = view.differences?.length
    ? view.differences
    : view.transcription
      ? diffWords(word.word, view.transcription, rule.caseSensitive === true)
      : [];
  const showErrorDetail = view.kind !== 'summary' && view.correct !== true && differences.length > 0;

  let headline = '';
  let body = '';
  if (view.kind === 'summary') {
    headline = 'Gut gemacht!';
    body = `<p class="lead">Du hast ${escapeHtml(view.message ?? 'eine Runde')} geschafft. Jede Runde macht die Wörter sicherer.</p>`;
  } else if (view.kind === 'retry') {
    headline = 'Noch einmal, bitte';
    body = `<p class="lead">${escapeHtml(view.message ?? 'Ich konnte die Schrift nicht sicher lesen.')}</p>
      <p class="panel-note">Unsaubere Striche sind kein Fehler – ich schaue nur auf die Buchstaben.</p>`;
  } else if (view.kind === 'fallback') {
    headline = 'Selbst prüfen';
    body = `<p class="lead">${escapeHtml(view.message ?? 'Die KI ist gerade nicht da.')}</p>`;
  } else {
    headline = view.correct ? 'Genau richtig!' : 'Fast!';
    body = `<p>${escapeHtml(view.feedback ?? '')}</p>`;
  }

  const showSolution = view.kind !== 'summary';
  const againAttrs = view.ruleId ? `data-id="${escapeHtml(view.ruleId)}"` : '';
  const againAction = view.ruleId ? 'practice-topic' : 'start';
  return `${header()}<main id="hauptinhalt" class="shell" tabindex="-1">
    <section class="stage" style="max-width:760px">
      <p class="kicker">Rückmeldung</p>
      <h1 class="result-word ${view.kind === 'success' && view.correct ? 'result-ok result-burst' : view.kind === 'success' ? 'result-no' : ''}">${escapeHtml(headline)}</h1>
      ${body}
      ${showSolution ? `<p class="prompt-hint">Gesucht war:</p><p class="result-word">${escapeHtml(word.word)}</p>${word.sentence ? `<p class="prompt-sentence">${escapeHtml(word.sentence)}</p>` : ''}` : ''}
      ${view.transcription ? `<p class="panel-note">Gelesen: ${escapeHtml(view.transcription)}${typeof view.confidence === 'number' ? ` · Sicherheit ${Math.round(view.confidence * 100)}%` : ''}</p>` : ''}
      ${showErrorDetail ? renderErrorDetail(word.word, differences) : ''}
      ${view.kind === 'summary' ? renderSummaryOverview(view.results ?? []) : ''}
      <div class="button-row stage-actions">
        ${view.kind === 'summary'
          ? `<button class="button primary" type="button" data-action="home">Zur Startseite</button><button class="button" type="button" data-action="${againAction}" ${againAttrs}>Noch eine Runde</button>`
          : `<button class="button primary" type="button" data-action="${view.kind === 'retry' ? 'retry-same' : 'next'}">${view.kind === 'retry' ? 'Noch einmal schreiben' : isLast ? 'Runde abschließen' : 'Weiter zum nächsten Wort'}</button>
             ${view.kind === 'fallback' || view.kind === 'retry' ? `<button class="button" type="button" data-action="self-correct" data-value="correct">Das war richtig</button><button class="button" type="button" data-action="self-correct" data-value="wrong">Nochmal üben</button>` : ''}
             ${view.kind === 'success' ? '<button class="button small" type="button" data-action="disagree">KI irrt – selbst bewerten</button>' : ''}`}
      </div>
      <p class="panel-note note-gap">Regel: ${escapeHtml(rule.tip)}</p>
    </section>
  </main>`;
}

export function parentGateView(setup: boolean, error = ''): string {
  return `${header()}<main id="hauptinhalt" class="shell" tabindex="-1">
    <section class="stage" style="max-width:560px">
      <p class="kicker">Elternbereich</p>
      <h1>${setup ? 'PIN festlegen' : 'PIN eingeben'}</h1>
      <p class="lead">${setup ? 'Wähle eine vier- bis sechsstellige PIN. Sie bleibt nur auf diesem Gerät gespeichert.' : 'Gib deine PIN ein, um Einstellungen und Fortschritt zu sehen.'}</p>
      ${error ? `<p class="tip-box" role="alert">${escapeHtml(error)}</p>` : ''}
      <form class="form-grid" data-form="pin">
        <input type="text" name="username" autocomplete="username" hidden />
        <div class="field"><label for="pin">PIN</label><input id="pin" name="pin" type="password" inputmode="numeric" autocomplete="current-password" minlength="4" maxlength="6" required /></div>
        ${setup ? '<div class="field"><label for="pin2">PIN wiederholen</label><input id="pin2" name="pin2" type="password" inputmode="numeric" autocomplete="new-password" minlength="4" maxlength="6" required /></div>' : ''}
        <div class="button-row"><button class="button primary" type="submit">${setup ? 'PIN speichern' : 'Öffnen'}</button><button class="button small" type="button" data-action="home">Abbrechen</button></div>
      </form>
    </section>
  </main>`;
}

export function parentView(
  data: AppData,
  plan: PlanEntry[],
  stats: { seen: number; correctRate: number; streak: number; stars: number; byCategory: Array<{ name: string; errors: number }> },
  unlockedThemes: string[],
  connectionTest: ConnectionTestResult | null = null,
  connectionTesting = false,
): string {
  const settings = data.settings;
  const customList = data.customWords.length
    ? `<ul class="category-list">${data.customWords.map((word) => `<li><span>${escapeHtml(word.word)} <small>${escapeHtml(word.ruleId)}</small></span><button class="link-button" type="button" data-action="delete-custom" data-id="${escapeHtml(word.id)}" aria-label="Wort ${escapeHtml(word.word)} löschen">Entfernen</button></li>`).join('')}</ul>`
    : '<p class="panel-note">Noch keine eigenen Wörter.</p>';

  return `${header(true)}<main id="hauptinhalt" class="shell" tabindex="-1">
    <p class="kicker">Elternbereich</p>
    <h1>Einstellungen & Fortschritt</h1>
    <p class="lead">Alles bleibt auf diesem Gerät. Es gibt kein Konto und keine Werbung.</p>

    <input class="tab-input" type="radio" name="parent-tab" id="parent-tab-ki" checked />
    <input class="tab-input" type="radio" name="parent-tab" id="parent-tab-writing" />
    <input class="tab-input" type="radio" name="parent-tab" id="parent-tab-words" />
    <input class="tab-input" type="radio" name="parent-tab" id="parent-tab-progress" />
    <nav class="tab-bar" aria-label="Bereiche">
      <label class="tab-label" for="parent-tab-ki">KI-Prüfung</label>
      <label class="tab-label" for="parent-tab-writing">Schreiben</label>
      <label class="tab-label" for="parent-tab-words">Eigene Wörter</label>
      <label class="tab-label" for="parent-tab-progress">Fortschritt</label>
    </nav>
    <div class="parent-panels">
    <section class="panel" id="panel-ki" aria-labelledby="ki-titel">
      <h2 id="ki-titel">KI-Prüfung</h2>
      <p class="panel-note"><strong>Bitte lesen:</strong> Für die Prüfung gehen nur Schriftbild und Zielwort an Gemini – keine Namen. Nur mit Zustimmung aktivieren. Empfohlen: eigener Key mit Limit.</p>
      <form class="form-grid" data-form="settings">
        <div class="checkbox-line">
          <input id="privacy" name="privacy" type="checkbox" ${settings.privacyOptIn ? 'checked' : ''} />
          <div><label for="privacy">Ich willige ein, dass Schriftbilder zur Prüfung an Google gesendet werden.</label>
          <small>Ohne diesen Haken erscheint in der Übung kein „Prüfen lassen“-Button.</small></div>
        </div>
        <div class="field-row">
          <div class="field"><label for="apiKey">Gemini API-Key</label>
            <input id="apiKey" name="apiKey" type="password" value="${escapeHtml(settings.apiKey)}" autocomplete="off" spellcheck="false" placeholder="In Google AI Studio erstellen" />
            <small>Der Key liegt im Browser (localStorage). Bei geteilten Geräten lieber einen Proxy nutzen – siehe README. Key mit Quota ist empfehlenswert.</small>
          </div>
          <div class="field"><label for="model">Modell</label>
            <input id="model" name="model" type="text" value="${escapeHtml(settings.model)}" spellcheck="false" />
            <small>Standard: gemini-3.5-flash-lite. Für schwierige Handschrift: gemini-4-hydrogen.</small>
          </div>
        </div>
        <div class="button-row">
          <button class="button primary" type="submit">Einstellungen speichern</button>
          <button class="button small" type="button" data-action="test-connection" ${connectionTesting ? 'disabled' : ''}>${connectionTesting ? 'Teste Verbindung …' : 'Verbindung testen'}</button>
        </div>
      </form>
      ${connectionTest ? `<p class="tip-box note-gap ${connectionTest.ok ? 'test-ok' : ''}" role="status">${escapeHtml(connectionTest.message)}${connectionTest.detail ? `<br><small>${escapeHtml(connectionTest.detail)}</small>` : ''}</p>` : ''}
    </section>

    <section class="panel" id="panel-writing" aria-labelledby="schreiben-titel">
      <h2 id="schreiben-titel">Schreiben & Vorlesen</h2>
      <form class="form-grid" data-form="writing">
        <div class="field-row">
          <div class="field"><label for="handColor">Farbe der Schrift</label><input id="handColor" name="handColor" type="color" value="${escapeHtml(settings.handColor)}" /></div>
          <div class="field"><label for="handWidth">Strichstärke: <span data-value-for="handWidth">${settings.handWidth}</span></label><input id="handWidth" name="handWidth" type="range" min="1.5" max="7" step="0.5" value="${settings.handWidth}" /></div>
          <div class="field"><label for="ttsRate">Tempo der Sprachausgabe: <span data-value-for="ttsRate">${settings.ttsRate}</span></label><input id="ttsRate" name="ttsRate" type="range" min="0.5" max="1.3" step="0.05" value="${settings.ttsRate}" /></div>
          <div class="field"><label for="sessionLength">Wörter pro Runde</label><select id="sessionLength" name="sessionLength">${[5, 8, 12, 16].map((count) => `<option value="${count}" ${settings.sessionLength === count ? 'selected' : ''}>${count} Wörter</option>`).join('')}</select></div>
        </div>
        <div class="field"><label for="theme">Design</label><select id="theme" name="theme">${['paper', 'mint', 'night'].map((theme) => `<option value="${theme}" ${settings.theme === theme ? 'selected' : ''} ${unlockedThemes.includes(theme) ? '' : 'disabled'}>${theme === 'paper' ? 'Papier' : theme === 'mint' ? 'Minze (ab 15 Sternen)' : 'Nacht (ab 40 Sternen)'}</option>`).join('')}</select></div>
        <button class="button primary" type="submit">Darstellung speichern</button>
      </form>
    </section>

    <section class="panel" id="panel-words" aria-labelledby="woerter-titel">
      <h2 id="woerter-titel">Eigene Wortlisten</h2>
      <p class="panel-note">Eine Zeile pro Wort: <code>wort|regelId</code>. Verfügbare Regel-IDs stehen in <code>src/data/rules.json</code>. Beispiel: <code>Tisch|grossschreibung</code></p>
      <form class="form-grid" data-form="custom">
        <div class="field"><label for="customWords">Wörter hinzufügen</label><textarea id="customWords" name="customWords" placeholder="Tisch|grossschreibung&#10; Straße|ss-oesz"></textarea></div>
        <button class="button primary" type="submit">Wörter hinzufügen</button>
      </form>
      ${customList}
    </section>

    <section class="panel" id="panel-progress" aria-labelledby="fortschritt-titel">
      <h2 id="fortschritt-titel">Fortschritt</h2>
      <div class="stat-row">
        <div class="stat"><b>${stats.seen}</b><span>Wörter geübt</span></div>
        <div class="stat"><b>${Math.round(stats.correctRate * 100)}%</b><span>Richtig</span></div>
        <div class="stat"><b>${stats.streak}</b><span>Tage in Folge</span></div>
        <div class="stat"><b>${stats.stars}</b><span>Sterne</span></div>
      </div>
      <h3 class="section-gap">Fehler nach Kategorie</h3>
      ${stats.byCategory.length ? `<ul class="category-list">${stats.byCategory.map((entry) => `<li><span>${escapeHtml(entry.name)}</span><small>${entry.errors} ×</small></li>`).join('')}</ul>` : '<p class="panel-note">Noch keine Fehler erfasst.</p>'}
      <h3 class="section-gap">Trainingsplan</h3>
      ${plan.length ? `<ul class="plan-list">${plan.map((entry) => `<li><span>${escapeHtml(entry.title)}</span><small>${entry.errors} × üben</small></li>`).join('')}</ul>` : '<p class="panel-note">Noch zu wenige Daten.</p>'}
      <div class="button-row stage-actions">
        <button class="button" type="button" data-action="export">Daten als JSON exportieren</button>
        <button class="button danger" type="button" data-action="reset">Alle Daten zurücksetzen</button>
        <button class="button small" type="button" data-action="change-pin">PIN ändern</button>
        <button class="button small" type="button" data-action="parent-exit">Elternbereich verlassen</button>
      </div>
    </section>
    </div>
  </main>`;
}
