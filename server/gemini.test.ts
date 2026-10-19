import { beforeEach, describe, expect, it, vi } from 'vitest';

// All tests run offline; importing server/gemini must never call the provider.
const sdk = vi.hoisted(() => ({
  generateContent: vi.fn(),
  keys: [] as string[],
}));

vi.mock('@google/genai', () => ({
  Type: { ARRAY: 'ARRAY', OBJECT: 'OBJECT', STRING: 'STRING', NUMBER: 'NUMBER' },
  GoogleGenAI: class {
    models = { generateContent: sdk.generateContent };
    constructor({ apiKey }: { apiKey: string }) {
      sdk.keys.push(apiKey);
    }
  },
}));

import { ModelOutputError } from '../services/normalizeInstruments';
import { createGeminiService } from './gemini';

const service = () => createGeminiService({
  apiKey: 'offline-test-key',
  analysisModel: 'analysis-test-model',
  imageModel: 'image-test-model',
});

describe('GenAI 2.x generateContent contract (offline)', () => {
  beforeEach(() => {
    sdk.generateContent.mockReset();
    sdk.keys.length = 0;
  });

  it('sends server-side image and JSON schema to models.generateContent and parses text response', async () => {
    sdk.generateContent.mockResolvedValue({
      text: JSON.stringify([{ tagName: 'PT-101', signalType: 'AI', pcs7BlockType: 'MonAnL', confidence: 'medium' }]),
    });
    const output = await service().analyze({ mimeType: 'image/png', data: 'AAAA' });
    expect(output).toHaveLength(1);
    expect(output[0]).toMatchObject({ tagName: 'PT-101', signalType: 'AI', pcs7BlockType: 'MonAnL' });
    expect(sdk.keys).toEqual(['offline-test-key']);
    expect(sdk.generateContent).toHaveBeenCalledTimes(1);
    const request = sdk.generateContent.mock.calls[0][0];
    expect(request.model).toBe('analysis-test-model');
    expect(request.contents.parts[0].inlineData).toEqual({ mimeType: 'image/png', data: 'AAAA' });
    expect(request.config.responseMimeType).toBe('application/json');
    expect(request.config.responseSchema.type).toBe('ARRAY');
    expect(JSON.stringify(request)).not.toContain('offline-test-key');
  });

  it('returns only bounded raster inlineData for generated diagrams', async () => {
    sdk.generateContent.mockResolvedValue({
      candidates: [{
        content: {
          parts: [
            { text: 'not an image' },
            { inlineData: { mimeType: 'image/png', data: 'AQID' } },
          ],
        },
      }],
    });
    const output = await service().digitalTwin([{ tagName: 'PT-101', description: 'Pressure' }]);
    expect(output).toBe('data:image/png;base64,AQID');
    expect(sdk.generateContent.mock.calls[0][0].model).toBe('image-test-model');
  });

  it('rejects HTML, SVG and malformed base64 even if provider returns inlineData', async () => {
    for (const unsafe of [
      { mimeType: 'text/html', data: 'AAAA' },
      { mimeType: 'image/svg+xml', data: 'AAAA' },
      { mimeType: 'image/png', data: '!!!' },
      { mimeType: 'image/png', data: 'A' },
    ]) {
      sdk.generateContent.mockResolvedValue({
        candidates: [{ content: { parts: [{ inlineData: unsafe }] } }],
      });
      await expect(service().digitalTwin([{ tagName: 'PT-101', description: 'Pressure' }]))
        .rejects.toThrow(ModelOutputError);
    }
    expect(sdk.generateContent).toHaveBeenCalledTimes(4);
  });

  it('does not retry transient errors into multiple app-level provider calls', async () => {
    const transient = Object.assign(new Error('offline upstream 503'), { status: 503 });
    sdk.generateContent.mockRejectedValue(transient);
    await expect(service().analyze({ mimeType: 'image/png', data: 'AAAA' })).rejects.toBe(transient);
    expect(sdk.generateContent).toHaveBeenCalledTimes(1);
    sdk.generateContent.mockClear();
    await expect(service().digitalTwin([{ tagName: 'PT-101', description: 'Pressure' }]))
      .rejects.toBe(transient);
    expect(sdk.generateContent).toHaveBeenCalledTimes(1);
  });

  it('rejects oversized generated inline image payloads', async () => {
    sdk.generateContent.mockResolvedValue({
      candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/webp', data: 'A'.repeat(4 * 1024 * 1024 * 5) } }] } }],
    });
    await expect(service().digitalTwin([{ tagName: 'PT-101', description: 'Pressure' }]))
      .rejects.toThrow('No valid raster image generated');
  });
});
