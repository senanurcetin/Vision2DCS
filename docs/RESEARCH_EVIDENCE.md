# Vision2DCS — NEXUS Scientific Evidence Boundary

**Status: synthetic and unscored.** No measured Gemini extraction quality is claimed.

## The ten-case challenge corpus

The baseline contains two separately authored schematic P&IDs (flow control and tank level).
Eight additional procedurally rendered monochrome P&IDs cover pressure, temperature,
flow and level regulation, discrete switches, valves and motors. Each case has
its own PNG raster, editable SVG source and expected.json with hand-specified
instrument classifications and directed signal references.

All eight procedural cases reuse the same lettering and drawing grammar;
they do not amount to eight independent engineering drafting conventions.
Human-authored reference labels have not received blinded second-annotator
verification. Process piping is never scored as an instrument signal.

## Fully offline reproduction

```sh
npm ci
npm run eval:preflight
npm run eval:inspect
npm run typecheck
npm test
npm run build
```

eval:inspect prints an unscored SHA-256 evidence inventory including drawings,
tag and link counts, classification diversity and corpus insufficiency.
eval:preflight rejects missing type labels, unrecognized tags, duplicate
identities, invalid directed edges and corrupt PNG files *before* model calls.
An actual provider run requires an explicit paid budget for all cases:

```sh
VISION2DCS_EVAL_MAX_CALLS=10 npm run eval
```

Never run this paid command from CI. Do not create synthetic precision,
recall, F1 or a nominal confidence interval in the absence of actual
Gemini predictions. Samples from one drawing are correlated; the unit for
assessing generalization is the independent drawing, not each extracted tag.

## Unresolved validation gaps

- Need diverse, permitted P&IDs authored by different engineers/tools.
- Need blinded independent gold-label review and documented disagreements.
- Need OCR/heuristic baselines, hard-negative, occlusion and scan-noise tests.
- Need metrics by drawing, difficulty and tag family, not pooled metrics alone.
- Current editor supports only a single connectedTo target per instrument.
- Neither Siemens PCS7 nor ABB 800xA vendor import format is certified.
- OT-Sentinel uses heuristic checking, not ISA/IEC functional-safety approval.

## Deliberately not productized

No customer accounts, subscriptions, payments, sales workflows, plant network
connection, live actuator control, commercial SLA or automatic approvals.
Research reproducibility, engineering reasoning and visual education are
the intended demo scope.

## Post-hoc drawing-level diagnostics (no additional model calls)

After a **real, explicitly authorized** `npm run eval` has created a valid
source-hashed report, inspect drawing-level failures separately from micro
averages:

```sh
npm run eval:diagnose -- eval/results/latest.json
```

The read-only command validates the v1/v2 report and checks its declared summary
against its underlying sample counts. It reports tag precision, recall, F1 and
classification accuracy per drawing, plus separate directed-edge scores in v2.
Each score has its exact drawing and expected-label SHA-256 references. The
macro-average gives every **drawing** equal weight, while the existing micro
score weights tags or connections. The worst F1 drawing is explicitly identified
for further investigation; ties are deterministic.

A metric with a zero denominator is `null`, not an artificial perfect score;
`evaluatedDrawings` shows the number of actual contributing drawings. A model
that predicts **no links** against positive connection ground truth receives
F1=0, while a drawing with no labelled *and* no predicted links has undefined
link F1. As a result, macro precision/recall/F1 can have different denominators;
compare them with care. This diagnostic **does not** produce performance numbers
without a saved report, run Gemini, certify independent examples, or establish
an uncertainty interval. Saved-report provenance is not independently verified;
synthetic fixtures with shared grammar remain correlated research examples.

## Demonstrating alarm logic without manufacturing plant evidence

The **Training Lab** implements a deterministic, entirely local sequence of
example observations, advisory/trip thresholds, a latched event, operator
acknowledgement and explicit clear-range reset. Example tags match the two
synthetic case studies, but thresholds and hypothetical effects are manually
invented educational data and are **not** extracted from drawings. A sensor
fault yields an **UNKNOWN** observation rather than a fabricated safe state.
The event history is bounded and ephemeral. This illustrates how to review a
simple alarm sequence; it is neither process dynamics nor a functional-safety
or cause/effect matrix verification. No plant commands, actuator control,
networked I/O, AI inference or paid model access are involved.

## Local NEXUS research evidence visualization

The **Research Evidence** tab can render a separately saved, source-hashed v1/v2
benchmark report without triggering any model inference. The same validator as
`npm run eval:diagnose` rejects inconsistent samples or summaries. The browser
calculates per-drawing F1 and macro means and exposes denominator coverage and
source SHA-256 identities; empty denominators remain N/A. It keeps an imported
JSON record in React memory only. Uploaded report provenance is not
independently authenticated. Do not present test-only or procedural fixture
records as Gemini performance. Without a real, user-supplied evaluation report,
the interface displays **no measured extraction results**.

## Measured non-generative Tesseract tag baseline

An independent, explicitly labelled **tag-reading-only** reference is provided
by the optional system Tesseract OCR engine and deterministic, bounded ISA-like
tag token parser:

```sh
# Install Tesseract OCR with English language data using the OS package manager.
npm run eval:preflight
npm run eval:ocr
npm run eval:diagnose -- eval/results/latest.json
# After a separately authorized real Gemini evaluation is available:
npm run eval:compare-tags -- <ocr-baseline.json> <real-gemini-report-v2.json>
```

`eval:ocr` makes CPU-only Tesseract calls on **exact validated PNG bytes**
written to restricted temporary files; it never reads SVG source text as an OCR
substitute or passes reference labels to Tesseract. Tesseract version and page
segmentation mode (`eng-psm11`) are recorded in a source-hashed, schema-v1
report. All inputs must pass the full preflight first, and failures never save
invented success results. Running the command locally requires installed
Tesseract. The dedicated `Vision2DCS offline OCR research baseline` GitHub
Actions workflow installs it and runs actual OCR without Gemini credentials,
retaining the measured report and per-drawing diagnostics as short-lived
artifacts, not benchmark numbers hardcoded in documentation.

**Fair comparison:** `eval:compare-tags` only compares precision, recall and
F1 for instrument tag detection after verifying identical drawing and label
SHA-256 identities for all cases. It deliberately permits a schema-v1
OCR report against a schema-v2 Gemini report **only for tag metrics**. OCR does
not predict AI/AO/DI/DO classifications, Siemens block types or signal links;
zero placeholder classification counts in the v1 report must not be presented
as a measured skill. Do not use the broader `eval:compare` for mixed versions.
The corpus is still mostly procedurally related and no generalization claim
follows from these synthetic results.
