// Inhalte für Klartext. Kleine, klar umrissene Aufgaben – keine Blocksätze.

const rule = (html) => html;

export const TOPICS = [
  {
    id: "silben",
    num: "01",
    name: "Silben bauen & trennen",
    desc: "Wörter in Teile zerlegen und wieder zusammensetzen.",
  },
  {
    id: "fehler",
    num: "02",
    name: "Fehler finden",
    desc: "Hinschauen, die Stelle entdecken und verbessern.",
  },
  {
    id: "luecken",
    num: "03",
    name: "Lückenwörter",
    desc: "Das passende Wort anhand einer Regel wählen.",
  },
  {
    id: "ableiten",
    num: "04",
    name: "Wörter ableiten",
    desc: "Mit ä, äu und hörbaren Endlauten sicher umgehen.",
  },
  {
    id: "bausteine",
    num: "05",
    name: "Wortbausteine",
    desc: "Vorsilben und Endungen als feste Bausteine erkennen.",
  },
  {
    id: "merkwoerter",
    num: "06",
    name: "Merkwörter",
    desc: "Ansehen, vorlesen, weglegen und aus dem Kopf schreiben.",
  },
  {
    id: "dasdass",
    num: "07",
    name: "das oder dass?",
    desc: "Mit der Ersatzprobe entscheiden – auch bei Groß und Klein.",
  },
  {
    id: "diktat",
    num: "08",
    name: "Diktat",
    desc: "Zuhören, noch mal abspielen und ruhig aufschreiben.",
  },
  {
    id: "handschrift",
    num: "09",
    name: "Handschrift",
    desc: "Mit dem Finger oder Stift schreiben und prüfen lassen.",
  },
];

// Hilfsfunktionen halten die Aufgaben kurz und lesbar.
const build = (id, prompt, syllables, hints) => ({
  id,
  type: "build",
  prompt,
  syllables,
  rule: rule("Sprich das Wort <strong>Silbe für Silbe</strong> mit. Jede Silbe bekam ihren eigenen Platz. Nun setzt du die Teile wieder zusammen."),
  hints,
});
const split = (id, word, options, answer, hints) => ({
  id,
  type: "split",
  prompt: `Wo trennst du <strong>${word}</strong>?`,
  word,
  options,
  answer,
  rule: rule("Ein <strong>Silbenbogen</strong> zeigt: Eine Silbe beginnt immer mit einem Mitlaut. Klingende Silben tragen oft ein <em>e</em>."),
  hints,
});
const error = (id, wrong, answer, errorIndex, hints, note) => ({
  id,
  type: "error",
  prompt: "Sieh dir das Wort an. Wo steckt der Fehler? Klicke die Stelle an und schreibe das Wort richtig.",
  wrong,
  answer,
  errorIndex,
  note,
  rule: rule("Erst <strong>hinschauen</strong>, dann <strong>mitsprechen</strong>: Klingt die Stelle so, wie sie geschrieben ist? Danach das ganze Wort richtig hinschreiben."),
  hints,
});
const gap = (id, before, after, options, answer, why, hints) => ({
  id,
  type: "gap",
  prompt: "Welches Wort passt in die Lücke?",
  before,
  after,
  sentence: `${before} ${after}`,
  options,
  answer,
  why,
  rule: rule("Lies den Satz bis zur Lücke <strong>und</strong> dahinter weiter. Das ergänzte Wort muss zum Sinn und zur Regel passen."),
  hints,
});
const derive = (id, from, question, answer, hints, note) => ({
  id,
  type: "derive",
  prompt: question,
  from,
  answer,
  note,
  rule: rule("Sprich die Grundform und die neue Form <strong>nacheinander</strong> aus. Eine Veränderung im Klang zeigt sich oft in <strong>ä</strong> oder <strong>äu</strong>. Am Ende eines Wortes klingt ein weicher Laut manchmal hart – in einer längeren Form kommt er wieder zum Vorschein."),
  hints,
});
const parts = (id, piece, question, options, answer, hints, note) => ({
  id,
  type: "parts",
  prompt: question,
  piece,
  options,
  answer,
  note,
  rule: rule("Ein <strong>Wortbaustein</strong> bleibt in vielen Wörtern gleich. Frag dich: Welcher Baustein macht aus dem Teil ein ganzes Wort?"),
  hints,
});
const memory = (id, word, hints, note) => ({
  id,
  type: "memory",
  word,
  prompt: "Sieh dir das Wort an. Dann verschwindet es – schreib es aus dem Kopf.",
  rule: rule("Drei Wege helfen: <strong>ansehen</strong>, <strong>mitsprechen</strong>, <strong>mit dem Finger in die Luft schreiben</strong>. Das nennt man Mehrkanal-Lernen."),
  hints,
  note,
});
const dasdass = (id, before, after, options, answer, why, hints) => ({
  id,
  type: "gap",
  prompt: "Was gehört in die Lücke?",
  before,
  after,
  sentence: `${before} ${after}`,
  options,
  answer,
  why,
  rule: rule("<strong>das</strong> ist ein Artikel oder ein Bindewort. <strong>dass</strong> leitet einen Nebensatz ein. Ersatzprobe: Passt <em>dieses</em> oder <em>jenes</em>, schreibst du <strong>das</strong>."),
  hints,
});
const caseTask = (id, before, after, options, answer, why, hints) => ({
  id,
  type: "gap",
  prompt: "Welche Schreibweise ist richtig?",
  before,
  after,
  sentence: `${before} ${after}`,
  options,
  answer,
  why,
  rule: rule("Namenwörter schreibt man <strong>groß</strong>. Ein Wort am Satzanfang auch. Ein Wort nach <em>der, die, das</em> ist meist ein Namenwort."),
  hints,
});
const dictation = (id, text, hints, note) => ({
  id,
  type: "dictation",
  text,
  prompt: "Hör gut zu. Du kannst den Satz so oft abspielen, wie du brauchst.",
  rule: rule("Hör zu, <strong>sprich leise mit</strong> und schreib in Ruhe auf. Beim Diktat darfst du die Vorlese-Geschwindigkeit selbst einstellen."),
  hints,
  note,
});
const handwriting = (id, word, hints, note) => ({
  id,
  type: "handwriting",
  word,
  prompt: "Schreib das Wort mit dem Finger oder einem Stift auf die Linien.",
  rule: rule("Schreib <strong>in Ruhe</strong> und mit ganzen Buchstaben. Die Prüfung liest, was wirklich auf dem Papier steht – und korrigiert nichts weg."),
  hints,
  note,
});

export const TASKS = {
  silben: [
    build("s1", "Setze das Wort zusammen.", ["Freund", "schaft"], ["Sag zuerst „Freund“, dann „schaft“.", "Jetzt beide Teile hintereinander sagen: Freundschaft."]),
    split("s2", "Wassermelone", ["Wasser-me-lo-ne", "Was-ser-melone", "Wasserme-lone"], "Wasser-me-lo-ne", ["Such zuerst das Wort „Wasser“.", "Danach bleibt „Melone“ – das zerlegst du in Me + lo + ne."]),
    build("s3", "Setze das Wort zusammen.", ["Schul", "hof"], ["Ein Silbenbogen verbindet die Laute von „Schul“.", "Sprich: Schul – Hof – Schulhof."]),
    split("s4", "Sonnenblume", ["Son-nen-blume", "Sonne-nblu-me", "Sonnen-blume"], "Son-nen-blume", ["„Sonne“ hat zwei Silben: Son + ne.", "„Blume“ bleibt ganz: Blume."]),
    build("s5", "Setze das Wort zusammen.", ["Mäd", "chen"], ["Sprich die erste Silbe langsam: Mäd.", "Die zweite Silbe ist „chen“."]),
    split("s6", "Bahnhof", ["Bahn-hof", "Bahnho-f", "Ba-hnhof"], "Bahn-hof", ["„Bahn“ ist eine Silbe.", "„Hof“ ist die zweite Silbe."]),
    build("s7", "Setze das Wort zusammen.", ["Fahr", "rad"], ["Denk an ein Wort mit zwei Rädern.", "Fahr + rad."]),
    split("s8", "Kleinigkeit", ["Klein-ig-keit", "Klei-nig-keit", "Kleinig-keit"], "Klein-ig-keit", ["„Klein“ bleibt als Ganzes.", "„igkeit“ zerfällt in ig + keit."]),
    build("s9", "Setze das Wort zusammen.", ["Turn", "halle"], ["Erste Silbe: Turn.", "Zweite Silbe: halle."]),
    split("s10", "Schreibtisch", ["Schreib-tisch", "Schreibt-isch", "Sch-reibtisch"], "Schreib-tisch", ["Das erste Wort ist „schreib“.", "Das zweite Wort ist „Tisch“."]),
  ],
  fehler: [
    error("f1", "Fahrrat", "Fahrrad", 6, ["Sprich das letzte Wort deutlich aus: ...rad.", "Ein weicher Laut am Ende wird oft hart geschrieben. Denk an „Räder“."]),
    error("f2", "Schuhle", "Schule", 4, ["Lies die Silben: Schu – le.", "In „Schule“ steht nur ein h direkt nach dem sch."]),
    error("f3", "Mädgen", "Mädchen", 3, ["Denk an „Mädchen“: Nach dem d kommt ein ch.", "Sag die zweite Silbe: chen."]),
    error("f4", "Freind", "Freund", 2, ["Denk an „freuen“: Freude, Freund.", "Die richtigen zwei Buchstaben sind eu."]),
    error("f5", "Baume", "Bäume", 1, ["Denk an den Baum – und an zwei Bäume.", "Aus a wird ä."]),
    error("f6", "Werme", "Wärme", 1, ["Was ist das Gegenteil von Kälte? Die ...ärme.", "Schreib den Umlaut."]),
    error("f7", "Heuser", "Häuser", 1, ["Ein Haus, zwei ...?", "Der erste Buchstabe braucht einen Umlaut."]),
    error("f8", "Muht", "Mut", 2, ["Sprich das Wort langsam: Mut.", "Nach dem u kommt ein t – ohne h."]),
    error("f9", "Sadt", "Stadt", 1, ["Denk an „Städte“: Das t steckt mit drin.", "Sprich: Stadt – Städte."]),
    error("f10", "Wiedersehn", "Wiedersehen", 8, ["Denk an „sehen“: se – hen.", "In „Wiedersehen“ steckt das ganze Wort „sehen“."]),
  ],
  luecken: [
    gap("l1", "Ich warte", "auf dich.", ["warte", "warten"], "warte", "„Ich“ ist die erste Person: ich warte. Bei „wir“ hieße es wir warten.", ["Setz statt „ich“ einmal „wir“ ein.", "Bei wir klingt es anders – bei ich bleibt es „warte“."]),
    gap("l2", "Der Hund", " laut.", ["bellt", "bellen"], "bellt", "„Der Hund“ ist Einzahl. Einzahl: bellt. Mehrzahl: bellen.", ["Probiere: „Die Hunde ...“.", "Die Mehrzahlform passt hier nicht."]),
    gap("l3", "Wir haben", " Hunger.", ["großen", "groß"], "großen", "Nach „haben“ und vor dem Namenwort „Hunger“ braucht das Eigenschaftswort eine Endung.", ["Sprich: Wir haben ... Hunger.", "„Groß“ allein klingt hier nicht fertig."]),
    gap("l4", "Die Kinder", " im Garten.", ["spielt", "spielen"], "spielen", "„Die Kinder“ ist Mehrzahl. Mehrzahl: spielen.", ["Ersetze „die Kinder“ durch „das Kind“.", "Beim Kind hieße es spielt – bei Kindern spielen."]),
    gap("l5", "Ich gehe", " Schule.", ["zur", "zum"], "zur", "„Schule“ ist weiblich: die Schule → zu der → zur.", ["Welcher Artikel gehört zu Schule? Die.", "Aus „zu der“ wird „zur“."]),
    gap("l6", "Er hat", " Ball gespielt.", ["einen", "ein"], "einen", "„Ball“ ist männlich und hier im Akkusativ: einen Ball.", ["Frag: Was hat er gespielt? Einen Ball.", "Nach „hat“ klingt es mit -en richtiger."]),
    gap("l7", "Sie ist", " kleinen Mädchen.", ["ein", "eine"], "ein", "„Mädchen“ ist sächlich: das Mädchen → ein Mädchen.", ["Welcher Artikel passt zu „das Mädchen“?", "Sächlich: ein, nicht eine."]),
    gap("l8", "Die Blumen", " schön.", ["ist", "sind"], "sind", "„Die Blumen“ ist Mehrzahl – dazu passt „sind“.", ["Probier es mit „Die Blume ...“.", "Einzahl: ist. Mehrzahl: sind."]),
    gap("l9", "Ich habe das Buch", "gelegt.", ["auf den Tisch", "auf dem Tisch"], "auf den Tisch", "Die Frage ist „wohin?“ – dann steht der Akkusativ: auf den Tisch.", ["Frag: Wo habe ich es hingelegt?", "Wohin? → auf den Tisch."]),
    gap("l10", "Morgen", " wir ins Schwimmbad.", ["gehen", "geht"], "gehen", "„Wir“ ist die erste Person Mehrzahl: wir gehen.", ["Setz „er“ ein: er geht.", "Bei „wir“ braucht es die Mehrzahlform."]),
  ],
  ableiten: [
    derive("a1", "Haus", "Was ist die Mehrzahl von „Haus“?", "Häuser", ["Sprich: Haus – Häuser.", "Der Laut wandelt sich zu äu."], "Haus → Häuser"),
    derive("a2", "Baum", "Was ist die Mehrzahl von „Baum“?", "Bäume", ["Ein Baum, zwei ...?", "Aus au wird äu."], "Baum → Bäume"),
    derive("a3", "Maus", "Was ist die Mehrzahl von „Maus“?", "Mäuse", ["Sag es leise vor: Maus – Mäuse.", "Der Umlaut kommt in die Mitte."], "Maus → Mäuse"),
    derive("a4", "Raum", "Was ist die Mehrzahl von „Raum“?", "Räume", ["Denk an mehrere Zimmer.", "Raum – Räume."], "Raum → Räume"),
    derive("a5", "Tag", "Was ist die Mehrzahl von „Tag“?", "Tage", ["Sag „Tag“ und dann „Tage“ – hörst du den weichen Laut?", "Am Ende klingt er wie k, in der Mehrzahl schreibst du g."], "Tag → Tage"),
    derive("a6", "Rad", "Was ist die Mehrzahl von „Rad“?", "Räder", ["Ein Rad, zwei Räder.", "Hier gibt es zwei Veränderungen: Umlaut und Endung."], "Rad → Räder"),
    derive("a7", "Berg", "Was ist die Mehrzahl von „Berg“?", "Berge", ["Sag Berg – Berge.", "Am Ende hörst du ein k, schreibst aber g."], "Berg → Berge"),
    derive("a8", "Weg", "Was ist die Mehrzahl von „Weg“?", "Wege", ["Weg – Wege: Der letzte Laut wird weicher.", "Schreib ihn mit g."], "Weg → Wege"),
    derive("a9", "Schild", "Was ist die Mehrzahl von „Schild“?", "Schilder", ["Denk an Schilder an der Wand.", "Das d am Ende bleibt in der Mitte erhalten."], "Schild → Schilder"),
    derive("a10", "Fuß", "Was ist die Mehrzahl von „Fuß“?", "Füße", ["Ein Fuß, zwei Füße.", "Aus u wird ü, aus ss wird ß."], "Fuß → Füße"),
  ],
  bausteine: [
    parts("b1", "…gessen", "Welche Vorsilbe passt: vergessen oder vorgessen?", ["ver-", "vor-"], "ver-", ["Denk an „weg“, an etwas, das man verliert.", "Es gibt kein Wort „vorgessen“."], "vergessen"),
    parts("b2", "…stellen", "Sagst du „vorstellen“ oder „verstellen“?", ["ver-", "vor-"], "vor-", ["Wenn du dich jemandem zeigst, stellst du dich vor.", "„Vor“ hat hier mit „vor jemandem“ zu tun."], "vorstellen"),
    parts("b3", "…stehen", "Sagst du „verstehen“ oder „vorstehen“?", ["ver-", "vor-"], "ver-", ["Wenn du etwas kapierst, verstehst du es.", "Denk an „Verständnis“."], "verstehen"),
    parts("b4", "…lesen", "Der Lehrer liest die Aufgabe vor – welcher Baustein?", ["ver-", "vor-"], "vor-", ["Er liest sie allen vor.", "„Vorlesen“ hat mit „vor“ zu tun."], "vorlesen"),
    parts("b5", "Wohn…", "Welche Endung passt: die Wohnung oder die Wohnkeit?", ["-ung", "-keit"], "-ung", ["Denk an eine Wohnung, in der du wohnst.", "Viele Wörter auf -ung bezeichnen einen Ort oder eine Handlung."], "Wohnung"),
    parts("b6", "Freundlich…", "Welche Endung passt: die Freundlichkeit?", ["-ung", "-keit"], "-keit", ["„Freundlich“ ist ein Eigenschaftswort.", "Aus Eigenschaftswörtern werden oft Wörter auf -keit."], "Freundlichkeit"),
    parts("b7", "…laufen", "Jemand verläuft den Weg – welcher Baustein?", ["ver-", "vor-"], "ver-", ["Denk an einen Weg, den du verläufst.", "„Vorlaufen“ hieße: vor jemandem her laufen."], "verlaufen"),
    parts("b8", "Lös…", "Welche Endung passt: die Lösung?", ["-ung", "-keit"], "-ung", ["Du löst ein Rätsel – die Lösung.", "Die Endung ist -ung."], "Lösung"),
    parts("b9", "…kommen", "Etwas kommt zu dir – welcher Baustein?", ["ver-", "vor-"], "vor-", ["Etwas ist „vorgekommen“.", "Denk an „Vorkommnis“."], "vorkommen"),
    parts("b10", "Möglich…", "Welche Endung passt: die Möglichkeit?", ["-ung", "-keit"], "-keit", ["„Möglich“ ist ein Eigenschaftswort.", "Eigenschaft + -keit ergibt ein Namenwort."], "Möglichkeit"),
  ],
  merkwoerter: [
    memory("m1", "Bibliothek", ["Teile es: Bi – blio – thek.", "Denk an viele Bücher in Regalen."], "Ort mit vielen Büchern"),
    memory("m2", "Schreibtisch", ["Schreib + Tisch.", "Wo sitzt du beim Schreiben?"], "Tisch zum Schreiben"),
    memory("m3", "Fahrrad", ["Fahr + rad.", "Zwei Räder – und du fährst damit."], "mit zwei Rädern"),
    memory("m4", "Bücherregal", ["Bücher + Regal.", "Regal mit Büchern drin."], "Bücher stehen darin"),
    memory("m5", "Turnhalle", ["Turn + halle.", "Halle, in der du turnst."], "Halle zum Turnen"),
    memory("m6", "Freundschaft", ["Freund + schaft.", "Zwischen zwei Freunden."], "zwischen Freunden"),
    memory("m7", "Nachbar", ["Der Mensch nebenan.", "Sprich: Nach – bar."], "wohnt neben dir"),
    memory("m8", "Mittagessen", ["Mittag + essen.", "Das Essen um zwölf."], "Essen am Mittag"),
    memory("m9", "Wirtschaft", ["Wirt + schaft.", "Denk an ein Wirtshaus – und an das Fach."], "Schulfach und auch ein Ort"),
    memory("m10", "Schulhof", ["Schul + hof.", "Der Hof deiner Schule."], "Hof in der Schule"),
  ],
  dasdass: [
    dasdass("d1", "Ich weiß,", "du da bist.", ["das", "dass"], "dass", "„du da bist“ ist ein Nebensatz – deshalb dass.", ["Kannst du ein Wort weglassen und es trotzdem verstehen?", "Probier die Ersatzprobe: Passt „dieses“? Nein."]),
    dasdass("d2", "Ich nehme", " Buch mit.", ["das", "dass"], "das", "„Buch“ ist ein Namenwort: das Buch.", ["Welcher Artikel gehört zu Buch? Das.", "„Ich nehme dieses Buch mit“ funktioniert."]),
    dasdass("d3", "Er sagt,", " er morgen kommt.", ["das", "dass"], "dass", "Nach „er sagt, ...“ folgt ein Nebensatz.", ["Sprich: Er sagt, ... er morgen kommt.", "„Dieses er morgen kommt“ geht nicht."]),
    dasdass("d4", "Siehst du", " Haus dort?", ["das", "dass"], "das", "„Haus“ ist sächlich: das Haus.", ["Ersatzprobe: Siehst du dieses Haus? Ja.", "Dann ist es das."]),
    dasdass("d5", "Ich hoffe,", " es regnet nicht.", ["das", "dass"], "dass", "„es regnet nicht“ ist der Inhalt deiner Hoffnung – ein Nebensatz.", ["Setz „dieses“ ein: funktioniert das?", "Nein? Dann schreib dass."]),
    dasdass("d6", "Ich mag", " Wetter heute.", ["das", "dass"], "das", "„Wetter“ ist sächlich: das Wetter.", ["„Ich mag dieses Wetter“ passt.", "Also das."]),
    caseTask("d7", "Ich gehe zum", "Arzt.", ["Arzt", "arzt"], "Arzt", "„Arzt“ ist ein Namenwort – Namenwörter schreibt man groß.", ["Welcher Artikel steckt in „zum“? Der.", "Der Arzt → groß."]),
    caseTask("d8", "Wir spielen im", "Park.", ["Park", "park"], "Park", "„Park“ ist ein Namenwort: der Park.", ["Sag: der Park. Wie schreibt man ihn?", "Mit großem P."]),
    caseTask("d9", "Heute ist", "Montag.", ["Montag", "montag"], "Montag", "Wochentage sind Namenwörter und werden groß geschrieben.", ["Montag ist ein Name.", "Namen schreibt man groß."]),
    caseTask("d10", "Sie wohnt in der", "Stadt.", ["Stadt", "stadt"], "Stadt", "„Stadt“ ist ein Namenwort: die Stadt.", ["Die Stadt – wie fängt das Wort an?", "Mit großem S."]),
  ],
  diktat: [
    dictation("k1", "Haus", ["Denk an das Wort mit zwei Silben.", "Haus – Häuser."], "einfaches Wort"),
    dictation("k2", "Freund", ["Freude, Freund.", "F – r – e – u – n – d."], "mit eu"),
    dictation("k3", "Schule", ["Schu – le.", "Nach sch kommt nur ein h."], "zwei Silben"),
    dictation("k4", "Bäume", ["Ein Baum, zwei Bäume.", "Der erste Buchstabe hat einen Umlaut."], "mit Umlaut"),
    dictation("k5", "Wiedersehen", ["Wieder + sehen.", "Am Ende steckt das Wort sehen."], "zusammengesetzt"),
    dictation("k6", "Fahrrad", ["Fahr + rad.", "Zwei hintereinander."], "mit doppeltem r"),
    dictation("k7", "Der Hund läuft.", ["Der Hund – was macht er?", "Achte auf den Punkt am Ende."], "kurzer Satz"),
    dictation("k8", "Ich spiele im Garten.", ["Ich – spiele – im – Garten.", "Der Satz beginnt groß und endet mit einem Punkt."], "kurzer Satz"),
    dictation("k9", "Wir sehen den Wald.", ["Wer? Wir. Was? sehen den Wald.", "„Wald“ wird groß geschrieben."], "kurzer Satz"),
    dictation("k10", "Heute ist schönes Wetter.", ["Heute – ist – schönes – Wetter.", "Achte auf das Wetter am Ende."], "kurzer Satz"),
  ],
  handschrift: [
    handwriting("h1", "Mama", ["Schreib zuerst das große M.", "Dann folgen a – m – a."], "kurzes Wort"),
    handwriting("h2", "Schule", ["Schu – le.", "Das sch bleibt zusammen."], "zwei Silben"),
    handwriting("h3", "Freund", ["Denk an Freude.", "F – r – e – u – n – d."], "mit eu"),
    handwriting("h4", "Bäume", ["Ein Baum, zwei Bäume.", "Vergiss den Umlaut nicht."], "mit Umlaut"),
    handwriting("h5", "Wiedersehen", ["Wieder + sehen.", "Schreib die Teile ohne Pause."], "langes Wort"),
    handwriting("h6", "Fahrrad", ["Fahr + rad.", "Zwei r stehen hintereinander."], "mit doppeltem r"),
    handwriting("h7", "Der Hund läuft.", ["Der Hund läuft.", "Achte auf den Umlaut in „läuft“ und auf den Punkt am Ende."], "kurzer Satz"),
    handwriting("h8", "Ich spiele im Garten.", ["Ich spiele im Garten.", "Satzanfang groß, Punkt am Ende."], "kurzer Satz"),
  ],
};

export const SESSION_SIZE = Object.fromEntries(TOPICS.map((topic) => [topic.id, Math.min(TASKS[topic.id].length, 10)]));

export function pickTasks(topicId) {
  const all = [...TASKS[topicId]];
  // Leichte Mischung: nicht immer in derselben Reihenfolge beginnen.
  const shift = Math.floor(Math.random() * all.length);
  return [...all.slice(shift), ...all.slice(0, shift)].slice(0, SESSION_SIZE[topicId]);
}
