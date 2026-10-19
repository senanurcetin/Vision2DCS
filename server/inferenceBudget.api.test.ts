import { describe, expect, it, vi } from 'vitest';
import { createApiHandler } from './api';
import { createInferenceConcurrencyGate, createInferenceRequestCap } from './inferenceBudget';
import type { GeminiService } from './gemini';

const PNG_FIXTURE = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO8mSY8AAAAASUVORK5CYII=';
const post = (path: string, body: unknown) => new Request('http://localhost' + path, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

describe('atomic app-level inference request reservations', () => {
  it('shares one cap between analysis and digital-twin routes without charging invalid inputs', async () => {
    const gemini = {
      analyze: vi.fn(async () => []),
      digitalTwin: vi.fn(async () => 'data:image/png;base64,AAAA'),
    } as unknown as GeminiService;
    const handler = createApiHandler({
      getGemini: () => gemini,
      allowRequest: () => true,
      authorizeRequest: () => true,
      aiEnabled: true,
      reserveInference: createInferenceRequestCap(2),
      acquireInferenceSlot: createInferenceConcurrencyGate(2),
      log: () => {},
    });
    const call = (path: string, body: unknown) => handler(post(path, body), 'test-client');
    expect((await call('/api/analyze', { image: 'AAAA', mimeType: 'image/png' }))?.status).toBe(400);
    expect((await call('/api/digital-twin', { instruments: [] }))?.status).toBe(400);
    expect((await call('/api/analyze', { image: PNG_FIXTURE, mimeType: 'image/png' }))?.status).toBe(200);
    expect((await call('/api/digital-twin', {
      instruments: [{ tagName: 'PT-101', description: 'Pressure' }],
    }))?.status).toBe(200);
    expect((await call('/api/analyze', { image: PNG_FIXTURE, mimeType: 'image/png' }))?.status).toBe(429);
    expect((await call('/api/digital-twin', {
      instruments: [{ tagName: 'PT-102', description: 'Pressure' }],
    }))?.status).toBe(429);
    expect(gemini.analyze).toHaveBeenCalledTimes(1);
    expect(gemini.digitalTwin).toHaveBeenCalledTimes(1);
  });

  it('reserves synchronously before a concurrent request can enter the Gemini adapter', async () => {
    const analyze = vi.fn(async () => [] as never[]);
    const gemini = { analyze, digitalTwin: vi.fn() } as unknown as GeminiService;
    const handler = createApiHandler({
      getGemini: () => gemini,
      allowRequest: () => true,
      authorizeRequest: () => true,
      aiEnabled: true,
      reserveInference: createInferenceRequestCap(3),
      acquireInferenceSlot: createInferenceConcurrencyGate(3),
      log: () => {},
    });
    const replies = await Promise.all(Array.from({ length: 12 }, () =>
      handler(post('/api/analyze', { image: PNG_FIXTURE, mimeType: 'image/png' }), 'test-client')));
    expect(replies.filter(reply => reply?.status === 200)).toHaveLength(3);
    expect(replies.filter(reply => reply?.status === 429)).toHaveLength(9);
    expect(analyze).toHaveBeenCalledTimes(3);
  });

  it('consumes one reservation even when the upstream call fails', async () => {
    const analyze = vi.fn(async () => { throw new Error('transient provider failure'); });
    const handler = createApiHandler({
      getGemini: () => ({ analyze, digitalTwin: vi.fn() }) as unknown as GeminiService,
      allowRequest: () => true,
      authorizeRequest: () => true,
      aiEnabled: true,
      reserveInference: createInferenceRequestCap(1),
      acquireInferenceSlot: createInferenceConcurrencyGate(1),
      log: () => {},
    });
    const call = () => handler(post('/api/analyze', { image: PNG_FIXTURE, mimeType: 'image/png' }), 'test-client');
    expect((await call())?.status).toBe(502);
    expect((await call())?.status).toBe(429);
    expect(analyze).toHaveBeenCalledTimes(1);
  });

  it('remains disabled if a caller neglects to explicitly provide an invocation cap', async () => {
    const gemini = { analyze: vi.fn(async () => []), digitalTwin: vi.fn() } as unknown as GeminiService;
    const handler = createApiHandler({
      getGemini: () => gemini, allowRequest: () => true,
      authorizeRequest: () => true, aiEnabled: true, log: () => {},
    });
    const result = await handler(post('/api/analyze', { image: PNG_FIXTURE, mimeType: 'image/png' }), 'test-client');
    expect(result?.status).toBe(429);
    expect(gemini.analyze).not.toHaveBeenCalled();
  });
});
