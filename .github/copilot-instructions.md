# GitHub Copilot repository instructions — Vision2DCS

## Purpose and boundaries
Vision2DCS is a TypeScript/React/Vite prototype that extracts instrumentation concepts from P&ID diagrams, visualizes topology, and drafts conceptual Siemens PCS 7 CSV and ABB 800xA XML exports. Outputs are NOT vendor-certified and must be reviewed by an industrial automation engineer before any operational use. Never claim hardware testing, real DCS integration or safety certification.

## Read before editing
- Read `README.md` and `TECHNICAL_GUIDE.md` for actual product limitations.
- `services/tagParser.ts`: ISA-style instrument parsing, canonical loop identity and valve tags.
- `services/normalizeInstruments.ts`: untrusted model output, confidence/Unknown handling.
- `services/exportService.ts`: Siemens semicolon CSV and ABB XML serialization.
- `eval/score.ts`, `eval/diagnostics.ts`, `eval/ocr-cli.ts`: benchmark contracts, per-drawing evidence and the actual tag-only OCR baseline.
- `server/`: server-only model credentials, upload validation and API rate limits.
- `.github/agents/dcs-verification.agent.md`: optional focused validation specialist (manually select it when appropriate).

## Development and validation
- Requires Node.js **24.15+**, with **24.22.0** pinned in `.nvmrc` and hosted CI.
- Run `npm test -- <affected.test.ts>` for focused Vitest tests and `npm run typecheck` for TypeScript checks. `npm test` runs the full offline unit suite.
- `npm run build` produces production assets only after tests pass.
- `npm run eval` invokes real Gemini inference and may incur cost; never execute without explicit provider authorization and `VISION2DCS_EVAL_MAX_CALLS`. Use `eval:preflight`, `eval:inspect`, or saved-report validation by default. `eval:ocr` performs **real Tesseract OCR** (CPU only) and requires a local system installation, but not Gemini.
- Preserve existing test file conventions, naming and import layout. Add focused regression tests for behavior changes.

## Quality and security
- Do not add credentials to frontend code or log API keys. Use synthetic fixtures for all P&ID examples.
- Validate user uploads and AI JSON without silently converting unrecognized signal/block values to high confidence.
- Precision, recall, F1 and other benchmark rates must remain in [0, 1] **when defined**. Explicitly preserve `null` for undefined per-drawing denominators; investigate duplicated canonical tags, altered SHA-256 identities and malformed expected labels. Never attribute actual Tesseract tag-only scores to Gemini.
- Preserve Unicode, XML escaping and CSV quoting; conceptual exports do not guarantee Siemens/ABB import compatibility.
- Favor small and reviewable patches, never make a hardware/control-system change from generated predictions.
- Avoid unrelated modifications to GitHub Actions, README, branding assets, screenshots or other workstreams. Update these when the user's task **explicitly requires** documentation, visual or CI maintenance, keeping evidence and link integrity intact.
- When preparing a PR, document exact tests actually run, observed outcomes, caveats and remaining unknowns. Do not auto-merge.

- Preserve the NEXUS offline `Training Lab`, `Research Evidence` and `Scan Stress` modules as **educational, local-only** features; never add PLC I/O, certified interlocks, external plant image fetching or fabricated AI validation.
