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
  {
    id: 'e-oder-ae',
    title: 'e oder ä?',
    tip: 'Such ein verwandtes Wort mit a: Hand → Hände, kalt → Kälte. Gibt es eins, schreib ä. Sonst bleibt meist das e: Held, Erde, Nest.',
    caseSensitive: false,
    area: 'verwechslung',
    summary: 'Ähnlich klingendes e und ä sicher unterscheiden.',
    goal: 'Du lernst, mit einem verwandten Wort mit a zu prüfen, ob ä oder e richtig ist.',
    rules: [
      'Ä entsteht oft aus einem a: Hand → Hände, kalt → Kälte, backen → Bäcker.',
      'Findest du kein verwandtes Wort mit a, bleibt meist das e: Held, Erde, Nest.',
      'Sprich das Wort und die verwandte Form langsam mit – dann hörst du den Unterschied.',
    ],
    examples: [
      { word: 'Hände', note: 'Hand → Hände: aus a wird ä.' },
      { word: 'Bäcker', note: 'backen → Bäcker: das a wird zu ä.' },
      { word: 'Erde', note: 'Kein verwandtes Wort mit a – deshalb e.' },
    ],
  },
  {
    id: 'f-oder-v',
    title: 'f oder v?',
    tip: 'Deutsche Wörter mit dem harten f-Laut schreibt man meist mit f: Fisch, Feder, laufen. Ein paar häufige deutsche Wörter beginnen mit v: Vater, Vogel, von, vor, voll, vier, viel.',
    caseSensitive: false,
    area: 'verwechslung',
    summary: 'Den harten f-Laut als f oder v schreiben.',
    goal: 'Du lernst die deutschen Wörter mit v und die Fremdwörter, in denen v wie w klingt.',
    rules: [
      'In deutschen Wörtern steht für den harten f-Laut meist f: Fisch, Feder, laufen.',
      'Häufige deutsche Wörter mit v merkst du dir: Vater, Vogel, von, vor, voll, vier, viel.',
      'In Fremdwörtern wie Vase, Video oder Ventil klingt v eher wie w – hier hilft nur Merken.',
    ],
    examples: [
      { word: 'Fisch', note: 'Deutsches Wort mit hartem f-Laut.' },
      { word: 'Vater', note: 'Häufiges deutsches Wort mit v am Anfang.' },
      { word: 'Vase', note: 'Fremdwort: das v klingt wie w.' },
    ],
  },
  {
    id: 'ks-laute',
    title: 'Der ks-Laut: cks, gs, chs, x, ks, ex-',
    tip: 'Der ks-Laut hat viele Gesichter. Denk an die Grundform: Tag → Tags, Fuchs → Füchse, Scheck → Schecks. Fremdwörter beginnen oft mit ex-: Extra, Export.',
    caseSensitive: false,
    area: 'verwechslung',
    summary: 'Die sechs Schreibweisen des ks-Lautes sicher unterscheiden.',
    goal: 'Du lernst, bei einem ks-Laut auf die Grundform und auf Fremdwörter zu achten.',
    rules: [
      'sechs, Fuchs, Luchs und Wachs schreibt man mit chs.',
      'Aus Tag wird Tags, aus Zug wird Zugs: das g der Grundform bleibt sichtbar.',
      'Endet die Grundform auf ck, entsteht cks: Scheck → Schecks, Block → Blocks.',
      'Box, Hexe und Taxi haben x; Keks und links haben ks; Extra und Export beginnen mit ex-.',
    ],
    examples: [
      { word: 'sechs', note: 'chs – denk an sechste.' },
      { word: 'Schecks', note: 'cks – Scheck mit angehängtem s.' },
      { word: 'Export', note: 'ex- am Anfang eines Fremdwortes.' },
    ],
  },
  {
    id: 'y-laute',
    title: 'y – wie i, ü oder j?',
    tip: 'Das y klingt mal wie i (Baby, Hobby), mal wie ü (Typ, Symbol) und am Wortanfang oft wie j (Yoga, Yeti). Sprich das Wort mit und merk dir die Gruppe.',
    caseSensitive: false,
    area: 'verwechslung',
    summary: 'Die drei Aussprachen des y sicher zuordnen.',
    goal: 'Du lernst, das y trotz unterschiedlicher Aussprache immer als y zu schreiben.',
    rules: [
      'Am Ende von Baby, Hobby, Party und City klingt das y wie i.',
      'In Typ, Zyklus, Symbol und Hymne klingt das y wie ü.',
      'Am Anfang von Yoga und Yeti klingt das y wie j.',
    ],
    examples: [
      { word: 'Baby', note: 'y am Ende klingt wie i.' },
      { word: 'Typ', note: 'y klingt wie ü.' },
      { word: 'Yoga', note: 'y am Anfang klingt wie j.' },
    ],
  },
  {
    id: 'pf-qu',
    title: 'Wortfamilien mit pf und qu',
    tip: 'In einer Wortfamilie bleibt der Anlaut erhalten: Pferd → Pferde, pflanzen → Pflanze. Das q steht fast immer direkt vor u: Quelle, Quittung.',
    caseSensitive: false,
    area: 'verwechslung',
    summary: 'Die Anlaute pf und qu in Wortfamilien wiedererkennen.',
    goal: 'Du lernst, aus einem bekannten Familienwort die Schreibung von pf und qu abzuleiten.',
    rules: [
      'Viele Wortfamilien beginnen mit pf: Pferd, Pferde; Pflanze, pflanzen; Pflege, pflegen.',
      'Hörst du den pf-Laut, schreib beide Buchstaben – auch in der Grundform.',
      'Das q steht im Deutschen fast immer unmittelbar vor u: Quelle, Quittung, Qualität.',
    ],
    examples: [
      { word: 'Pferd', note: 'pf bleibt auch in Pferde.' },
      { word: 'Pflanze', note: 'pflanzen → Pflanze.' },
      { word: 'Quelle', note: 'q steht direkt vor u.' },
    ],
  },
  {
    id: 'dt',
    title: 'Lernwörter mit -dt',
    tip: 'Ein paar Wörter enden auf -dt, obwohl man nur ein t hört: die Stadt, die Magd, sandte, wandte, verwandt. Denk an die Familie: Stadt → Städte.',
    caseSensitive: false,
    area: 'verwechslung',
    summary: 'Typische Wörter mit stummem d vor t merken.',
    goal: 'Du lernst die Lernwörter mit -dt und findest sie über verwandte Formen wieder.',
    rules: [
      'Stadt und Magd enden auf -dt; im Plural bleibt das d sichtbar: Städte, Mägde.',
      'sandte und wandte kommen von senden und wenden – das d bleibt, auch wenn man es nicht hört.',
      'Auch verwandt endet auf -dt. Diese Wörter merkst du dir gemeinsam.',
    ],
    examples: [
      { word: 'Stadt', note: 'Stadt → Städte: das d bleibt.' },
      { word: 'sandte', note: 'senden → sandte.' },
      { word: 'verwandt', note: 'Endet auf -dt.' },
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

const E_AE_RULE = 'Such ein verwandtes Wort mit a: Hand → Hände, kalt → Kälte. Gibt es eins, schreib ä. Sonst bleibt meist das e: Held, Erde, Nest.';
const F_V_RULE = 'Deutsche Wörter mit dem harten f-Laut schreibt man meist mit f: Fisch, Feder, laufen. Ein paar häufige deutsche Wörter beginnen mit v: Vater, Vogel, von, vor, voll, vier, viel. In Fremdwörtern wie Vase oder Video klingt v wie w.';
const KS_RULE = 'Der ks-Laut hat viele Gesichter. Denk an die Grundform: Tag → Tags, Fuchs → Füchse, Scheck → Schecks. Fremdwörter beginnen oft mit ex-: Extra, Export.';
const Y_RULE = 'Das y klingt mal wie i (Baby, Hobby), mal wie ü (Typ, Symbol) und am Wortanfang oft wie j (Yoga, Yeti). Sprich das Wort mit und merk dir die Gruppe.';
const PF_QU_RULE = 'In einer Wortfamilie bleibt der Anlaut erhalten: Pferd → Pferde, pflanzen → Pflanze. Das q steht fast immer direkt vor u: Quelle, Quittung.';
const DT_RULE = 'Ein paar Wörter enden auf -dt, obwohl man nur ein t hört: die Stadt, die Magd, sandte, wandte, verwandt. Denk an die Familie: Stadt → Städte.';

/** „Fehler finden“: die erste abweichende Stelle wird automatisch markiert. */
function mistake(id, wrong, answer, ruleId, prompt, ruleText, hints, sentence) {
  const letters = [...wrong];
  const correct = [...answer];
  const found = letters.findIndex((char, index) => char !== correct[index]);
  return {
    id,
    kind: 'error',
    word: answer,
    ruleId,
    prompt,
    ruleText,
    hints,
    wrong,
    answer,
    errorIndex: found < 0 ? 0 : found,
    sentence,
  };
}

/** Lückenaufgabe für ein Wortteilchen: ä/e, f/v oder eine ks-Schreibweise. */
function fill(id, before, after, answer, options, word, ruleId, prompt, ruleText, hints, sentence) {
  return { id, kind: 'gap', word, ruleId, prompt, ruleText, hints, before, after, answer, options, sentence };
}

/** Merkwort: ansehen, mitsprechen, weglegen und aus dem Kopf schreiben. */
function memorize(id, word, ruleId, prompt, ruleText, hints, sentence) {
  return { id, kind: 'memory', word, ruleId, prompt, ruleText, hints, sentence };
}

/** Ableiten: aus der Grundform wird die passende neue Form gebildet. */
function derive(id, from, answer, ruleId, prompt, ruleText, hints, sentence) {
  return { id, kind: 'derive', word: answer, ruleId, prompt, ruleText, hints, from, answer, sentence };
}

const extraChallenges = [
  // e oder ä
  mistake('ch-e1', 'Hende', 'Hände', 'e-oder-ae', 'Korrigiere das Wort.', E_AE_RULE,
    ['Denk an die Hand: eine Hand, zwei …', 'Hand → Hände: aus a wird ä.'], 'Ich wasche mir die Hände.'),
  mistake('ch-e2', 'Kelte', 'Kälte', 'e-oder-ae', 'Mir ist kalt. Wie schreibt man das?', E_AE_RULE,
    ['kalt → Kälte: das a wird zu ä.', 'Sprich beide Wörter langsam mit.'], 'Die Kälte kommt aus dem Norden.'),
  mistake('ch-e3', 'Becker', 'Bäcker', 'e-oder-ae', 'Wer backt das Brot?', E_AE_RULE,
    ['backen → Bäcker: aus a wird ä.', 'Der Bäcker steht in der Backstube.'], 'Der Bäcker backt frisches Brot.'),
  mistake('ch-e4', 'Zehne', 'Zähne', 'e-oder-ae', 'Ein Zahn, zwei …?', E_AE_RULE,
    ['Ein Zahn, zwei Zähne – das a aus Zahn wird zu ä.', 'Sprich beide Formen langsam: Zahn – Zähne.'], 'Ich putze mir die Zähne.'),
  mistake('ch-e5', 'Wesche', 'Wäsche', 'e-oder-ae', 'Waschen macht …?', E_AE_RULE,
    ['waschen → Wäsche: das a wird zu ä.', 'Denk an die Wäsche im Schrank.'], 'Die Wäsche ist trocken.'),
  fill('ch-e6', 'l', 'cheln', 'ä', ['ä', 'e'], 'lächeln', 'e-oder-ae', 'Lächeln oder lecheln?', E_AE_RULE,
    ['lachen → lächeln: aus a wird ä.', 'Das Kind lächelt – mit ä.'], 'Das Kind lächelt.'),
  fill('ch-e7', 'kr', 'ftig', 'ä', ['ä', 'e'], 'kräftig', 'e-oder-ae', 'Kräftig oder kreftig?', E_AE_RULE,
    ['Kraft → kräftig: aus a wird ä.', 'Sprich das Wort deutlich: kräftig.'], 'Der Hund ist kräftig.'),
  mistake('ch-e8', 'Ärde', 'Erde', 'e-oder-ae', 'Auf welchem Planeten leben wir?', E_AE_RULE,
    ['Gibt es ein verwandtes Wort mit a? Nein.', 'Die Erde bleibt mit e.'], 'Die Erde ist unser Planet.'),
  mistake('ch-e9', 'Näst', 'Nest', 'e-oder-ae', 'Wo wohnen junge Vögel? Im …', E_AE_RULE,
    ['Nest hat kein verwandtes Wort mit a.', 'Das Nest bleibt mit e.'], 'Im Nest sitzen junge Vögel.'),
  memorize('ch-e10', 'Mädchen', 'e-oder-ae', 'Sieh dir das Wort an, dann schreibst du es aus dem Kopf.', E_AE_RULE,
    ['Denk an die Magd: Mädchen mit ä.', 'Mäd-chen – die zweite Silbe bleibt mit e.'], 'Das Mädchen liest ein Buch.'),

  // f oder v
  mistake('ch-v1', 'Fater', 'Vater', 'f-oder-v', 'Wer ist der Papa? Der …', F_V_RULE,
    ['Das ist ein häufiges deutsches Wort mit v.', 'Denk an vor: beide beginnen mit v.'], 'Der Vater liest vor.'),
  mistake('ch-v2', 'Fogel', 'Vogel', 'f-oder-v', 'Was fliegt durch die Luft? Der …', F_V_RULE,
    ['Vogel gehört zu den deutschen Wörtern mit v.', 'Ein Vogel fliegt – mit v am Anfang.'], 'Der Vogel singt.'),
  mistake('ch-v3', 'Fon', 'von', 'f-oder-v', 'Welches kleine Wort fehlt: … mir?', F_V_RULE,
    ['Das Wort von beginnt mit v.', 'Ich bin von hier – nicht „fon“.'], 'Das Buch ist von mir.'),
  mistake('ch-v4', 'Foll', 'voll', 'f-oder-v', 'Die Flasche ist …', F_V_RULE,
    ['voll gehört zu den deutschen Wörtern mit v.', 'Sprich: voll – mit v.'], 'Die Flasche ist voll.'),
  mistake('ch-v5', 'Fase', 'Vase', 'f-oder-v', 'Wo stehen die Blumen? In der …', F_V_RULE,
    ['Die Vase ist ein Fremdwort.', 'In Fremdwörtern wie Vase klingt v wie w.'], 'In der Vase stehen Blumen.'),
  mistake('ch-v6', 'Fideo', 'Video', 'f-oder-v', 'Was schauen wir uns an? Ein …', F_V_RULE,
    ['Video ist ein Fremdwort mit v.', 'Das v klingt hier wie w.'], 'Das Video ist lustig.'),
  fill('ch-v7', '', 'isch', 'F', ['F', 'V'], 'Fisch', 'f-oder-v', 'Fisch – mit F oder V?', F_V_RULE,
    ['Deutsche Wörter mit f-Laut schreibt man meist mit f.', 'Ein Fisch schwimmt – mit f.'], 'Der Fisch schwimmt.'),
  fill('ch-v8', '', 'eder', 'F', ['F', 'V'], 'Feder', 'f-oder-v', 'Feder – mit F oder V?', F_V_RULE,
    ['Feder ist ein deutsches Wort mit f.', 'Ich schreibe mit einer Feder.'], 'Ich schreibe mit einer Feder.'),
  fill('ch-v9', 'lau', 'en', 'f', ['f', 'v'], 'laufen', 'f-oder-v', 'Laufen – mit f oder v?', F_V_RULE,
    ['laufen ist ein deutsches Wort mit f.', 'Wir laufen – mit f.'], 'Die Kinder laufen schnell.'),
  memorize('ch-v10', 'Vogel', 'f-oder-v', 'Sieh dir das Wort an, dann schreibst du es aus dem Kopf.', F_V_RULE,
    ['Vogel beginnt mit v.', 'Denk an den Vogel, der fliegt.'], 'Der Vogel fliegt hoch.'),

  // ks-Laute
  fill('ch-k1', 'se', '', 'chs', ['chs', 'ks', 'x'], 'sechs', 'ks-laute', 'Wie schreibt man sechs?', KS_RULE,
    ['sechs – sechste: das ch bleibt.', 'Zähl mit: eins, zwei, drei, vier, fünf, sechs.'], 'Ich habe sechs Stifte.'),
  mistake('ch-k2', 'Fuks', 'Fuchs', 'ks-laute', 'Welches Tier hat einen buschigen Schwanz?', KS_RULE,
    ['Fuchs → Füchse: das ch bleibt.', 'Ein Fuchs ist kein Fuks.'], 'Der Fuchs läuft durch den Wald.'),
  fill('ch-k3', 'Ta', '', 'gs', ['gs', 'ks', 'cks'], 'Tags', 'ks-laute', 'Der Tag – zwei …?', KS_RULE,
    ['Grundform: der Tag. Häng s dran: Tags.', 'Das g aus dem Tag bleibt sichtbar.'], undefined),
  mistake('ch-k4', 'Zuks', 'Zugs', 'ks-laute', 'Der Zug – mit s wird …?', KS_RULE,
    ['Grundform: der Zug.', 'Zug + s = Zugs mit g.'], undefined),
  fill('ch-k5', 'Sche', '', 'cks', ['cks', 'ks', 'x'], 'Schecks', 'ks-laute', 'Der Scheck – mehrere …?', KS_RULE,
    ['Scheck endet auf ck; dann kommt s dazu.', 'Scheck → Schecks mit cks.'], 'Ich habe zwei Schecks dabei.'),
  mistake('ch-k6', 'Bloks', 'Blocks', 'ks-laute', 'Der Block – zwei …?', KS_RULE,
    ['Block endet auf ck.', 'Block + s = Blocks mit cks.'], 'Zwei Blocks liegen auf dem Tisch.'),
  fill('ch-k7', 'Bo', '', 'x', ['x', 'ks', 'chs'], 'Box', 'ks-laute', 'Eine Box – mit x oder ks?', KS_RULE,
    ['Box → Boxen: das x bleibt.', 'Box ist ein kurzes Fremdwort mit x.'], 'Die Box steht im Flur.'),
  fill('ch-k8', 'He', 'e', 'x', ['x', 'ks', 'chs'], 'Hexe', 'ks-laute', 'Die Hexe – mit x oder ks?', KS_RULE,
    ['Hexe hat ein x.', 'Denk an Hexe und Box.'], 'Die Hexe fliegt auf dem Besen.'),
  fill('ch-k9', 'Ke', '', 'ks', ['ks', 'chs', 'x'], 'Keks', 'ks-laute', 'Der Keks – mit ks oder x?', KS_RULE,
    ['Keks → Kekse: das ks bleibt.', 'Keks wird nicht mit x geschrieben.'], 'Ich esse einen Keks.'),
  fill('ch-k10', 'lin', '', 'ks', ['ks', 'x', 'chs'], 'links', 'ks-laute', 'Das Wort links – mit ks oder x?', KS_RULE,
    ['links endet auf ks.', 'Denk an „link“ und häng s dran.'], 'Der Hund läuft links.'),
  fill('ch-k11', '', 'tra', 'Ex', ['Ex', 'Eks', 'Ecks'], 'Extra', 'ks-laute', 'Was steht am Anfang: Ex oder Eks?', KS_RULE,
    ['Extra beginnt mit ex – wie Export.', 'Fremdwörter mit ex- schreibt man mit x.'], 'Das ist ein Extra.'),
  mistake('ch-k12', 'Eksport', 'Export', 'ks-laute', 'Welches Wort beginnt mit ex-?', KS_RULE,
    ['Export beginnt mit ex – wie Extra.', 'Das x steht direkt nach dem E.'], 'Wir exportieren Waren.'),

  // y wie i, ü oder j
  mistake('ch-y1', 'Babi', 'Baby', 'y-laute', 'Wie schreibt man das kleine Kind?', Y_RULE,
    ['Das y am Ende klingt wie i: Baby.', 'Baby endet auf y – nicht auf i.'], 'Das Baby schläft.'),
  mistake('ch-y2', 'Hobi', 'Hobby', 'y-laute', 'Was machst du in deiner Freizeit? Dein …', Y_RULE,
    ['Hobby klingt wie „Hobi“, wird aber mit y geschrieben.', 'Das y am Ende klingt wie i.'], 'Mein Hobby ist Lesen.'),
  mistake('ch-y3', 'Parti', 'Party', 'y-laute', 'Wir feiern eine …', Y_RULE,
    ['Party endet auf y.', 'Das y klingt hier wie i.'], 'Die Party ist lustig.'),
  fill('ch-y4', 'Cit', '', 'y', ['y', 'i'], 'City', 'y-laute', 'City oder Citi?', Y_RULE,
    ['Das y am Ende klingt wie i.', 'Die City liegt im Zentrum.'], 'In der City ist viel los.'),
  mistake('ch-y5', 'Tüp', 'Typ', 'y-laute', 'Was für ein … ist er?', Y_RULE,
    ['Hier klingt das y wie ü: Typ.', 'Sprich das Wort deutlich: Typ.'], 'Er ist ein lustiger Typ.'),
  mistake('ch-y6', 'Züklus', 'Zyklus', 'y-laute', 'Der … wiederholt sich.', Y_RULE,
    ['Zyklus wird mit y geschrieben.', 'Das y klingt hier wie ü.'], 'Der Zyklus wiederholt sich.'),
  mistake('ch-y7', 'Sümbol', 'Symbol', 'y-laute', 'Ein Herz ist ein …', Y_RULE,
    ['Symbol hat ein y.', 'Das y klingt wie ü.'], 'Die Flagge ist ein Symbol.'),
  mistake('ch-y8', 'Hümne', 'Hymne', 'y-laute', 'Die … wird gesungen.', Y_RULE,
    ['Hymne wird mit y geschrieben.', 'Das y klingt wie ü.'], 'Die Hymne wird gesungen.'),
  mistake('ch-y9', 'Joga', 'Yoga', 'y-laute', 'Wir machen …', Y_RULE,
    ['Am Anfang klingt y wie j: Yoga.', 'Yoga beginnt mit y.'], 'Wir machen Yoga.'),
  mistake('ch-y10', 'Jeti', 'Yeti', 'y-laute', 'Im Schnee wohnt der …', Y_RULE,
    ['Yeti beginnt mit y.', 'Das y klingt hier wie j.'], 'Der Yeti wohnt im Schnee.'),

  // Wortfamilien mit pf und qu
  mistake('ch-p1', 'Ferd', 'Pferd', 'pf-qu', 'Was läuft auf vier Beinen?', PF_QU_RULE,
    ['Ein Pferd beginnt mit pf.', 'Pferd → Pferde: das pf bleibt.'], 'Das Pferd läuft auf dem Feld.'),
  mistake('ch-p2', 'Flanze', 'Pflanze', 'pf-qu', 'Was wächst im Garten?', PF_QU_RULE,
    ['pflanzen → Pflanze: das pf bleibt.', 'Sprich das Wort deutlich: Pflanze.'], 'Die Pflanze wächst.'),
  mistake('ch-p3', 'Flege', 'Pflege', 'pf-qu', 'Wer kümmert sich um Kranke? Die …', PF_QU_RULE,
    ['pflegen → Pflege.', 'Pflege beginnt mit pf.'], 'Die Pflege ist wichtig.'),
  derive('ch-p4', 'pflügen', 'Pflug', 'pf-qu', 'Wie heißt die Grundform von pflügen?', PF_QU_RULE,
    ['pflügen → Pflug: das pf bleibt.', 'Denk an den Pflug auf dem Feld.'], 'Der Pflug liegt auf dem Feld.'),
  derive('ch-p5', 'pflastern', 'Pflaster', 'pf-qu', 'Was legst du auf den Weg? Das …', PF_QU_RULE,
    ['pflastern → Pflaster: das pf bleibt.', 'Das Pflaster liegt auf der Straße.'], 'Das Pflaster ist neu.'),
  mistake('ch-q1', 'Kuelle', 'Quelle', 'pf-qu', 'Wo kommt das Wasser her? Aus der …', PF_QU_RULE,
    ['quellen → Quelle: das qu bleibt.', 'Das q steht direkt vor u.'], 'Die Quelle sprudelt.'),
  mistake('ch-q2', 'Kittung', 'Quittung', 'pf-qu', 'Was bekommst du beim Bezahlen? Die …', PF_QU_RULE,
    ['quittieren → Quittung.', 'Quittung beginnt mit qu.'], 'Ich hebe die Quittung auf.'),
  mistake('ch-q3', 'Kualität', 'Qualität', 'pf-qu', 'Wie gut ist etwas? Die …', PF_QU_RULE,
    ['Qualität beginnt mit qu.', 'Das q steht vor u.'], 'Die Qualität ist hoch.'),
  mistake('ch-q4', 'Kuartal', 'Quartal', 'pf-qu', 'Ein Viertel Jahr ist ein …', PF_QU_RULE,
    ['Quartal beginnt mit qu.', 'Das q steht direkt vor u.'], 'Das Quartal endet heute.'),
  fill('ch-q5', '', 'ell', 'Qu', ['Qu', 'Ku', 'Quu'], 'Quell', 'pf-qu', 'Quell oder Kuell?', PF_QU_RULE,
    ['Das q steht vor u.', 'Quell beginnt mit qu.'], 'Das Quellwasser ist kalt.'),

  // Lernwörter mit -dt
  mistake('ch-d1', 'Stat', 'Stadt', 'dt', 'Wo wohnst du? In der …', DT_RULE,
    ['Stadt endet auf dt.', 'Stadt → Städte: das d bleibt sichtbar.'], 'Die Stadt ist groß.'),
  mistake('ch-d2', 'Magt', 'Magd', 'dt', 'Früher arbeitete die … auf dem Hof.', DT_RULE,
    ['Magd endet auf dt.', 'Magd → Mägde: das d bleibt.'], 'Die Magd molk die Kuh.'),
  mistake('ch-d3', 'sante', 'sandte', 'dt', 'Ich … dir einen Brief.', DT_RULE,
    ['senden → sandte: das d bleibt.', 'Du hörst ein t, schreibst aber dt.'], 'Ich sandte einen Brief.'),
  mistake('ch-d4', 'wante', 'wandte', 'dt', 'Er … sich um.', DT_RULE,
    ['wenden → wandte.', 'Hier steht dt, obwohl man ein t hört.'], 'Er wandte sich um.'),
  mistake('ch-d5', 'verwant', 'verwandt', 'dt', 'Sie sind miteinander …', DT_RULE,
    ['verwandt endet auf dt.', 'Denk an die Verwandten – mit d vor t.'], 'Wir sind verwandt.'),
  derive('ch-d6', 'senden', 'sandte', 'dt', 'Wie heißt die vergangene Form von senden?', DT_RULE,
    ['senden → sandte.', 'Das d bleibt, auch wenn man es nicht hört.'], 'Ich sandte das Paket ab.'),
  derive('ch-d7', 'wenden', 'wandte', 'dt', 'Wie heißt die vergangene Form von wenden?', DT_RULE,
    ['wenden → wandte.', 'Schreib dt, auch wenn es wie t klingt.'], 'Er wandte den Blick ab.'),
  memorize('ch-d8', 'Stadt', 'dt', 'Sieh dir das Wort an, dann schreibst du es aus dem Kopf.', DT_RULE,
    ['Stadt endet auf dt.', 'Denk an die Städte – das d bleibt.'], 'In der Stadt wohnen viele Menschen.'),
];

for (const challenge of extraChallenges) {
  challenges.push(challenge);
  challengeWords.push({
    id: challenge.id,
    word: challenge.word,
    ruleId: challenge.ruleId,
    level: 1,
    hint: challenge.hints[0] ?? challenge.ruleText,
    sentence: challenge.sentence,
    challenge: true,
  });
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
