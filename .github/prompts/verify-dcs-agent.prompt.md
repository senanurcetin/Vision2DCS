---
description: Read-only acceptance test for DCS Verification custom agent
---

# DCS Verification — manual acceptance

Select the DCS Verification custom agent manually in a supported GitHub Copilot IDE. If it is absent, report NOT RUN.

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