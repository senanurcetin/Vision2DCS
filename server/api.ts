import { decodedBase64Bytes, isValidCanonicalBase64, matchesRasterSignature } from './base64';
import type { GeminiService } from './gemini';
import { ModelOutputError } from '../services/normalizeInstruments';

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
// Decoded image size accepted by /api/analyze. The HTTP body limit sits above this.
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_TWIN_INSTRUMENTS = 200;
const MAX_TWIN_TAG_CHARS = 64;
const MAX_TWIN_DESCRIPTION_CHARS = 500;

export interface ApiDeps {
  /** Returns the Gemini service, or null when the server has no API key. */
  getGemini: () => GeminiService | null;
  /** Returns false when the client has exhausted its request budget. */
  allowRequest: (clientId: string) => boolean;
  /** Production server defaults to disabled; explicit operator opt-in required. */
  aiEnabled?: boolean;
  authorizeRequest?: (request: Request) => boolean;
  /** Reserve one application-level provider invocation; must fail closed. */
  reserveInference?: () => boolean;
  log?: (message: string, error: unknown) => void;
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const error = (status: number, message: string) => json(status, { error: message });



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
export const createApiHandler = ({ getGemini, allowRequest, aiEnabled = false, authorizeRequest = () => false,
  reserveInference = () => false, log = console.error }: ApiDeps) =>
  async (request: Request, clientId: string): Promise<Response | null> => {
    const { pathname } = new URL(request.url);
    if (!pathname.startsWith('/api/')) return null;

    const route = pathname === '/api/analyze' || pathname === '/api/digital-twin' ? pathname : null;
    if (!route) return error(404, 'Not found');
    if (request.method !== 'POST') return error(405, 'Method not allowed');
    // Refuse anonymous paid inference BEFORE rate limiting, parsing or provider access.
    if (!aiEnabled) return error(503, 'AI endpoints are disabled by server configuration.');
    if (!authorizeRequest(request)) return error(401, 'AI access token is missing or invalid.');
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
        if (decodedBase64Bytes(image) > MAX_IMAGE_BYTES) return error(413, 'Image is too large (max 10 MB).');
        if (!isValidCanonicalBase64(image)) return error(400, 'Image data must be valid base64.');
        if (!matchesRasterSignature(image, mimeType)) {
          return error(400, 'Image bytes do not match the declared JPEG, PNG or WebP format.');
        }

        if (!reserveInference()) return error(429, 'The AI request cap for this process has been reached.');
        const instruments = await gemini.analyze({ data: image, mimeType });
        return json(200, { instruments });
      }

      const { instruments } = body;
      if (!Array.isArray(instruments) || instruments.length === 0) {
        return error(400, 'Provide at least one instrument.');
      }
      if (instruments.length > MAX_TWIN_INSTRUMENTS) {
        // Never silently omit equipment from an engineering drawing.
        return error(413, 'Too many instruments (max 200).');
      }
      const summary: Array<{ tagName: string; description: string }> = [];
      for (const instrument of instruments) {
        if (!instrument || typeof instrument !== 'object' || Array.isArray(instrument)) {
          return error(400, 'Each instrument must be an object.');
        }
        const { tagName, description } = instrument as Record<string, unknown>;
        if (typeof tagName !== 'string' || !tagName.trim() || tagName.length > MAX_TWIN_TAG_CHARS) {
          return error(400, 'Each instrument needs a tag name (max 64 characters).');
        }
        if (typeof description !== 'string' || description.length > MAX_TWIN_DESCRIPTION_CHARS) {
          return error(400, 'Each instrument needs a description (max 500 characters).');
        }
        summary.push({ tagName, description });
      }
      if (!reserveInference()) return error(429, 'The AI request cap for this process has been reached.');
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
