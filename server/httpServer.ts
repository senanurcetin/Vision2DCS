import { createServer, type Server } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { ApiHandler, handleNodeApiRequest } from './node';

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

const isFile = async (file: string) => (await stat(file).catch(() => null))?.isFile() ?? false;

/** Production server: the /api routes plus the built SPA from distDir. */
export const createAppServer = ({ handler, distDir }: { handler: ApiHandler; distDir: string }): Server => {
  const root = path.resolve(distDir);

  return createServer(async (req, res) => {
    try {
      if (await handleNodeApiRequest(handler, req, res)) return;

      const { pathname } = new URL(req.url ?? '/', 'http://localhost');
      let decoded: string;
      try {
        decoded = decodeURIComponent(pathname);
      } catch {
        res.writeHead(400, { 'content-type': 'text/plain' });
        res.end('Bad request');
        return;
      }
      const requested = path.resolve(root, '.' + decoded);
      const inRoot = requested === root || requested.startsWith(root + path.sep);
      // Unknown paths fall back to index.html so client-side routes work.
      const file = inRoot && await isFile(requested) ? requested : path.join(root, 'index.html');

      const body = await readFile(file);
      const type = CONTENT_TYPES[path.extname(file)] ?? 'application/octet-stream';
      const cache = file.includes(`${path.sep}assets${path.sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache';
      res.writeHead(200, { 'content-type': type, 'cache-control': cache });
      res.end(body);
    } catch (e) {
      console.error('Request failed:', e);
      if (!res.headersSent) res.writeHead(500, { 'content-type': 'text/plain' });
      res.end('Internal server error');
    }
  });
};
