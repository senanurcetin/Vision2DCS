import type { Connect, Plugin } from 'vite';
import { createGeminiApiHandler, handleNodeApiRequest } from './node';

/** Serves the /api routes from `vite` (dev) and `vite preview`. */
export const geminiApiPlugin = (env: Record<string, string | undefined>): Plugin => {
  const handler = createGeminiApiHandler(env);
  const middleware: Connect.NextHandleFunction = (req, res, next) => {
    handleNodeApiRequest(handler, req, res)
      .then(handled => { if (!handled) next(); })
      .catch(next);
  };
  return {
    name: 'vision2dcs-gemini-api',
    configureServer: server => { server.middlewares.use(middleware); },
    configurePreviewServer: server => { server.middlewares.use(middleware); },
  };
};
