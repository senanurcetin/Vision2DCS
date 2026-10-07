# Vision2DCS

Vision2DCS is an industrial AI prototype that turns P&ID interpretation into a structured engineering workflow. It analyzes instrumentation diagrams, drafts tag mappings, and produces visual topology concepts for modern DCS and HMI projects.

![Vision2DCS interface](https://github.com/user-attachments/assets/2259d7d5-cac7-409c-b453-ede8c39f6398)

Portfolio case study: [senanur-cetin.vercel.app/projects/vision2dcs](https://senanur-cetin.vercel.app/projects/vision2dcs)

Portfolio role: `archive proof`

## Why it sits in supporting evidence

Vision2DCS adds multimodal engineering-tool breadth to the portfolio, but it is intentionally secondary to the lead case studies. Its role is to show industrial workflow design and automation-engineering context rather than serve as the primary applied-ML proof.

## Why this project exists

Instrumentation engineers still spend significant time translating P&IDs into tag lists, control structures, and HMI drafts by hand. Vision2DCS demonstrates how multimodal AI can accelerate the early design phase of automation projects while keeping the output visible and reviewable.

## What it does

- Parses uploaded process diagrams with Gemini-powered multimodal analysis.
- Extracts instrumentation concepts into structured engineering data.
- Drafts HMI and topology views with React Flow components.
- Maps output toward DCS-centric thinking for platforms such as Siemens PCS 7 and ABB 800xA (CSV/XML exports are concept formats, not validated against the vendors' import schemas).
- Packages the result as an explorable React/Vite prototype for portfolio review.

## Architecture snapshot

- **Frontend:** React 19, TypeScript, Vite
- **AI layer:** `@google/genai` with Gemini-based image and text reasoning, called only from the server
- **Server:** a small Web-standard `/api` handler, served by Vite in development and by a Node server (`npm start`) in production
- **Visualization:** React Flow for topology and node mapping
- **Reference docs:** `TECHNICAL_GUIDE.md` for deeper implementation notes

## Local setup

### Prerequisites

- Node.js 20+
- npm
- A Google AI Studio API key

### Install

```bash
npm install
cp .env.example .env.local
```

Set `GEMINI_API_KEY` in `.env.local`. The key is read only on the server. The browser calls `/api/analyze` and `/api/digital-twin` and never sees the key.

| Variable | Default | Purpose |
|----------|---------|---------|
| `GEMINI_API_KEY` | (required) | Google AI Studio key |
| `GEMINI_ANALYSIS_MODEL` | `gemini-3-flash-preview` | Model for P&ID extraction |
| `GEMINI_IMAGE_MODEL` | `gemini-2.5-flash-image` | Model for the digital-twin render |
| `PORT` | `3000` | Port for `npm start` |

### Run

```bash
npm run dev
```

### Type check and tests

```bash
npm run typecheck
npm test
```

### Build and run in production

```bash
npm run build
GEMINI_API_KEY=... npm start
```

`npm run build` writes the app to `dist/` and the server to `dist-server/`. `npm start` serves both on `PORT`. The server limits each client to 20 AI requests per minute, accepts images up to 10 MB, and retries rate-limited or transient Gemini failures with backoff. The rate limit is held in memory per process and keyed by client IP, so it assumes a single instance that is not behind a shared proxy.

## Measuring extraction quality

`samples/` holds synthetic P&IDs drawn for this repository. Each has an SVG source, the rendered `drawing.png` and a hand-checked `expected.json`. To run the benchmark against the configured model:

```bash
npm run eval
```

The benchmark prints per-sample missed and unexpected tags plus overall tag precision, recall and F1, and signal/block type accuracy on the matched tags. It calls the real API, so it needs `GEMINI_API_KEY` and is not part of CI. CI does check that the samples stay well-formed. To add a case, create `samples/<name>/` with a `drawing.png` and an `expected.json` that follows the existing ones. A field may list several accepted values, for example a controller as `["AI", "AO"]`.

## Limitations

- **AI output needs review.** Extracted tags, `connectedTo` links and especially the BOM brands and costs are model estimates, not engineering data. The OT-Sentinel audit flags common problems but is not a substitute for a check by an engineer.
- **Exports are concept formats.** The PCS 7 CSV and 800xA XML are well-formed but have not been validated against the vendors' import tools (#2).
- **Single-user storage.** Project history lives in the browser's `localStorage`, about 5 MB. A warning appears when it is full.
- **Single-instance server.** The rate limiter is in memory, and there is no authentication. Put the app behind your own access control before exposing it.
- **Preview models.** The default model names are preview releases and may change. Override them with the `GEMINI_*_MODEL` variables.

## Repository highlights

- `server/gemini.ts` contains the AI orchestration layer; `server/api.ts` is the HTTP contract in front of it.
- `services/` holds the browser-side logic: tag parsing, normalization, OT-Sentinel audit, exports, topology layout. All of it is unit tested.
- `components/HmiReactFlowView.tsx` drives the topology visualization.
- `eval/` and `samples/` hold the extraction benchmark.
- `TECHNICAL_GUIDE.md` documents the engineering intent in more depth. `CONTRIBUTING.md` lists the checks to run before a pull request.

## Portfolio note

This repository is archive proof for Industrial AI workflow design in automation engineering. It is intended to showcase multimodal engineering-tool thinking rather than serve as a production-ready export pipeline.

## License

MIT
