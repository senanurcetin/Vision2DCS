import { describe, expect, it, vi } from 'vitest';
import { createGeminiApiHandler } from './node';
import { createApiHandler } from './api';
import type { GeminiService } from './gemini';

const token = 'operator-auth-token-at-least-thirty-two-characters';
const fakeGemini = {
  analyze: vi.fn(async () => []),
  digitalTwin: vi.fn(async () => 'data:image/png;base64,AAAA'),
} as unknown as GeminiService;

const req = (authorization?: string, route = '/api/analyze') =>
  new Request('http://localhost' + route, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(authorization ? { authorization } : {}),
    },
    body: JSON.stringify({ image: '', mimeType: 'image/png' }),
  });

describe('default-deny, operator-gated Gemini ingress', () => {
  const baseEnv = { GEMINI_API_KEY: 'invalid-test-key-not-called', VISION2DCS_AI_MAX_REQUESTS: '2' };

  it('fails closed for API key alone and for incomplete operator enablement', async () => {
    const configs = [
      baseEnv,
      { ...baseEnv, VISION2DCS_ENABLE_AI: 'true' },
      { ...baseEnv, VISION2DCS_ENABLE_AI: 'true', VISION2DCS_AI_ACCESS_TOKEN: 'short' },
      { VISION2DCS_ENABLE_AI: 'true', VISION2DCS_AI_ACCESS_TOKEN: token },
      { ...baseEnv, VISION2DCS_ENABLE_AI: 'TRUE', VISION2DCS_AI_ACCESS_TOKEN: token },
      { ...baseEnv, VISION2DCS_ENABLE_AI: 'true', VISION2DCS_AI_ACCESS_TOKEN: token, VISION2DCS_AI_MAX_REQUESTS: '0' },
      { ...baseEnv, VISION2DCS_ENABLE_AI: 'true', VISION2DCS_AI_ACCESS_TOKEN: token, VISION2DCS_AI_MAX_REQUESTS: '1001' },
      { GEMINI_API_KEY: baseEnv.GEMINI_API_KEY, VISION2DCS_ENABLE_AI: 'true', VISION2DCS_AI_ACCESS_TOKEN: token },
    ];
    for (const config of configs) {
      const handler = createGeminiApiHandler(config);
      const response = await handler(req('Bearer ' + token), 'test-client');
      expect(response?.status).toBe(503);
      expect((await response?.json()).error).toContain('disabled');
    }
  });

  it('rejects missing, modified, overlong and malformed credentials before parsing', async () => {
    const handler = createGeminiApiHandler({
      ...baseEnv, VISION2DCS_ENABLE_AI: 'true', VISION2DCS_AI_ACCESS_TOKEN: token,
    });
    const candidates = [
      undefined, token, 'Bearer wrong', 'bearer ' + token,
      'Bearer ' + token + 'A', 'Bearer ' + token + ' extra',
      'Bearer ' + 'A'.repeat(1200),
    ];
    for (const credential of candidates) {
      const response = await handler(req(credential), 'test-client');
      expect(response?.status).toBe(401);
    }
  });

  it('accepts the authorized header but refuses invalid payload before model invocation', async () => {
    const handler = createGeminiApiHandler({
      ...baseEnv, VISION2DCS_ENABLE_AI: 'true', VISION2DCS_AI_ACCESS_TOKEN: token,
    });
    const response = await handler(req('Bearer ' + token), 'test-client');
    expect(response?.status).toBe(400);
    expect((await response?.json()).error).toContain('Missing image data');
  });

  it('keeps unauthorized and disabled requests away from billing, rate limits and body parsing', async () => {
    const getGemini = vi.fn(() => fakeGemini);
    const allowRequest = vi.fn(() => true);
    const handler = createApiHandler({
      getGemini, allowRequest, aiEnabled: true, authorizeRequest: () => false,
      reserveInference: () => true,
      acquireInferenceSlot: () => () => {},
    });
    const denied = await handler(new Request('http://localhost/api/digital-twin', {
      method: 'POST', body: '{malformed-json',
    }), 'test-client');
    expect(denied?.status).toBe(401);
    expect(getGemini).not.toHaveBeenCalled();
    expect(allowRequest).not.toHaveBeenCalled();

    const disabled = createApiHandler({
      getGemini, allowRequest, aiEnabled: false, authorizeRequest: () => true,
      reserveInference: () => true,
      acquireInferenceSlot: () => () => {},
    });
    expect((await disabled(req('Bearer ' + token), 'test-client'))?.status).toBe(503);
    expect(getGemini).not.toHaveBeenCalled();
    expect(allowRequest).not.toHaveBeenCalled();
  });

  it('performs header-only authorization without consuming quotas', () => {
    const handler = createGeminiApiHandler({
      ...baseEnv, VISION2DCS_ENABLE_AI: 'true', VISION2DCS_AI_ACCESS_TOKEN: token,
    });
    const valid = new Request('http://localhost/api/analyze', {
      method: 'POST', headers: { authorization: 'Bearer ' + token },
    });
    expect(handler.preflight?.(new Request('http://localhost/api/analyze', { method: 'POST' }))?.status).toBe(401);
    expect(handler.preflight?.(valid)).toBeNull();
    expect(handler.preflight?.(new Request('http://localhost/index.html'))).toBeNull();
    expect(handler.preflight?.(new Request('http://localhost/api/no-such-route'))?.status).toBe(404);
    expect(handler.preflight?.(new Request('http://localhost/api/analyze'))?.status).toBe(405);
  });

  it('requires POST and returns 404 for unknown API routes without authenticating', async () => {
    const handler = createGeminiApiHandler({
      ...baseEnv, VISION2DCS_ENABLE_AI: 'true', VISION2DCS_AI_ACCESS_TOKEN: token,
    });
    const unknown = await handler(req(undefined, '/api/not-a-route'), 'test-client');
    expect(unknown?.status).toBe(404);
    const wrongMethod = await handler(new Request('http://localhost/api/analyze'), 'test-client');
    expect(wrongMethod?.status).toBe(405);
  });
});
