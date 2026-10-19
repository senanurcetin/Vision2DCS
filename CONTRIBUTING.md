# Contributing

## Setup

```bash
nvm use            # Node 20, from .nvmrc
npm ci
cp .env.example .env.local   # add GEMINI_API_KEY to analyze real drawings
npm run dev
```

The offline app runs without a key. Billable AI routes are disabled by default and require explicit server enablement, an operator access token, and a provider key. Never run real-model evaluation without an approved API budget.

## Checks

Run these before a milestone review. CI normally runs on commits to `main` and PR updates, but development batches may skip intermediate CI as explained below.

| Command | What it checks |
|---------|----------------|
| `npm run typecheck` | TypeScript across the app, server, tests and eval |
| `npm test` | Unit and integration tests (Vitest) |
| `npm run build` | Client bundle (`dist/`) and production server (`dist-server/`) |
| `npm run eval` | Extraction quality on `samples/`. Needs a key, so run it when you change prompts, schemas or models |

## Batched development and CI

During exploratory engineering work, keep changes on a dedicated `work/*` branch rather than updating the release-candidate PR after every edit. Use `[skip ci]` on **intermediate** commits to skip GitHub Actions push/PR checks and CircleCI's normal VCS-push pipeline. Such commits are **unverified by CI** and must never be treated as release-ready. A skipped required GitHub check can remain Pending and prevent a PR from merging.

At a meaningful integration milestone, finish local type-check/unit checks, consolidate changes into the review branch, and create a **fresh HEAD commit without any CI-skip directive**. Require the resulting exact-head GitHub Actions and CircleCI checks before approving or merging. When squashing, ensure **no `[skip ci]` text is inherited into the final merge commit message**, otherwise checks can be accidentally suppressed. Never disable main-branch protection or skip release acceptance to save CI minutes.

## Where things live

- `server/`: everything that touches the Gemini key: the API handler, the Gemini calls, retry, rate limiting, and the Node and Vite adapters.
- `services/`: pure browser-side logic. New logic goes here with a `*.test.ts` next to it, not in components.
- `components/`, `hooks/`, `App.tsx`: UI and state.
- `eval/`, `samples/`: the extraction benchmark.

## Conventions

- The browser must never import from `server/` (`server/boundary.test.ts` enforces this), and nothing may inline secrets into the client bundle. After changing build config, build with a dummy key and confirm it does not appear in `dist/`, e.g. `GEMINI_API_KEY=canary-123 npm run build && ! grep -r canary-123 dist`.
- Model output is untrusted input. Validate it in `services/normalizeInstruments.ts`, and mark anything uncertain as `Unknown` or low confidence. Never replace it with a plausible default.
- Keep `TECHNICAL_GUIDE.md` in step with the audit rules, export formats and server behavior.
