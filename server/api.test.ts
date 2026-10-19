import { describe, expect, it, vi } from 'vitest';
import { ModelOutputError } from '../services/normalizeInstruments';
import { createApiHandler, MAX_IMAGE_BYTES } from './api';
import type { GeminiService } from './gemini';

const fakeGemini = (overrides: Partial<GeminiService> = {}): GeminiService => ({
  analyze: vi.fn(async () => [{ tagName: 'PT-101' } as never]),
  digitalTwin: vi.fn(async () => 'data:image/png;base64,AAAA'),
  ...overrides,
});

const setup = (options: { gemini?: GeminiService | null; allow?: boolean } = {}) => {
  const gemini = options.gemini === undefined ? fakeGemini() : options.gemini;
  const handler = createApiHandler({
    getGemini: () => gemini,
    allowRequest: () => options.allow ?? true,
    // Explicit test harness opt-in uses a mock Gemini service, never provider API.
    aiEnabled: true,
    authorizeRequest: () => true,
    log: () => {},
  });
  const call = (path: string, body?: unknown, method = 'POST') =>
    handler(new Request(`http://localhost${path}`, {
      method,
      headers: { 'content-type': 'application/json' },
      body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    }), 'client');
  return { gemini, call };
};

const read = async (response: Response | null) => ({ status: response?.status, body: await response?.json() });

describe('createApiHandler', () => {
  it('ignores paths outside /api', async () => {
    expect(await setup().call('/index.html', undefined, 'GET')).toBeNull();
  });

  it('analyzes a supported image', async () => {
    const { gemini, call } = setup();
    const result = await read(await call('/api/analyze', { image: 'AAAA', mimeType: 'image/png' }));
    expect(result).toEqual({ status: 200, body: { instruments: [{ tagName: 'PT-101' }] } });
    expect(gemini!.analyze).toHaveBeenCalledWith({ data: 'AAAA', mimeType: 'image/png' });
  });

  it('rejects unsupported types, missing data and oversized images', async () => {
    const { call } = setup();
    expect((await call('/api/analyze', { image: 'AAAA', mimeType: 'application/pdf' }))?.status).toBe(400);
    expect((await call('/api/analyze', { mimeType: 'image/png' }))?.status).toBe(400);
    const huge = 'A'.repeat(Math.ceil((MAX_IMAGE_BYTES * 4) / 3) + 8);
    expect((await call('/api/analyze', { image: huge, mimeType: 'image/png' }))?.status).toBe(413);
  });

  it('accepts padded base64 images with the exact decoded byte count', async () => {
    const { gemini, call } = setup();
    for (const image of ['AQ==', 'AAA=', 'AAAAAQ==']) {
      expect((await call('/api/analyze', { image, mimeType: 'image/png' }))?.status).toBe(200);
    }
    expect(gemini!.analyze).toHaveBeenCalledTimes(3);
  });

  it('rejects malformed base64 before invoking the model', async () => {
    const { gemini, call } = setup();
    for (const image of [
      'A', 'AA=', 'AAAA===', 'AAAA?', 'data:image/png;base64,AAAA',
      'A A A A', 'AAAA\n', 'AAAA\r', '-_==',
    ]) {
      const response = await read(await call('/api/analyze', { image, mimeType: 'image/png' }));
      expect(response).toEqual({ status: 400, body: { error: 'Image data must be valid base64.' } });
    }
    expect(gemini!.analyze).not.toHaveBeenCalled();
  });

  it('rejects malformed bodies, wrong methods and unknown routes', async () => {
    const { call } = setup();
    expect((await call('/api/analyze', '{not json'))?.status).toBe(400);
    expect((await call('/api/analyze', [1, 2]))?.status).toBe(400);
    expect((await call('/api/analyze', undefined, 'GET'))?.status).toBe(405);
    expect((await call('/api/unknown', {}))?.status).toBe(404);
  });

  it('returns 503 when no API key is configured', async () => {
    const result = await read(await setup({ gemini: null }).call('/api/analyze', { image: 'AAAA', mimeType: 'image/png' }));
    expect(result.status).toBe(503);
    expect(result.body.error).toMatch(/GEMINI_API_KEY/);
  });

  it('returns 429 when the client is over its budget', async () => {
    expect((await setup({ allow: false }).call('/api/analyze', {}))?.status).toBe(429);
  });

  it('passes model output errors through and hides other upstream details', async () => {
    const modelError = setup({ gemini: fakeGemini({ analyze: async () => { throw new ModelOutputError('AI returned malformed JSON'); } }) });
    expect(await read(await modelError.call('/api/analyze', { image: 'AAAA', mimeType: 'image/png' })))
      .toEqual({ status: 502, body: { error: 'AI returned malformed JSON.' } });

    const upstream = setup({ gemini: fakeGemini({ analyze: async () => { throw new Error('secret internal detail'); } }) });
    const result = await read(await upstream.call('/api/analyze', { image: 'AAAA', mimeType: 'image/png' }));
    expect(result.status).toBe(502);
    expect(result.body.error).not.toMatch(/secret/);

    const limited = setup({ gemini: fakeGemini({ analyze: async () => { throw Object.assign(new Error('quota'), { status: 429 }); } }) });
    expect((await limited.call('/api/analyze', { image: 'AAAA', mimeType: 'image/png' }))?.status).toBe(503);
  });

  it('reports a rejected API key as a server configuration problem', async () => {
    const invalidKey = Object.assign(new Error('{"error":{"code":400,"details":[{"reason":"API_KEY_INVALID"}]}}'), { status: 400 });
    const { call } = setup({ gemini: fakeGemini({ analyze: async () => { throw invalidKey; } }) });
    const result = await read(await call('/api/analyze', { image: 'AAAA', mimeType: 'image/png' }));
    expect(result).toEqual({ status: 503, body: { error: "The server's GEMINI_API_KEY was rejected by the AI service." } });
  });

  it('rejects oversized digital-twin instrument arrays instead of silently dropping equipment', async () => {
    const { gemini, call } = setup();
    const instruments = Array.from({ length: 201 }, (_, n) => ({
      tagName: `PT-${n + 1}`, description: 'Pressure',
    }));
    expect(await read(await call('/api/digital-twin', { instruments }))).toEqual({
      status: 413,
      body: { error: 'Too many instruments (max 200).' },
    });
    expect(gemini!.digitalTwin).not.toHaveBeenCalled();
  });

  it('rejects malformed and unbounded digital-twin metadata before calling the model', async () => {
    const { gemini, call } = setup();
    for (const invalid of [
      null,
      ['PT-101'],
      12,
      { tagName: '', description: 'Pressure' },
      { tagName: '   ', description: 'Pressure' },
      { tagName: 101, description: 'Pressure' },
      { tagName: 'P'.repeat(65), description: 'Pressure' },
      { tagName: 'PT-101' },
      { tagName: 'PT-101', description: null },
      { tagName: 'PT-101', description: 'd'.repeat(501) },
    ]) {
      const response = await call('/api/digital-twin', { instruments: [invalid] });
      expect(response?.status).toBe(400);
    }
    expect(gemini!.digitalTwin).not.toHaveBeenCalled();
  });

  it('accepts the full digital-twin instrument limit without truncation', async () => {
    const { gemini, call } = setup();
    const instruments = Array.from({ length: 200 }, (_, n) => ({
      tagName: `PT-${n + 1}`, description: 'Pressure', estimatedCost: 99,
    }));
    expect((await call('/api/digital-twin', { instruments }))?.status).toBe(200);
    const forwarded = vi.mocked(gemini!.digitalTwin).mock.calls[0][0];
    expect(forwarded).toHaveLength(200);
    expect(forwarded.at(-1)).toEqual({ tagName: 'PT-200', description: 'Pressure' });
    expect(forwarded[0]).not.toHaveProperty('estimatedCost');
  });

  it('generates a digital twin from tag names and descriptions only', async () => {
    const { gemini, call } = setup();
    const result = await read(await call('/api/digital-twin', {
      instruments: [{ tagName: 'PT-101', description: 'Pressure', estimatedCost: 5 }],
    }));
    expect(result).toEqual({ status: 200, body: { imageUrl: 'data:image/png;base64,AAAA' } });
    expect(gemini!.digitalTwin).toHaveBeenCalledWith([{ tagName: 'PT-101', description: 'Pressure' }]);
    expect((await call('/api/digital-twin', { instruments: [] }))?.status).toBe(400);
  });
});
