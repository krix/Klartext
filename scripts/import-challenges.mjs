/**
 * Importiert die neun Übungsformen aus dem Referenz-Prototyp alternate-vanilla/
 * in die Daten der aktiven TypeScript-App.
 *
 * Der Prototyp bleibt unverändert; dieses Skript erzeugt nur
 * src/data/challenges.json sowie zusätzliche Einträge in words.json und rules.json.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { TASKS } from '../alternate-vanilla/data.js';
import { pdfSections } from './pdf-sections.mjs';

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
// Wörter aus früheren PDF-Importläufen werden unten komplett neu erzeugt.
const words = readJson('src/data/words.json').filter((word) => !word.id.startsWith('pdf-'));
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
    tip: 'Such in der Wortfamilie ein Wort mit a: Baum → Bäume, Garten → Gärten, kalt → Kälte. Gibt es eins, schreib ä. Sonst bleibt meist das e: Held, Erde, Nest.',
    caseSensitive: false,
    area: 'verwechslung',
    summary: 'Ähnlich klingendes e und ä sicher unterscheiden.',
    goal: 'Du lernst, mit einem verwandten Wort mit a zu prüfen, ob ä oder e richtig ist.',
    rules: [
      'Ä entsteht oft aus einem a: Baum → Bäume, Garten → Gärten, kalt → Kälte.',
      'Findest du kein verwandtes Wort mit a, bleibt meist das e: Held, Erde, Nest.',
      'Sprich das Wort und die verwandte Form langsam mit – dann hörst du den Unterschied.',
    ],
    examples: [
      { word: 'Bäume', note: 'Baum → Bäume: aus a wird ä.' },
      { word: 'Gärten', note: 'Garten → Gärten: das a wird zu ä.' },
      { word: 'Erde', note: 'Kein verwandtes Wort mit a – deshalb e.' },
    ],
  },
  {
    id: 'f-oder-v',
    title: 'f oder v?',
    tip: 'Deutsche Wörter mit dem harten f-Laut schreibt man meist mit f: Fisch, Feuer, Fahrrad. Ein paar häufige deutsche Wörter beginnen mit v: Vogel, Vater, viel, von, vor, voll.',
    caseSensitive: false,
    area: 'verwechslung',
    summary: 'Den harten f-Laut als f oder v schreiben.',
    goal: 'Du lernst die deutschen Wörter mit v und die Fremdwörter, in denen v wie w klingt.',
    rules: [
      'In deutschen Wörtern steht für den harten f-Laut meist f: Fisch, Feuer, Fahrrad.',
      'Häufige deutsche Wörter mit v merkst du dir: Vogel, Vater, viel, von, vor, voll.',
      'In Fremdwörtern wie Vase, Video oder Ventil klingt v eher wie w – hier hilft nur Merken.',
    ],
    examples: [
      { word: 'Fahrrad', note: 'Deutsches Wort mit hartem f-Laut.' },
      { word: 'Vogel', note: 'Häufiges deutsches Wort mit v am Anfang.' },
      { word: 'Vase', note: 'Fremdwort: das v klingt wie w.' },
    ],
  },
  {
    id: 'ks-laute',
    title: 'Der ks-Laut: cks, gs, chs, x, ks, ex-',
    tip: 'Der ks-Laut hat viele Gesichter: Wachs und Fuchs mit chs, Keks mit ks, Klecks mit cks, Hexe mit x, flugs mit gs. Denk an die Grundform: Scheck → Schecks.',
    caseSensitive: false,
    area: 'verwechslung',
    summary: 'Die sechs Schreibweisen des ks-Lautes sicher unterscheiden.',
    goal: 'Du lernst, bei einem ks-Laut auf die Grundform und auf Fremdwörter zu achten.',
    rules: [
      'Wachs, sechs und Fuchs schreibt man mit chs.',
      'Aus Flug wird flugs, aus Tag wird Tags: das g der Grundform bleibt sichtbar.',
      'Endet die Grundform auf ck, entsteht cks: Klecks, Scheck → Schecks, Block → Blocks.',
      'Hexe, Box und Taxi haben x; Keks und links haben ks; Extra und Export beginnen mit ex-.',
    ],
    examples: [
      { word: 'Wachs', note: 'chs – denk an wachsen.' },
      { word: 'Klecks', note: 'cks – wie Schecks.' },
      { word: 'flugs', note: 'gs – denk an Flug.' },
    ],
  },
  {
    id: 'y-laute',
    title: 'y – wie i, ü oder j?',
    tip: 'Wörter mit y sind meist Fremd- und Lehnwörter: Baby, Handy, Hobby, Gymnastik, Pyramide. Das y klingt mal wie i, mal wie ü, am Anfang auch wie j.',
    caseSensitive: false,
    area: 'verwechslung',
    summary: 'Die drei Aussprachen des y sicher zuordnen.',
    goal: 'Du lernst, das y trotz unterschiedlicher Aussprache immer als y zu schreiben.',
    rules: [
      'Viele Wörter mit y kommen aus anderen Sprachen: Baby, Handy, Hobby, Gymnastik, Pyramide.',
      'Am Ende von Baby, Handy, Hobby, Party und City klingt das y wie i.',
      'In Gymnastik, Pyramide, Typ und Symbol klingt das y wie ü; am Anfang von Yoga und Yeti wie j.',
    ],
    examples: [
      { word: 'Handy', note: 'Lehnwort, y am Ende klingt wie i.' },
      { word: 'Pyramide', note: 'Fremdwort, y klingt wie ü.' },
      { word: 'Yoga', note: 'y am Anfang klingt wie j.' },
    ],
  },
  {
    id: 'pf-mpf',
    title: 'Wörter mit pf und mpf',
    tip: 'Der pf-Laut steht am Anfang (Pferd), mitten im Wort (Apfel, Kopf) oder nach m (Strumpf, Kampf, Dampf). In der Wortfamilie bleibt er erhalten.',
    caseSensitive: false,
    area: 'verwechslung',
    summary: 'pf und mpf in allen Positionen sicher schreiben.',
    goal: 'Du lernst pf und mpf auch dort zu erkennen, wo man nur ein f hört.',
    rules: [
      'Am Anfang vieler Wörter steht pf: Pferd, Pflanze, Pflege.',
      'Mitten im Wort kommt pf vor: Apfel, Kopf, Schnupfen.',
      'Nach einem m schreibst du mpf: Strumpf, Kampf, Dampf – im Plural Strümpfe, Kämpfe, Dämpfe.',
    ],
    examples: [
      { word: 'Pferd', note: 'pf am Anfang; in Pferden bleibt er.' },
      { word: 'Apfel', note: 'pf mitten im Wort.' },
      { word: 'Strumpf', note: 'mpf – im Plural Strümpfe.' },
    ],
  },
  {
    id: 'qu',
    title: 'Wörter mit qu',
    tip: 'Das q steht im Deutschen fast immer direkt vor u: Quelle, Qualle, Quark, quaken, bequem, Quatsch. Sprich das qu deutlich mit.',
    caseSensitive: false,
    area: 'verwechslung',
    summary: 'qu als festen Buchstabenpaar erkennen und schreiben.',
    goal: 'Du lernst Wörter mit qu sicher von gleich klingenden Formen mit k oder kw zu trennen.',
    rules: [
      'Das q steht fast immer unmittelbar vor u: Quelle, Qualle, Quark.',
      'Auch in der Mitte bleibt das qu zusammen: bequem, quaken.',
      'Denk an die Wortfamilie: quellen → Quelle, quaken → Quaken.',
    ],
    examples: [
      { word: 'Quelle', note: 'quellen → Quelle.' },
      { word: 'Qualle', note: 'q steht direkt vor u.' },
      { word: 'bequem', note: 'qu bleibt auch in der Mitte.' },
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
  {
    id: 'homophone',
    title: 'Gleich klingend, anders geschrieben',
    tip: 'Meer oder mehr? Wal oder Wahl? Solche Wörter klingen gleich, haben aber verschiedene Bedeutungen. Lies vor und nach der Lücke und setze beide probehalber ein.',
    caseSensitive: false,
    area: 'verwechslung',
    summary: 'Homophone über die Bedeutung im Satz unterscheiden.',
    goal: 'Du lernst, bei gleich klingenden Wörtern auf den Sinn des Satzes zu achten.',
    rules: [
      'Lies den ganzen Satz, bevor du dich für eine Schreibweise entscheidest.',
      'Setze beide Möglichkeiten probehalber ein: Nur eine ergibt einen Sinn.',
      'Diese Paare merkst du dir gemeinsam: Meer/mehr, Wal/Wahl, Lied/Lid, Seite/Saite, Mal/Mahl.',
    ],
    examples: [
      { word: 'Meer', note: 'Das Wasser – nicht „mehr“.' },
      { word: 'Wahl', note: 'Eine Entscheidung – nicht das Tier Wal.' },
      { word: 'Saite', note: 'Sie klingt – nicht die Seite.' },
    ],
  },
];

// Themen aus „Loesungen.pdf“, die in der App noch fehlten. Die Nummern im Kommentar
// verweisen auf die Kapitel des Lehrwerks; die Übungen selbst stehen weiter unten.
const pdfRules = [
  {
    id: 'tz-ck',
    title: 'tz oder ck?',
    tip: 'Nach einem kurzen Vokal schreibst du tz oder ck: Katze, Ecke, Decke. Sprich das Wort langsam – der Vokal davor bleibt kurz.',
    caseSensitive: false,
    area: 'laenge',
    summary: 'tz und ck nach kurzem Vokal sicher unterscheiden.',
    goal: 'Du lernst, warum man Katze mit tz und Ecke mit ck schreibt.',
    rules: [
      'Nach kurzem Vokal steht tz statt tt: Katze, Matze, spitze.',
      'Nach kurzem Vokal steht ck statt kk: Ecke, Decke, backen.',
      'Sprich das Wort und achte darauf, dass der Vokal davor kurz bleibt.',
    ],
    examples: [
      { word: 'Katze', note: 'Kurz gesprochen – deshalb tz.' },
      { word: 'Ecke', note: 'Kurz gesprochen – deshalb ck.' },
      { word: 'Decke', note: 'Deck-e: das ck bleibt.' },
    ],
  },
  {
    id: 'verben-endungen',
    title: 'Verben: Stamm und Endung',
    tip: 'Such zuerst den Wortstamm und häng die Endung an: mach-en, mach-st, mach-t. Der Stamm bleibt in allen Formen gleich.',
    caseSensitive: false,
    area: 'laenge',
    summary: 'Verbformen aus Stamm und Endung zusammensetzen.',
    goal: 'Du lernst, Verben in Stamm und Endung zu zerlegen und richtig zu schreiben.',
    rules: [
      'Der Stamm bleibt erhalten: mach-en, mach-st, mach-t.',
      'Die Endungen -en, -st und -t hängen direkt an den Stamm.',
      'In der 2. Person Singular steht -st: du machst, du gehst.',
    ],
    examples: [
      { word: 'machen', note: 'Stamm mach + Endung en.' },
      { word: 'machst', note: 'Stamm mach + Endung st.' },
      { word: 'macht', note: 'Stamm mach + Endung t.' },
    ],
  },
  {
    id: 'dehnungs-h-ausnahmen',
    title: 'Ausnahmen beim stummen h',
    tip: 'Nicht jedes lang gesprochene Wort bekommt ein stummes h: holen, hören, malen bleiben ohne h. Merk dir diese Wortfamilien.',
    caseSensitive: false,
    area: 'laenge',
    summary: 'Typische Wörter ohne stummes h kennen.',
    goal: 'Du lernst, wann das stumme h verboten ist und wie du Ausnahmen erkennst.',
    rules: [
      'holen, hören und malen stehen ohne stummes h.',
      'Englische Verwandte helfen: die Mutter, die Feder – ohne h.',
      'Prüfe die Wortfamilie, bevor du ein h einsetzt.',
    ],
    examples: [
      { word: 'holen', note: 'Kein stummes h.' },
      { word: 'hören', note: 'Lange Aussprache, aber ohne h.' },
      { word: 'malen', note: 'Gehört zu den Ausnahmen.' },
    ],
  },
  {
    id: 'ie-fremdwoerter',
    title: 'Kein ie in Fremdwörtern',
    tip: 'Das lange i steht in deutschen Wörtern meist als ie. Fremdwörter behalten ein einfaches i: Kino, Zitrone, Musik.',
    caseSensitive: false,
    area: 'laute',
    summary: 'deutsche ie-Wörter von Fremdwörtern trennen.',
    goal: 'Du lernst, auch in Fremdwörtern das lange i richtig zu schreiben.',
    rules: [
      'Deutsche Wörter mit langem i: Liebe, Biene, Ziel – mit ie.',
      'Fremdwörter behalten oft ein einfaches i: Kino, Zitrone, Detail.',
      'Die Endung -ie bleibt in Fremdwörtern: Energie, Fantasie.',
    ],
    examples: [
      { word: 'Kino', note: 'Fremdwort mit einfachem i.' },
      { word: 'Zitrone', note: 'Das i bleibt einfach.' },
      { word: 'Energie', note: 'Fremde Endung -ie.' },
    ],
  },
  {
    id: 'doppelvokale',
    title: 'Doppelvokale',
    tip: 'Manche Wörter schreibt man mit zwei gleichen Vokalen: Aal, Seele, Moore. Sprich das Wort deutlich und merk dir die Doppelung.',
    caseSensitive: false,
    area: 'laenge',
    summary: 'Wörter mit zwei gleichen Vokalen erkennen.',
    goal: 'Du lernst Doppelvokale von langen Vokalen mit h oder einfachem Vokal zu trennen.',
    rules: [
      'Doppelvokale kommen oft in alten deutschen Wörtern vor: Aal, Seele, Tier.',
      'Bei a, e, o und u können zwei gleiche Vokale stehen.',
      'Vergleiche verwandte Formen: Seele → Seelen.',
    ],
    examples: [
      { word: 'Aal', note: 'Zwei a.' },
      { word: 'Seele', note: 'Zwei e.' },
      { word: 'Moore', note: 'Zwei o.' },
    ],
  },
  {
    id: 'trennungs-h',
    title: 'Das Trennungs-h',
    tip: 'Zwischen zwei Vokalen steht manchmal ein h, damit die Silben getrennt bleiben: Ge-hör, A-horn, Uhr.',
    caseSensitive: false,
    area: 'laenge',
    summary: 'das h zwischen Vokalen als Silbengrenze verstehen.',
    goal: 'Du lernst das Trennungs-h von Dehnungs-h und einfachen Vokalen zu unterscheiden.',
    rules: [
      'Das h zwischen Vokalen trennt die Silben: Ge-hör, A-horn.',
      'Es steht oft nach e, a oder u: Gehör, Ahorn, Uhr.',
      'Lernwörter mit Trennungs-h merkst du dir gemeinsam.',
    ],
    examples: [
      { word: 'Gehör', note: 'Ge-hör mit Trennungs-h.' },
      { word: 'Ahorn', note: 'A-horn mit Trennungs-h.' },
      { word: 'Uhr', note: 'Uhr mit h nach u.' },
    ],
  },
  {
    id: 'verben-h',
    title: 'Verben mit oder ohne h',
    tip: 'gehen, sehen und geschehen behalten das h in vielen Formen: gehe, gehst, sehe. Hör nicht nur zu – schau auf die Grundform.',
    caseSensitive: false,
    area: 'wortbau',
    summary: 'Verbformen mit und ohne h sicher bilden.',
    goal: 'Du lernst bei Verben zu prüfen, ob eine Form ein h braucht.',
    rules: [
      'gehen, sehen und geschehen behalten in vielen Formen ein h.',
      'Das h hörst du nicht immer – die Grundform hilft.',
      'Sprich die Formen langsam mit: gehe, gehst, geht.',
    ],
    examples: [
      { word: 'gehe', note: 'gehen → gehe.' },
      { word: 'sehe', note: 'sehen → sehe.' },
      { word: 'geschehen', note: 'Mit h in der Grundform.' },
    ],
  },
  {
    id: 'verben-s-z',
    title: 'Verben mit s-Laut oder z',
    tip: 'Verben auf -sen und -zen behalten ihren Laut in allen Formen: reisen → reise, sitzen → sitze.',
    caseSensitive: false,
    area: 'laenge',
    summary: 'Verbendungen auf -sen und -zen schreiben.',
    goal: 'Du lernst, den Stamm von Verben auf -sen und -zen zu erhalten.',
    rules: [
      'Die Endung -sen bleibt: reisen, reise, reist.',
      'Die Endung -zen bleibt: sitzen, sitze, sitzt.',
      'In der 2. Person Singular steht -st: du reist, du sitzt.',
    ],
    examples: [
      { word: 'reise', note: 'reisen → reise.' },
      { word: 'reist', note: 'reisen → du reist.' },
      { word: 'sitze', note: 'sitzen → sitze.' },
    ],
  },
  {
    id: 'fremd-endung-ie',
    title: 'Fremde Endungen mit -ie',
    tip: 'Viele Fremdwörter enden auf -ie: Energie, Fantasie, Demokratie. Die Endung bleibt auch in der Mehrzahl erhalten.',
    caseSensitive: false,
    area: 'wortbau',
    summary: 'Fremde Endungen auf -ie erkennen.',
    goal: 'Du lernst, die Endung -ie in Fremdwörtern sicher zu schreiben.',
    rules: [
      'Fremdwörter enden oft auf -ie: Energie, Fantasie, Demokratie.',
      'Die Endung bleibt unverändert: die Energien.',
      'Sprich die letzte Silbe deutlich: -ie.',
    ],
    examples: [
      { word: 'Energie', note: 'Endet auf -ie.' },
      { word: 'Fantasie', note: 'Endet auf -ie.' },
      { word: 'Demokratie', note: 'Endet auf -ie.' },
    ],
  },
  {
    id: 'wortstamm-familien',
    title: 'Wortstämme und Wortfamilien',
    tip: 'In einer Wortfamilie bleibt der Stamm erkennbar, auch wenn er sich ändert: Haus → Häuser, lesen → liest.',
    caseSensitive: false,
    area: 'wortbau',
    summary: 'verwandte Wörter über ihren Stamm finden.',
    goal: 'Du lernst, aus einem bekannten Familienwort die Schreibung abzuleiten.',
    rules: [
      'Such zuerst die Grundform der Wortfamilie.',
      'Auch wenn der Stamm sich ändert, bleibt er verwandt: Haus → Häuser.',
      'Markier die schwierige Stelle mit einem Silbenbogen.',
    ],
    examples: [
      { word: 'Häuser', note: 'Haus → Häuser.' },
      { word: 'liest', note: 'lesen → liest.' },
      { word: 'schrieb', note: 'schreiben → schrieb.' },
    ],
  },
  {
    id: 'hin-her-da',
    title: 'hin-, her- und da(r)-',
    tip: 'hin- heißt weg von hier, her- heißt zu mir, da(r)- heißt dort. Die Vorsilbe bleibt in jedem Wort erhalten.',
    caseSensitive: false,
    area: 'wortbau',
    summary: 'die Vorsilben hin, her und da(r) zuordnen.',
    goal: 'Du lernst, die Richtung einer Bewegung aus der Vorsilbe abzulesen.',
    rules: [
      'hin- bedeutet Bewegung weg: hingehen.',
      'her- bedeutet Bewegung zu mir: herkommen.',
      'da- oder dar- heißt dort: dabei, daraus.',
    ],
    examples: [
      { word: 'hingehen', note: 'Bewegung weg.' },
      { word: 'herkommen', note: 'Bewegung zu mir.' },
      { word: 'daraus', note: 'dort heraus.' },
    ],
  },
  {
    id: 'ver-fer-vor-for',
    title: 'ver-, fer-, vor- oder for-?',
    tip: 'ver- ist häufig (verkaufen), fer- kommt in wenigen Wörtern vor (fern, Fernglas). vor- heißt vorher; for- gibt es im Deutschen kaum.',
    caseSensitive: false,
    area: 'wortbau',
    summary: 'die vier ähnlichen Vorsilben unterscheiden.',
    goal: 'Du lernst, die passende Vorsilbe über die Bedeutung zu wählen.',
    rules: [
      'ver- heißt oft verändert oder weg: verkaufen, verlieren.',
      'fer- steht in fern, Ferne, Fernglas.',
      'vor- heißt vorher oder davor: vorstellen, vorher.',
    ],
    examples: [
      { word: 'verkaufen', note: 'ver- mit veränderter Bedeutung.' },
      { word: 'Fernglas', note: 'fer- wie fern.' },
      { word: 'vorstellen', note: 'vor- wie vorher.' },
    ],
  },
  {
    id: 'end-ent',
    title: 'end- oder ent-?',
    tip: 'ent- heißt oft los oder weg: entdecken, entfernen. end- gehört zu Ende: endlich, Endung.',
    caseSensitive: false,
    area: 'wortbau',
    summary: 'end- und ent- über die Bedeutung trennen.',
    goal: 'Du lernst, die Vorsilbe mit einem verwandten Wort zu prüfen.',
    rules: [
      'ent- bedeutet los, weg oder beginnen: entdecken, entscheiden.',
      'end- hängt mit Ende zusammen: endlich, Endung.',
      'Setze ein verwandtes Wort probehalber ein.',
    ],
    examples: [
      { word: 'entdecken', note: 'ent- mit los/weg.' },
      { word: 'entfernen', note: 'ent- mit weg.' },
      { word: 'endlich', note: 'end- wie Ende.' },
    ],
  },
  {
    id: 'fugen',
    title: 'Fugen in Zusammensetzungen',
    tip: 'Zusammengesetzte Wörter behalten oft ein -s- oder -en- in der Fuge: Straßenbahn, Arbeitsblatt, Kirschtorte.',
    caseSensitive: false,
    area: 'wortbau',
    summary: 'die Fuge zwischen zwei Wortteilen sichtbar machen.',
    goal: 'Du lernst, die beiden Teile eines Kompositums zu erkennen.',
    rules: [
      'Zusammengesetzte Wörter behalten oft s oder en in der Fuge.',
      'Straßenbahn, Arbeitsblatt, Kirschtorte – die Fuge verbindet die Teile.',
      'Sprich die beiden Teile einzeln und dann zusammen.',
    ],
    examples: [
      { word: 'Straßenbahn', note: 'Straße + n + Bahn.' },
      { word: 'Arbeitsblatt', note: 'Arbeit + s + Blatt.' },
      { word: 'Kirschtorte', note: 'Kirsche + Torte.' },
    ],
  },
  {
    id: 'endung-in',
    title: 'Die Endung -in für Frauen',
    tip: 'Aus einem Berufswort wird die weibliche Form mit -in: Lehrer → Lehrerin, Arzt → Ärztin. Der Stamm bleibt erhalten.',
    caseSensitive: false,
    area: 'wortbau',
    summary: 'weibliche Formen mit -in bilden.',
    goal: 'Du lernst, Berufsbezeichnungen über den Stamm in die weibliche Form zu übertragen.',
    rules: [
      'Die Endung -in macht aus Männer- Frauenwörter: Lehrerin.',
      'Vor dem -in bleibt der Stamm: Ärztin, Malerin.',
      'Bei -er entfällt oft das e: Lehrer → Lehrerin.',
    ],
    examples: [
      { word: 'Lehrerin', note: 'Lehrer → Lehrerin.' },
      { word: 'Ärztin', note: 'Arzt → Ärztin.' },
      { word: 'Malerin', note: 'Maler → Malerin.' },
    ],
  },
  {
    id: 'konsonanten',
    title: 'Verschiedene Konsonanten nach kurzem Vokal',
    tip: 'Nach einem kurzen Vokal stehen oft zwei verschiedene Mitlaute: Hund, Tulpe, Wespe. Sprich den Vokal kurz und hör auf die Laute danach.',
    caseSensitive: false,
    area: 'laenge',
    summary: 'Konsonantenverbindungen nach kurzem Vokal schreiben.',
    goal: 'Du lernst, auf die Mitlaute nach einem kurzen Selbstlaut zu achten.',
    rules: [
      'Nach kurzem Vokal folgen oft zwei verschiedene Konsonanten: Hund, Fink, Wespe.',
      'Sprich das Wort langsam: nach dem kurzen Laut kommen zwei Mitlaute.',
      'Denk an ein verwandtes Wort, wenn du dir bei einem Laut unsicher bist.',
    ],
    examples: [
      { word: 'Hund', note: 'Kurzes u, dann nd.' },
      { word: 'Tulpe', note: 'Kurzes u, dann lp.' },
      { word: 'Wespe', note: 'Kurzes e, dann sp.' },
    ],
  },
  {
    id: 'adjektive-kurzvokal',
    title: 'Adjektive mit kurzem Vokal',
    tip: 'Bei Adjektiven mit kurzem Vokal wird der letzte Mitlaut verdoppelt: dumm → dümmer → dümmsten.',
    caseSensitive: false,
    area: 'laenge',
    summary: 'Steigerungsformen mit kurzem Vokal schreiben.',
    goal: 'Du lernst, warum sich die Schreibung bei dumm → dümmer ändert.',
    rules: [
      'dumm → dümmer → am dümmsten: der Vokal bleibt kurz.',
      'dünn → dünner → am dünnsten, dick → dicker → am dicksten.',
      'Sprich die Formen nacheinander und achte auf die Doppelung.',
    ],
    examples: [
      { word: 'dumm', note: 'Kurzes u – einfach.' },
      { word: 'dümmer', note: 'Kurz gesprochen – mm.' },
      { word: 'dünnster', note: 'Kurz gesprochen – nn.' },
    ],
  },
  {
    id: 'verben-langvokal',
    title: 'Verben mit langem Vokal',
    tip: 'Bei Verben mit langem Vokal bleibt der Mitlaut einfach: graben → gräbst, wagen → wagt. Der Vokal davor ist lang.',
    caseSensitive: false,
    area: 'laenge',
    summary: 'Verbformen mit langem Vokal sicher schreiben.',
    goal: 'Du lernst, einen langen Vokal in allen Verbformen zu erkennen.',
    rules: [
      'graben → gräbst: der Vokal ist lang, der Mitlaut bleibt einfach.',
      'wagen → wagt, klagen → klagt, flöten → flötet.',
      'Sprich die Formen langsam und vergleiche die Vokallänge.',
    ],
    examples: [
      { word: 'graben', note: 'Lang gesprochen – ein b.' },
      { word: 'gräbst', note: 'graben → gräbst.' },
      { word: 'wagen', note: 'Lang gesprochen – ein g.' },
    ],
  },
  {
    id: 'adjektive-langvokal',
    title: 'Adjektive mit langem Vokal',
    tip: 'Bei langem Vokal bleibt der Mitlaut einfach: müde → müder, klug → klüger. Sprich den Vokal deutlich lang.',
    caseSensitive: false,
    area: 'laenge',
    summary: 'Steigerungsformen mit langem Vokal schreiben.',
    goal: 'Du lernst, lange Vokale in Adjektiven von kurzen zu unterscheiden.',
    rules: [
      'müde → müder → am müdesten: der Vokal bleibt lang.',
      'klug → klüger → am klügsten, schwer → schwerer.',
      'Nach langem Vokal steht kein doppelter Mitlaut.',
    ],
    examples: [
      { word: 'müde', note: 'Lang gesprochen.' },
      { word: 'klüger', note: 'klug → klüger.' },
      { word: 'schwerer', note: 'schwer → schwerer.' },
    ],
  },
  {
    id: 'diphthong',
    title: 'Doppellaute: ei, ai, au, äu, eu',
    tip: 'In Doppellauten klingen zwei Laute in einer Silbe: ei, au, eu, äu. ai ist selten: Mai, Laie, Kaiser.',
    caseSensitive: false,
    area: 'laute',
    summary: 'Die Doppellaute ei, ai, au, äu und eu erkennen.',
    goal: 'Du lernst, zwei Laute in einer Silbe als Doppellaut zu hören.',
    rules: [
      'Doppellaute verbinden zwei Laute in einer Silbe: ei, au, eu, äu.',
      'Fast immer schreibt man ei – ai nur in Mai, Laie, Kaiser und ähnlichen Wörtern.',
      'Sprich die Silbe langsam und achte auf den zweiten Laut.',
    ],
    examples: [
      { word: 'Mais', note: 'ai bleibt in diesem Wort.' },
      { word: 'Laich', note: 'ai wie in Laie.' },
      { word: 'Kaiser', note: 'ai bleibt vor s.' },
    ],
  },
];

extraRules.push(...pdfRules);

const challengeWords = [];

function targetFor(task) {
  if (task.syllables) return task.syllables.join('');
  if (task.type === 'error') return task.answer;
  // Bei Bausteinen ist die Antwort nur die Vorsilbe („ver-“). Geübt wird das
  // ganze Wort, das im Prototyp als Note steht („vergessen“).
  if (task.type === 'parts') return plain(task.note ?? '');
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

const E_AE_RULE = 'Such in der Wortfamilie ein Wort mit a: Baum → Bäume, Garten → Gärten, kalt → Kälte. Gibt es eins, schreib ä. Sonst bleibt meist das e: Held, Erde, Nest.';
const F_V_RULE = 'Deutsche Wörter mit dem harten f-Laut schreibt man meist mit f: Fisch, Feuer, Fahrrad. Ein paar häufige deutsche Wörter beginnen mit v: Vogel, Vater, viel, von, vor, voll. In Fremdwörtern wie Vase oder Video klingt v wie w.';
const KS_RULE = 'Der ks-Laut hat viele Gesichter: Wachs und Fuchs mit chs, Keks mit ks, Klecks mit cks, Hexe mit x, flugs mit gs. Denk an die Grundform: Scheck → Schecks.';
const Y_RULE = 'Wörter mit y sind meist Fremd- und Lehnwörter: Baby, Handy, Hobby, Gymnastik, Pyramide. Das y klingt mal wie i, mal wie ü, am Anfang auch wie j.';
const PF_MPF_RULE = 'Der pf-Laut steht am Anfang (Pferd), mitten im Wort (Apfel, Kopf) oder nach m (Strumpf, Kampf, Dampf). In der Wortfamilie bleibt er erhalten.';
const QU_RULE = 'Das q steht im Deutschen fast immer direkt vor u: Quelle, Qualle, Quark, quaken, bequem, Quatsch. Sprich das qu deutlich mit.';
const HOMO_RULE = 'Meer oder mehr? Wal oder Wahl? Solche Wörter klingen gleich, haben aber verschiedene Bedeutungen. Lies vor und nach der Lücke und setze beide probehalber ein.';
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
  mistake('ch-v11', 'Veuer', 'Feuer', 'f-oder-v', 'Was wärmt dich im Winter? Das …', F_V_RULE,
    ['Feuer ist ein deutsches Wort mit f.', 'Das Feuer brennt – mit f.'], 'Das Feuer brennt im Ofen.'),
  mistake('ch-v12', 'Vahrrad', 'Fahrrad', 'f-oder-v', 'Womit fährst du zur Schule? Mit dem …', F_V_RULE,
    ['Fahrrad beginnt mit f.', 'Das Fahrrad hat zwei Räder – mit f.'], 'Ich fahre mit dem Fahrrad.'),

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
  mistake('ch-k13', 'Waks', 'Wachs', 'ks-laute', 'Womit polierst du den Boden? Mit …', KS_RULE,
    ['wachsen → Wachs: das chs bleibt.', 'Wachs wird mit chs geschrieben.'], 'Ich poliere mit Wachs.'),
  mistake('ch-k14', 'Kleks', 'Klecks', 'ks-laute', 'Ein … Tinte auf dem Papier.', KS_RULE,
    ['Klecks endet auf cks.', 'Denk an Schecks – beide enden auf cks.'], 'Ein Klecks Tinte liegt auf dem Papier.'),
  mistake('ch-k15', 'fluk', 'flugs', 'ks-laute', 'Er kam … zurück.', KS_RULE,
    ['flugs kommt von Flug: das g bleibt.', 'Das gs hörst du, wenn du flugs sagst.'], 'Er kam flugs zurück.'),

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
  fill('ch-y11', 'Han', '', 'dy', ['dy', 'di'], 'Handy', 'y-laute', 'Handy oder Handi?', Y_RULE,
    ['Das y am Ende klingt wie i.', 'Handy ist ein Lehnwort mit y.'], 'Mein Handy liegt auf dem Tisch.'),
  mistake('ch-y12', 'Gimnastik', 'Gymnastik', 'y-laute', 'Wir treiben …', Y_RULE,
    ['Gymnastik ist ein Fremdwort mit y.', 'Das y klingt hier wie ü.'], 'Wir treiben Gymnastik.'),
  mistake('ch-y13', 'Piramide', 'Pyramide', 'y-laute', 'In Ägypten steht eine …', Y_RULE,
    ['Pyramide ist ein Fremdwort mit y.', 'Das y klingt hier wie ü.'], 'Die Pyramide steht in der Wüste.'),

  // Wörter mit pf und mpf
  mistake('ch-p1', 'Ferd', 'Pferd', 'pf-mpf', 'Was läuft auf vier Beinen?', PF_MPF_RULE,
    ['Ein Pferd beginnt mit pf.', 'Pferd → Pferde: das pf bleibt.'], 'Das Pferd läuft auf dem Feld.'),
  mistake('ch-p2', 'Flanze', 'Pflanze', 'pf-mpf', 'Was wächst im Garten?', PF_MPF_RULE,
    ['pflanzen → Pflanze: das pf bleibt.', 'Sprich das Wort deutlich: Pflanze.'], 'Die Pflanze wächst.'),
  mistake('ch-p3', 'Flege', 'Pflege', 'pf-mpf', 'Wer kümmert sich um Kranke? Die …', PF_MPF_RULE,
    ['pflegen → Pflege.', 'Pflege beginnt mit pf.'], 'Die Pflege ist wichtig.'),
  derive('ch-p4', 'pflügen', 'Pflug', 'pf-mpf', 'Wie heißt die Grundform von pflügen?', PF_MPF_RULE,
    ['pflügen → Pflug: das pf bleibt.', 'Denk an den Pflug auf dem Feld.'], 'Der Pflug liegt auf dem Feld.'),
  derive('ch-p5', 'pflastern', 'Pflaster', 'pf-mpf', 'Was legst du auf den Weg? Das …', PF_MPF_RULE,
    ['pflastern → Pflaster: das pf bleibt.', 'Das Pflaster liegt auf der Straße.'], 'Das Pflaster ist neu.'),
  mistake('ch-p6', 'Afel', 'Apfel', 'pf-mpf', 'Was wächst am Baum? Der …', PF_MPF_RULE,
    ['Apfel hat pf mitten im Wort.', 'Sprich deutlich: Apfel – das pf bleibt.'], 'Der Apfel hängt am Baum.'),
  mistake('ch-p7', 'Kof', 'Kopf', 'pf-mpf', 'Was hast du auf den Schultern? Den …', PF_MPF_RULE,
    ['Kopf → Köpfe: das pf bleibt.', 'Du hörst einen Laut, schreibst aber zwei.'], 'Ich trage eine Mütze auf dem Kopf.'),
  mistake('ch-p8', 'Strumf', 'Strumpf', 'pf-mpf', 'Was ziehst du an die Füße? Den …', PF_MPF_RULE,
    ['Strumpf → Strümpfe: das mpf bleibt.', 'Nach dem m kommen p und f.'], 'Der Strumpf ist warm.'),
  mistake('ch-p9', 'Kamf', 'Kampf', 'pf-mpf', 'Zwei Mannschaften im …', PF_MPF_RULE,
    ['Kampf → Kämpfe: das mpf bleibt.', 'Sprich: Kampf – mit mpf.'], 'Der Kampf war spannend.'),
  mistake('ch-p10', 'Damf', 'Dampf', 'pf-mpf', 'Was steigt aus dem Topf? Der …', PF_MPF_RULE,
    ['Dampf → Dämpfe: das mpf bleibt.', 'Dampf beginnt nicht mit f.'], 'Der Dampf steigt auf.'),

  // Wörter mit qu
  mistake('ch-q1', 'Kuelle', 'Quelle', 'qu', 'Wo kommt das Wasser her? Aus der …', QU_RULE,
    ['quellen → Quelle: das qu bleibt.', 'Das q steht direkt vor u.'], 'Die Quelle sprudelt.'),
  mistake('ch-q2', 'Kittung', 'Quittung', 'qu', 'Was bekommst du beim Bezahlen? Die …', QU_RULE,
    ['quittieren → Quittung.', 'Quittung beginnt mit qu.'], 'Ich hebe die Quittung auf.'),
  mistake('ch-q3', 'Kualität', 'Qualität', 'qu', 'Wie gut ist etwas? Die …', QU_RULE,
    ['Qualität beginnt mit qu.', 'Das q steht vor u.'], 'Die Qualität ist hoch.'),
  mistake('ch-q4', 'Kuartal', 'Quartal', 'qu', 'Ein Viertel Jahr ist ein …', QU_RULE,
    ['Quartal beginnt mit qu.', 'Das q steht direkt vor u.'], 'Das Quartal endet heute.'),
  fill('ch-q5', '', 'ell', 'Qu', ['Qu', 'Ku', 'Quu'], 'Quell', 'qu', 'Quell oder Kuell?', QU_RULE,
    ['Das q steht vor u.', 'Quell beginnt mit qu.'], 'Das Quellwasser ist kalt.'),
  mistake('ch-q6', 'Kwalle', 'Qualle', 'qu', 'Was schwimmt im Meer? Die …', QU_RULE,
    ['Qualle beginnt mit qu.', 'Das q steht direkt vor u.'], 'Die Qualle schwimmt im Meer.'),
  mistake('ch-q7', 'Kwark', 'Quark', 'qu', 'Was isst du zum Frühstück? Den …', QU_RULE,
    ['Quark beginnt mit qu.', 'Sprich das qu deutlich mit.'], 'Ich esse Quark mit Obst.'),
  mistake('ch-q8', 'kwaken', 'quaken', 'qu', 'Was macht der Frosch? Er …', QU_RULE,
    ['quaken → Quaken: das qu bleibt.', 'Das q steht vor u.'], 'Der Frosch fängt an zu quaken.'),
  mistake('ch-q9', 'bekwem', 'bequem', 'qu', 'Der Sessel ist …', QU_RULE,
    ['bequem behält das qu in der Mitte.', 'Das q steht direkt vor u.'], 'Der Sessel ist bequem.'),
  mistake('ch-q10', 'Kwatsch', 'Quatsch', 'qu', 'Das war nur …', QU_RULE,
    ['Quatsch beginnt mit qu.', 'Das q steht direkt vor u.'], 'Das war nur Quatsch.'),

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

  // Gleich klingend, anders geschrieben – die Bedeutung im Satz entscheidet.
  fill('ch-h1', 'Wir fahren im Sommer ans', '. Das Wasser ist blau.', 'Meer', ['Meer', 'mehr'], 'Meer', 'homophone', 'Welches Wort passt in den Satz?', HOMO_RULE,
    ['Meer ist das Wasser – mehr ist eine Menge.', 'Lies den ganzen Satz: Wovon ist die Rede?'], 'Wir fahren im Sommer ans Meer. Das Wasser ist blau.'),
  fill('ch-h2', 'Ich möchte noch', ' Kuchen.', 'mehr', ['Meer', 'mehr'], 'mehr', 'homophone', 'Welches Wort passt in den Satz?', HOMO_RULE,
    ['mehr heißt „eine größere Menge“.', 'Hier passt kein Meer hinein.'], 'Ich möchte noch mehr Kuchen.'),
  fill('ch-h3', 'Im Meer schwimmt ein', '.', 'Wal', ['Wal', 'Wahl'], 'Wal', 'homophone', 'Welches Wort passt in den Satz?', HOMO_RULE,
    ['Ein Wal ist ein Tier.', 'Wahl wäre eine Entscheidung – hier schwimmt ein Tier.'], 'Im Meer schwimmt ein Wal.'),
  fill('ch-h4', 'Wir treffen eine', '.', 'Wahl', ['Wal', 'Wahl'], 'Wahl', 'homophone', 'Welches Wort passt in den Satz?', HOMO_RULE,
    ['eine Wahl ist eine Entscheidung.', 'Sprich beide Wörter: nur eines ergibt Sinn.'], 'Wir treffen eine Wahl.'),
  fill('ch-h5', 'Das', ' ist schön.', 'Lied', ['Lied', 'Lid'], 'Lied', 'homophone', 'Welches Wort passt in den Satz?', HOMO_RULE,
    ['Ein Lied wird gesungen.', 'Das Lid gehört zum Auge.'], 'Das Lied ist schön.'),
  fill('ch-h6', 'Er schließt das', '.', 'Lid', ['Lied', 'Lid'], 'Lid', 'homophone', 'Welches Wort passt in den Satz?', HOMO_RULE,
    ['Das Lid ist das Augenlid.', 'Hier singt niemand – es geht ums Auge.'], 'Er schließt das Lid.'),
  fill('ch-h7', 'Ich lese auf der', '.', 'Seite', ['Seite', 'Saite'], 'Seite', 'homophone', 'Welches Wort passt in den Satz?', HOMO_RULE,
    ['Die Seite steht im Buch.', 'Eine Saite gehört zur Gitarre.'], 'Ich lese auf der Seite.'),
  fill('ch-h8', 'Die', ' der Gitarre klingt.', 'Saite', ['Seite', 'Saite'], 'Saite', 'homophone', 'Welches Wort passt in den Satz?', HOMO_RULE,
    ['Die Saite klingt – die Seite nicht.', 'Denk an das Instrument.'], 'Die Saite der Gitarre klingt.'),
  fill('ch-h9', 'Das ist das erste', '.', 'Mal', ['Mal', 'Mahl'], 'Mal', 'homophone', 'Welches Wort passt in den Satz?', HOMO_RULE,
    ['zum ersten Mal heißt „einmal“.', 'Ein Mahl ist eine Mahlzeit.'], 'Das ist das erste Mal.'),
  fill('ch-h10', 'Das', ' war reichlich.', 'Mahl', ['Mal', 'Mahl'], 'Mahl', 'homophone', 'Welches Wort passt in den Satz?', HOMO_RULE,
    ['Ein Mahl ist das Essen.', 'Hier geht es um Essen, nicht um einen Zeitpunkt.'], 'Das Mahl war reichlich.'),
  // Weitere Verwechslungspaare aus Unterkapitel 8.4 des Lösungshefts.
  fill('ch-h11', 'Ich male das Bild in einem neuen', '.', 'Stil', ['Stil', 'Stiel'], 'Stil', 'homophone', 'Welches Wort passt in den Satz?', HOMO_RULE,
    ['Stil heißt Art und Weise.', 'Ein Stiel gehört zu Besen oder Löffel.'], 'Ich male das Bild in einem neuen Stil.'),
  fill('ch-h12', 'Der Besen hat einen langen', '.', 'Stiel', ['Stil', 'Stiel'], 'Stiel', 'homophone', 'Welches Wort passt in den Satz?', HOMO_RULE,
    ['Der Stiel ist der Griff.', 'Stil wäre hier die Art zu malen.'], 'Der Besen hat einen langen Stiel.'),
  fill('ch-h13', 'Die', ' meines Bleistifts ist weich.', 'Mine', ['Mine', 'Miene'], 'Mine', 'homophone', 'Welches Wort passt in den Satz?', HOMO_RULE,
    ['Die Mine schreibt.', 'Eine Miene zeigt dein Gesicht.'], 'Die Mine meines Bleistifts ist weich.'),
  fill('ch-h14', 'Sie macht eine fröhliche', '.', 'Miene', ['Mine', 'Miene'], 'Miene', 'homophone', 'Welches Wort passt in den Satz?', HOMO_RULE,
    ['Die Miene gehört zum Gesicht.', 'Hier geht es ums Lächeln, nicht um den Stift.'], 'Sie macht eine fröhliche Miene.'),
  fill('ch-h15', 'Wir singen ein fröhliches', '.', 'Lied', ['Lied', 'Lid'], 'Lied', 'homophone', 'Welches Wort passt in den Satz?', HOMO_RULE,
    ['Ein Lied wird gesungen.', 'Das Lid gehört zum Auge.'], 'Wir singen ein fröhliches Lied.'),
  fill('ch-h16', 'Das', ' am Auge zuckt.', 'Lid', ['Lied', 'Lid'], 'Lid', 'homophone', 'Welches Wort passt in den Satz?', HOMO_RULE,
    ['Das Lid deckt das Auge zu.', 'Ein Lied kann nicht zucken.'], 'Das Lid am Auge zuckt.'),
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

// Übungen aus den Unterkapiteln von „Loesungen.pdf“. Die IDs enthalten die
// Nummer des Unterkapitels (Punkte durch Bindestriche ersetzt), damit jede
// Aufgabe auf ihre Seite im Lehrwerk zurückgeführt werden kann.
const ruleForPdf = new Map([...rules, ...extraRules].map((rule) => [rule.id, rule]));

// Sehr lange Wörter bleiben in der Wortbank, bekommen aber keine Aufgabe –
// ein 35-Buchstaben-Kompromisswort wäre für eine kurze Runde zu viel.
const challengeable = (word) => word.length > 0 && word.length <= 18;
const usedMemory = new Set();
const usedDerive = new Set();
const usedError = new Set();
const usedBuild = new Set();

function registerChallenge(challenge) {
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

for (const section of pdfSections) {
  const rule = ruleForPdf.get(section.rule);
  if (!rule) throw new Error(`PDF-Thema ${section.no}: Regel ${section.rule} fehlt`);
  const hints = (rule.rules ?? []).slice(0, 3);
  const ruleText = rule.tip;
  const ref = section.no.replaceAll('.', '-');

  section.words.forEach((word, index) => {
    words.push({
      id: `pdf-${ref}-w${index + 1}`,
      word,
      ruleId: section.rule,
      level: word.length > 10 ? 2 : 1,
      hint: hints[0] ?? rule.tip,
      sentence: index === 0 ? section.sentences?.[0] : undefined,
    });
  });

  const candidates = section.words.filter(challengeable);
  const fresh = candidates.filter((word) => !usedMemory.has(`${section.rule}|${word}`));
  const memoryWords = [...new Set([...fresh, ...candidates])].slice(0, 2);
  memoryWords.forEach((word, index) => {
    usedMemory.add(`${section.rule}|${word}`);
    registerChallenge(memorize(
      `pdfmem-${ref}-${index + 1}`,
      word,
      section.rule,
      'Sieh dir das Wort an, dann schreibst du es aus dem Kopf.',
      ruleText,
      hints,
      section.sentences?.[index],
    ));
  });

  (section.build ?? []).filter(([word]) => challengeable(word)).forEach(([word, syllables]) => {
    const key = `${section.rule}|${word}`;
    if (usedBuild.has(key)) return;
    usedBuild.add(key);
    registerChallenge({
      id: `pdfsilbe-${ref}-${usedBuild.size}`,
      kind: 'syllables-build',
      word,
      ruleId: section.rule,
      prompt: 'Setze die Silben in der richtigen Reihenfolge zusammen.',
      ruleText,
      hints,
      syllables,
      sentence: section.sentences?.[0],
    });
  });

  (section.pairs ?? []).filter(([from, answer]) => challengeable(from) && challengeable(answer)).forEach(([from, answer]) => {
    const key = `${section.rule}|${from}|${answer}`;
    if (usedDerive.has(key)) return;
    usedDerive.add(key);
    registerChallenge(derive(
      `pdfableit-${ref}-${usedDerive.size}`,
      from,
      answer,
      section.rule,
      `Wie heißt die passende Form zu „${from}“?`,
      ruleText,
      hints,
    ));
  });

  (section.error ?? []).filter(([wrong, answer]) => challengeable(wrong) && challengeable(answer)).forEach(([wrong, answer]) => {
    const key = `${section.rule}|${wrong}|${answer}`;
    if (usedError.has(key)) return;
    usedError.add(key);
    registerChallenge(mistake(
      `pdferr-${ref}-${usedError.size}`,
      wrong,
      answer,
      section.rule,
      'Korrigiere das Wort.',
      ruleText,
      hints,
      section.sentences?.[0],
    ));
  });
}

const extraIds = new Set(extraRules.map((rule) => rule.id));
// Der gesamte Bereich „Verwechslung“ wird vom Skript verwaltet. So verschwinden
// auch umbenannte Regeln aus früheren Läufen (z. B. pf-qu) wieder aus den Daten.
const keptRules = rules.filter((rule) => rule.area !== 'verwechslung' && !extraIds.has(rule.id));
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
