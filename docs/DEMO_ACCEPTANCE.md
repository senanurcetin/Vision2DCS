# NEXUS Vision2DCS — Offline Demo Acceptance

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
declared links. Gray dashed edges are ONLY visualization heuristics, never
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
