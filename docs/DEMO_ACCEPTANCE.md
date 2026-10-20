# NEXUS Vision2DCS — Offline Demo Acceptance

For claim-level evidence and current scientific limits, see [DEMO_EVIDENCE_MATRIX.md](DEMO_EVIDENCE_MATRIX.md).

Scope: a **local, read-only engineering concept demo**, not certified industrial
control software or a vendor-ready PCS 7 / ABB import. No live PLC, plant network,
automatic GitHub deployment, model API payment or operator secrets are needed.

## Reproducible exact-head checks

Run with locked dependencies and a supported Node.js environment:

```sh
npm ci --no-audit --no-fund
npm run typecheck
npm test
npm run eval:preflight
npm run build
```

Pull-request GitHub Actions and CircleCI supply independent evidence. The
offline Chromium browser-smoke job additionally checks synthetic backup import,
explicit review before concept exports, responsive layout and token handling.

## Manual demo walk-through

1. Launch `npm run dev`. Leave the AI access token blank; model features must
   remain disabled. Do not configure or call a real Gemini API for this demo.
2. Import a valid `.vision2dcs.json` project with reviewed flags in the file.
   Verify flags are revoked and the original source drawing appears locally.
3. Confirm tag editing, undo/redo and project rename work; engineering-field
   edits must revoke previous human review.
4. Check OT-Sentinel warnings and BOM. Unpriced equipment displays
   **Not estimated**, with a **Partial estimate** warning for missing costs.
5. Confirm concept exports cannot run while any row lacks explicit local review;
   review tags manually, then export conceptual Siemens CSV, ABB XML and the
   read-only NEXUS Tag Map v1 JSON.
6. Confirm the JSON tag-map is at most 1 MiB **as downloaded**, contains no
   credentials or drawing payload, and fails closed on invalid or duplicate tags.
7. Import a deliberately malformed backup; the original projects must remain
   untouched. Reject unauthorized/oversized HTTP uploads without model calls.

## Advanced signal-link editing and provenance

The Tag Management **Signal to** field edits one optional directed instrument
connection per row. Editing revokes that row's local human review. OT-Sentinel
reports unresolved, ambiguous, self-referencing or cyclic links as critical
errors that block all concept exports. HMI cyan edges are independently resolved
declared links. A missing, invalid or ambiguous **source** tag, ambiguous
target tag, or duplicated internal instrument-row ID must not produce a cyan
edge; these are critical findings rather than independent wiring evidence.
Gray dashed edges are ONLY visualization heuristics, never
plant connection evidence. Reviewed **SIGNAL LINKS CSV** downloads contain only
declared directional links labelled "not certified". It is not vendor-native
import data, and the system has no live OT integration.

## Release boundaries

Passing this offline demo does **not** claim verified live AI extraction
accuracy, PLC/OT interoperability, vendor import compatibility, a signed
human engineering review, SIL certification, or production-grade internet
authentication / provider billing controls. Real vendor validation (#2),
engineering sign-off and secure TLS identity ingress remain separate gates.

Do not merge this integration PR into a production/deployment branch based
solely on an offline smoke test.

## Public demo UX and deployment environment

The dedicated static Vercel project (`vision2dcs-nexus-demo`) builds with
`VITE_VISION2DCS_PUBLIC_DEMO=true` for production and preview deployments.
This is a public non-secret build flag; it hides inoperative Gemini token,
upload-to-AI and digital-twin actions on a frontend-only host. It does not
grant backend access or enable inference. A separate empty-state CTA loads the
existing synthetic flow-control fixture. Local dev/Node builds omit the flag
and preserve guarded AI functionality. The browser smoke workflow runs
both `developer` and `public` jobs to prevent mode regressions.

## Review and project integrity (vNext)

The project reducer refuses duplicate IDs rather than overwriting an earlier
engineering project. Browser-generated project, demo and manual-row IDs carry
fresh random entropy and a monotonically increasing local suffix. Deleting the
selected project selects the next available project instead of showing a blank
workspace. The NEXUS readiness panel reports explicitly reviewed instrument
coverage and critical versus advisory heuristic findings; green/eligible output
**never** implies certified engineering or signed approval.

## Destructive instrument actions

An individual instrument cannot be deleted without browser-native confirmation.
The confirmation reports incoming declared signal references by canonical tag
identity and warns that dangling references will remain unresolved, while
in-memory Undo stops being available on reload. Cancel leaves project data and
undo history unchanged. No automatic cascade deletes other signal definitions.

## Distinct research exercises

The live NEXUS demo offers two independent synthetic engineering exercises:
`flow-control-loop` (FT-101 → FIC-101 → FCV-101) and `tank-level`
(LT-201 → LIC-201 → LV-201). The remaining instruments have no invented
signal edges. Both use source-controlled reference drawings, explicit labels,
and newly allocated local project IDs. Neither is a measured Gemini outcome;
each must start with zero locally reviewed tags. The browser E2E checks the
full second scenario as well as the original one.

## Research exercise acceptance

Two independently selected public scenarios (flow-control and tank-level) must open without AI requests, remain unreviewed, retain correct declared directed signal links and preserve local project history. The source-controlled benchmark has ten synthetic cases, eight sharing a common procedural drawing grammar. The new `eval:inspect` inventory is explicitly unscored; do not infer model performance or plant certification from successful software tests. See `docs/RESEARCH_EVIDENCE.md`.

## Offline cause/effect education (synthetic only)

Open a sample project, choose **Training Lab**, then use the keyboard-accessible
observation slider. Two independent synthetic examples are available: a buffer
tank high-level lesson (LT-201) and a reactor feed low-flow lesson (FT-101).
The exercise uses arbitrary training thresholds, **not** P&ID-derived plant
logic, PLC code, a vendor function block or certified protective actions.

Acceptance: a trip threshold sets a local latch; acknowledging an alarm does
not release it. The latch can be reset only after moving into a separate clear
range with a healthy observation. An injected sensor fault is **UNKNOWN**, not
NORMAL, and prohibits reset. Changing scenario or restarting resets only the
local educational simulation. The last 20 events remain visible, without
browser storage, network requests, API tokens or any control connection.

Both desktop and public static demo builds must run this exercise entirely
offline. The Chromium smoke checks level trip, acknowledgement, clearing,
sensor fault and selection of the flow scenario. Educational effects are text
only and must never be sent to a PLC/DCS or interpreted as an interlock design.

## Local source-hashed research report explorer

The **Research Evidence** tab accepts a locally selected v1/v2 benchmark JSON
up to 8 MiB. The viewer runs the exact `validateBenchmarkReport` integrity
checks used by the offline diagnostics CLI and refuses forged score summaries,
missing sample hashes, unsupported schemas and invalid counts. Failed imports
clear the previously loaded record rather than leaving stale accepted evidence.
No report data leaves the browser or persists in storage.

Micro F1, per-drawing macro F1 with contributing-drawing coverage, a weakest
tag drawing, optional v2 directed-edge macro F1, and each drawing/label SHA-256
are explicitly displayed. An unavailable denominator appears as N/A. This
is a read-only numerical exploration of **user-provided evidence**, not a
model evaluation initiated by the UI or independent confirmation of provider
provenance, ground-truth label quality, plant applicability or certification.

Chromium smoke must check the valid synthetic **test-only** JSON and reject an
altered summary in both developer and public static builds without /api calls.

## Repeatable image-based OCR tag baseline

The optional `npm run eval:ocr` command runs a real installed Tesseract
engine on already prevalidated PNG image bytes, not extracted SVG/label text.
It records an engine-version-tagged, SHA-bound historical **tag-only** report
with real observed detections. It makes no AI calls. The separate GitHub
Actions OCR workflow must pass and publish a diagnostics artifact before its
measured tag scores are cited; a passing parser unit test alone is not OCR
quality evidence. Mixed v1 OCR and v2 Gemini reports may be paired only via
`npm run eval:compare-tags -- <baseline> <candidate>` on exact source hashes,
and only their tag detection precision/recall/F1 may be interpreted.

## Seeded local P&ID scan perturbations

The **Scan Stress** tab applies deterministic monochrome speckle and two
seeded rectangular occlusions only to a locally embedded PNG/JPEG/WebP
project image. The RGBA operation is pure, size-limited and never changes the
stored source project. Each preview displays **rendered pixel SHA-256 hashes**
(before/after) distinct from original PNG **file** hashes. Changing the seed
changes the transformed RGBA digest; restoring the seed, strength and mode
restores identical pixels and hash in the same rendering environment. The
standalone downloadable PNG contains degraded *synthetic visual output* only.

Acceptance: browser smoke verifies reproducibility, the changed-seed hash,
local PNG download, no model/OT requests and responsive tabs. This screen
contains no evaluated OCR/model predictions, training data injection,
certification, hard-negative benchmark or measured robustness improvement.
