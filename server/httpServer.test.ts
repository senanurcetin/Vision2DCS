import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { request as httpRequest } from 'node:http';
import { createAppServer } from './httpServer';
import { MAX_BODY_BYTES, createGeminiApiHandler } from './node';

let server: Server;
let base: string;
let distDir: string;

beforeAll(async () => {
  distDir = await mkdtemp(path.join(tmpdir(), 'vision2dcs-dist-'));
  await mkdir(path.join(distDir, 'assets'));
  await writeFile(path.join(distDir, 'index.html'), '<html>app</html>');
  await writeFile(path.join(distDir, 'assets', 'app.js'), 'console.log(1)');

  // Echo handler: proves the Node adapter forwards method, path and body.
  server = createAppServer({
    distDir,
    handler: async (request) => {
      const { pathname } = new URL(request.url);
      if (!pathname.startsWith('/api/')) return null;
      if (pathname === '/api/header-echo') return Response.json({
        authorization: request.headers.get('authorization'),
      });
      return Response.json({ method: request.method, path: pathname, body: await request.text() });
    },
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise(resolve => server.close(resolve));
  await rm(distDir, { recursive: true, force: true });
});

describe('createAppServer', () => {
  it('forwards /api requests to the handler', async () => {
    const response = await fetch(`${base}/api/analyze`, { method: 'POST', body: '{"a":1}' });
    expect(await response.json()).toEqual({ method: 'POST', path: '/api/analyze', body: '{"a":1}' });
  });

  it('forwards an operator-provided bearer header from Node HTTP into the API handler', async () => {
    const secret = 'operator-auth-token-at-least-thirty-two-characters';
    const response = await fetch(`${base}/api/header-echo`, {
      method: 'POST',
      headers: { authorization: 'Bearer ' + secret },
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ authorization: 'Bearer ' + secret });
  });

  it('rejects a declared oversized payload before reading any body bytes', async () => {
    const received = await new Promise<{ status: number; body: string }>((resolve, reject) => {
      const call = httpRequest(base + '/api/analyze', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'content-length': String(MAX_BODY_BYTES + 1) },
      }, result => {
        let body = '';
        result.setEncoding('utf8');
        result.on('data', chunk => { body += chunk; });
        result.on('end', () => {
          call.destroy(); // The declared oversized upload was never sent.
          resolve({ status: result.statusCode ?? 0, body });
        });
      });
      call.on('error', reject);
      call.setTimeout(4000, () => call.destroy(new Error('Timed out waiting for early HTTP 413.')));
      call.flushHeaders(); // Deliberately never send the declared 15 MiB body.
    });
    expect(received.status).toBe(413);
    expect(JSON.parse(received.body).error).toMatch(/too large/);
  });

  it('immediately rejects chunked bodies crossing the limit without waiting for request end', async () => {
    const received = await new Promise<number>((resolve, reject) => {
      const call = httpRequest(base + '/api/analyze', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'transfer-encoding': 'chunked' },
      }, response => {
        response.resume();
        response.on('end', () => {
          call.destroy();
          resolve(response.statusCode ?? 0);
        });
      });
      call.on('error', reject);
      call.setTimeout(10000, () => call.destroy(new Error('Chunked upload did not receive early 413.')));
      // Never call end(): a server that waits for the full body will time out.
      call.write(Buffer.alloc(MAX_BODY_BYTES + 1));
    });
    expect(received).toBe(413);
  });

  it('rejects request bodies over the limit', async () => {
    const response = await fetch(`${base}/api/analyze`, { method: 'POST', body: 'x'.repeat(MAX_BODY_BYTES + 1) });
    expect(response.status).toBe(413);
  });

  it('serves built assets with long-lived caching', async () => {
    const response = await fetch(`${base}/assets/app.js`);
    expect(await response.text()).toBe('console.log(1)');
    expect(response.headers.get('content-type')).toMatch(/javascript/);
    expect(response.headers.get('cache-control')).toMatch(/immutable/);
  });

  it('falls back to index.html for unknown paths', async () => {
    const response = await fetch(`${base}/some/route`);
    expect(await response.text()).toBe('<html>app</html>');
    expect(response.headers.get('cache-control')).toBe('no-cache');
  });

  it('does not serve files outside the dist directory', async () => {
    const response = await fetch(`${base}/..%2f..%2fetc%2fpasswd`);
    expect(await response.text()).toBe('<html>app</html>');
  });

  it('answers 400 for malformed percent-encoding', async () => {
    expect((await fetch(`${base}/%E0%A4%A`)).status).toBe(400);
  });
});


describe('preflight rejects non-authenticated uploads before body buffering', () => {
  it('returns 401 even when a large declared body has not yet been sent', async () => {
    const handler = createGeminiApiHandler({
      GEMINI_API_KEY: 'offline-test-provider-key',
      VISION2DCS_ENABLE_AI: 'true',
      VISION2DCS_AI_ACCESS_TOKEN: 'offline-long-operator-token-for-testing-123456',
      VISION2DCS_AI_MAX_REQUESTS: '1',
    });
    const protectedServer = createAppServer({ handler, distDir });
    await new Promise<void>(resolve => protectedServer.listen(0, '127.0.0.1', resolve));
    const port = (protectedServer.address() as AddressInfo).port;
    try {
      const status = await new Promise<number>((resolve, reject) => {
        const call = httpRequest('http://127.0.0.1:' + port + '/api/analyze', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'content-length': '1000000' },
        }, response => {
          response.resume();
          response.on('end', () => {
            call.destroy();
            resolve(response.statusCode ?? 0);
          });
        });
        call.on('error', reject);
        call.setTimeout(4000, () => call.destroy(new Error('Preflight timed out.')));
        call.flushHeaders(); // No request body is ever transmitted.
      });
      expect(status).toBe(401);
    } finally {
      await new Promise<void>(resolve => protectedServer.close(() => resolve()));
    }
  });
});
