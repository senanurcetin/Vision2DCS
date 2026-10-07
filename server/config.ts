export interface ServerConfig {
  apiKey: string | undefined;
  analysisModel: string;
  imageModel: string;
}

export const DEFAULT_ANALYSIS_MODEL = 'gemini-3-flash-preview';
export const DEFAULT_IMAGE_MODEL = 'gemini-2.5-flash-image';

const nonEmpty = (value: string | undefined) => (value && value.trim() !== '' ? value.trim() : undefined);

export const readServerConfig = (env: Record<string, string | undefined>): ServerConfig => ({
  apiKey: nonEmpty(env.GEMINI_API_KEY),
  analysisModel: nonEmpty(env.GEMINI_ANALYSIS_MODEL) ?? DEFAULT_ANALYSIS_MODEL,
  imageModel: nonEmpty(env.GEMINI_IMAGE_MODEL) ?? DEFAULT_IMAGE_MODEL,
});
