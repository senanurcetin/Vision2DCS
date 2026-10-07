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
