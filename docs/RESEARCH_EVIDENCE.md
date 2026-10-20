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
