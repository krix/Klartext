# Klartext

Offline-fähige PWA zum Üben deutscher Rechtschreibung (Klasse 5/6) mit Handschrift auf dem Tablet und freundlicher KI-Korrektur. Kein Konto, kein Backend, keine Werbung.

---

## 1. Recherche (Stand November 2026)

**Gemini-API:** Der aktuelle REST-Endpoint ist `POST https://generativelanguage.googleapis.com/v1beta/interactions` mit `x-goog-api-key`. Das Bild wird inline als `{"type":"image","data":"<base64>","mime_type":"image/png"}` übergeben, die strukturierte Antwort über `response_format: {type:"text", mime_type:"application/json", schema:...}` erzwungen. Die Antwort liegt in `steps[].content[].text` (die SDK-Kurzform heißt `output_text`). Der klassische Endpoint `.../models/{model}:generateContent` funktioniert als Fallback, erwartet aber `generationConfig.response_mime_type` / `response_schema` in Snake_Case und `?key=...`.

- Empfohlenes Standardsmodell: `gemini-3.5-flash-lite` (schnell und günstig, stabil). Für schwierige Handschrift: `gemini-4-hydrogen` (seit 12.11.2026 GA). `gemini-2.5-flash` wird zum 01.12.2026 auf Flash-Lite umgeleitet und ist deshalb keine gute Wahl.
- Der Request enthält `store: false`, damit Google die Interaktion nicht für die spätere Einsicht speichert.
- Fehler kommen als HTTP-Status plus `error.code`/`error.message` (z. B. `401 authentication`, `429 rate_limit_exceeded`, `500 api_error`).
- Neue AI-Studio-Keys sind seit 28.05.2026 auf die Generative-Language-API beschränkt; Key-Limits (RPM/TPM/RPD) sollten gesetzt und Ausgaben im AI Studio überwacht werden.

Quellen: [Interactions API](https://aistudio.google.com/api-reference/interactions-api/create-interaction) · [Structured outputs](https://ai.google.dev/gemini-api/docs/structured-output) · [Image understanding](https://ai.google.dev/gemini-api/docs/image-understanding) · [generateContent](https://aistudio.google.com/api-reference/generate-content/generate-content) · [Modelle](https://aistudio.google.com/docs/models) · [API-Fehler](https://aistudio.google.com/docs/api-errors) · [API-Keys](https://aistudio.google.com/docs/api-key) · [Rate-Limits](https://aistudio.google.com/docs/rate-limits) · [Logs-Richtlinie](https://aistudio.google.com/docs/logs-policy)

**Fazit für die Umsetzung:** Ein kleiner Browser-Client reicht. Die KI liefert Transkription, Abweichungen und Einschätzung; die Richtigkeit wird zusätzlich lokal nachgerechnet, damit das Modell nicht versehentlich nachsichtig bewertet.

---

## 2. Konzept

### Bildschirme

| Bildschirm | Inhalt |
|---|---|
| Start | Tagesziel, Sterne, Tagesserie, Trainingsplan, Startknopf, Elternbereich |
| Übung | Regelthema, Fortschritt, Diktat (Sprachausgabe) / Abschreiben / Auswahl, Schreibfläche oder Antwortbuttons, Tipp, Lösung |
| Rückmeldung | Richtig/Fast, Vergleichswort, Abweichungstabelle (Position / erwartet / geschrieben), kurzer Tipp, Wiederholung oder Selbstprüfung |
| Elternbereich (PIN) | KI-Key und Datenschutz, Schriftfarbe/-stärke, Vorlesetempo, Rundenlänge, Design, eigene Wortlisten, Fortschritt, Export, Reset |

### Datenmodell (alles in `localStorage`, Schlüssel `klartext.state.v1`)

```text
AppData
├─ settings: apiKey, model, privacyOptIn, handColor, handWidth,
│            ttsRate, sessionLength, theme, pinHash, pinSalt
├─ progress[wortId]: box (Leitner 0..5), due, seen, lapses
├─ attempts[]: ts, wortId, correct, source (ai|self|choice),
│              confidence, transcription, illegible, categories
└─ customWords[]: id, word, ruleId, level, hint
```

Die PIN wird gesalzen als SHA-256-Hash gespeichert, nie im Klartext. 320 Wörter und 16 Regelthemen liegen als JSON in `src/data/`.

### Übungsablauf

1. Wörter nach Leitner-Fach und Fälligkeit auswählen; falsche Wörter kommen nach zwei anderen Wörtern wieder.
2. Übungstyp wählen: Hördiktat (~60 %), Abschreiben, Auswahl. Nach zwei Fehlern in Folge erscheinen mehr Hilfen und leichtere Wörter; nach fünf Richtigen wird die Stufe erhöht.
3. Handschrift auf dem Canvas schreiben → PNG (nur der beschriebene Bereich) → Gemini.
4. Antwort validieren, lokal nachvergleichen, Rückmeldung zeigen. Bei unleserlicher Schrift oder Konfidenz < 0,6: freundlich noch einmal schreiben bitten, **kein** Fehler.
5. Bei Offline/Key-Fehler/Rate-Limit/Timeout/kaputtem JSON: Lösung anzeigen und Kind selbst bewerten lassen.
6. Aus Fehlern wird ein persönlicher Trainingsplan (häufigste Fehlerkategorien der letzten 90 Tage) gebaut.

---

## 3. Technik und Begründung

**TypeScript + Vite ohne Framework.** Die App hat vier Bildschirme und wenige Zustände; ein Framework würde nur Bundle-Größe und Update-Komplexität hinzufügen. Vite liefert einen kleinen Production-Build (~96 kB JS inklusive Wortbank, ~27 kB gzip), der vollständig offline funktioniert. TypeScript verhindert Fehler im Datenmodell. `localStorage` reicht bei dieser Datenmenge aus und ist einfacher als IndexedDB; exportiert wird jederzeit als JSON.

Weitere Punkte: Service Worker mit versionsbasiertem Precache (außer Gemini alles offline), installierbares Manifest mit Icons, `prefers-reduced-motion`, Tastaturbedienung, ARIA-Labels, Skip-Link, klare Fokusmarkierung. Kommentare im Code erklären die kniffligen Stellen (Leitner-Logik, DPR-Canvas, API-Fallback, PIN-Hash).

> **Hinweis zum Repo:** Im Ordner `alternate-vanilla/` liegt ein früherer Prototyp ohne Build-Schritt (Node-Server mit serverseitigem `GEMINI_API_KEY`, eigene Schriften und Themen). Er wird nicht ausgeliefert und ist nur als Referenz erhalten. Die aktive App ist die oben beschriebene TypeScript/Vite-Version.

---

## 4. Setup

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # 19 Unit-Tests
npm run build      # Typcheck + Build + Service Worker
npm run preview    # Produktionsbuild lokal testen
```

Node 20+ reicht. Die KI-Prüfung funktioniert auf `localhost` auch ohne HTTPS; für die installierte PWA auf dem Tablet ist HTTPS nötig.

### Deployment

- **GitHub Pages:** Die Workflow-Datei `.github/workflows/deploy.yml` baut bei jedem Push auf `main` und veröffentlicht `dist/`. In den Repository-Einstellungen unter **Pages → Build and deployment → Source** einmal **GitHub Actions** auswählen. `base: './'` in `vite.config.ts` sorgt dafür, dass auch `https://user.github.io/klartext/` funktioniert.
  > Wenn nur eine weiße Seite und der Link „Zum Inhalt springen“ erscheinen, wurde der Projekt-Root statt `dist/` ausgeliefert (dann wird die TypeScript-Quelldatei `src/main.ts` ausgeliefert). Pages auf GitHub Actions umstellen oder den Build erneut laufen lassen.
- **Netlify / Cloudflare Pages:** Build-Befehl `npm run build`, Publish-Verzeichnis `dist`.
- Danach einmal online öffnen, damit der Service Worker den Cache füllt. Danach funktioniert die App offline.

---

## 5. API-Key einrichten

1. In [Google AI Studio](https://aistudio.google.com/apikey) einen API-Key erzeugen.
2. Den Key auf **„Restrict to Gemini API only“** beschränken, nach Möglichkeit auf die eigene Website (HTTP-Referrer) bzw. IP. Ein eigenes tägliches Limit (RPD) setzen und einen Billing-Alarm einrichten.
3. In der App: Elternbereich 🔒 → PIN festlegen → KI-Prüfung → **Zustimmung anhaken** und Key eintragen. Ohne den Haken erscheint in der Übung gar kein „Prüfen lassen“-Button.
4. **„Verbindung testen“** klicken. Der Test benutzt den gerade eingegebenen Key und das Modell (auch vor dem Speichern), sendet ein kleines Testwort und zeigt bei Erfolg „Verbindung OK“. Bei Fehlern erscheinen HTTP-Status und API-Grund.

**Häufige Ursachen, wenn die Prüfung nicht startet:**

- `API_KEY_INVALID` / HTTP 400/401: Key kopiert oder gelöscht? In AI Studio einen neuen Key erzeugen.
- HTTP 403: Die HTTP-Referrer-Beschränkung passt nicht zur Deploy-Adresse (für GitHub Pages `https://krix.github.io/*` zulassen).
- `Failed to fetch` / CORS: Der Client darf **keine eigenen Header** wie `Api-Revision` mitschicken – die API lehnt den Preflight dann mit 403 ab. Es werden nur `Content-Type` und `x-goog-api-key` gesendet.
- `NOT_FOUND` / 404: Modellnamen prüfen; der Client probiert anschließend automatisch den klassischen Endpoint.
- HTTP 429: Minuten- oder Tageslimit erreicht, kurz warten.

**Wichtig:** Der Key liegt im `localStorage` des Browsers und ist für technisch versuchte Nutzer auf diesem Gerät lesbar. Für Geräte, die auch Kinder oder Gäste nutzen, ist ein kleiner Proxy sicherer, z. B. ein Cloudflare Worker, der den Key serverseitig ergänzt und ein eigenes Limit setzt:

```js
export default {
  async fetch(request, env) {
    const body = await request.json();
    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/interactions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': env.GEMINI_KEY,
        },
        body: JSON.stringify({ ...body, store: false }),
      },
    );
    return new Response(response.body, { status: response.status });
  },
};
```

Dafür müsste die Basis-URL in `src/lib/gemini.ts` auf die Worker-URL umgestellt werden. Ohne Proxy nie einen Key mit hohem Limit verwenden.

---

## 6. Datenschutz

- Es werden **nur das Canvas-Bild und das Zielwort** an Gemini gesendet – keine Namen, kein Fortschritt, keine Kontodaten. Zusätzlich nur das technische Flag, ob Groß-/Kleinschreibung geprüft wird.
- Die Prüfung ist standardmäßig aus. Einmaliger Opt-in im Elternbereich; ohne Opt-in läuft alles offline mit Selbstvergleich.
- `store: false` verhindert das Speichern der Anfrage in den Google-Interaktions-Logs. Google verarbeitet den Bild-Input jedoch gemäß seiner Datenschutzerklärung; deshalb die Zustimmung.
- Alle Lernfortschritte bleiben lokal. Export und Löschen jederzeit im Elternbereich möglich. Keine Accounts, keine Analyse-Skripte, keine externen Fonts.

---

## 7. Wortlisten erweitern

- Eigene Wörter: Elternbereich → *Eigene Wortlisten*, eine Zeile pro Wort im Format `wort|regelId`, z. B.

```text
Tisch|grossschreibung
Straße|ss-oesz
Biene|ie-i
```

Gültige Regel-IDs: `ie-i`, `ss-oesz`, `ai-ei`, `aeu-eu`, `dehnung`, `dehnungs-h`, `doppelkonsonant`, `sch-s`, `das-dass`, `als-wie`, `wieder-wider`, `ver-vor`, `emp-ent`, `ig-lich`, `heit-keit`, `grossschreibung`.

- Dauerhaft neue Wörter oder Regeln: Dateien `src/data/words.json` und `src/data/rules.json` erweitern. Jedes Wort braucht `id`, `word`, `ruleId`, `level` (1–3), `hint` und optional `sentence`. Danach `npm test && npm run build`.

---

## 8. Tests und offene Punkte

**Getestet:** 19 Unit-Tests für Textvergleich, Leitner-Fächer, adaptive Auswahl, Trainingsplan, Tagesserie, Sitzungsablauf sowie Gemini-Request/-Fallback und Fehlerzuordnung. `npm run build` prüft Typen, erstellt den Produktionsbuild und den Service Worker.

**Annahmen / offene Punkte:**

- Die Gemini-Antwort kann nicht ohne echten Key gegen die Live-API geprüft werden. Der Client ist gegen die dokumentierte REST-Antwort (2026) getestet; bei einer API-Änderung greift der Legacy-Fallback. Für den Live-Test Key im Elternbereich eintragen und ein Diktat mit klarer Handschrift prüfen.
- Die KI-Rückmeldung wird nur verwendet, wenn sie 3–240 Zeichen und höchstens zwei Sätze hat. Der konkrete Regeltipp kommt immer aus der lokalen Datenbank – so bleibt er altersgerecht und kontrollierbar.
- Auf Tablets ohne deutsche Sprachstimme übernimmt die Browser-Standardstimme die Sprachausgabe; die Aussprachequalität hängt vom Gerät ab.
- Eigene Wörter werden aktuell auf Stufe 1 eingeordnet und nicht automatisch in Stufe 2/3 einsortiert.
- Der Key ist im Browser nicht verschlüsselt (siehe Proxy-Hinweis). `localStorage` kann im privaten Modus voll sein; die App bleibt dann nutzbar, speichert aber nicht.
- Lighthouse-PWA-Score wurde nicht automatisch gemessen; Manifest, Service Worker, Icons, Offline-Modus und Accessibility-Grundlagen sind vorhanden. Eine Messung auf HTTPS ist noch offen.
- „Unsaubere Handschrift“ wird über `illegible`/`confidence` des Modells erkannt. Sehr unleserliche Schrift führt zu einer Wiederholungsbitte statt zu einem Fehler – das hängt von der Erkennungsqualität des gewählten Modells ab.
