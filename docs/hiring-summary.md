# Vision2DCS — technical reviewer brief

**Research demo** | NEXUS-branded industrial automation concept studio | React 19 + TypeScript + Vite + React Flow + optional guarded Gemini backend

[**Open static offline demo**](https://vision2dcs-nexus-demo.vercel.app/) · [**Repository home**](../README.md) · [**Evidence matrix**](DEMO_EVIDENCE_MATRIX.md)

## What a reviewer can actually run

Vision2DCS provides an inspectable human-in-the-loop workflow: two synthetic P&IDs, editable instrument tags, reviewed-only concept exports, conservative OT-Sentinel findings, declared versus inferred signal-topology visualization, local alarm education and repeatable pixel-noise exploration. The public demo **does not require an API key** or invoke paid AI.

| Reviewer question | Reproducible evidence |
|---|---|
| Are there real, checked sample drawings? | [Ten PNG/SVG and labelled fixtures](../samples/) verified by `npm run eval:preflight` and `eval:inspect` |
| Can scientific metrics be inspected honestly? | [Versioned source-hashed reports](../eval/report.ts), [drawing-level diagnostics](../eval/diagnostics.ts), [local JSON viewer](../components/BenchmarkEvidenceViewer.tsx) |
| Is anything actually measured? | [Tesseract OCR job](https://github.com/senanurcetin/Vision2DCS/actions/runs/39515173658): 10 synthetic PNGs, **tag-only F1 28.13%**, not Gemini |
| Are risky inputs and credentials kept behind server checks? | [API guard](../server/api.ts), [server adapter](../server/node.ts), [security overview](../SECURITY.md) and unit tests |
| Are UI and export review gates exercised in a browser? | [Chromium developer/public smoke workflow](https://github.com/senanurcetin/Vision2DCS/actions/workflows/browser-smoke.yml) |
| Is the full claim boundary recorded? | [Acceptance evidence matrix](DEMO_EVIDENCE_MATRIX.md) and [scientific limitations](RESEARCH_EVIDENCE.md) |

## Reproduce locally

Use **Node 24.15+**, with **24.22.0** pinned in `.nvmrc`, then:

```bash
nvm use
npm ci
npm run typecheck
npm test
npm run eval:preflight
npm run eval:inspect
npm run build
npm run dev
```

These checks and the local synthetic demo do **not** call Gemini. Actual model evaluation (`npm run eval`) requires **separately authorized** server credentials and a complete paid-call budget; CI does not fabricate model performance.

## Technical judgment

The meaningful design choice is the **review and evidence boundary**, not a claim of AI autonomy. Model-generated tags and links remain untrusted until checked; a local review toggle is not a signed engineering approval. Cyan lines in HMI represent validated declared references, gray dashed lines only heuristic layout. Conceptual Siemens PCS 7 CSV and ABB 800xA XML have no vendor import acceptance. The synthetic corpus, Tesseract comparison, alarm simulation and scan perturbation exercises demonstrate implementation and research methodology; they **do not prove independent plant generalization, SIL compliance or PLC/DCS interoperability**.

**Current research gaps:** diverse permissioned engineering P&IDs, blinded second-annotator review, real measured Gemini evaluation, paired OCR robustness experiments, versioned multi-target signal graph and external vendor-schema verification. See [research track #88](https://github.com/senanurcetin/Vision2DCS/issues/88) and [vendor-schema issue #2](https://github.com/senanurcetin/Vision2DCS/issues/2).

**Project purpose:** advanced portfolio/research demonstration only. No accounts, billing, commercial sales features, remote plant network or actuator writes.
