# Security Policy

Vision2DCS is an experimental P&ID-to-HMI engineering assistant. It is **not** a production-certified DCS/PLC integration, control application, or safety instrument.

## Private vulnerability reporting

Send a private report to **senanur.cetin.work@gmail.com** with subject `[Vision2DCS security]`. Include the affected branch or commit, expected impact, and steps to reproduce with harmless synthetic inputs. Never put tokens, proprietary plant diagrams, credentials or exploitable information in public issues.

There is no guaranteed security response SLA or supported release schedule for this demonstration.

## Data handling boundaries

- A P&ID may expose sensitive process topology, equipment information or plant operations. Use only diagrams you own or have permission to process.
- Analyze requests are sent to an external AI provider (Google Gemini). Do not upload proprietary or confidential plant documents without the required contractual, organizational and privacy approvals.
- The `GEMINI_API_KEY` must remain server-side. Never put it in client code, `VITE_*` environment variables, screenshots, issue payloads or version control.
- Model-generated tags, loop links, bill of materials and HMI layouts may be incomplete or incorrect. Independently validate them against approved engineering drawings and vendor specifications before any operational use.
- The public demo/server has no end-user authentication and a process-local rate limiter; do not expose it to untrusted production networks without independent hardening.

## Security development checklist

- Validate and bound file uploads and third-party/model outputs.
- Preserve the browser/server boundary: no imports of `server/` from client code.
- Do not log API keys or full uploaded diagram contents.
- Avoid unsafe dynamic evaluation and keep third-party dependencies patched.
- Test changes with synthetic P&IDs, not real customer drawings.

See [CONTRIBUTING.md](CONTRIBUTING.md) for test commands and key-boundary checks.
