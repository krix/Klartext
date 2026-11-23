import type { CheckResult, Difference } from './types';
import { evaluateTranscription } from './learning';

export type CheckErrorCode = 'offline' | 'auth' | 'rate-limit' | 'timeout' | 'bad-request' | 'bad-response' | 'server' | 'unknown';

export class CheckError extends Error {
  constructor(
    public readonly code: CheckErrorCode,
    message: string,
    public readonly status?: number,
    public readonly detail?: string,
  ) {
    super(message);
    this.name = 'CheckError';
  }
}

export interface CheckRequest {
  /** PNG-Daten-URL aus der Schreibfläche. */
  imageDataUrl: string;
  targetWord: string;
  caseSensitive: boolean;
  apiKey: string;
  model: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
}

/** Exakt das gewünschte Antwortschema (siehe README). */
export const RESULT_SCHEMA = {
  type: 'object',
  properties: {
    transcription: { type: 'string', description: 'Das gelesene handschriftliche Wort' },
    isCorrect: { type: 'boolean', description: 'true, wenn das gelesene Wort dem Zielwort entspricht' },
    confidence: { type: 'number', description: 'Sicherheit der Lesung zwischen 0 und 1' },
    differences: {
      type: 'array',
      description: 'Abweichungen vom Zielwort',
      items: {
        type: 'object',
        properties: {
          position: { type: 'integer', description: 'Nullbasierter Index im Zielwort' },
          expected: { type: 'string', description: 'Erwartetes Zeichen' },
          written: { type: 'string', description: 'Gelesenes Zeichen, leer wenn nichts geschrieben wurde' },
        },
        required: ['position', 'expected', 'written'],
      },
    },
    feedback: { type: 'string', description: 'Kurze deutsche Rückmeldung für ein Kind, maximal zwei Sätze' },
    illegible: { type: 'boolean', description: 'true, wenn die Schrift nicht zuverlässig lesbar ist' },
  },
  required: ['transcription', 'isCorrect', 'confidence', 'differences', 'feedback', 'illegible'],
} as const;

function buildPrompt(targetWord: string, caseSensitive: boolean): string {
  return `Du bist ein geduldiger Rechtschreib-Assistent für Kinder der 5./6. Klasse. Auf dem Bild steht handschriftlich genau EIN Wort.

Zielwort: ${targetWord}
Groß-/Kleinschreibung bewerten: ${caseSensitive ? 'ja' : 'nein'}

Lies nur das geschriebene Wort. Ignoriere schiefe, unruhige oder leicht unsaubere Striche: Das ist keine Rechtschreibfehler, sondern nur Handschrift. Setze "illegible" nur dann auf true, wenn ein Buchstabe wirklich nicht erkennbar ist; bei Unsicherheit lieber illegible=true und eine niedrige confidence.
"differences" enthält pro abweichender Stelle position (nullbasierter Index), expected (Zeichen im Zielwort) und written (gelesenes Zeichen oder leerer String).
"feedback" ist ein kurzer, freundlicher deutscher Satz (maximal zwei Sätze) ohne Tadel und ohne Note.
Antworte ausschließlich im vorgegebenen JSON-Format.`;
}

function base64FromDataUrl(dataUrl: string): string {
  const match = /^data:image\/(?:png|jpeg|webp);base64,(.+)$/i.exec(dataUrl);
  if (!match) throw new CheckError('bad-request', 'Das Bild konnte nicht vorbereitet werden.');
  return match[1];
}

function extractJson(payload: unknown): string {
  if (!payload || typeof payload !== 'object') throw new CheckError('bad-response', 'Die Antwort war leer.');
  const record = payload as Record<string, unknown>;
  const interaction = record.interaction;
  const interactionText = interaction && typeof interaction === 'object'
    ? (interaction as Record<string, unknown>).output_text
    : undefined;
  const output = record.output;
  const outputText = Array.isArray(output)
    ? output.map((part) => (part && typeof part === 'object' ? String((part as Record<string, unknown>).text ?? '') : '')).join('')
    : undefined;
  // REST-Antwort der Interactions-API: steps[].content[].text (SDK: output_text).
  const steps = Array.isArray(record.steps)
    ? record.steps
        .map((step) => {
          if (!step || typeof step !== 'object') return '';
          const content = (step as Record<string, unknown>).content;
          if (!Array.isArray(content)) return '';
          return content
            .map((part) => (part && typeof part === 'object' ? String((part as Record<string, unknown>).text ?? '') : ''))
            .join('');
        })
        .join('')
    : '';
  const candidateText = Array.isArray(record.candidates)
    ? record.candidates
        .map((candidate) => {
          if (!candidate || typeof candidate !== 'object') return '';
          const content = (candidate as Record<string, unknown>).content;
          if (!content || typeof content !== 'object') return '';
          const parts = (content as Record<string, unknown>).parts;
          if (!Array.isArray(parts)) return '';
          return parts.map((part) => (part && typeof part === 'object' ? String((part as Record<string, unknown>).text ?? '') : '')).join('');
        })
        .join('')
    : undefined;
  const text = interactionText ?? record.output_text ?? outputText ?? (steps || undefined) ?? candidateText;
  if (typeof text !== 'string' || !text.trim()) {
    throw new CheckError('bad-response', 'Die Antwort enthielt keinen Text.');
  }
  return text;
}

function parseResult(text: string): Omit<CheckResult, 'isCorrect'> {
  // Modelle liefern gelegentlich Markdown-Codeblöcke trotz JSON-Schema.
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  const jsonText = start >= 0 && end > start ? text.slice(start, end + 1) : text;
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new CheckError('bad-response', 'Die Antwort war kein gültiges JSON.');
  }
  if (!parsed || typeof parsed !== 'object') throw new CheckError('bad-response', 'Die Antwort war kein Objekt.');
  const record = parsed as Record<string, unknown>;
  if (typeof record.transcription !== 'string') {
    throw new CheckError('bad-response', 'Die Antwort enthielt keine Erkennung des Wortes.');
  }

  const differences: Difference[] = Array.isArray(record.differences)
    ? record.differences.filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === 'object').map((entry) => ({
        position: typeof entry.position === 'number' && Number.isFinite(entry.position) ? Math.max(0, Math.floor(entry.position)) : 0,
        expected: typeof entry.expected === 'string' ? entry.expected : '',
        written: typeof entry.written === 'string' ? entry.written : '',
      }))
    : [];

  const rawConfidence = typeof record.confidence === 'number' && Number.isFinite(record.confidence)
    ? record.confidence
    : 0.5;

  return {
    transcription: record.transcription,
    confidence: Math.max(0, Math.min(1, rawConfidence)),
    differences,
    feedback: typeof record.feedback === 'string' ? record.feedback.slice(0, 400) : '',
    illegible: record.illegible === true,
  };
}

async function readError(response: Response): Promise<CheckError> {
  let status = '';
  let message = `Die Anfrage schlug fehl (HTTP ${response.status}).`;
  try {
    const body = await response.json() as { error?: { status?: string; message?: string } };
    status = body.error?.status ?? '';
    if (body.error?.message) message = body.error.message;
  } catch {
    // Manche Proxies liefern nur Klartext zurück.
  }
  const code: CheckErrorCode = response.status === 401 || response.status === 403
    ? 'auth'
    : response.status === 429
      ? 'rate-limit'
      : response.status >= 500
        ? 'server'
        : response.status === 400
          ? 'bad-request'
          : 'unknown';
  return new CheckError(code, message, response.status === 400 ? 400 : response.status, status || undefined);
}

/** Ruft Gemini auf. Zuerst die aktuelle Interactions-API, bei 404/legacy-Modellen der klassische Endpoint. */
export async function checkHandwriting(request: CheckRequest): Promise<CheckResult> {
  const {
    imageDataUrl,
    targetWord,
    caseSensitive,
    apiKey,
    model,
    timeoutMs = 20_000,
    fetchImpl = fetch,
    signal,
  } = request;
  if (!apiKey.trim()) throw new CheckError('auth', 'Es ist kein API-Key eingetragen.');

  const data = base64FromDataUrl(imageDataUrl);
  const prompt = buildPrompt(targetWord, caseSensitive);
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort);
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const headers = {
    'Content-Type': 'application/json',
    'x-goog-api-key': apiKey.trim(),
    'Api-Revision': '2026-05-20',
  };

  try {
    const interactionsBody = {
      model,
      input: [
        { type: 'text', text: prompt },
        { type: 'image', data, mime_type: 'image/png' },
      ],
      response_format: { type: 'text', mime_type: 'application/json', schema: RESULT_SCHEMA },
      // Keine Speicherung der Interaktion in den Google-Logs (Opt-out, siehe README).
      store: false,
    };

    let response: Response;
    try {
      response = await fetchImpl('https://generativelanguage.googleapis.com/v1beta/interactions', {
        method: 'POST',
        headers,
        body: JSON.stringify(interactionsBody),
        signal: controller.signal,
      });
    } catch (error) {
      if (controller.signal.aborted) throw new CheckError(signal?.aborted ? 'offline' : 'timeout', 'Die Prüfung hat zu lange gedauert.');
      throw new CheckError('offline', 'Keine Verbindung zum Prüfdienst.', undefined, String(error));
    }

    if (!response.ok) {
      const failure = await readError(response);
      // Alte Modellnamen oder noch nicht freigeschaltete Endpoints: klassischen Endpoint versuchen.
      const legacyPossible = response.status === 404 || (response.status === 400 && /model|schema|endpoint|unsupported/i.test(failure.message));
      if (!legacyPossible) throw failure;

      const legacyBody = {
        contents: [{
          parts: [
            { text: prompt },
            { inline_data: { mime_type: 'image/png', data } },
          ],
        }],
        generationConfig: {
          temperature: 0,
          // Der Legacy-Endpoint erwartet snake_case-Felder.
          response_mime_type: 'application/json',
          response_schema: RESULT_SCHEMA,
        },
      };
      response = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey.trim())}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey.trim() },
        body: JSON.stringify(legacyBody),
        signal: controller.signal,
      });
      if (!response.ok) throw await readError(response);
    }

    const parsed = parseResult(extractJson(await response.json() as unknown));
    // Die Richtigkeit wird immer lokal nachgerechnet – das Modell darf hier nicht nachsichtig sein.
    const evaluation = evaluateTranscription(targetWord, parsed.transcription, caseSensitive);
    return { ...parsed, isCorrect: evaluation.correct, differences: evaluation.differences };
  } catch (error) {
    if (error instanceof CheckError) throw error;
    if (signal?.aborted) throw new CheckError('offline', 'Die Prüfung wurde abgebrochen.');
    if (controller.signal.aborted) throw new CheckError('timeout', 'Die Prüfung hat zu lange gedauert.');
    throw new CheckError('unknown', 'Die Prüfung ist fehlgeschlagen.', undefined, String(error));
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

/** Menschlich verständliche Fehlermeldungen für die Kinderoberfläche. */
export function friendlyError(error: unknown): string {
  if (!(error instanceof CheckError)) return 'Die Prüfung hat gerade nicht geklappt. Du kannst das Wort selbst vergleichen.';
  switch (error.code) {
    case 'offline': return 'Du bist gerade offline. Schau selbst nach – das klappt auch ohne KI.';
    case 'auth': return 'Der API-Key funktioniert nicht. Die Eltern können ihn im Elternbereich prüfen.';
    case 'rate-limit': return 'Zu viele Anfragen auf einmal. Warte kurz und versuche es noch einmal.';
    case 'timeout': return 'Die Antwort hat zu lange gewartet. Versuch es noch einmal oder prüfe selbst.';
    case 'bad-request': case 'bad-response': return 'Die Antwort war unklar. Schau selbst nach oder schreib noch einmal.';
    case 'server': return 'Der Prüfdienst ist gerade nicht erreichbar. Du kannst selbst vergleichen.';
    default: return 'Die Prüfung hat gerade nicht geklappt. Du kannst das Wort selbst vergleichen.';
  }
}
