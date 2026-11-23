import { describe, expect, it, vi } from 'vitest';
import { CheckError, checkHandwriting } from '../src/lib/gemini';

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
