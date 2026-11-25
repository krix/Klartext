/** Erzeugt `pdf-abgleich.md`: Thema-für-Thema-Vergleich von Loesungen.pdf und App. */
import { readFileSync, writeFileSync } from 'node:fs';
import { pdfSections } from './pdf-sections.mjs';

const rules = JSON.parse(readFileSync('src/data/rules.json', 'utf8'));
const words = JSON.parse(readFileSync('src/data/words.json', 'utf8'));

// Regelthemen, die es vor dem PDF-Abgleich schon in der App gab.
const existing = new Set([
  'ie-i', 'ai-ei', 'aeu-eu', 'sch-s', 'ss-oesz', 'dehnung', 'dehnungs-h',
  'doppelkonsonant', 'wieder-wider', 'ver-vor', 'emp-ent', 'ig-lich',
  'heit-keit', 'das-dass', 'als-wie', 'grossschreibung', 'silbenbau',
  'fehlerfinden', 'luecken', 'ableiten', 'bausteine', 'merkwoerter',
  'e-oder-ae', 'f-oder-v', 'ks-laute', 'y-laute', 'pf-mpf', 'qu', 'dt',
  'homophone',
]);

const chapters = [
  [1, 'Grundlagen', 4], [2, 'Lange und kurze Vokale', 5],
  [3, 'Überprüfen der Rechtschreibung', 9], [4, 'Großschreibung', 13],
  [5, 'Rechtschreibregeln nach kurzem Vokal', 16],
  [6, 'Rechtschreibregeln nach langem Vokal (ohne Dehnungszeichen)', 21],
  [7, 'Stummes h (stummes Dehnungs-h)', 25],
  [8, 'Das lang gesprochene i', 33],
  [9, 'Besonderheiten bei der Schreibung langer Vokale', 37],
  [10, 's-Laute', 44], [11, 'Verben richtig schreiben', 48],
  [12, 'Wortbausteine', 53], [13, 'Wortstamm', 55],
  [14, 'Wortbausteine verwenden', 57],
  [15, 'Sicherheit durch Wortbausteine', 62],
  [16, 'Verwechslungsgefahr', 64],
];

const areas = {
  laute: 'Laute & Buchstaben', laenge: 'Länge & Silben',
  wortbau: 'Wortbau & Endungen', satz: 'Wörter im Satz',
  verwechslung: 'Verwechslungsgefahr',
};

function forms(section) {
  const list = [];
  if (section.words.length) list.push(`${Math.min(2, section.words.length)} Merkwörter`);
  if (section.build?.length) list.push(`${section.build.length} Silbenbau-Aufgaben`);
  if (section.pairs?.length) list.push(`${section.pairs.length} Ableitungen`);
  if (section.error?.length) list.push(`${section.error.length} Fehlerfinden-Aufgaben`);
  return list.join(', ') || '–';
}

const lines = [
  '# Abgleich: `Loesungen.pdf` und Klartext-App',
  '',
  'Geprüft wurden alle 97 Unterkapitel des Inhaltsverzeichnisses (PDF-Seiten 2–3).',
  'Jede Zeile verweist auf die Seite im PDF und nennt das App-Thema (`ruleId`),',
  'unter dem die Wörter und Übungen jetzt liegen.',
  '',
  '- **vorhanden** = Thema und Übungen waren schon in der App; keine Änderung nötig.',
  '- **ergänzt** = Wörter und/oder Übungen aus den Lösungen des Lehrwerks neu aufgenommen.',
  '- **Thema neu** = Für dieses PDF-Thema gab es vorher kein eigenes App-Thema.',
  '- Die Seitenzahlen sind die gedruckten Zahlen und entsprechen den PDF-Seiten.',
  '',
];

let added = 0;
let complete = 0;
for (const [number, title, page] of chapters) {
  const sections = pdfSections.filter((section) => section.no.split('.')[0] === String(number));
  lines.push(`## ${number}. ${title} – [S. ${page}](Loesungen.pdf#page=${page})`, '');
  lines.push('| Unterkapitel | PDF | App-Thema | Status | Übungen |');
  lines.push('| --- | --- | --- | --- | --- |');
  for (const section of sections) {
    const rule = rules.find((candidate) => candidate.id === section.rule);
    const isNew = !existing.has(section.rule);
    const status = section.words.length ? 'ergänzt' : 'vorhanden';
    if (section.words.length) added += 1;
    else complete += 1;
    const topic = `${rule?.title ?? section.rule} (\`${section.rule}\`${isNew ? ', neu' : ''}${rule?.area ? `, ${areas[rule.area] ?? rule.area}` : ''})`;
    lines.push(`| ${section.no} | [S. ${section.page}](Loesungen.pdf#page=${section.page}) | ${topic} | ${status} | ${forms(section)} |`);
  }
  lines.push('');
}

lines.push('## Ergebnis', '');
lines.push(`- ${pdfSections.length} Unterkapitel geprüft.`);
lines.push(`- ${added} Unterkapitel mit Wörtern und Übungen aus dem PDF ergänzt.`);
lines.push(`- ${complete} Unterkapitel waren bereits vollständig abgedeckt (Kapitel 16 und 8.4).`);
lines.push(`- ${rules.length - existing.size} neue Regelthemen, ${words.length} Wörter insgesamt.`);
lines.push('- Die Übungen liegen in `src/data/challenges.json` und werden von `scripts/import-challenges.mjs` aus `scripts/pdf-sections.mjs` erzeugt.');
lines.push('');

writeFileSync('pdf-abgleich.md', lines.join('\n'), 'utf8');
console.log(`pdf-abgleich.md geschrieben (${pdfSections.length} Unterkapitel).`);
