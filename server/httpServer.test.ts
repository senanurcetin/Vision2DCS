import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createAppServer } from './httpServer';
import { MAX_BODY_BYTES } from './node';

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
