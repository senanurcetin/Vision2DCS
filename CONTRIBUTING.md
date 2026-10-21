# Contributing to Vision2DCS

Vision2DCS is an **offline-first research and educational engineering demo**. Changes must preserve its distinction between synthetic examples, measured results, unverified vendor exports and actual plant engineering. It is **not** a PLC/DCS operating system or a commercial service.

## Environment

- Node.js **24.15+**, pinned **24.22.0** in `.nvmrc`.
- npm; use the repository lockfile, not ad-hoc dependency upgrades.
- No Gemini key or Tesseract installation is required for routine offline development.

```bash
nvm use
npm ci
npm run dev
```

`cp .env.example .env.local` is **optional** and needed only for separately authorized Gemini experiments. The `GEMINI_API_KEY` alone leaves paid AI disabled. Do not send customer/plant data to a provider, commit credentials or configure unrestricted paid AI.

## Validation matrix

| Command | Scope | External charges? |
|---|---|---|
| `npm run typecheck` | TypeScript source, tests, evaluation and server | No |
| `npm test` | Vitest regressions and local contracts | No |
| `npm run eval:preflight` | PNG signatures, CRCs, labelled tags and edges | No |
| `npm run eval:inspect` | **Unscored** fixture inventory | No |
| `npm run build` | Client and Node SSR bundles | No |
| `npm run docs:check` | All repository Markdown links, local targets and heading references | No |
| `npm audit --omit=dev --audit-level=high` | Production dependency advisories (network required) | No model charges |
| `npm run eval:ocr` | **Actual**, locally installed Tesseract CPU OCR, not fake benchmark numbers | No model charges |
| `npm run eval:diagnose -- <report.json>` | Source-hashed saved report inspection | No |
| `npm run eval:compare-tags -- <before.json> <after.json>` | Exact-paired **tag-only** metrics | No |
| `npm run eval` | **Actual external Gemini inference**; explicit model key and `VISION2DCS_EVAL_MAX_CALLS` required | **Potentially billable — do not run routinely** |

The GitHub Actions workflows provide additional Linux Chromium smoke checks in both public and local developer modes, and execute the optional system-Tesseract baseline on the checked-in synthetic images without Gemini credentials. CircleCI independently runs the locked Node quality pipeline. A CI green result **does not** prove AI accuracy, physical safety or vendor import interoperability.

## Change workflow

1. Start from the current `main`, work on a focused branch, and keep source changes together with affected tests and documentation.
2. Use synthetic, permissioned P&IDs only. Never fabricate human review, model predictions, measured accuracy, OPC/PLC behavior, or vendor acceptance.
3. Run the appropriate offline checks and examine actual failures; document checks **not run**.
4. Open a reviewable PR and require the **latest-head** GitHub CI and relevant Chromium/OCR checks to finish successfully before merging.
5. Avoid `[skip ci]` and stale branch merges in PRs intended for acceptance. Do not bypass required checks, force-update protected refs or mistake a successful local test for a passing hosted job.
6. Update the [claim-to-evidence matrix](docs/DEMO_EVIDENCE_MATRIX.md) when new behavior, a measurement or its limitations change.

### Code layout

- `App.tsx`, `components/`, `hooks/`: UI and editor state.
- `services/`: domain logic, canonical tags, graph checks, exports, pure synthetic simulators.
- `server/`: guarded API entrypoints, configuration, model SDK and server-only secrets.
- `eval/`, `samples/`: image preflight, scoring, Tesseract baseline, experiment provenance and fixtures.
- `docs/`: engineering constraints, scientific and demo evidence, NEXUS visual identity.

### Security and review invariants

- Browser code must never import `server/`; `server/boundary.test.ts` checks this boundary. Never expose `GEMINI_API_KEY` or operator tokens in output, screenshots or client build.
- Treat model-generated and uploaded/project data as untrusted. Fail closed on malformed rows, conflicting tag identities, invalid links and fake saved-report summaries. Never silently upgrade `Unknown` to a confident instrument classification.
- Only reviewed, unblocked **concept exports** may be downloaded. A local review flag is not signed engineering acceptance.
- Cyan HMI lines are validated explicitly declared signal edges; gray dashed lines are heuristics. Neither constitutes actual plant wiring approval.
- PCS 7 CSV, ABB 800xA XML and safety advisories are illustrative; no vendor import, IEC 61511/SIL or actual PLC authorization is implied.
- Use a dummy canary to verify the client bundle contains no server secret after build configuration changes. Do not run paid Gemini evaluation or access real OT hardware without a separate, explicit authorization.

See [Technical Guide](TECHNICAL_GUIDE.md), [Security Policy](SECURITY.md), [Research Evidence](docs/RESEARCH_EVIDENCE.md) and [Demo Acceptance](docs/DEMO_ACCEPTANCE.md).
