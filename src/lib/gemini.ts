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

/**
 * Mindest-Sicherheit für eine verwertbare Lesung. Alles darunter ist eine
 * Wiederholungsbitte, kein Rechtschreibfehler.
 */
export const MIN_CONFIDENCE = 0.7;

/** Das Modell liefert nur eine blinde Lesung; Richtigkeit und Abweichungen rechnet die App lokal aus. */
export const RESULT_SCHEMA = {
  type: 'object',
  properties: {
    transcription: { type: 'string', description: 'Genau das gelesene Wort; leerer String, wenn nichts Lesbares zu erkennen ist' },
    confidence: { type: 'number', description: 'Sicherheit der Lesung zwischen 0 und 1' },
    illegible: { type: 'boolean', description: 'true, wenn die Zeichen kein eindeutig lesbares Wort ergeben' },
    feedback: { type: 'string', description: 'Kurze deutsche Beschreibung der Lesbarkeit, maximal zwei Sätze' },
  },
  required: ['transcription', 'confidence', 'illegible', 'feedback'],
} as const;

function buildPrompt(): string {
  // Das Zielwort wird absichtlich NICHT genannt: sonst "erkennt" das Modell
  // das gewünschte Wort auch in wirren Linien (Anchoring).
  return `Du bist ein geduldiger Helfer für Kinder der 5./6. Klasse. Auf dem Bild steht handschriftlich genau EIN Wort.
Du kennst das gesuchte Wort NICHT. Lies das Bild deshalb ganz neutral und schreibe in "transcription" genau das, was wirklich dasteht. Achte auf die tatsächliche Groß-/Kleinschreibung.

Ganz wichtig:
- Wirre Linien, Kritzeln, Kreise oder Striche, die keine Buchstaben ergeben, sind KEIN Wort: transcription = "" und illegible = true.
- Wenn du dir bei Buchstaben unsicher bist, setze illegible = true und eine niedrige confidence. Rate nicht.
- Schiefe, unruhige oder leicht unsaubere, aber erkennbare Buchstaben sind normale Handschrift: transcription = gelesenes Wort, illegible = false.

"confidence" ist deine Sicherheit zwischen 0 und 1. "feedback" ist ein kurzer, freundlicher deutscher Satz nur zur Lesbarkeit, ohne Tadel und ohne Note.
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

interface ApiErrorShape {
  status?: string;
  code?: string | number;
  reason?: string;
  message?: string;
  details?: Array<{ reason?: string }>;
}

/** Die API liefert je nach Endpoint {error:...} oder [{error:...}] – beides verstehen. */
function firstApiError(body: unknown): ApiErrorShape | undefined {
  if (Array.isArray(body)) return body.length ? firstApiError(body[0]) : undefined;
  if (!body || typeof body !== 'object') return undefined;
  const error = (body as Record<string, unknown>).error;
  return error && typeof error === 'object' ? error as ApiErrorShape : undefined;
}

async function readError(response: Response): Promise<CheckError> {
  let apiCode = '';
  let apiMessage = '';
  const message = `Die Anfrage schlug fehl (HTTP ${response.status}).`;
  try {
    const apiError = firstApiError(await response.json());
    const detailReasons = Array.isArray(apiError?.details)
      ? apiError!.details!.map((entry) => entry?.reason).filter(Boolean).map(String)
      : [];
    // Je nach Endpoint heißt der Code "status", "code" oder "reason" – für die Diagnose alles mitnehmen.
    apiCode = [
      apiError?.status,
      apiError?.reason,
      ...detailReasons,
      apiError?.code != null ? String(apiError.code) : undefined,
    ].filter(Boolean).join(' / ');
    apiMessage = apiError?.message ?? '';
  } catch {
    // Manche Proxies liefern nur Klartext zurück.
  }
  const detail = [apiCode, apiMessage].filter(Boolean).join(' – ');
  // Ein ungültiger Key kommt bei der Interactions-API als 400 mit API_KEY_INVALID zurück.
  const authHint = /auth|api_key_invalid|unauthenticated|permission_denied/i.test(apiCode);
  const code: CheckErrorCode = response.status === 401 || response.status === 403 || authHint
    ? 'auth'
    : response.status === 429
      ? 'rate-limit'
      : response.status >= 500
        ? 'server'
        : response.status === 400
          ? 'bad-request'
          : 'unknown';
  return new CheckError(code, message, response.status, detail || undefined);
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
  const prompt = buildPrompt();
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort);
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  // Wichtig: Keine eigenen Header (z. B. "Api-Revision") ergänzen!
  // Solche Header erzwingen einen CORS-Preflight, den die API mit 403 ablehnt.
  const headers = {
    'Content-Type': 'application/json',
    'x-goog-api-key': apiKey.trim(),
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
    const transcription = parsed.transcription.trim();
    // Auch ein überzeugtes Modell darf wirre Linien nicht als Wort durchgehen lassen.
    const illegible = parsed.illegible || transcription.length === 0 || parsed.confidence < MIN_CONFIDENCE;
    // Die Richtigkeit wird ausschließlich lokal aus der blinden Lesung berechnet.
    const evaluation = evaluateTranscription(targetWord, transcription, caseSensitive);
    return {
      ...parsed,
      transcription,
      illegible,
      isCorrect: !illegible && evaluation.correct,
      differences: illegible ? [] : evaluation.differences,
    };
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

/** Kleines Testbild, falls die Oberfläche kein Bild erzeugen kann. */
const FALLBACK_TEST_IMAGE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==';

export interface ConnectionTestRequest {
  apiKey: string;
  model: string;
  /** Optional ein in der UI erzeugtes Testbild mit lesbarem Wort. */
  imageDataUrl?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export interface ConnectionTestResult {
  ok: boolean;
  message: string;
  /** Technischer Grund (HTTP-Status, API-Code) für die Eltern. */
  detail?: string;
}

/** Wandelt Prüfungsfehler in eine diagnosesfreundliche Elternmeldung um. */
function connectionErrorResult(error: unknown): ConnectionTestResult {
  if (!(error instanceof CheckError)) {
    return { ok: false, message: 'Der Verbindungstest ist fehlgeschlagen.', detail: String(error) };
  }
  const detail = [error.status ? `HTTP ${error.status}` : '', error.detail ?? ''].filter(Boolean).join(' – ') || undefined;
  switch (error.code) {
    case 'auth':
      return { ok: false, message: 'Der API-Key wurde abgelehnt. Prüfe den Key und seine Beschränkungen in Google AI Studio.', detail };
    case 'rate-limit':
      return { ok: false, message: 'Das Limit ist erreicht. Warte kurz und versuche es erneut.', detail };
    case 'timeout':
      return { ok: false, message: 'Die Antwort hat zu lange gedauert. Prüfe deine Internetverbindung.', detail };
    case 'offline':
      return { ok: false, message: 'Keine Verbindung zum Prüfdienst erreichbar. Prüfe Internet und Firewall.', detail };
    case 'bad-request':
      return { ok: false, message: 'Die Anfrage wurde abgelehnt. Prüfe vor allem den Modellnamen.', detail };
    case 'bad-response':
      return { ok: false, message: 'Gemini antwortet, aber nicht im erwarteten Format. Versuche ein anderes Modell.', detail };
    case 'server':
      return { ok: false, message: 'Der Prüfdienst ist gerade nicht erreichbar. Bitte später erneut versuchen.', detail };
    default:
      return { ok: false, message: 'Der Verbindungstest ist fehlgeschlagen.', detail };
  }
}

/**
 * Testet Key, Modell, Endpoint und Antwortschema mit einem kleinen Bild.
 * Läuft bewusst über denselben Codepfad wie die echte Handschriftprüfung,
 * damit der Test auch CORS-, Schema- und Bildprobleme findet.
 */
export async function testGeminiConnection(request: ConnectionTestRequest): Promise<ConnectionTestResult> {
  const { apiKey, model } = request;
  if (!apiKey.trim()) {
    return { ok: false, message: 'Bitte zuerst einen API-Key eintragen.' };
  }
  try {
    await checkHandwriting({
      imageDataUrl: request.imageDataUrl || FALLBACK_TEST_IMAGE,
      targetWord: 'Test',
      caseSensitive: false,
      apiKey,
      model,
      timeoutMs: request.timeoutMs,
      fetchImpl: request.fetchImpl,
    });
    return { ok: true, message: 'Verbindung OK – Gemini antwortet mit einer gültigen Prüfung.' };
  } catch (error) {
    return connectionErrorResult(error);
  }
}

/** Nur vorübergehende Störungen verdienen einen zweiten Versuch. */
export function isRetryableCheckError(error: unknown): boolean {
  return error instanceof CheckError
    && ['offline', 'rate-limit', 'timeout', 'server', 'bad-response', 'unknown'].includes(error.code);
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
