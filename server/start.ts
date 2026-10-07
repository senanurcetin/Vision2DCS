import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAppServer } from './httpServer';
import { createGeminiApiHandler } from './node';

// Built by `npm run build` into dist-server/start.js; serves ../dist.
const distDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const port = Number(process.env.PORT ?? 3000);

if (!process.env.GEMINI_API_KEY) {
  console.warn('GEMINI_API_KEY is not set: analysis requests will return 503.');
}

createAppServer({ handler: createGeminiApiHandler(process.env), distDir })
  .listen(port, () => console.log(`Vision2DCS listening on http://localhost:${port}`));
