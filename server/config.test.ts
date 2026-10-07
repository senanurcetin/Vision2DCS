import { describe, expect, it } from 'vitest';
import { DEFAULT_ANALYSIS_MODEL, DEFAULT_IMAGE_MODEL, readServerConfig } from './config';

describe('readServerConfig', () => {
  it('uses default models and treats a blank key as missing', () => {
    expect(readServerConfig({ GEMINI_API_KEY: '  ' })).toEqual({
      apiKey: undefined,
      analysisModel: DEFAULT_ANALYSIS_MODEL,
      imageModel: DEFAULT_IMAGE_MODEL,
    });
  });

  it('reads overrides from the environment', () => {
    expect(readServerConfig({
      GEMINI_API_KEY: 'key',
      GEMINI_ANALYSIS_MODEL: 'model-a',
      GEMINI_IMAGE_MODEL: 'model-b',
    })).toEqual({ apiKey: 'key', analysisModel: 'model-a', imageModel: 'model-b' });
  });
});
