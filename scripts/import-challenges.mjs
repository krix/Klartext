/**
 * Importiert die neun Übungsformen aus dem Referenz-Prototyp alternate-vanilla/
 * in die Daten der aktiven TypeScript-App.
 *
 * Der Prototyp bleibt unverändert; dieses Skript erzeugt nur
 * src/data/challenges.json sowie zusätzliche Einträge in words.json und rules.json.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { TASKS } from '../alternate-vanilla/data.js';

function plain(value = '') {
  return String(value)
    .replace(/<strong>/g, '')
    .replace(/<\/strong>/g, '')
    .replace(/<em>/g, '„')
    .replace(/<\/em>/g, '“')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const TOPIC_RULES = {
  silben: 'silbenbau',
  fehler: 'fehlerfinden',
  luecken: 'luecken',
  ableiten: 'ableiten',
  bausteine: 'bausteine',
  merkwoerter: 'merkwoerter',
};

const KINDS = {
  build: 'syllables-build',
  split: 'syllables-split',
  error: 'error',
  gap: 'gap',
  derive: 'derive',
  parts: 'parts',
  memory: 'memory',
};

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const writeJson = (path, value) => writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');

const rules = readJson('src/data/rules.json');
const words = readJson('src/data/words.json');
const extraRules = [
  {
    id: 'silbenbau',
    title: 'Silben bauen und trennen',
    tip: 'Sprich das Wort Silbe für Silbe mit. Eine Silbe beginnt mit einem Mitlaut; ein Silbenbogen verbindet die Laute.',
    caseSensitive: false,
    area: 'laenge',
    summary: 'Wörter in Silben zerlegen und die Teile wieder zusammensetzen.',
    goal: 'Du lernst, Wörter in ihren Klangteilen zu hören und die Silben richtig zu trennen.',
    rules: [
      'Eine Silbe beginnt meist mit einem Mitlaut und trägt einen Selbstlaut.',
      'Sprich das Wort langsam und klatsche bei jeder neuen Silbe.',
      'Ein Silbenbogen zeigt dir, welche Laute zu einer Silbe gehören.',
    ],
    examples: [
      { word: 'Freundschaft', note: 'Freund + schaft – zwei Silben.' },
      { word: 'Wasser-me-lo-ne', note: 'Vier Silben, jede mit eigenem Selbstlaut.' },
      { word: 'Schulhof', note: 'Schul + hof – zwei Silben.' },
    ],
  },
  {
    id: 'fehlerfinden',
    title: 'Fehler finden und verbessern',
    tip: 'Erst hinschauen, dann mitsprechen: Klingt die Stelle so, wie sie geschrieben ist? Danach das ganze Wort richtig hinschreiben.',
    caseSensitive: false,
    area: 'laute',
    summary: 'Die unsichere Stelle entdecken und das Wort richtig schreiben.',
    goal: 'Du übst, eine verdächtige Stelle zu finden und daraus das richtige Wort zu machen.',
    rules: [
      'Lies das Wort langsam Silbe für Silbe.',
      'Sprich die Stelle, die sich falsch anfühlt, deutlich mit.',
      'Denk an ein verwandtes Wort, das die Schreibung verrät.',
    ],
    examples: [
      { word: 'Fahrrad', note: 'Aus Fahrrat wird Fahrrad – denk an die Räder.' },
      { word: 'Schule', note: 'Nach sch steht nur ein h direkt vor dem u.' },
      { word: 'Stadt', note: 'Denk an die Städte – das t bleibt erhalten.' },
    ],
  },
  {
    id: 'luecken',
    title: 'Lückenwörter',
    tip: 'Lies den Satz bis zur Lücke und dahinter weiter. Das Wort muss zum Sinn und zur Regel passen.',
    caseSensitive: false,
    area: 'satz',
    summary: 'Das passende Wort anhand des Satzes und der Regel wählen.',
    goal: 'Du lernst, vor und nach der Lücke mitzulesen und die passende Form zu wählen.',
    rules: [
      'Lies den ganzen Satz, bevor du dich entscheidest.',
      'Achte auf Einzahl und Mehrzahl sowie auf das Zeitwort.',
      'Setze probehalber die andere Möglichkeit ein und vergleiche.',
    ],
    examples: [
      { word: 'warte', note: 'Ich warte – bei wir hieße es warten.' },
      { word: 'spielen', note: 'Die Kinder spielen – Mehrzahl.' },
      { word: 'großen', note: 'Wir haben großen Hunger – die Endung passt zum Namenwort.' },
    ],
  },
  {
    id: 'ableiten',
    title: 'Wörter ableiten',
    tip: 'Sprich die Grundform und die neue Form nacheinander aus. Ein Wechsel im Klang zeigt sich oft in äu oder im Endlaut.',
    caseSensitive: false,
    area: 'laenge',
    summary: 'Mit äu/au und hörbaren Endlauten sicher umgehen.',
    goal: 'Du lernst, aus einem Grundwort eine neue Form abzuleiten.',
    rules: [
      'Kommt das Wort von au, schreibst du in der Mehrzahl äu: Haus – Häuser.',
      'Am Ende klingt ein weicher Laut oft hart: Tag – Tage, Rad – Räder.',
      'Sprich beide Formen nacheinander und höre, was sich verändert.',
    ],
    examples: [
      { word: 'Häuser', note: 'Mehrzahl von Haus.' },
      { word: 'Tage', note: 'Mehrzahl von Tag – das g bleibt.' },
      { word: 'Füße', note: 'Mehrzahl von Fuß – Umlaut und ß verändern sich.' },
    ],
  },
  {
    id: 'bausteine',
    title: 'Wortbausteine',
    tip: 'Ein Wortbaustein bleibt in vielen Wörtern gleich. Frag dich, welcher Baustein aus dem Teil ein ganzes Wort macht.',
    caseSensitive: false,
    area: 'wortbau',
    summary: 'Vorsilben und Endungen als feste Bausteine erkennen.',
    goal: 'Du lernst die Bausteine ver-, vor-, -ung und -keit sicher zu unterscheiden.',
    rules: [
      'ver- hat oft mit einem Weg oder einer Veränderung zu tun: vergessen, verlaufen.',
      'vor- hat mit einer Stelle oder einem Vorher zu tun: vorstellen, vorlesen.',
      'Aus Tätigkeiten werden Wörter auf -ung: die Lösung, die Wohnung.',
      'Aus Eigenschaftswörtern werden Wörter auf -keit: die Freundlichkeit.',
    ],
    examples: [
      { word: 'vergessen', note: 'Die Vorsilbe ist ver-.' },
      { word: 'Freundlichkeit', note: 'Die Endung ist -keit.' },
      { word: 'vorlesen', note: 'Die Vorsilbe ist vor-.' },
    ],
  },
  {
    id: 'merkwoerter',
    title: 'Merkwörter',
    tip: 'Sieh dir das Wort an, sprich es mit und schreib es mit dem Finger in die Luft. Dann schreibst du es aus dem Kopf.',
    caseSensitive: false,
    area: 'laute',
    summary: 'Ansehen, mitsprechen, weglegen und aus dem Kopf schreiben.',
    goal: 'Du übst das Mehrkanal-Lernen: sehen, hören, sprechen und bewegen.',
    rules: [
      'Sieh dir das Wort in Ruhe an und achte auf die schwierige Stelle.',
      'Sprich es leise mit und lass die Silben klingen.',
      'Schreib die Buchstaben mit dem Finger in die Luft.',
      'Dann erst das Wort wegblenden und aus der Erinnerung schreiben.',
    ],
    examples: [
      { word: 'Bahnhof', note: 'Bahn + Hof.' },
      { word: 'Mädchen', note: 'Sprich die zweite Silbe deutlich: chen.' },
      { word: 'Freundschaft', note: 'Erst ansehen, dann mitsprechen, dann schreiben.' },
    ],
  },
];

const challengeWords = [];

function targetFor(task) {
  if (task.syllables) return task.syllables.join('');
  if (task.type === 'error') return task.answer;
  if (task.answer) return task.answer;
  return task.word ?? '';
}

const challenges = [];
for (const [topic, tasks] of Object.entries(TASKS)) {
  if (!(topic in TOPIC_RULES)) continue;
  for (const task of tasks) {
    const id = `ch-${task.id}`;
    const ruleId = topic === 'dasdass'
      ? (task.options?.includes('dass') ? 'das-dass' : 'grossschreibung')
      : TOPIC_RULES[topic];
    const word = targetFor(task);
    const hints = (task.hints ?? []).map(plain).filter(Boolean);
    const challenge = {
      id,
      kind: KINDS[task.type],
      word,
      ruleId,
      prompt: plain(task.prompt),
      ruleText: plain(task.rule),
      hints,
    };
    if (task.syllables) challenge.syllables = task.syllables;
    if (task.word) challenge.wordToSplit = plain(task.word);
    if (task.wrong) challenge.wrong = plain(task.wrong);
    if (task.options) challenge.options = task.options.map(plain);
    if (task.answer) challenge.answer = plain(task.answer);
    if (task.before !== undefined) challenge.before = plain(task.before);
    if (task.after !== undefined) challenge.after = plain(task.after);
    if (task.errorIndex !== undefined) challenge.errorIndex = task.errorIndex;
    if (task.from) challenge.from = plain(task.from);
    if (task.piece) challenge.piece = plain(task.piece);
    if (task.note) challenge.note = plain(task.note);
    if (task.why) challenge.why = plain(task.why);
    challenges.push(challenge);

    challengeWords.push({
      id,
      word,
      ruleId,
      level: 1,
      hint: hints[0] ?? challenge.ruleText,
      sentence: task.before !== undefined ? `${plain(task.before)} ${word} ${plain(task.after)}`.replace(/\s+/g, ' ').trim() : undefined,
      challenge: true,
    });
  }
}

const extraIds = new Set(extraRules.map((rule) => rule.id));
const keptRules = rules.filter((rule) => !extraIds.has(rule.id));
rules.length = 0;
rules.push(...keptRules, ...extraRules);
const challengeIds = new Set(challengeWords.map((word) => word.id));
const keptWords = words.filter((word) => !challengeIds.has(word.id));
words.length = 0;
words.push(...keptWords, ...challengeWords);

writeJson('src/data/rules.json', rules);
writeJson('src/data/words.json', words);
writeJson('src/data/challenges.json', challenges);
console.log(`${challenges.length} Aufgaben importiert (${words.length} Wörter, ${rules.length} Regeln insgesamt).`);
