import type { IncomingMessage, ServerResponse } from 'node:http';
import { createHash, timingSafeEqual } from 'node:crypto';
import { createApiHandler } from './api';
import { readServerConfig } from './config';
import { createGeminiService, GeminiService } from './gemini';
import { createRateLimiter } from './rateLimit';
import {
  createInferenceConcurrencyGate, createInferenceRequestCap,
  parseAiConcurrency, parseAiRequestCap,
} from './inferenceBudget';

// Base64 inflates the 10 MB image limit by a third, plus JSON overhead.
export const MAX_BODY_BYTES = 15 * 1024 * 1024;

export type ApiHandler = ((request: Request, clientId: string) => Promise<Response | null>) & {
  preflight?: (request: Request) => Response | null;
};

/** Live provider requests require explicit enablement and a separate operator token. */
export const createGeminiApiHandler = (env: Record<string, string | undefined>): ApiHandler => {
  const config = readServerConfig(env);
  const secret = env.VISION2DCS_AI_ACCESS_TOKEN;
  const requestCap = parseAiRequestCap(env.VISION2DCS_AI_MAX_REQUESTS);
  const concurrencyLimit = parseAiConcurrency(env.VISION2DCS_AI_MAX_CONCURRENT ?? '2');
  const aiEnabled = env.VISION2DCS_ENABLE_AI === 'true'
    && typeof secret === 'string' && secret.length >= 32
    && !!config.apiKey && requestCap !== null && concurrencyLimit !== null;
  const expectedDigest = aiEnabled ? createHash('sha256').update(secret ?? '').digest() : null;
  let gemini: GeminiService | null = null;
  return createApiHandler({
    aiEnabled,
    reserveInference: aiEnabled ? createInferenceRequestCap(requestCap ?? 1) : () => false,
    acquireInferenceSlot: aiEnabled ? createInferenceConcurrencyGate(concurrencyLimit ?? 1) : () => null,
    authorizeRequest: (request: Request) => {
      if (!expectedDigest) return false;
      const header = request.headers.get('authorization');
      if (!header?.startsWith('Bearer ') || header.length > 1024) return false;
      const provided = header.slice(7);
      if (!provided || provided !== provided.trim()) return false;
      const actualDigest = createHash('sha256').update(provided).digest();
      return timingSafeEqual(actualDigest, expectedDigest);
    },
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

// Reject immediately upon crossing the body limit. Continue draining the
// inbound stream without buffering it so HTTP clients can receive a 413.
const readBody = (req: IncomingMessage, maxBytes: number): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    let chunks: Buffer[] = [];
    let size = 0;
    let exceeded = false;
    req.on('data', (chunk: Buffer) => {
      if (exceeded) return;
      size += chunk.length;
      if (size > maxBytes) {
        exceeded = true;
        chunks = [];
        reject(new BodyTooLargeError());
        req.resume(); // Drain any remaining bytes without awaiting request end.
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!exceeded) resolve(Buffer.concat(chunks));
    });
    req.on('error', reject);
  });

const sendError = (res: ServerResponse, status: number, message: string) => {
  res.writeHead(status, {
    'content-type': 'application/json',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
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

  // Reject declared over-limit uploads without buffering a 15+ MiB body.
  // Drain the socket to keep the connection protocol in a consistent state.
  const declaredLength = req.headers['content-length'];
  if (typeof declaredLength === 'string' && /^[0-9]+$/.test(declaredLength) &&
      Number(declaredLength) > MAX_BODY_BYTES) {
    req.resume();
    sendError(res, 413, 'Request body is too large.');
    return true;
  }

  const headers = {
    'content-type': String(req.headers['content-type'] ?? ''),
    ...(typeof req.headers.authorization === 'string'
      ? { authorization: req.headers.authorization }
      : {}),
  };

  // Refuse unauthorized or disabled AI calls before allocating upload buffers.
  if (handler.preflight) {
    const refused = handler.preflight(new Request(url, { method: req.method, headers }));
    if (refused) {
      req.resume();
      res.writeHead(refused.status, Object.fromEntries(refused.headers));
      res.end(Buffer.from(await refused.arrayBuffer()));
      return true;
    }
  }

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
    headers,
    body: body ? new Uint8Array(body) : undefined,
  });
  const response = await handler(request, req.socket.remoteAddress ?? 'unknown');
  if (!response) return false;

  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
  return true;
};
