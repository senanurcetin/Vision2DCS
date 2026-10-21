# Vision2DCS security and disclosure

Vision2DCS is a **synthetic, educational industrial engineering research demo**, not a deployed process controller, certified safety system or vendor-supported PLC/DCS integration. No security SLA or formally supported release channel is offered.

## Report a concern privately

Email **senanur.cetin.work@gmail.com** with the subject `[Vision2DCS security]` and a concise description, affected commit, impact and steps to reproduce with synthetic inputs. Do not publish operator tokens, API keys, proprietary process drawings, confidential data or active exploit payloads in issues.

## What is and is not exposed

- **Static public demo:** The advertised [offline NEXUS demo](https://vision2dcs-nexus-demo.vercel.app/) uses the `VITE_VISION2DCS_PUBLIC_DEMO=true` build flag. It exposes sample P&IDs and local browser features **without working paid AI routes**. Its presence does not imply hosted Gemini inference.
- **Optional local/Node API:** Gemini requests are server-side and **disabled by default**. Explicit `VISION2DCS_ENABLE_AI=true`, `GEMINI_API_KEY`, a separately generated 32+ character `VISION2DCS_AI_ACCESS_TOKEN`, and a positive per-process `VISION2DCS_AI_MAX_REQUESTS` are required. The shared token is transmitted as a bearer token and is held only in the browser tab's volatile memory.
- **Limits, not guarantees:** The server enforces request/image bounds, raster signature checks, early authorization, in-memory per-client rate limits and reserved provider-invocation budgets. **A shared operator secret is not user identity management; an in-process budget is not a provider monetary cap.** Provider-side quotas, secure TLS termination, audited identity-aware ingress and multi-instance coordination are external requirements before any public paid API use.
- **Client-side state:** Edited projects and drawing images can be stored in local browser storage. Do not assume encryption, guaranteed persistence, multi-user isolation or enterprise auditability. Research report imports and simulated alarm event traces are not uploaded by the demo UI.
- **Model/output trust:** Extracted tags, conceptual links, costs, warnings and digital twin imagery can be incorrect. Export eligibility only means local validation and review checks passed; it never certifies ISA/IEC compliance or a vendor import.

## Disclosure and engineering privacy

Use only owned or explicitly permissioned diagrams. A real plant P&ID may reveal process topology or confidential operating details. Obtain organizational, contractual, privacy and safety approvals before using any external AI provider; neither the GitHub synthetic fixtures nor the browser demo grant permission to upload plant drawings.

The source and offline samples never give permission to send live PLC/DCS commands, read plant telemetry or make unattended actuator/setpoint changes. Vendor-style Siemens PCS 7 CSV and ABB 800xA XML must **not** be treated as import-ready engineering files.

## Maintainer security checklist

- Verify MIME, size, PNG/JPEG/WebP signatures, canonical base64 and untrusted JSON before any potentially paid model call.
- Never check secrets into Git, client bundles, `VITE_*` variables, logs, screenshots or test artifacts.
- Reject duplicate instrument identities and unresolved directed signal references before reviewed concept export.
- Do not treat mock-provider Vitest results, OAuth-free shared secrets, OCR scores on synthetic samples or browser smoke as an operational security certification.
- Keep dependencies current, run locked CI and audit production dependencies before reviewing a PR.

For details see [Technical Guide](TECHNICAL_GUIDE.md), [Contributing](CONTRIBUTING.md) and [Evidence Matrix](docs/DEMO_EVIDENCE_MATRIX.md).
