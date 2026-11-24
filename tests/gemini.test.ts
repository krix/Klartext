import { describe, expect, it, vi } from 'vitest';
import { CheckError, checkHandwriting, isRetryableCheckError, MIN_CONFIDENCE, RESULT_SCHEMA, testGeminiConnection } from '../src/lib/gemini';

const PNG = 'data:image/png;base64,iVBORw0KGgo=';

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const aiJson = JSON.stringify({
  transcription: 'liebe',
  isCorrect: true,
  confidence: 0.9,
  differences: [],
  feedback: 'Super gemacht!',
  illegible: false,
});

const baseRequest = {
  imageDataUrl: PNG,
  targetWord: 'Liebe',
  caseSensitive: false,
  apiKey: 'test-key',
  model: 'gemini-3.5-flash-lite',
};

describe('Gemini-Client', () => {
  it('liest die aktuelle Interactions-Antwort und rechnet die Richtigkeit lokal nach', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({
      steps: [{ type: 'model_output', content: [{ type: 'text', text: aiJson }] }],
    }));
    const result = await checkHandwriting({ ...baseRequest, fetchImpl: fetchMock as unknown as typeof fetch });
    expect(result.transcription).toBe('liebe');
    expect(result.isCorrect).toBe(true);
    const body = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    expect(body.response_format.mime_type).toBe('application/json');
    expect(body.store).toBe(false);
    expect(body.input[1].mime_type).toBe('image/png');
  });

  it('fragt blind ab, damit das Modell das Zielwort nicht in Kritzeleien hineinliest', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({
      steps: [{ content: [{ text: aiJson }] }],
    }));
    await checkHandwriting({ ...baseRequest, fetchImpl: fetchMock as unknown as typeof fetch });
    const prompt = String(JSON.parse(String(fetchMock.mock.calls[0][1].body)).input[0].text);
    expect(prompt).not.toContain(baseRequest.targetWord);
    expect(prompt).toContain('kennst das gesuchte Wort NICHT');
    expect(Object.keys(RESULT_SCHEMA.properties)).toEqual(['transcription', 'confidence', 'illegible', 'feedback']);
  });

  it('behandelt unlesbare oder unsichere Lesungen als Wiederholung, nicht als Fehler', async () => {
    const cases = [
      { transcription: '', confidence: 0.95, illegible: false },
      { transcription: 'Liebe', confidence: MIN_CONFIDENCE - 0.1, illegible: false },
      { transcription: 'Liebe', confidence: 0.95, illegible: true },
    ];
    for (const answer of cases) {
      const fetchMock = vi.fn().mockResolvedValue(response({
        steps: [{ content: [{ text: JSON.stringify({ ...answer, feedback: '', differences: [], isCorrect: true }) }] }],
      }));
      const result = await checkHandwriting({ ...baseRequest, fetchImpl: fetchMock as unknown as typeof fetch });
      expect(result.illegible).toBe(true);
      expect(result.isCorrect).toBe(false);
      expect(result.differences).toEqual([]);
    }
  });

  it('korrigiert ein zu nachsichtiges Modell', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({
      steps: [{ content: [{ text: JSON.stringify({
        transcription: 'lieber', isCorrect: true, confidence: 0.9, differences: [], feedback: '', illegible: false,
      }) }] }],
    }));
    const result = await checkHandwriting({ ...baseRequest, fetchImpl: fetchMock as unknown as typeof fetch });
    expect(result.isCorrect).toBe(false);
    expect(result.differences).toHaveLength(1);
  });

  it('fällt bei 404 auf den klassischen Endpoint zurück', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({ error: { code: 'not_found', message: 'model not found' } }, 404))
      .mockResolvedValueOnce(response({ candidates: [{ content: { parts: [{ text: aiJson }] } }] }));
    const result = await checkHandwriting({ ...baseRequest, fetchImpl: fetchMock as unknown as typeof fetch });
    expect(result.isCorrect).toBe(true);
    expect(String(fetchMock.mock.calls[1][0])).toContain(':generateContent?key=test-key');
    const legacy = JSON.parse(String(fetchMock.mock.calls[1][1].body));
    expect(legacy.generationConfig.response_mime_type).toBe('application/json');
  });

  it('mapped Authentifizierungsfehler und kaputtes JSON', async () => {
    const authFetch = vi.fn().mockResolvedValue(response({ error: { code: 401, message: 'bad key' } }, 401));
    await expect(checkHandwriting({ ...baseRequest, fetchImpl: authFetch as unknown as typeof fetch }))
      .rejects.toMatchObject({ code: 'auth' });

    const brokenFetch = vi.fn().mockResolvedValue(response({ steps: [{ content: [{ text: 'kein json' }] }] }));
    await expect(checkHandwriting({ ...baseRequest, fetchImpl: brokenFetch as unknown as typeof fetch }))
      .rejects.toBeInstanceOf(CheckError);
  });
});

describe('Verbindungstest', () => {
  const testRequest = {
    apiKey: 'test-key',
    model: 'gemini-3.5-flash-lite',
    imageDataUrl: PNG,
  };

  it('meldet Erfolg bei einer gültigen Antwort über denselben Pfad wie die Prüfung', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({
      steps: [{ content: [{ text: aiJson }] }],
    }));
    const result = await testGeminiConnection({ ...testRequest, fetchImpl: fetchMock as unknown as typeof fetch });
    expect(result.ok).toBe(true);
    expect(result.message).toContain('OK');
    const body = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    expect(body.store).toBe(false);
    expect(body.input[1].mime_type).toBe('image/png');
  });

  it('gibt bei einem abgelehnten Key einen verständlichen Grund zurück', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({
      error: { status: 'UNAUTHENTICATED', message: 'API key not valid' },
    }, 401));
    const result = await testGeminiConnection({ ...testRequest, fetchImpl: fetchMock as unknown as typeof fetch });
    expect(result.ok).toBe(false);
    expect(result.message).toContain('API-Key');
    expect(result.detail).toContain('HTTP 401');
    expect(result.detail).toContain('API key not valid');
  });

  it('erkennt den Legacy-Fallback ebenfalls als erfolgreiche Verbindung', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({ error: { code: 'not_found', message: 'model not found' } }, 404))
      .mockResolvedValueOnce(response({ candidates: [{ content: { parts: [{ text: aiJson }] } }] }));
    const result = await testGeminiConnection({ ...testRequest, fetchImpl: fetchMock as unknown as typeof fetch });
    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('fragt ohne Key nicht erst das Netzwerk an', async () => {
    const fetchMock = vi.fn();
    const result = await testGeminiConnection({ ...testRequest, apiKey: '  ', fetchImpl: fetchMock as unknown as typeof fetch });
    expect(result.ok).toBe(false);
    expect(result.message).toContain('API-Key');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('meldet ein fehlgeschlagenes Limit mit dem API-Code', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({
      error: { code: 429, reason: 'rate_limit_exceeded', message: 'Quota exceeded' },
    }, 429));
    const result = await testGeminiConnection({ ...testRequest, fetchImpl: fetchMock as unknown as typeof fetch });
    expect(result.ok).toBe(false);
    expect(result.message).toContain('Limit');
    expect(result.detail).toContain('rate_limit_exceeded');
  });

  it('erkennt einen ungültigen Key auch im Array-Fehlerformat der Interactions-API', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response([{
      error: {
        code: 400,
        status: 'INVALID_ARGUMENT',
        message: 'API key not valid. Please pass a valid API key.',
        details: [{ reason: 'API_KEY_INVALID' }],
      },
    }], 400));
    const result = await testGeminiConnection({ ...testRequest, fetchImpl: fetchMock as unknown as typeof fetch });
    expect(result.ok).toBe(false);
    expect(result.message).toContain('API-Key');
    expect(result.detail).toContain('API_KEY_INVALID');
  });

  it('bietet nur bei vorübergehenden Fehlern einen zweiten Versuch an', () => {
    expect(isRetryableCheckError(new CheckError('server', 'weg'))).toBe(true);
    expect(isRetryableCheckError(new CheckError('rate-limit', 'zu viele'))).toBe(true);
    expect(isRetryableCheckError(new CheckError('auth', 'falscher Key'))).toBe(false);
    expect(isRetryableCheckError(new Error('unbekannt'))).toBe(false);
  });

  it('sendet nur CORS-fähige Header – eigene Header brechen den Preflight', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({
      steps: [{ content: [{ text: aiJson }] }],
    }));
    await testGeminiConnection({ ...testRequest, fetchImpl: fetchMock as unknown as typeof fetch });
    const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>;
    expect(Object.keys(headers).map((name) => name.toLowerCase()).sort()).toEqual(['content-type', 'x-goog-api-key']);
  });
});
