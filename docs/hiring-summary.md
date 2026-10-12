# Reviewer brief — Vision2DCS

**Role:** Industrial AI workflow prototyping, multimodal extraction and reviewable engineering interfaces. **Stage:** P&ID-to-HMI concept assistant, not certified DCS configuration software.

## What the prototype does

A Gemini-powered server endpoint interprets process and instrumentation diagrams, returns structured tag and connectivity concepts, and displays them using React Flow. A separate render produces digital-twin imagery. Input diagrams can be synthetic, allowing controlled evaluations.

| Question to ask | Proof |
|---|---|
| Can extraction be evaluated against expected output? | [Synthetic samples](../samples/), [runner](../eval/run.ts), [scoring code](../eval/score.ts) |
| Are service responsibilities clear? | [README architecture](../README.md#architecture-snapshot) and [technical guide](../TECHNICAL_GUIDE.md) |
| Is it a real implementation rather than a mockup? | [Representative interface capture](https://github.com/user-attachments/assets/2259d7d5-cac7-409c-b453-ede8c39f6398) and [project source](../README.md#repository-highlights) |
| Can a reviewer repeat checks? | `npm run eval` with a configured model; `npm run typecheck` and `npm test`; [setup](../README.md#local-setup) |

## Engineering decision

Make AI-generated tags and connections inspectable instead of pretending an LLM has produced deployment-ready PLC/DCS engineering. API credentials remain server-side and basic rate limiting protects the hosted interaction.

## Known gaps

Vendor-oriented PCS 7 CSV and ABB 800xA XML are conceptual formats, not validated import schemas. Extraction and BOM estimates require qualified engineer review; no physical safety or plant network integration is implied.

**Full technical scope:** [README and limitations](../README.md#limitations).
