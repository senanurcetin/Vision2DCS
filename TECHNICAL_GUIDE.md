# Vision2DCS Technical Architecture

## 🧠 AI Strategy: Multimodal Extraction

The core of the application lies in `server/gemini.ts`. Instead of simple OCR, we use **Multimodal Prompting**:
- **System Instruction**: We prime the model as a "Lead DCS Architect" to ensure technical vocabulary (e.g., "Engineering Units", "Solenoid", "Diaphragm Actuator").
- **Schema Enforcement**: We use the Gemini `responseSchema` to force the model to return valid JSON that maps directly to our `Instrument` interface.
- **Contextual Inference**: The model doesn't just read text; it infers "connectedTo" relationships based on the visual proximity of equipment in the P&ID.

## 🔐 Server Boundary

All Gemini calls run on the server so the API key never reaches the browser. **Live model calls are fail-closed**: `VISION2DCS_ENABLE_AI=true`, a distinct server-side 32+ character `VISION2DCS_AI_ACCESS_TOKEN`, and a configured `GEMINI_API_KEY`, and a positive per-process `VISION2DCS_AI_MAX_REQUESTS` (1–1000) are all required. Users enter the operator access token manually per browser tab; it stays in volatile JavaScript memory, not stored projects. The Node adapter forwards the bearer header; the server verifies a SHA-256 digest using `timingSafeEqual` before JSON parsing, rate limiting or Gemini calls. Disabled endpoints return 503, invalid token requests return 401. This is a shared-secret demo boundary, not identity-based authentication or a spending cap. The invocation allowance is reserved synchronously only after input validation and before a provider call, is never refunded on provider error, and lasts until process restart. A synchronous in-flight concurrency gate limits AI calls to two at a time by default (configurable 1–8 using `VISION2DCS_AI_MAX_CONCURRENT`), returns HTTP 429 if full without spending another invocation allowance, and releases slots in `finally`. The application-level retry loop is disabled so one allowance cannot launch three explicit Gemini calls. It is **not** a monetary cap: provider retries, multiple server processes and restarts require authoritative upstream quotas. Remote deployments still require TLS, trusted ingress and provider budget controls.

- `server/api.ts` is a Web-standard `Request → Response` handler for `POST /api/analyze` and `POST /api/digital-twin`. It validates declared raster MIME, canonical base64, decoded size (≤ 10 MB) and a bounded PNG/JPEG/WebP binary signature before calling Gemini. This magic-byte check is not a complete image decoder or content scanner. It applies a single-process per-client rate limit with a cap of 4096 distinct tracked client identities per window (new identities are refused when the map is full until stale entries expire, with cleanup scheduled at the earliest remaining expiration), periodically removes expired client windows, and maps failures to user-safe messages. Provider SDK errors are logged only as an error class and numeric status, never with raw messages or stack traces that could include plant details or credentials. A rejected key or missing configuration returns 503, and other upstream errors return 502 without exposing internal details.
- `/api/digital-twin` accepts 1–200 instrument objects containing nonempty string `tagName` (≤64 characters) and string `description` (≤500 characters). It rejects malformed rows or oversized lists without making an AI call; it does **not** silently drop instruments from a requested plant diagram. Only those two fields are forwarded to the model, not BOM costs or other engineering metadata. The endpoint is a conceptual visualization, not a verified DCS design.
- Gemini-generated inline raster images are also checked for matching PNG/JPEG/WebP signatures before being returned as browser data URIs; model-supplied MIME labels alone are never trusted. SDK error names are sanitized to fixed diagnostic classes rather than logging model/provider-supplied text.
- `server/retry.ts` offers retryable-error handling, but the paid model integration uses exactly one application-level attempt per reserved call. The SDK may still implement its own retry behavior, so provider quotas remain essential.
- The API exposes a header-only preflight that is invoked by Node/Vite HTTP adapters before buffering an uploaded body; disabled and unauthorized calls fail without reading a large image or reserving an AI allowance. The full handler repeats the same checks before model access.
- `server/node.ts` adapts the handler to Node's `http` module with a 15 MB body limit, rejecting over-limit Content-Length declarations without first buffering a payload. API JSON replies are marked `Cache-Control: no-store` and `X-Content-Type-Options: nosniff`; unknown/chunked-length bodies are rejected as soon as the 15 MB streaming threshold is crossed, without waiting for the client to finish transmitting. Aborted or prematurely closed HTTP uploads reject the outstanding body-read promise; the adapter avoids writing error responses to destroyed sockets. Early Node-level API errors include no-store and nosniff headers. It is mounted by `server/vitePlugin.ts` for `vite` and `vite preview`, and by `server/httpServer.ts` for `npm start`. The production server also serves `dist/` with an SPA fallback.
- `services/geminiService.ts` is the thin browser client for these routes.

## 🕸 Topology Engine (React Flow)

Mapping a 2D image back to a node-based graph:
1. **Loop Parsing**: `services/tagParser.ts` splits a tag into function letters, loop number and suffix. The loop is the first (measured-variable) letter plus the number, so `FT-101` and `FCV-101` share loop `F-101` while `TT-101` is loop `T-101`.
2. **Grouping and ordering** (`services/topologyLayout.ts`): instruments with the same loop key are clustered into `loopGroup` nodes and ordered by role: measurement first, then controller (`PIDConL` or a `C` after the measured-variable letter, e.g. `FIC`), then final element (valves, AO/DO, motors). The model's own output order no longer decides the layout.
3. **Signal lines**: gray dashed edges illustrate inferred loop-order chains only, while solid cyan lines show individually resolved declared `connectedTo` links. A declared direction overrides the opposing inferred layout for the same pair. Missing, ambiguous, self-referential or cyclic declared connections raise OT-Sentinel blockers. The editor supports one outgoing connection per instrument, not a complete physical topology graph.

## 🖼 Upload and Persistence

- **Upload** (`services/imageUpload.ts`): only JPEG, PNG and WebP files up to 25 MB are accepted. Drawings larger than 2048 px on the longest side are downscaled in the browser, keeping their format so line work stays crisp, before they are sent to `/api/analyze`.
- **History** (`hooks/useProjects.ts`, `services/projectStore.ts`): projects are kept in `localStorage`. Every change is a functional state update, so an analysis that finishes late cannot overwrite newer edits. Saved project records now validate instrument field types, row count and duplicate identities; corrupted records are skipped **as a whole** so no instrument silently disappears. Unsafe external/SVG image URLs are cleared, and repeated project IDs are ignored. Previously recorded local review flags remain local editor state, not signed approval. When the browser refuses to save because its quota is full, the app shows a warning instead of failing silently. Projects can be renamed and deleted from History.

## 🛡 OT-Sentinel Audit Logic

The audit engine (`otSentinelService.ts`) performs these checks:
1. **Syntactic**: Does the parsed tag conform to ISA naming constraints `[Letters]-[Number][Suffix]` (e.g. `PT-101A`)? Validation canonicalizes case, surrounding whitespace and an optional separator before applying the constraints.
2. **Classification**: Did the model return a signal or block type that could not be mapped (`Unknown`)? These need manual assignment before export.
5. **Duplicate identity**: Canonicalized instrument tags (case, optional separators/whitespace) must be unique across the project; repeated equipment identities receive an error before anyone relies on the conceptual exports. The audit does not claim a SIL/standards certification.
3. **Functional**: Does an analog signal (AI/AO) lack engineering units? Does the description mention a safety function (relief, ESD, interlock...) that needs IEC 61511 / SIL review?
4. **Topology**: Does a flow loop (`F-...`) contain an analog input but no final control element (an AO signal or a tag whose function letters end in `V`)?

## Consistent read-only safety findings

The BOM Safety & Naming Audit now displays deterministic OT-Sentinel tag/loop checks (errors, warnings and informational heuristics) even if Gemini did not populate `safetyWarning`. Model-supplied notes are presented separately as **unverified** safety notes. Neither audit tab certifies ISA-5.1, IEC 61511 or SIL compliance, and neither can issue OT commands.

## Conceptual BOM estimate integrity

BOM costs are unverified estimates, not vendor quotations. Normalization, UI and CSV use `services/bomCost.ts`: only finite nonnegative unit estimates no greater than USD 1 billion are recognized. Missing or invalid values display **Not estimated** instead of $0, and the UI labels totals partial if equipment remains unpriced. The CSV leaves invalid estimated unit costs blank. Procurement prices require vendor verification.

## Backup schema integrity

Backup export and import share the stored-project typed-field validator. Every instrument must have all expected typed fields, supported classifications, a nonempty row ID and tag, and distinct editor row IDs. Incomplete, malformed or duplicate rows reject the entire backup rather than silently manufacturing tags or classifications. Imported backups still receive new editor IDs and any claimed human-reviewed flags are cleared. Unlike provider-output normalization, backup restoration preserves validated intentionally blank descriptions, units, equipment/object names, brands and model notes verbatim, without creating synthetic engineering values. Only documented instrument fields are restored; unknown extension keys are discarded. Existing unstructured legacy backups must be repaired at the source instead of best-effort coercion.

## Model Output Normalization

`services/normalizeInstruments.ts` validates the model's JSON before it reaches the UI. Malformed or non-array responses are rejected with a clear error. A non-object row anywhere in a model-generated array also rejects the entire response, rather than silently discarding a potentially important instrument. Valid object rows still retain unknown classifications as low-confidence findings. Signal or block types outside the supported set become `Unknown` with `low` confidence instead of being silently replaced with a default, and a missing confidence also counts as `low`.

## 📏 Evaluation

`npm run eval` (`eval/run.ts`) sends each `samples/<name>/drawing.png` through the same `server/gemini.ts` path the app uses and scores the result against `expected.json` (`eval/score.ts`):
- **Tag matching** is format-insensitive, so `FT101`, `FT 101` and `FT-101` count as the same tag. Precision and recall are micro-averaged over all samples.
- **Signal and block type accuracy** are measured on matched tags only. An expected field may list several acceptable values.

The samples are synthetic drawings authored for this repository (SVG sources included), so they can be shared and extended freely. Their `signalConnections` labels identify directed, actually drawn *instrument signal* lines only. `eval/topology.ts` separately microaverages directed edge precision/recall/F1 using canonical tag identities, treating missing, reversed, dangling and self-links as errors. The visualization engine's inferred loop chains and physical pipe connectivity are not labelled signal edges. Topology results are printed and retained in **schema-v2** reports containing per-sample directed-signal counts and independent microaveraged topology precision/recall/F1. The report validator checks each metric family against its stored counts, preserves source drawing/label hashes and refuses cross-version comparisons. Legacy schema-v1 reports remain tag-only. No model performance claim is made without a real evaluation.

## Gemini SDK 2.x contract and image output

The server uses `@google/genai@2.29.1` with `models.generateContent`, a typed JSON response schema for P&ID tag extraction, and `response.text` for decoding model output. Offline provider-mock contract tests cover both extraction and generated image paths without API credentials. Inline image responses accept only PNG, JPEG or WebP with valid base64 and a 12 MiB decoded payload limit; HTML/SVG outputs are rejected. These tests verify local SDK call shapes and response handling, **not the correctness of real Gemini model predictions**. A genuine, explicitly authorized `npm run eval` benchmark and human review are still required before production acceptance.

## Bounded engineering edit history

Tag edits, manual additions and deletions are recorded in a bounded 30-step, per-project, **in-memory only** undo/redo history using one React reducer for atomic state/history transitions. Imported or deleted projects start without inherited edit history; editing after undo clears the redo stack. History stores instrument arrays only (not P&ID raster images or digital-twin blobs). Undo/redo conservatively revoke **all restored row review flags** so a previous approval cannot be replayed into the current engineering snapshot. Export remains blocked until explicit human re-review. Reloading the browser clears undo/redo history, not saved projects. This is local convenience history, not a signed engineering audit trail.

## Manual editing and backup
A review-required low-confidence instrument can be added to the table. The BOM export reuses existing spreadsheet formula-injection prevention for all text cells; costs remain estimates. Versioned JSON project backups use the same 48 MiB UTF-8 cap on import and export, including a pre-read File.size check and an explicit error for oversized exports, parsed and normalized before adding a new project ID. Only base64 PNG/JPEG/WebP inline images are retained. Any non-object instrument row blocks both backup import and serialization to prevent a silently incomplete engineering record; valid records still undergo normalization and lose untrusted review flags. No vendor import claim is implied.

## 📊 Export Mappings

> **Concept formats.** Both exports are illustrative layouts. They have not been validated against the real Siemens PCS 7 (Import/Export Assistant) or ABB 800xA (Bulk Data Manager) import schemas, so treat them as a starting point for an engineering tool chain, not as files to load into a live system.

Export builders live in `services/exportService.ts` and are covered by unit tests:
- **CSV:** semicolon delimiter, CRLF line endings, RFC 4180 quoting for fields containing `;`, tabs, `"` or line breaks, and a UTF-8 BOM so Excel shows units such as `°C` correctly.
- **Spreadsheet safety:** AI-extracted fields beginning with formula operators (`=`, `+`, `-`, `@`, including leading whitespace/invisible characters) are prefixed with an apostrophe before quoting. This reduces accidental formula execution when reviewing CSV in spreadsheets but modifies those values. Spreadsheet behavior can vary, so **do not treat CSV escaping as a complete security boundary**. Inspect any escaped cells and validate the full file against real vendor schemas before engineering-system import.
- **XML:** `&`, `<`, `>`, `"` and `'` are escaped and characters XML 1.0 forbids are dropped, so the output is always well-formed.

### Siemens PCS7 APL
| Signal Type | ISA Tag | PCS7 Block Type |
|-------------|---------|-----------------|
| AI          | PT/TT/FT| `MonAnL`        |
| AO          | FCV/PCV | `VlvAnL`        |
| DI          | LSH/PSL | `MonDiL`        |
| DO          | XV      | `VlvL`          |

### ABB 800xA
Generates a structured XML fragment where each instrument is assigned an `AspectObject` type based on its signal characteristics.

## Node runtime baseline (toolchain upgrade phase 1)

Use Node 24 LTS, minimum v24.15.0 and pinned v24.22.0 for reproducible GitHub Actions, CircleCI, browser smoke and local `.nvmrc`. `package.json` and root `package-lock.json` engine metadata agree. This stage does not upgrade Vite, Vitest, vite-node or jsdom and intentionally leaves all transitive lockfile entries unchanged. Advance those coordinated toolchain changes only in later tested PRs. Any runtime mismatch must fail the dependency/CI checks; never skip safety tests to merge.

## Research evidence and reproducibility

The ten-drawing synthetic corpus now has source SVGs, validated PNGs and hand-authored gold reference labels. `npm run eval:inspect` produces an **unscored** SHA-256 inventory. Preflight rejects missing signal/block labels; missing ground truth never receives credit as a correct prediction. The eight new procedural cases share a drawing style. Passing CI demonstrates software correctness, not real Gemini accuracy or independent engineering certification. See [research evidence](docs/RESEARCH_EVIDENCE.md).

### Additional classification advisory

OT-Sentinel now compares assigned AI/AO/DI/DO signal class against a small **illustrative** MonAnL/MonDiL/MotL/VlvL/VlvAnL/PIDConL block mapping table. Inconsistent classifications raise advisory warnings and are never auto-corrected. These mappings are conceptual shorthand and must not be treated as a verified Siemens PCS7 import schema or a plant safety assessment. Existing human review and critical topology blockers remain authoritative for concept exports.
