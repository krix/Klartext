/**
 * Playwright-Smoke-Test für den Rundenablauf.
 * Voraussetzung: `npm run build` und `npm run preview -- --port 4173` laufen.
 * Chrome wird lokal genutzt, es muss kein Playwright-Browser geladen werden.
 */
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:4173/';
const CHROME = process.env.CHROME_PATH ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
const page = await context.newPage();
const errors = [];
page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
page.on('pageerror', (error) => errors.push(String(error)));

await page.goto(BASE);
await page.evaluate(() => {
  localStorage.setItem('klartext.state.v1', JSON.stringify({
    version: 1, settings: { sessionLength: 5 }, progress: {}, attempts: [], customWords: [],
  }));
});
await page.reload();
await page.locator('[data-action="start"]').click();

let wrongMarked = 0;
let reachedSummary = false;
for (let step = 0; step < 200; step += 1) {
  const view = await page.evaluate(() => document.body.dataset.view);
  if (view === 'feedback' && (await page.getByText('Gut gemacht!').count())) { reachedSummary = true; break; }
  if (view === 'practice') {
    const choice = page.locator('.choice-grid [data-action="choose"]').first();
    const selfCheck = page.locator('[data-action="self-check"]');
    if (await choice.count()) await choice.click(); // Auswahlfehler liefern echte Fehlerdetails.
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
assert.ok(reachedSummary, 'Rundenübersicht wurde nicht erreicht');

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

assert.equal(errors.length, 0, 'keine Konsolenfehler: ' + errors.join(' | '));
console.log('ALL PLAYWRIGHT CHECKS PASSED');
await browser.close();
