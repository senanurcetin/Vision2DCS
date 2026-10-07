import type { GeminiService } from './gemini';
import { ModelOutputError } from '../services/normalizeInstruments';

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
// Decoded image size accepted by /api/analyze. The HTTP body limit sits above this.
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_TWIN_INSTRUMENTS = 200;

export interface ApiDeps {
  /** Returns the Gemini service, or null when the server has no API key. */
  getGemini: () => GeminiService | null;
  /** Returns false when the client has exhausted its request budget. */
  allowRequest: (clientId: string) => boolean;
  log?: (message: string, error: unknown) => void;
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const error = (status: number, message: string) => json(status, { error: message });

const decodedSize = (base64: string) => Math.floor((base64.length * 3) / 4);

const readJson = async (request: Request): Promise<Record<string, unknown> | null> => {
  try {
    const body = await request.json();
    return typeof body === 'object' && body !== null && !Array.isArray(body) ? body as Record<string, unknown> : null;
  } catch {
    return null;
  }
};

/**
 * Web-standard handler for the /api routes. Returns null for paths it does not
 * own so hosts can fall through to static files.
 */
export const createApiHandler = ({ getGemini, allowRequest, log = console.error }: ApiDeps) =>
  async (request: Request, clientId: string): Promise<Response | null> => {
    const { pathname } = new URL(request.url);
    if (!pathname.startsWith('/api/')) return null;

    const route = pathname === '/api/analyze' || pathname === '/api/digital-twin' ? pathname : null;
    if (!route) return error(404, 'Not found');
    if (request.method !== 'POST') return error(405, 'Method not allowed');
    if (!allowRequest(clientId)) return error(429, 'Too many requests. Please wait a minute and try again.');

    const gemini = getGemini();
    if (!gemini) return error(503, 'The server has no GEMINI_API_KEY configured.');

    const body = await readJson(request);
    if (!body) return error(400, 'Request body must be a JSON object.');

    try {
      if (route === '/api/analyze') {
        const { image, mimeType } = body;
        if (typeof mimeType !== 'string' || !ALLOWED_IMAGE_TYPES.includes(mimeType)) {
          return error(400, 'Unsupported image type. Use JPEG, PNG or WebP.');
        }
        if (typeof image !== 'string' || image.length === 0) return error(400, 'Missing image data.');
        if (decodedSize(image) > MAX_IMAGE_BYTES) return error(413, 'Image is too large (max 10 MB).');

        const instruments = await gemini.analyze({ data: image, mimeType });
        return json(200, { instruments });
      }

      const { instruments } = body;
      if (!Array.isArray(instruments) || instruments.length === 0) {
        return error(400, 'Provide at least one instrument.');
      }
      const summary = instruments.slice(0, MAX_TWIN_INSTRUMENTS).map(i => ({
        tagName: String((i as Record<string, unknown>)?.tagName ?? ''),
        description: String((i as Record<string, unknown>)?.description ?? ''),
      }));
      const imageUrl = await gemini.digitalTwin(summary);
      return json(200, { imageUrl });
    } catch (e) {
      log(`Gemini request to ${route} failed:`, e);
      const status = (e as { status?: unknown })?.status;
      if (status === 429) return error(503, 'The AI service is rate limited. Please try again shortly.');
      if (status === 401 || status === 403 || (e instanceof Error && e.message.includes('API_KEY_INVALID'))) {
        return error(503, "The server's GEMINI_API_KEY was rejected by the AI service.");
      }
      if (e instanceof ModelOutputError) return error(502, `${e.message}.`);
      return error(502, 'The AI service request failed.');
    }
  };
