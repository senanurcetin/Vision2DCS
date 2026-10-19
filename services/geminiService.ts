import { Instrument } from "../types";

/**
 * Provider Gemini credentials are server-only. A separately provisioned
 * operator access token is kept in the tab's volatile JS memory, never in
 * localStorage, sessionStorage, source code or engineering backup files.
 */
let accessToken: string | null = null;
export const setAiAccessToken = (token: string | null): void => {
  accessToken = token && token.length >= 32 ? token : null;
};

const postJson = async <T>(url: string, body: unknown): Promise<T> => {
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(accessToken ? { authorization: 'Bearer ' + accessToken } : {}),
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('Could not reach the Vision2DCS server. Check that it is running.');
  }

  const payload = await response.json().catch(() => null) as (T & { error?: string }) | null;
  if (!response.ok || !payload) {
    throw new Error(payload?.error ?? 'Request failed with status ' + response.status + '.');
  }
  return payload;
};

export const analyzePIDImage = async (base64Image: string, mimeType: string): Promise<Instrument[]> => {
  const { instruments } = await postJson<{ instruments: Instrument[] }>('/api/analyze', { image: base64Image, mimeType });
  return instruments;
};

/** Generates a conceptual 3D render based on instrumentation. */
export const generateDigitalTwin = async (instruments: Instrument[]): Promise<string> => {
  const { imageUrl } = await postJson<{ imageUrl: string }>('/api/digital-twin', {
    instruments: instruments.map(({ tagName, description }) => ({ tagName, description })),
  });
  return imageUrl;
};
