import { Instrument } from "../types";

/**
 * Browser client for the server-side Gemini proxy (server/api.ts).
 * The API key lives on the server; the browser only talks to /api.
 */

const postJson = async <T>(url: string, body: unknown): Promise<T> => {
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('Could not reach the Vision2DCS server. Check that it is running.');
  }

  const payload = await response.json().catch(() => null) as (T & { error?: string }) | null;
  if (!response.ok || !payload) {
    throw new Error(payload?.error ?? `Request failed with status ${response.status}.`);
  }
  return payload;
};

export const analyzePIDImage = async (base64Image: string, mimeType: string): Promise<Instrument[]> => {
  const { instruments } = await postJson<{ instruments: Instrument[] }>('/api/analyze', { image: base64Image, mimeType });
  return instruments;
};

/** Generates a conceptual 3D render of the process area based on instrumentation. */
export const generateDigitalTwin = async (instruments: Instrument[]): Promise<string> => {
  const { imageUrl } = await postJson<{ imageUrl: string }>('/api/digital-twin', {
    instruments: instruments.map(({ tagName, description }) => ({ tagName, description })),
  });
  return imageUrl;
};
