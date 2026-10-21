# Vision2DCS — NEXUS Advanced Research-Demo Evidence Matrix

**Engineering evidence baseline:** checked against GitHub `main` at `9a2e51757ce6a06643e1f460fe5678f9480c5f33` (21 October 2026); this document is an evidence register, not a claim that the branch will always remain at that commit.  
**Scope:** Industrial automation **research and educational portfolio demo**, **not** a commercial product, validated engineering deliverable, plant controller or vendor-native import system.

This document separates **implemented software**, **tested behavior**, **measured scientific performance**, and **unsupported claims**. A passing unit test never proves real P&ID extraction accuracy, safety integrity, independent labels or interoperability.

**Documentation maintenance:** [Contributing](../CONTRIBUTING.md) describes the offline `npm run docs:check` integrity command. Its GitHub Actions and CircleCI gates verify internal Markdown file/headline references, not the live validity of external sites or the provenance of AI experiments.

## Verification references

| Evidence | Exact verification |
|---|---|
| Main quality CI | [Main-head run 39516571475](https://github.com/senanurcetin/Vision2DCS/actions/runs/39516571475): locked install, production dependency audit, TypeScript, Vitest, PNG/gold-label preflight, scientific corpus inspection, web/SSR build |
| Real OCR research run | [Main-head run 39515173658](https://github.com/senanurcetin/Vision2DCS/actions/runs/39515173658): Tesseract system package, exact PNGs, source-hashed tag-only report, local diagnostic validation and 7-day evidence artifact |
| Developer/public browser interaction | [PR #93 Chromium smoke run 39516364508](https://github.com/senanurcetin/Vision2DCS/actions/runs/39516364508): synthetic project, export review gate, no `/api` calls, cause/effect keys and reset, source-hashed report accept/reject, reproducible scan stress, responsive viewports |
| Critical HMI wiring guard | [PR #87](https://github.com/senanurcetin/Vision2DCS/pull/87): tested ambiguous/duplicated identities, fail-closed declared edges |
| Drawing-level diagnostics | [PR #86](https://github.com/senanurcetin/Vision2DCS/pull/86): source-hashed per-drawing macro scoring and empty-denominator semantics |
| Offline educational logic | [PR #89](https://github.com/senanurcetin/Vision2DCS/pull/89): pure local alarm state machine with fault-as-UNKNOWN and explicit clear-range reset |
| Browser evidence explorer | [PR #90](https://github.com/senanurcetin/Vision2DCS/pull/90): locally validated JSON, source hashes, per-drawing evidence, no uploads |
| Measured non-generative baseline | [PR #91](https://github.com/senanurcetin/Vision2DCS/pull/91): real Tesseract OCR, tag-only parity and captured CI artifact |

## Engineering and software acceptance

| Capability | State | Evidence within repository | Boundary |
|---|---|---|---|
| Official NEXUS identity and responsive UI | **IMPLEMENTED; browser tested and captured** | `public/nexus-x.svg`, `index.css`, `App.tsx`; real `docs/assets/nexus-workspace-*.png`, `nexus-hmi-topology.png`, `nexus-training-lab.png`, `nexus-scan-stress.png` | Screenshot and smoke evidence is not a complete WCAG audit or a vendor/plant usability validation |
| Real Chromium screenshot capture | **IMPLEMENTED; dedicated job passed** | `.github/workflows/nexus-readme-screenshots.yml`, `scripts/capture-readme.mjs` and committed `docs/assets/nexus-*.png` | Source-controlled synthetic examples only; no paid AI or observed plant signals |
| Offline sample P&IDs | **IMPLEMENTED; smoke tested** | `services/offlineDemo.ts`; `services/offlineDemo.test.ts` | All labels synthetic, unreviewed by default; no model extraction is implied |
| Source-bounded project/backup lifecycle | **IMPLEMENTED; tested** | `services/projectStore.ts`, `services/projectBackup.ts` and tests | Local browser storage is not a secure enterprise or audited document vault |
| Explicit local engineering review & revocation | **IMPLEMENTED; tested** | `services/reviewState.ts`, `services/conceptExportGate.ts`, browser export/review smoke | A local boolean is not a signed engineering approval |
| Tag, signal and topology heuristics | **IMPLEMENTED; tested** | `services/tagParser.ts`, `services/signalTopology.ts`, `services/topologyLayout.ts`, tests | ISA-like naming *heuristics*, not full ISA-5.1 certification; one declared outgoing signal target per row |
| Distinguish declared versus inferred HMI links | **IMPLEMENTED; tested** | `components/HmiReactFlowView.tsx`, `services/topologyLayout.ts`, `services/signalTopology.ts` | Gray inferred lines never count as diagram-grounded signal evidence; ambiguous declared links fail closed |
| Conservative OT findings and BOM estimates | **IMPLEMENTED; tested** | `services/otSentinelService.ts`, `services/signalBlockAdvisory.ts`, `services/bomCost.ts` | Heuristic safety warnings and nonquoted cost estimates; no SIL, FMEA or vendor module verification |
| Vendor-style CSV/XML and NEXUS read-only tag map | **IMPLEMENTED; browser-tested as concepts** | `services/exportService.ts`, `services/nexusTagMap.ts`, `services/nexusTagMapReader.ts` | Not validated against Siemens PCS 7 / ABB 800xA import schemas; [external evidence issue #2](https://github.com/senanurcetin/Vision2DCS/issues/2) |
| Non-billable public demo and secured optional model route | **IMPLEMENTED; tested** | `server/api.ts`, `server/node.ts`, `server/operatorAccess.test.ts`, `App.tsx` | Token + per-process call budget is not internet identity federation or a financial provider spending cap |
| Synthetic alarm/cause/effect teaching | **IMPLEMENTED; smoke tested** | `services/causeEffectDemo.ts`, `components/CauseEffectDemo.tsx` and tests | Arbitrary training thresholds, no process-dynamics solver, no PLC/DCS/actuator commands |
| Accessible interaction | **PARTIALLY TESTED** | Native buttons/range/checkbox, aria labels, keyboard-driven Chromium smoke, reduced-motion styling | Screen-reader usability, WCAG contrast and cross-browser AT audit not independently performed |

## Scientific acceptance and evidence limits

| Research measure | State | Evidence | Correct interpretation |
|---|---|---|---|
| Source-labelled synthetic corpus | **VERIFIED AS A FIXTURE, NOT A PERFORMANCE RESULT** | 10 checked PNG + expected JSON pairs; `eval/preflight.ts`, `eval/inspect.ts` | Eight procedural images share a common grammar; two baseline cases do not establish broad independence |
| Directed signal gold references | **VERIFIED AS REPOSITORY LABELS** | `eval/topology.ts` and tests; strict CRC/edge validation | Drawn dashed signal lines only; process piping not scored; not a blinded label adjudication |
| Model tag classification/edge accuracy | **NOT MEASURED HERE** | `eval/run.ts` supports explicitly budgeted Gemini, but CI never calls paid inference | No claimed Gemini precision/recall/F1 without an actual logged model run |
| Per-drawing macro and micro evaluation | **IMPLEMENTED AND UNIT-TESTED** | `eval/diagnostics.ts` and `eval/diagnostics.test.ts` | Produces numbers only from a validated, supplied benchmark report; `null` means undefined denominator |
| Local benchmark explorer | **IMPLEMENTED; browser-tested** | `components/BenchmarkEvidenceViewer.tsx`; PR #90 smoke | Validates arithmetic and source hashes, **not** report authorship or label independence |
| Tesseract real PNG tag-only baseline | **MEASURED ON SYNTHETIC CORPUS** | `eval/ocr-cli.ts`, `eval/ocrBaseline.ts`, main-head OCR Actions artifact | Real Tesseract 5.3.4 with eng/PSM11 on the 10 synthetic PNGs; precision **0.5294**, recall **0.1915**, F1 **0.2813** on *tag detection only*. These measured figures are not Gemini results |
| OCR versus paid-model pairing | **IMPLEMENTED, NOT YET EXECUTED AGAINST LIVE GEMINI** | `eval/compareTags.ts` and tests, `eval:compare-tags` | Requires matching exact drawing and expected-label SHA-256; compares only tag precision/recall/F1 |
| Independently authored engineering P&IDs | **NOT ESTABLISHED** | `docs/RESEARCH_EVIDENCE.md` | Requires permissible external P&IDs from diverse engineers/tools |
| Blinded secondary annotation and agreement | **NOT ESTABLISHED** | No second independent human-labelled reference set | Cannot claim agreement or adjudication without actual secondary annotators |
| Seed-controlled visual scan speckle / occlusions | **IMPLEMENTED AS UNSCORED PREVIEW; browser tested** | `services/scanStress.ts`, `components/ScanStressLab.tsx`, tests | Pixel-hashed deterministic preview only; no OCR/Gemini robustness accuracy or independent hard-negative experiments yet |
| Multi-target instrument signal graph | **NOT YET IMPLEMENTED** | Current `Instrument.connectedTo?: string` | A backward-compatible versioned graph and backup migration would require separate test and review |
| Certified vendor import, verified SIL/OT deployment | **EXCLUDED FROM DEMO ACCEPTANCE** | [Issue #2](https://github.com/senanurcetin/Vision2DCS/issues/2) documents external validation need | Do not call experimental CSV/XML files import-ready or safety-certified |

## Demo-completion decision

- **Working advanced offline research/education demo:** **YES for the implemented, tested functions above**, with CI and Chromium evidence.
- **Proven high-accuracy multimodal P&ID extractor:** **NO; no live Gemini result is established**.
- **Independent scientific generalization to engineering P&IDs:** **NOT ESTABLISHED**.
- **Production, plant operation, certified DCS import:** **NOT IN SCOPE**.
- **Future research backlog:** preserved in [#88](https://github.com/senanurcetin/Vision2DCS/issues/88), not silently converted into completed claims.

No customer accounts, sales flows, subscriptions, payment processing, automatic OT commands, multi-tenant deployment or commercial SLA are permitted under this demo scope.
