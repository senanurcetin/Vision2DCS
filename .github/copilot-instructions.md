# GitHub Copilot repository instructions — Vision2DCS

## Purpose and boundaries
Vision2DCS is a TypeScript/React/Vite prototype that extracts instrumentation concepts from P&ID diagrams, visualizes topology, and drafts conceptual Siemens PCS 7 CSV and ABB 800xA XML exports. Outputs are NOT vendor-certified and must be reviewed by an industrial automation engineer before any operational use. Never claim hardware testing, real DCS integration or safety certification.

## Read before editing
- Read `README.md` and `TECHNICAL_GUIDE.md` for actual product limitations.
- `services/tagParser.ts`: ISA-style instrument parsing, canonical loop identity and valve tags.
- `services/normalizeInstruments.ts`: untrusted model output, confidence/Unknown handling.
- `services/exportService.ts`: Siemens semicolon CSV and ABB XML serialization.
- `eval/score.ts`: extraction benchmarking; `eval/score.test.ts`: evaluation contracts.
- `server/`: server-only model credentials, upload validation and API rate limits.
- `.github/agents/dcs-verification.agent.md`: optional focused validation specialist (manually select it when appropriate).

## Development and validation
- Requires Node.js 20+.
- Run `npm test -- <affected.test.ts>` for focused Vitest tests and `npm run typecheck` for TypeScript checks. `npm test` runs the full offline unit suite.
- `npm run build` produces production assets only after tests pass.
- `npm run eval` calls an actual Gemini model and may incur cost. Never run it without explicit authorization. Use fixtures and mocks instead.
- Preserve existing test file conventions, naming and import layout. Add focused regression tests for behavior changes.

## Quality and security
- Do not add credentials to frontend code or log API keys. Use synthetic fixtures for all P&ID examples.
- Validate user uploads and AI JSON without silently converting unrecognized signal/block values to high confidence.
- Precision, recall, F1 and other benchmark rates must stay within [0, 1]. Investigate duplicate canonical tags and malformed expected labels before accepting aggregate scores.
- Preserve Unicode, XML escaping and CSV quoting; conceptual exports do not guarantee Siemens/ABB import compatibility.
- Favor small and reviewable patches, never make a hardware/control-system change from generated predictions.
- Do not modify GitHub Actions workflows, README, metadata, screenshots, or other parallel workstreams unless the task specifically requires them.
- When preparing a PR, document exact tests actually run, observed outcomes, caveats and remaining unknowns. Do not auto-merge.
