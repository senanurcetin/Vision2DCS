import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { geminiApiPlugin } from './server/vitePlugin';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      // The Gemini key stays on the server: /api is served by this plugin in
      // dev/preview and by server/start.ts in production. Nothing is inlined.
      plugins: [react(), tailwindcss(), geminiApiPlugin(env)],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
