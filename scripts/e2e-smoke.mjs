/**
 * Playwright-Smoke-Test für den Rundenablauf.
 * Voraussetzung: `npm run build` und `npm run preview -- --port 4173` laufen.
 * Chrome wird lokal genutzt, es muss kein Playwright-Browser geladen werden.
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:4173/';
const CHROME = process.env.CHROME_PATH ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const challenges = JSON.parse(readFileSync(new URL('../src/data/challenges.json', import.meta.url), 'utf8'));
const words = JSON.parse(readFileSync(new URL('../src/data/words.json', import.meta.url), 'utf8'));
const knownWords = new Set(words.map((word) => word.word));

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
const page = await context.newPage();
const errors = [];
page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
page.on('pageerror', (error) => errors.push(String(error)));

await page.goto(BASE);
await page.evaluate(() => document.fonts.ready);
assert.ok(await page.evaluate(() => document.fonts.check('18px Lexend')), 'lokale Leseschrift wurde nicht geladen');
await page.evaluate(() => {
  localStorage.setItem('klartext.state.v1', JSON.stringify({
    version: 1, settings: { sessionLength: 5 }, progress: {}, attempts: [], customWords: [],
  }));
});
await page.reload();
await page.locator('[data-action="start"]').click();

let wrongMarked = 0;
let reachedSummary = false;
const progressLabels = [];
for (let step = 0; step < 200; step += 1) {
  const view = await page.evaluate(() => document.body.dataset.view);
  if (view === 'feedback' && (await page.getByText('Gut gemacht!').count())) { reachedSummary = true; break; }
  if (view === 'practice') {
    progressLabels.push(await page.locator('.practice-head span').first().innerText());
    const choices = page.locator('.choice-grid [data-action="choose"]');
    const selfCheck = page.locator('[data-action="self-check"]');
    if (await choices.count()) {
      const options = await choices.allTextContents();
      const prompt = (await page.locator('.stage > .kicker').last().textContent())?.trim() ?? '';
      const hintLocator = page.locator('.prompt-hint');
      const hint = (await hintLocator.count()) ? (await hintLocator.textContent()) ?? '' : '';
      const challengeAnswer = challenges.find((entry) => entry.prompt === prompt)?.answer;
      const candidates = options
        .map((option, index) => ({ option: option.trim(), index }))
        .filter((entry) => entry.option === challengeAnswer
          || (knownWords.has(entry.option) && hint.toLocaleLowerCase('de-DE').includes(entry.option.toLocaleLowerCase('de-DE')))
          || knownWords.has(entry.option));
      const correctIndex = (challengeAnswer ? candidates.find((entry) => entry.option === challengeAnswer) : candidates[0])?.index ?? 0;
      const isRetry = progressLabels.at(-1)?.startsWith('Wiederholung') ?? false;
      // Drei bewusste Fehler liefern echte Fehlerdetails; danach muss die Runde zuverlässig enden.
      const wrongIndex = options.findIndex((_, index) => index !== correctIndex);
      const index = wrongMarked < 3 && !isRetry && wrongIndex >= 0 ? wrongIndex : correctIndex;
      if (index === wrongIndex) wrongMarked += 1;
      await choices.nth(index).click();
    }
    else if (await page.locator('[data-action="check-syllables"]').count()) {
      const tile = page.locator('[data-action="place-syllable"]:not(.is-used)').first();
      while (await tile.count()) await tile.click();
      await page.locator('[data-action="check-syllables"]').click();
    }
    else if (await page.locator('[data-action="check-answer"]').count()) {
      // Tipp-Aufgaben: die erwartete Form steht in den lokalen Aufgabendaten.
      const typed = await page.locator('#antwort').inputValue();
      // textContent bewahrt die Originalschreibung; innerText liefert die per CSS großgeschriebene Variante.
      const prompt = (await page.locator('.stage > .kicker').last().textContent())?.trim() ?? '';
      const challenge = challenges.find((entry) => entry.wrong === typed || (entry.prompt === prompt && entry.answer));
      if (challenge?.answer && !typed.includes(challenge.answer)) await page.locator('#antwort').fill(challenge.answer);
      await page.locator('[data-action="check-answer"]').click();
    }
    else if (await selfCheck.count()) await selfCheck.click();
    else {
      console.log('DEBUG practice ohne Buttons:', await page.evaluate(() => document.querySelector('main')?.innerText.slice(0, 400)));
      break;
    }
  } else if (view === 'feedback') {
    const wrong = page.locator('[data-action="self-correct"][data-value="wrong"]');
    if (await wrong.count()) {
      if (wrongMarked < 3) { await wrong.click(); wrongMarked += 1; }
      else await page.locator('[data-action="self-correct"][data-value="correct"]').click();
    } else {
      await page.locator('[data-action="next"]').click();
    }
  }
  await page.waitForTimeout(80);
}
if (!reachedSummary) console.log('DEBUG Ende:', await page.evaluate(() => ({ view: document.body.dataset.view, text: document.querySelector('main')?.innerText.slice(0, 400), actions: [...document.querySelectorAll('[data-action]')].map((el) => el.dataset.action + (el.dataset.value ? ':' + el.dataset.value : '')).join(',') })));
assert.ok(reachedSummary, 'Rundenübersicht wurde nicht erreicht');
assert.ok(progressLabels.length > 0, 'keine Fortschrittsanzeige gesehen');
for (const label of progressLabels) {
  const match = label.match(/(\d+)\s+von\s+(\d+)/);
  assert.ok(match, 'Fortschritt ohne „X von Y“: ' + label);
  assert.equal(Number(match[2]), 5, 'Rundenlänge darf nicht wachsen: ' + label);
  assert.ok(Number(match[1]) <= 5, 'Fortschritt darf die Rundenlänge nicht überschreiten: ' + label);
}
console.log('progressLabels=' + JSON.stringify(progressLabels));

const reviewCount = await page.locator('.review-item').count();
const wrongCount = await page.locator('.review-item.is-wrong').count();
const detailCount = await page.locator('.error-detail.compact').count();
const wrongWithSolution = await page.locator('.review-item.is-wrong .review-sentence').count();
const summaryPlanCount = await page.locator('.summary-plan .plan-list li').count();
console.log({ reviewCount, wrongCount, detailCount, wrongWithSolution, summaryPlanCount });
assert.equal(reviewCount, 5, 'alle geübten Wörter müssen in der Übersicht stehen');
assert.ok(wrongCount >= 1, 'falsche Wörter müssen als solche markiert sein');
assert.ok(detailCount > 0 || wrongWithSolution > 0, 'bei Fehlern muss die Lösung oder Fehlerstelle stehen');
assert.ok(summaryPlanCount > 0, 'Trainingsplan muss schon im Rundenende gefüllt sein');

const summaryOverflow = await page.evaluate(() => ({
  width: document.documentElement.scrollWidth, innerWidth: window.innerWidth,
}));
assert.ok(summaryOverflow.width <= summaryOverflow.innerWidth + 1, 'horizontaler Overflow im Rundenende');

await page.locator('[data-action="home"]').first().click();
await page.waitForFunction(() => document.body.dataset.view === 'home');
const homePlanNow = await page.locator('.plan-list li').count();
console.log('homePlanImmediately=' + homePlanNow);
assert.ok(homePlanNow > 0, 'Trainingsplan muss ohne Reload gefüllt sein');

const homeMetrics = await page.evaluate(() => ({
  width: document.documentElement.scrollWidth, innerWidth: window.innerWidth,
  height: document.documentElement.scrollHeight, innerHeight: window.innerHeight,
}));
console.log('homeMobile=' + JSON.stringify(homeMetrics));
console.log('overflowElements=' + JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('body *')]
  .filter((el) => el.getBoundingClientRect().bottom > innerHeight + 1)
  .slice(0, 15)
  .map((el) => el.tagName + (el.id ? '#' + el.id : '') + (typeof el.className === 'string' && el.className ? '.' + el.className.split(' ').join('.') : '') + '@' + Math.round(el.getBoundingClientRect().bottom)))));
assert.ok(homeMetrics.width <= homeMetrics.innerWidth + 1, 'horizontaler Overflow auf der Startseite');
assert.ok(homeMetrics.height <= homeMetrics.innerHeight + 2, 'vertikaler Overflow auf der Startseite');

// Zweiter Tab schreibt neue Fehler: der erste Tab muss seinen Plan ohne Reload aktualisieren.
const page2 = await context.newPage();
await page2.goto(BASE);
await page2.evaluate(() => {
  localStorage.setItem('klartext.state.v1', JSON.stringify({
    version: 1,
    settings: { sessionLength: 5 },
    progress: {},
    attempts: [{
      ts: Date.now(), wordId: 'cross-tab', word: 'Fuß', ruleId: 'ss-oesz',
      correct: false, source: 'self', selfAssessed: true, illegible: false, categories: ['ss/ß'],
    }],
    customWords: [],
  }));
});
await page.waitForFunction(
  () => document.querySelector('.plan-list')?.textContent.includes('ss oder ß'),
  null,
  { timeout: 5000 },
);
console.log('planAfterCrossTabSync=' + JSON.stringify(await page.locator('.plan-list').innerText()));
await page2.close();

await page.setViewportSize({ width: 1280, height: 800 });
await page.waitForTimeout(150);
const desktopMetrics = await page.evaluate(() => ({
  width: document.documentElement.scrollWidth, innerWidth: window.innerWidth,
  height: document.documentElement.scrollHeight, innerHeight: window.innerHeight,
}));
console.log('homeDesktop=' + JSON.stringify(desktopMetrics));
assert.ok(desktopMetrics.width <= desktopMetrics.innerWidth + 1, 'horizontaler Overflow auf Desktop');
assert.ok(desktopMetrics.height <= desktopMetrics.innerHeight + 2, 'vertikaler Overflow auf Desktop');

// Kritzel dürfen nie als richtige Lösung durchgehen: simulierte blinde Lesung ohne Wort.
const scribbleContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
const scribblePage = await scribbleContext.newPage();
scribblePage.on('pageerror', (error) => errors.push(String(error)));
await scribblePage.route('**/v1beta/interactions', (route) => route.fulfill({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify({
    steps: [{ content: [{ text: JSON.stringify({
      transcription: '', confidence: 0.2, illegible: true, feedback: 'Ich kann das nicht lesen.',
    }) }] }],
  }),
}));
await scribblePage.goto(BASE);
await scribblePage.evaluate(() => {
  localStorage.setItem('klartext.state.v1', JSON.stringify({
    version: 1,
    settings: { apiKey: 'test-key', privacyOptIn: true, sessionLength: 5 },
    progress: {}, attempts: [], customWords: [],
  }));
});
await scribblePage.reload();
let dictationFound = false;
for (let attempt = 0; attempt < 20; attempt += 1) {
  await scribblePage.locator('[data-action="start"]').click();
  if (await scribblePage.locator('#schreibflaeche').count()) { dictationFound = true; break; }
  await scribblePage.locator('[data-action="quit"]').click();
}
assert.ok(dictationFound, 'keine Diktatübung gefunden');
const padBox = await scribblePage.locator('#schreibflaeche').boundingBox();
for (let line = 0; line < 6; line += 1) {
  const y = padBox.y + 30 + line * 22;
  await scribblePage.mouse.move(padBox.x + 20, y);
  await scribblePage.mouse.down();
  for (let point = 1; point <= 8; point += 1) {
    await scribblePage.mouse.move(padBox.x + 20 + point * (padBox.width - 40) / 8, y + (point % 2 ? 14 : -14));
  }
  await scribblePage.mouse.up();
}
await scribblePage.locator('[data-action="check"]').click();
await scribblePage.waitForFunction(() => document.body.dataset.view === 'feedback');
const scribbleFeedback = await scribblePage.locator('main').innerText();
console.log('scribbleFeedback=' + JSON.stringify(scribbleFeedback.slice(0, 160)));
assert.match(scribbleFeedback, /Noch einmal, bitte/);
assert.doesNotMatch(scribbleFeedback, /Genau richtig!/);
const attemptsAfterScribble = await scribblePage.evaluate(() => JSON.parse(localStorage.getItem('klartext.state.v1')).attempts.length);
assert.equal(attemptsAfterScribble, 0, 'Kritzel darf nicht als Fehler gewertet werden');
await scribbleContext.close();

// Kurzer Dienstausfall: das bereits geschriebene Bild kann erneut geprüft werden.
const outageContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
const outagePage = await outageContext.newPage();
outagePage.on('pageerror', (error) => errors.push(String(error)));
let checkCalls = 0;
await outagePage.route('**/v1beta/interactions', (route) => {
  checkCalls += 1;
  if (checkCalls === 1) {
    return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: { message: 'Dienst nicht erreichbar' } }) });
  }
  return route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      steps: [{ content: [{ text: JSON.stringify({
        transcription: 'Liebe', confidence: 0.9, illegible: false,
        feedback: 'Super gemacht!', isCorrect: true, differences: [],
      }) }] }],
    }),
  });
});
await outagePage.goto(BASE);
await outagePage.evaluate(() => {
  localStorage.setItem('klartext.state.v1', JSON.stringify({
    version: 1,
    settings: { apiKey: 'test-key', privacyOptIn: true, sessionLength: 5 },
    progress: {}, attempts: [], customWords: [],
  }));
});
await outagePage.reload();
let outageDictationFound = false;
for (let attempt = 0; attempt < 20; attempt += 1) {
  await outagePage.locator('[data-action="start"]').click();
  if (await outagePage.locator('#schreibflaeche').count()) { outageDictationFound = true; break; }
  await outagePage.locator('[data-action="quit"]').click();
}
assert.ok(outageDictationFound, 'keine Diktatübung für den Ausfall-Test gefunden');
const outageBox = await outagePage.locator('#schreibflaeche').boundingBox();
await outagePage.mouse.move(outageBox.x + 30, outageBox.y + 90);
await outagePage.mouse.down();
await outagePage.mouse.move(outageBox.x + outageBox.width - 30, outageBox.y + 90);
await outagePage.mouse.up();
await outagePage.locator('[data-action="check"]').click();
await outagePage.waitForFunction(() => document.body.dataset.view === 'feedback');
assert.equal(await outagePage.locator('[data-action="retry-check"]').count(), 1, 'Dienstausfall muss erneute Prüfung anbieten');
const fallbackOverflow = await outagePage.evaluate(() => ({
  width: document.documentElement.scrollWidth, innerWidth: window.innerWidth,
}));
assert.ok(fallbackOverflow.width <= fallbackOverflow.innerWidth + 1, 'horizontaler Overflow im Ausfall-Feedback');
await outagePage.locator('[data-action="retry-check"]').click();
await outagePage.waitForFunction(() => !document.querySelector('[data-action="retry-check"]'), null, { timeout: 5000 });
assert.equal(checkCalls, 2, 'erneute Prüfung muss den Dienst ein zweites Mal aufrufen');
const retryResult = await outagePage.locator('main').innerText();
console.log('retryResult=' + JSON.stringify(retryResult.slice(0, 120)));
assert.doesNotMatch(retryResult, /Selbst prüfen/);
await outageContext.close();

// Profile: anlegen, umbenennen, wechseln – der aktive Name steht in der Begrüßung.
const profileContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
const profilePage = await profileContext.newPage();
profilePage.on('pageerror', (error) => errors.push(String(error)));
await profilePage.goto(BASE);
await profilePage.evaluate(async () => {
  const salt = '1234567890abcdef1234567890abcdef';
  const bytes = new TextEncoder().encode(`klartext:${salt}:1234`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const pinHash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  localStorage.setItem('klartext.state.v1', JSON.stringify({
    version: 2,
    settings: { sessionLength: 5, pinSalt: salt, pinHash, privacyOptIn: true, apiKey: 'test-key' },
    activeProfileId: 'kind-1',
    profiles: [{ id: 'kind-1', name: 'Kind', progress: {}, attempts: [] }],
    customWords: [],
  }));
});
await profilePage.reload();
await profilePage.locator('[data-action="parent"]').click();
await profilePage.locator('#pin').fill('1234');
await profilePage.locator('form[data-form="pin"] button[type="submit"]').click();
await profilePage.waitForFunction(() => document.body.dataset.view === 'parent');
await profilePage.locator('#new-profile').fill('Lina');
await profilePage.locator('[data-form="add-profile"] button[type="submit"]').click();
await profilePage.waitForFunction(() => document.querySelector('.profile-list')?.textContent.includes('Lina'));
await profilePage.locator('form[data-form="rename-profile"] input').last().fill('Lina S.');
await profilePage.locator('form[data-form="rename-profile"] button[type="submit"]').last().click();
await profilePage.waitForFunction(() => document.querySelector('.profile-list')?.textContent.includes('Lina S.'));
await profilePage.locator('[data-action="switch-profile"][data-keep="true"]').first().click();
await profilePage.waitForFunction(() => document.querySelector('.profile-list')?.textContent.includes('Kind'));
await profilePage.locator('a[data-action="home"]').click();
await profilePage.waitForFunction(() => document.body.dataset.view === 'home');
assert.match((await profilePage.locator('.kicker').innerText()).toLowerCase(), /hallo kind!/);
await profilePage.locator('.profile-menu summary').click();
await profilePage.locator('.profile-menu-list button', { hasText: 'Lina S.' }).click();
await profilePage.waitForFunction(() => document.querySelector('.kicker')?.textContent.toLowerCase().includes('hallo lina s.!'));
console.log('profileGreeting=' + JSON.stringify((await profilePage.locator('main').innerText()).slice(0, 90)));
await profileContext.close();

// Update-Hinweis: eine neue Service-Worker-Version muss sichtbar werden und übernehmen.
// Dafür liefert ein kleiner lokaler Server denselben Build aus, aber mit wechselnder SW-Version.
let swVersion = 'update-v1';
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css',
  '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
};
const updateServer = createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  if (path === '/sw.js') {
    const body = readFileSync('dist/sw.js', 'utf8')
      .replace(/const VERSION = ['"][^'"]+['"]/, `const VERSION = '${swVersion}'`);
    res.writeHead(200, { 'content-type': 'application/javascript', 'cache-control': 'no-store' });
    res.end(body);
    return;
  }
  const file = join('dist', path.replace(/^\/+/, '') || 'index.html');
  if (!existsSync(file)) {
    res.writeHead(404);
    res.end('Nicht gefunden');
    return;
  }
  res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
  res.end(readFileSync(file));
});
await new Promise((resolve) => updateServer.listen(0, '127.0.0.1', resolve));
const updateBase = `http://127.0.0.1:${updateServer.address().port}/`;
const updateContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
try {
  const updatePage = await updateContext.newPage();
  updatePage.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  updatePage.on('pageerror', (error) => errors.push(String(error)));
  await updatePage.goto(updateBase);
  await updatePage.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 10000 });
  swVersion = 'update-v2';
  await updatePage.reload({ waitUntil: 'domcontentloaded' });
  await updatePage.waitForSelector('#update-banner', { timeout: 10000 });
  assert.match(await updatePage.locator('#update-banner').innerText(), /Neue Version da!/);
  const [navigated] = await Promise.all([
    updatePage.waitForNavigation({ waitUntil: 'domcontentloaded' }),
    updatePage.locator('#update-banner button').click(),
  ]);
  assert.equal(navigated?.url(), updateBase);
  assert.equal(await updatePage.locator('#update-banner').count(), 0);
  console.log('updateBanner=gezeigt und übernommen');
} finally {
  await updateContext.close();
  await new Promise((resolve) => updateServer.close(resolve));
}

assert.equal(errors.length, 0, 'keine Konsolenfehler: ' + errors.join(' | '));
console.log('ALL PLAYWRIGHT CHECKS PASSED');
await browser.close();
