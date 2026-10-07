# Vision2DCS Technical Architecture

## 🧠 AI Strategy: Multimodal Extraction

The core of the application lies in `server/gemini.ts`. Instead of simple OCR, we use **Multimodal Prompting**:
- **System Instruction**: We prime the model as a "Lead DCS Architect" to ensure technical vocabulary (e.g., "Engineering Units", "Solenoid", "Diaphragm Actuator").
- **Schema Enforcement**: We use the Gemini `responseSchema` to force the model to return valid JSON that maps directly to our `Instrument` interface.
- **Contextual Inference**: The model doesn't just read text; it infers "connectedTo" relationships based on the visual proximity of equipment in the P&ID.

## 🔐 Server Boundary

All Gemini calls run on the server so the API key never reaches the browser:

- `server/api.ts` is a Web-standard `Request → Response` handler for `POST /api/analyze` and `POST /api/digital-twin`. It validates input (JPEG/PNG/WebP, ≤ 10 MB), applies a per-client rate limit, and maps failures to user-safe messages. A rejected key or missing configuration returns 503, and other upstream errors return 502 without exposing internal details.
- `server/retry.ts` retries 429 and 5xx responses with exponential backoff.
- `server/node.ts` adapts the handler to Node's `http` module with a 15 MB body limit. It is mounted by `server/vitePlugin.ts` for `vite` and `vite preview`, and by `server/httpServer.ts` for `npm start`. The production server also serves `dist/` with an SPA fallback.
- `services/geminiService.ts` is the thin browser client for these routes.

## 🕸 Topology Engine (React Flow)

Mapping a 2D image back to a node-based graph:
1. **Loop Parsing**: `services/tagParser.ts` splits a tag into function letters, loop number and suffix. The loop is the first (measured-variable) letter plus the number, so `FT-101` and `FCV-101` share loop `F-101` while `TT-101` is loop `T-101`.
2. **Grouping**: Instruments with the same loop ID are clustered into `loopGroup` nodes.
3. **Auto-Routing**: The `HmiReactFlowView` calculates `X/Y` coordinates to present a logical left-to-right process flow (Sensor -> Controller -> Actuator).

## 🛡 OT-Sentinel Audit Logic

The audit engine (`otSentinelService.ts`) performs these checks:
1. **Syntactic**: Does the tag match the ISA format `[Letters]-[Number][Suffix]` (e.g. `PT-101A`)?
2. **Classification**: Did the model return a signal or block type that could not be mapped (`Unknown`)? These need manual assignment before export.
3. **Functional**: Does an analog signal (AI/AO) lack engineering units? Does the description mention a safety function (relief, ESD, interlock...) that needs IEC 61511 / SIL review?
4. **Topology**: Does a flow loop (`F-...`) contain an analog input but no final control element (an AO signal or a tag whose function letters end in `V`)?

## Model Output Normalization

`services/normalizeInstruments.ts` validates the model's JSON before it reaches the UI. Malformed or non-array responses are rejected with a clear error. Signal or block types outside the supported set become `Unknown` with `low` confidence instead of being silently replaced with a default, and a missing confidence also counts as `low`.

## 📊 Export Mappings

> **Concept formats.** Both exports are illustrative layouts. They have not been validated against the real Siemens PCS 7 (Import/Export Assistant) or ABB 800xA (Bulk Data Manager) import schemas, so treat them as a starting point for an engineering tool chain, not as files to load into a live system.

Export builders live in `services/exportService.ts` and are covered by unit tests:
- **CSV:** semicolon delimiter, CRLF line endings, RFC 4180 quoting for fields containing `;`, `"` or line breaks, and a UTF-8 BOM so Excel shows units such as `°C` correctly.
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
