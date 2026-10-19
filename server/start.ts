import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAppServer } from './httpServer';
import { createGeminiApiHandler } from './node';
import { parseAiConcurrency, parseAiRequestCap } from './inferenceBudget';

// Built by `npm run build` into dist-server/start.js; serves ../dist.
const distDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const port = Number(process.env.PORT ?? 3000);

if (!process.env.GEMINI_API_KEY || process.env.VISION2DCS_ENABLE_AI !== 'true' ||
    (process.env.VISION2DCS_AI_ACCESS_TOKEN?.length ?? 0) < 32 ||
    parseAiRequestCap(process.env.VISION2DCS_AI_MAX_REQUESTS) === null ||
    parseAiConcurrency(process.env.VISION2DCS_AI_MAX_CONCURRENT ?? '2') === null) {
  console.warn('Paid AI routes are disabled; a provider key, explicit enablement and long operator access token, valid request cap and concurrency setting are required.');
}

createAppServer({ handler: createGeminiApiHandler(process.env), distDir })
  .listen(port, () => console.log(`Vision2DCS listening on http://localhost:${port}`));
