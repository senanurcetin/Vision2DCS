# Contributing

## Setup

```bash
nvm use            # Node 20, from .nvmrc
npm ci
cp .env.example .env.local   # add GEMINI_API_KEY to analyze real drawings
npm run dev
```

The app runs without a key. Analysis requests then return a clear "no GEMINI_API_KEY configured" error.

## Checks

Run these before opening a pull request. CI runs the first three on every push and pull request to `main`.

| Command | What it checks |
|---------|----------------|
| `npm run typecheck` | TypeScript across the app, server, tests and eval |
| `npm test` | Unit and integration tests (Vitest) |
| `npm run build` | Client bundle (`dist/`) and production server (`dist-server/`) |
| `npm run eval` | Extraction quality on `samples/`. Needs a key, so run it when you change prompts, schemas or models |

## Where things live

- `server/`: everything that touches the Gemini key: the API handler, the Gemini calls, retry, rate limiting, and the Node and Vite adapters.
- `services/`: pure browser-side logic. New logic goes here with a `*.test.ts` next to it, not in components.
- `components/`, `hooks/`, `App.tsx`: UI and state.
- `eval/`, `samples/`: the extraction benchmark.

## Conventions

- The browser must never import from `server/` (`server/boundary.test.ts` enforces this), and nothing may inline secrets into the client bundle. After changing build config, build with a dummy key and confirm it does not appear in `dist/`, e.g. `GEMINI_API_KEY=canary-123 npm run build && ! grep -r canary-123 dist`.
- Model output is untrusted input. Validate it in `services/normalizeInstruments.ts`, and mark anything uncertain as `Unknown` or low confidence. Never replace it with a plausible default.
- Keep `TECHNICAL_GUIDE.md` in step with the audit rules, export formats and server behavior.
