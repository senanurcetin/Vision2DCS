# Vision2DCS — P&ID-to-HMI Engineering Assistant

<p align="right"><img src="docs/assets/nexus-official-midnight.svg" alt="Official NEXUS 2.0 Midnight brand logo" width="240"></p>

**Technical reviewer brief:** [System evidence, reproducibility and operational limits](docs/hiring-summary.md).

**React · TypeScript · Gemini multimodal AI · React Flow · Structured instrumentation extraction**

Vision2DCS is an industrial AI prototype that turns P&ID interpretation into a structured engineering workflow. It analyzes instrumentation diagrams, drafts tag mappings, and produces visual topology concepts for modern DCS and HMI projects.

![NEXUS Vision2DCS engineering workspace (Chromium, synthetic offline fixture)](docs/assets/nexus-workspace-desktop.png)

<sub>Captured from this repository in Chromium, 1440 × 960. The pictured P&ID and tag list are **synthetic offline demonstration fixtures**; no Gemini call or vendor import approval is implied.</sub>

<details><summary>Mobile preview · 390 × 844</summary>

<img src="docs/assets/nexus-workspace-mobile.png" alt="NEXUS Vision2DCS mobile engineering interface with synthetic flow-loop project" width="390">

</details>

Portfolio case study: [senanur-cetin.vercel.app/projects/vision2dcs](https://senanur-cetin.vercel.app/projects/vision2dcs)

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

- Node.js 24.15+ (24.22.0 pinned in .nvmrc)
- npm
- A Google AI Studio API key

### Install

```bash
npm install
cp .env.example .env.local
```

Set `GEMINI_API_KEY` in `.env.local`. **Billable AI is disabled by default** even when a Gemini key is configured. Explicitly authorize model spending before enabling `VISION2DCS_ENABLE_AI=true` and providing a distinct random `VISION2DCS_AI_ACCESS_TOKEN` (32+ characters) **and** a positive `VISION2DCS_AI_MAX_REQUESTS` process invocation cap (1–1000). Enter this *operator token* in the browser's **AI access** field. It is kept in the current tab's memory only; reloading or **Clear AI token** discards it. The provider key never enters the browser. For remote deployments, use HTTPS, an identity-aware ingress and provider budget limits; a shared token is **not** full user authentication or a spending cap. The application invocation cap is **not a monetary billing limit**: SDK-internal retries, replicas and process restarts may cause additional provider calls. The application-level Gemini wrapper explicitly disables automatic retries per reserved invocation. Set hard quotas or spending controls with the provider.

| Variable | Default | Purpose |
|----------|---------|---------|
| `GEMINI_API_KEY` | (unset) | Server-side Gemini key; does not by itself activate paid AI |
| `VISION2DCS_ENABLE_AI` | `false` | Must equal `true` for paid AI inference |
| `VISION2DCS_AI_ACCESS_TOKEN` | (unset) | 32+ character server-only operator token required for enabled AI routes |
| `VISION2DCS_AI_MAX_REQUESTS` | (unset) | Required positive (1–1000) per-process provider invocation cap; no automatic refund |
| `VISION2DCS_AI_MAX_CONCURRENT` | `2` | Optional maximum simultaneous paid model operations (1–8) |
| `GEMINI_ANALYSIS_MODEL` | `gemini-3-flash-preview` | Model for P&ID extraction |
| `GEMINI_IMAGE_MODEL` | `gemini-2.5-flash-image` | Model for the digital-twin render |
| `PORT` | `3000` | Port for `npm start` |

### Supported Node.js runtime

Use **Node 24 LTS**, at least **24.15.0** (tested and pinned to **24.22.0** in `.nvmrc`, GitHub Actions, CircleCI and Chromium smoke). Run `nvm use` before `npm ci`. Node 20 is no longer an accepted app runtime; the pinned runtime is required for future test/toolchain upgrades. The root lockfile engine metadata is synchronized; no transitive dependencies are changed in this runtime-only migration.

### Run

```bash
npm run dev
```

**Public interactive NEXUS demo:** [vision2dcs-nexus-demo.vercel.app](https://vision2dcs-nexus-demo.vercel.app/). Select **Load sample P&ID** to open the bundled, hand-labelled synthetic reactor-feed drawing with five draft instruments; no provider calls, billing or operator token are involved. The example remains **unreviewed** and all concept exports require explicit local engineer review. The Vercel demo is static and does not provide a paid Gemini backend; run the server locally with the separately documented security controls for authorized model use. The dedicated Vercel demo project sets `VITE_VISION2DCS_PUBLIC_DEMO=true` at **build time**, which replaces unavailable AI-token and paid-inference controls with an explicit offline-demo label. Local developer builds leave this unset so authorized model routes remain available. The empty project workspace includes an **Explore sample project** entry point. Both modes are independently tested in Chromium.

### Type check and tests

```bash
npm run typecheck
npm test
```

### Build and run in production

```bash
npm run build
npm start
```

`npm run build` writes the app to `dist/` and the server to `dist-server/`. `npm start` serves both on `PORT`. Disabled AI requests return HTTP 503; authorized operators with a missing or incorrect bearer token receive HTTP 401. The offline JSON backup, engineering review and export flows remain available with AI disabled. Enabled AI routes first acquire a bounded in-flight model-operation slot (default 2), then reserve from a process-lifetime invocation cap immediately before model use, and limit each client to 20 requests per minute, accept images up to 10 MB, and do not automatically retry Gemini calls, avoiding multiple provider attempts per local allowance. The rate limit is held in memory per process and keyed by client IP, so it assumes a single instance that is not behind a shared proxy.

## Measuring extraction quality

`samples/` holds synthetic P&IDs drawn for this repository. Each has an SVG source, the rendered `drawing.png` and a hand-checked `expected.json`. To run the benchmark against the configured model:

```bash
npm run eval:preflight
VISION2DCS_EVAL_MAX_CALLS=10 npm run eval  # Explicitly allow the complete ten-fixture paid evaluation
```

The benchmark prints per-sample missed and unexpected tags plus overall tag precision, recall and F1, and signal/block type accuracy on the matched tags. The synthetic fixtures also label **directed dashed instrument signal lines** in `signalConnections`. The runner prints separate edge precision, recall and F1 from model-generated `connectedTo` references, counting missed, reversed, dangling and spurious links. This excludes automatically inferred React Flow loop chains and unlabelled process piping. Topology-aware evaluations are persisted in **schema-v2** reports containing per-sample and microaveraged tag and directed-signal metrics. Historical **schema-v1** tag-only reports remain readable and comparable to other v1 reports; mixed v1/v2 comparisons fail explicitly. CI validates reporting offline but never makes billable Gemini calls. On successful completion it retains a unique report in **`eval/results/runs/`** and atomically updates **`eval/results/latest.json`** with model identifier, timestamp, per-sample input SHA-256 hashes and microaveraged metrics, so successive results can be inspected against the exact source drawings and labels. This file is ignored by Git and is **not** a synthetic score or automatic CI output. Running `npm run eval` makes real, potentially billable Gemini calls. The runner now validates **every fixture, expected tag, complete PNG chunk structure and CRC, drawing size and directed-signal annotation before any provider call**. It also requires explicit `VISION2DCS_EVAL_MAX_CALLS` (positive integer, no more than 100, covering the complete fixture set) in addition to `GEMINI_API_KEY`; incomplete or corrupt later examples cannot waste paid calls on earlier fixtures. Use `npm run eval:preflight` for a fully offline, free check. Per-process and provider-level spending controls remain separate; actual billing and vendor data are never fabricated by CI. CI tests the offline report builder and the same full-fixture preflight logic used by manual paid evaluation, but never calls Gemini. To add a case, create `samples/<name>/` with a `drawing.png` and an `expected.json` that follows the existing ones. A field may list several accepted values, for example a controller as `["AI", "AO"]`.

### Compare two real benchmark runs without another Gemini call

Use two locally retained, real `eval/results/runs/*.json` files. Compare only **paired, identical sample source revisions**:

```bash
npm run eval:compare -- eval/results/baseline.json eval/results/candidate.json
```

This offline command verifies the report schema, source drawing/label SHA-256 hashes, unique sample names, scoring counts and recalculated microaveraged summaries. It prints baseline/candidate precision, recall, F1, matched-tag type accuracies and their signed deltas. A changed data set, forged summary, corrupt report or different label file fails rather than producing a misleading comparison. Reports must first be generated by explicitly authorized `npm run eval` runs; **CI neither runs Gemini nor fabricates benchmark results**. The command does not interpret changes as statistically significant or certified engineering quality.

## Manual engineering edits and project backup
The P&ID editor supports review-required low-confidence manual tag entries, spreadsheet-safe estimated BOM CSV export and versioned JSON backups. Imported/exported backup files share a 48 MiB UTF-8 limit (a 25 MiB raw drawing can require about 34 MiB in base64). Oversize exports fail visibly rather than creating unrestorable backups. Imported instrument rows are type-validated and reconstructed from known fields (not re-normalized with AI defaults); existing local-review flags are revoked and external/SVG image URLs are stripped. Malformed non-object instrument rows fail the entire model response or backup import/export rather than silently disappearing. All vendor CSV/XML formats remain conceptual until verified against vendor import tools.

## Limitations

- **AI output needs review.** Extracted tags, `connectedTo` links and especially the BOM brands and costs are model estimates, not engineering data. The OT-Sentinel audit flags common problems but is not a substitute for a check by an engineer.
- **Exports are concept formats.** The PCS 7 CSV and 800xA XML are well-formed but have not been validated against the vendors' import tools (#2).
- **Fail-closed concept export buttons.** The UI blocks Siemens/ABB concept downloads while tag identity errors (including canonical duplicates or invalid ISA-style tag names) or unresolved signal/PCS 7 block classifications remain. Fix the highlighted tags first. A cleared heuristic audit does not prove vendor compatibility, process safety, SIL or ISA certification.
- **Explicit local review.** Every model-extracted or imported instrument starts unreviewed, regardless of AI confidence or any review flag inside a JSON backup. The operator must click **Review** for each row after inspecting the drawing. Changing a tag, description, signal, block or units clears that approval; concept exports are disabled until all current rows have been reviewed. This local toggle is **not an authenticated engineering sign-off** or vendor safety certification.
- **NEXUS Tag Map v1.** A manually downloaded, [read-only versioned JSON contract](docs/NEXUS_TAG_MAP_V1.md) is available for locally reviewed and tag-valid projects. It deliberately omits credentials, drawings, plant measurements and control commands. No automatic cross-product synchronization is implemented.
- **Single-user storage.** Project history lives in the browser's `localStorage`, about 5 MB. A warning appears when it is full.
- **Operator-gated paid AI API.** AI endpoints are disabled by default. An explicit operator toggle and a long bearer secret are required; this shared-secret mechanism is **not identity authentication, a billing cap or protection against stolen credentials**. Require trusted HTTPS ingress, identity-aware access and provider quotas before any public exposure.
- **Single-instance server.** Rate limiting is in memory and keyed by socket IP; reverse-proxy headers are not trusted and multiple replicas need authoritative shared upstream limits.
- **Preview models.** The default model names are preview releases and may change. Override them with the `GEMINI_*_MODEL` variables.

## Repository highlights

- `server/gemini.ts` contains the AI orchestration layer; `server/api.ts` is the HTTP contract in front of it.
- `services/` holds the browser-side logic: tag parsing, normalization, OT-Sentinel audit, exports, topology layout. All of it is unit tested.
- `components/HmiReactFlowView.tsx` drives the topology visualization.
- `eval/` and `samples/` hold the extraction benchmark.
- `TECHNICAL_GUIDE.md` documents the engineering intent in more depth. `CONTRIBUTING.md` lists the checks to run before a pull request.

## Engineering readiness

This is a human-in-the-loop **concept-generation tool**, not a validated PLC/DCS engineering exporter. Always independently review extracted tags, connections and bill-of-materials suggestions against source drawings and the target vendor's engineering tools.

## License

MIT


### Offline engineering acceptance regression

The `services/engineeringAcceptance.test.ts` suite exercises the **complete pure-data path** that supports the UI: an AI-created row starts unreviewed; an explicit local Review click can unlock conceptual export; creating a backup and importing it into a new project clears any asserted approval; changing a reviewed instrument invalidates that approval; and canonical duplicates prevent export. It also tests 12 MiB of valid inline image data and rejects malformed, remote and SVG image payloads. The backup image validator uses the shared linear-time canonical base64 scanner, avoiding a large regex on untrusted backups.

Run `npm test` for these offline checks. This is **not** a claim of real-browser keyboard/screenshot QA, paid Gemini accuracy, authenticated engineer sign-off, Siemens/ABB vendor import acceptance or actual plant control. Those remain separate release gates.

### Browser session continuity and download verification

Valid local projects reopen after a browser refresh, restoring the last selected valid project (or the newest available one when the prior selection was deleted). Only the selected project ID is saved as UI state; operator AI tokens and in-memory undo/redo history are **never** persisted by this feature. CI's Chromium smoke tests verify real downloaded read-only NEXUS Tag Map v1 JSON, Siemens-style conceptual CSV, and ABB-style conceptual XML bytes, then reload the edited project to confirm review gate and undo history remain safe. These outputs are not vendor-certified engineering imports.

### Advanced signal-link engineering (read-only concept)

The NEXUS Tag Management table now has a **Signal to** input with project tag suggestions. Editing a directed link revokes local review. Unresolved, ambiguous, self-links and cycles are diagnosed by OT-Sentinel and block concept exports. In HMI, **cyan** edges are declared directional connections, whereas **gray dashed** edges are inferred layout only. After explicit review, **SIGNAL LINKS CSV** exports declared edges with their direction and an uncertified-evidence label. No real plant or vendor-import compatibility is claimed.

### Lossless project identity and navigation

All newly analyzed drawings, imported project backups, bundled demo sessions and manual instrument groups use collision-resistant local IDs. A reducer-level guard prevents accidental replacement of saved project data even if an ID collision is introduced by another caller. When deleting the currently selected project, the next remaining project opens automatically; invalid project selections are ignored. Existing projects are never migrated, silently rewritten, or deleted by this change.

### Two independent offline engineering scenarios

The public demo now includes a **flow-control** reference (5 instruments, 2 annotated directional signal links) and a **tank-level** reference (6 instruments, 2 annotated links), each with its own checked-in PNG/SVG and reference labels. Open them through **Load sample P&ID** or **Tank-level sample** (or the welcome-screen choices). Both are purely hand-labelled synthetic demonstrations; they are not model predictions or evidence of AI extraction quality. Every new demo project starts unreviewed and offline. The Chromium browser suite independently exercises both scenarios.

### Scientific evidence inventory (zero API calls)

Run `npm run eval:inspect` for a source-hashed JSON inventory of all real checked-in synthetic P&ID fixtures: number of independent drawings, independently labelled tags and drawn directional signal links, signal/block coverage and ambiguous reference types. The output explicitly declares itself **unscored** and identifies insufficient independent drawing coverage. No AI metric is invented and no API key is needed. `npm run eval:preflight` now requires complete signal and PCS7 reference classifications before any paid call, and the scorer no longer awards correct classifications for missing ground-truth labels. Statistical generalization and real-model precision/recall remain unverified until independent drawings and authorized Gemini runs are available.

### Synthetic scientific challenge expansion

The source-controlled benchmark now has **ten synthetic drawings** (two initial hand-authored drawings and eight black-and-white procedural variants for flow, pressure, temperature and level loops). Each fixture contains an editable SVG source, complete PNG raster, engineer-style label JSON and annotated directed signal edges. The eight generated cases share a visual style, so they do not constitute independent industrial P&ID evidence. Passing test cases **does not measure Gemini accuracy**. See [Research evidence limits](docs/RESEARCH_EVIDENCE.md); use `npm run eval:inspect` to retrieve source-hashed inventory with no model calls. Real AI evaluation requires an explicit paid-run budget for all 10 fixtures.
