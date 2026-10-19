import { afterEach, describe, expect, it, vi } from 'vitest';
import { analyzePIDImage, generateDigitalTwin, setAiAccessToken } from './geminiService';

afterEach(() => {
  setAiAccessToken(null);
  vi.unstubAllGlobals();
});

describe('volatile browser AI access header', () => {
  it('adds only an operator token to AI requests when explicitly configured', async () => {
    const calls: Array<{ url: string; options: RequestInit }> = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, options: RequestInit) => {
      calls.push({ url, options });
      return new Response(JSON.stringify(url.includes('digital-twin')
        ? { imageUrl: 'data:image/png;base64,AAAA' }
        : { instruments: [] }), { status: 200 });
    }));
    const token = 'operator-auth-token-at-least-thirty-two-characters';
    await analyzePIDImage('AAAA', 'image/png');
    setAiAccessToken(token);
    await analyzePIDImage('AAAA', 'image/png');
    await generateDigitalTwin([]);
    setAiAccessToken(null);
    await analyzePIDImage('AAAA', 'image/png');

    expect(calls.map(x => x.url)).toEqual([
      '/api/analyze', '/api/analyze', '/api/digital-twin', '/api/analyze',
    ]);
    expect(calls[0].options.headers).not.toHaveProperty('authorization');
    expect(calls[1].options.headers).toMatchObject({ authorization: 'Bearer ' + token });
    expect(calls[2].options.headers).toMatchObject({ authorization: 'Bearer ' + token });
    expect(calls[3].options.headers).not.toHaveProperty('authorization');
    for (const call of calls) {
      expect(JSON.stringify(call.options.body)).not.toContain(token);
    }
  });

  it('does not attach short credentials or misinterpret them as a provider key', async () => {
    const fake = vi.fn(async (_url: string, options: RequestInit) => {
      expect(options.headers).not.toHaveProperty('authorization');
      return new Response(JSON.stringify({ instruments: [] }), { status: 200 });
    });
    vi.stubGlobal('fetch', fake);
    setAiAccessToken('short');
    await analyzePIDImage('AAAA', 'image/png');
    expect(fake).toHaveBeenCalledOnce();
  });
});
