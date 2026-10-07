import type { IncomingMessage, ServerResponse } from 'node:http';
import { createApiHandler } from './api';
import { readServerConfig } from './config';
import { createGeminiService, GeminiService } from './gemini';
import { createRateLimiter } from './rateLimit';

// Base64 inflates the 10 MB image limit by a third, plus JSON overhead.
export const MAX_BODY_BYTES = 15 * 1024 * 1024;

export type ApiHandler = (request: Request, clientId: string) => Promise<Response | null>;

/** Wires the API to Gemini using env vars (GEMINI_API_KEY, GEMINI_*_MODEL). */
export const createGeminiApiHandler = (env: Record<string, string | undefined>): ApiHandler => {
  const config = readServerConfig(env);
  let gemini: GeminiService | null = null;
  return createApiHandler({
    getGemini: () => {
      const { apiKey } = config;
      if (!apiKey) return null;
      gemini ??= createGeminiService({ ...config, apiKey });
      return gemini;
    },
    allowRequest: createRateLimiter({ limit: 20, windowMs: 60_000 }),
  });
};

class BodyTooLargeError extends Error {}

// Past the limit the rest of the body is drained without being kept, so the
// client still receives a clean 413 instead of a reset connection.
const readBody = (req: IncomingMessage, maxBytes: number): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    let chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > maxBytes) chunks = [];
      else chunks.push(chunk);
    });
    req.on('end', () => (size > maxBytes ? reject(new BodyTooLargeError()) : resolve(Buffer.concat(chunks))));
    req.on('error', reject);
  });

const sendError = (res: ServerResponse, status: number, message: string) => {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ error: message }));
};

/**
 * Runs the API handler for a Node request. Returns false when the path is not
 * an API route so the caller can serve something else.
 */
export const handleNodeApiRequest = async (
  handler: ApiHandler,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  if (!url.pathname.startsWith('/api/')) return false;

  let body: Buffer | undefined;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    try {
      body = await readBody(req, MAX_BODY_BYTES);
    } catch (e) {
      if (e instanceof BodyTooLargeError) sendError(res, 413, 'Request body is too large.');
      else sendError(res, 400, 'Could not read request body.');
      return true;
    }
  }

  const request = new Request(url, {
    method: req.method,
    headers: { 'content-type': String(req.headers['content-type'] ?? '') },
    body: body ? new Uint8Array(body) : undefined,
  });
  const response = await handler(request, req.socket.remoteAddress ?? 'unknown');
  if (!response) return false;

  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
  return true;
};
