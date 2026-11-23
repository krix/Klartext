// Handschrift-Prüfung über die aktuelle Interactions API (Stand: Docs 2026).
// Wichtig: Das Modell transkribiert buchstabengetreu. Der Vergleich passiert
// anschließend hier im Browser – das Zielwort darf nie in die Abschrift eingesickert werden.

export const GEMINI_MODEL = "gemini-3.5-flash-lite";
export const API_REVISION = "2026-05-20";
export const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/interactions";

export const RESULT_SCHEMA = {
  type: "object",
  properties: {
    transcription: {
      type: "string",
      description: "Exakt das, was tatsächlich geschrieben steht. Keine Korrektur, keine Ergänzung.",
    },
    legible: {
      type: "boolean",
      description: "true, wenn die Schrift lesbar genug ist, um einzelne Buchstaben zu unterscheiden.",
    },
    uncertain_characters: {
      type: "string",
      description: "Buchstaben, die nicht sicher erkennbar sind, als Kette von □-Zeichen. Leer, wenn alles sicher ist.",
    },
  },
  required: ["transcription", "legible", "uncertain_characters"],
};

export function buildPrompt(target) {
  return `Du bist ein sehr genauer Leser von Handschrift eines Kindes.

Aufgabe 1 – Transkription:
Lies das Bild und schreibe auf, was TATSÄCHLICH geschrieben steht. Übernehme jede Zeile und jeden Buchstaben so, wie er dasteht. Korrigiere nichts. Ergänze nichts. Rate nichts. Wenn ein Buchstabe unklar ist, schreibe ein □ an seine Stelle. Wenn die Schrift unlesbar ist, schreibe eine leere Transkription und setze legible auf false. Ignoriere die Hilfslinien im Bild.

Aufgabe 2 – nur für deinen Vergleich (nicht für die Transkription):
Das erwartete Wort ist: „${target}“. Vergleiche deine Transkription damit. Du darfst das erwartete Wort niemals in die Transkription schreiben, selbst wenn das Geschriebene anders aussieht.

Antworte ausschließlich im vorgegebenen JSON-Format.`;
}

export function buildRequestBody({ target, imageBase64, mimeType = "image/png" }) {
  if (!imageBase64) throw new Error("Kein Bild vorhanden.");
  return {
    model: GEMINI_MODEL,
    input: [
      { type: "text", text: buildPrompt(target) },
      { type: "image", data: imageBase64, mime_type: mimeType },
    ],
    response_format: {
      type: "text",
      mime_type: "application/json",
      schema: RESULT_SCHEMA,
    },
    generation_config: { temperature: 0 },
    store: false,
  };
}

/** Normalisiert Schreibung für einen fairen, aber strengen Vergleich. */
export function normalizeForCheck(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[“”„"]/g, "")
    .replace(/ß/g, "ss")
    .replace(/[.,!?;:]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function distanceTable(a, b) {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const d = Array.from({ length: rows }, () => new Array(cols).fill(0));
  for (let i = 0; i < rows; i += 1) d[i][0] = i;
  for (let j = 0; j < cols; j += 1) d[0][j] = j;
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }
  return d;
}

/** Erzeugt freundliche, konkrete Hinweise aus einem Levenshtein-Alignment. */
export function compareTranscription(transcription, target) {
  const expected = normalizeForCheck(target);
  const written = normalizeForCheck(transcription);
  if (expected === written) {
    return { matches: true, differences: [] };
  }
  const d = distanceTable(expected, written);
  const differences = [];
  let i = expected.length;
  let j = written.length;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && d[i][j] === d[i - 1][j - 1] && expected[i - 1] === written[j - 1]) {
      i -= 1;
      j -= 1;
    } else if (j > 0 && d[i][j] === d[i][j - 1] + 1) {
      differences.push({ type: "extra", position: j - 1, expected: "", written: written[j - 1] });
      j -= 1;
    } else if (i > 0 && d[i][j] === d[i - 1][j] + 1) {
      differences.push({ type: "missing", position: i - 1, expected: expected[i - 1], written: "" });
      i -= 1;
    } else if (i > 0 && j > 0) {
      differences.push({ type: "different", position: j - 1, expected: expected[i - 1], written: written[j - 1] });
      i -= 1;
      j -= 1;
    } else {
      break;
    }
  }
  differences.reverse();
  return { matches: false, differences };
}

function extractOutputText(data) {
  if (!data) return "";
  if (typeof data.output_text === "string") return data.output_text;
  if (typeof data.outputText === "string") return data.outputText;
  const outputs = Array.isArray(data.outputs) ? data.outputs : [];
  for (const step of outputs) {
    if (typeof step?.text === "string") return step.text;
    if (typeof step?.output_text === "string") return step.output_text;
  }
  return "";
}

function parseResult(data) {
  const text = extractOutputText(data);
  if (!text) throw new Error("Die Prüfung hat keine Antwort gegeben.");
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Die Antwort der Prüfung war kein JSON.");
    parsed = JSON.parse(match[0]);
  }
  if (typeof parsed.transcription !== "string") {
    throw new Error("Die Antwort der Prüfung war unvollständig.");
  }
  return {
    transcription: parsed.transcription,
    legible: Boolean(parsed.legible),
    uncertain: typeof parsed.uncertain_characters === "string" ? parsed.uncertain_characters : "",
  };
}

/** Ruft den lokalen Proxy auf. Fällt auf file:// auf einen Sitzungsschlüssel zurück. */
export async function transcribeHandwriting({ target, imageBase64, apiKey = "" }) {
  const body = { target, imageBase64 };
  const isFile = location.protocol === "file:";

  if (!isFile) {
    const response = await fetch("./api/transcribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (response.ok) {
      return parseResult(await response.json());
    }
    if (response.status !== 404) {
      let message = "Die Prüfung ist gerade nicht erreichbar.";
      try {
        const error = await response.json();
        if (error?.error) message = error.error;
      } catch {
        // Die freundliche Standardmeldung behalten.
      }
      throw new Error(message);
    }
    // Kein Proxy vorhanden (z. B. statischer Server): Sitzungsschlüssel versuchen.
  }

  if (!apiKey) {
    throw new Error("Für die Prüfung fehlt entweder der Server oder ein API-Schlüssel in den Einstellungen.");
  }
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
      "Api-Revision": API_REVISION,
    },
    body: JSON.stringify(buildRequestBody({ target, imageBase64 })),
  });
  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(`Die Prüfung wurde abgelehnt (${response.status}). ${details.slice(0, 160)}`);
  }
  return parseResult(await response.json());
}
