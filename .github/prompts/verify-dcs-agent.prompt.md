---
description: Read-only acceptance test for DCS Verification custom agent
---

# DCS Verification — manual acceptance

Agent invocation: use a supported IDE agent selector **or** GitHub Copilot CLI with `--agent=dcs-verification`. CLI agent selection is valid; do not mark this test NOT RUN merely because no IDE selector was used. The wrapper must record the requested agent ID and CLI exit status independently. If the actual loaded profile cannot be independently confirmed, report agent identity UNVERIFIED separately from the source-review checks. Do not infer successful runtime tests from a read-only answer.

Read repository instructions and:
- services/tagParser.ts
- services/normalizeInstruments.ts
- services/exportService.ts
- server/api.ts
- applicable adjacent TypeScript test files

Without editing or executing code:

1. Identify which absent/malformed ISA tags must remain low confidence regardless of plausible AI signals.
2. Distinguish tested conceptual Siemens PCS 7 CSV and ABB XML exports from genuine vendor import certification.
3. Give a code-grounded offline regression scenario for invalid base64 or request size limits.
4. Explain how synthetic CSV/XML escaping tests should avoid real devices and external models.

Report PASS/FAIL/UNVERIFIED and cited source paths. Never claim live PLC/DCS validation, vendor-certified interoperability, or deployment readiness. Do not access hardware, Gemini, CI/Actions/CircleCI/Vercel, production credentials or external services.