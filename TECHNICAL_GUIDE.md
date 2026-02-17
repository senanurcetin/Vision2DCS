# Vision2DCS Technical Architecture

## 🧠 AI Strategy: Multimodal Extraction

The core of the application lies in the `geminiService.ts`. Instead of simple OCR, we use **Multimodal Prompting**:
- **System Instruction**: We prime the model as a "Lead DCS Architect" to ensure technical vocabulary (e.g., "Engineering Units", "Solenoid", "Diaphragm Actuator").
- **Schema Enforcement**: We use the Gemini `responseSchema` to force the model to return valid JSON that maps directly to our `Instrument` interface.
- **Contextual Inference**: The model doesn't just read text; it infers "connectedTo" relationships based on the visual proximity of equipment in the P&ID.

## 🕸 Topology Engine (React Flow)

Mapping a 2D image back to a node-based graph:
1. **Loop Parsing**: We use regex to extract loop IDs (e.g., `101` from `PT-101`).
2. **Grouping**: Instruments with the same loop ID are clustered into `loopGroup` nodes.
3. **Auto-Routing**: The `HmiReactFlowView` calculates `X/Y` coordinates to present a logical left-to-right process flow (Sensor -> Controller -> Actuator).

## 🛡 OT-Sentinel Audit Logic

The audit engine (`otSentinelService.ts`) performs three types of checks:
1. **Syntactic**: Does the tag match the `[Letter]-[Number]` ISA format?
2. **Functional**: Is a safety-critical tag missing mandatory descriptors?
3. **Topology**: Does an Analog Output (AO) exist without a corresponding Input (AI) in the same loop?

## 📊 Export Mappings

### Siemens PCS7 APL
| Signal Type | ISA Tag | PCS7 Block Type |
|-------------|---------|-----------------|
| AI          | PT/TT/FT| `MonAnL`        |
| AO          | FCV/PCV | `VlvAnL`        |
| DI          | LSH/PSL | `MonDiL`        |
| DO          | XV      | `VlvL`          |

### ABB 800xA
Generates a structured XML fragment where each instrument is assigned an `AspectObject` type based on its signal characteristics.
