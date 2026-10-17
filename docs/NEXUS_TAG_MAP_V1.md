# NEXUS Industrial Tag Map v1 — offline, read-only contract

This document specifies the **first shared industrial data contract** for the NEXUS suite. Vision2DCS may export it when **every instrument has explicit local review** and the existing tag/classification audit has no blocking errors. It is only a conceptual, manually downloaded JSON file. Neither OT-Sentinel nor Ops-Copilot ingests this file automatically yet.

## JSON shape

```json
{
  "schema": "nexus.industrial.tag-map.v1",
  "version": 1,
  "mode": "read-only",
  "evidence": "local-human-reviewed-concept",
  "generatedAt": "2026-10-17T10:00:00.000Z",
  "source": {
    "product": "Vision2DCS",
    "projectId": "local-project-id",
    "projectTitle": "Demonstration P&ID"
  },
  "tags": [
    {
      "tag": "PT-101",
      "description": "Pressure transmitter",
      "signalType": "AI",
      "pcs7BlockType": "MonAnL",
      "engineeringUnits": "bar"
    }
  ]
}
```

## Reader requirements

- Treat every imported file as **untrusted**, even if it claims local review. Validate the schema identifier, version, input size, tag syntax/uniqueness, types and origin before use.
- Do not turn an exported tag, or a future link to an alarm/procedure, into an actuator command, PLC/DCS write, setpoint change or automatic maintenance instruction.
- Never infer a sensor reading, plant asset ID, alarm severity or machine-learning similarity from a conceptual tag. These fields are deliberately absent.
- No drawing image, API key, endpoint URL, private connection string, supplier name, estimate or model confidence is included; only the selected project title and reviewed engineering concept fields are exported.
- The local review toggle is not signed, enterprise-authenticated or sufficient to assert a certified engineering acceptance.
- Read-only sharing between these three apps is **future integration**, not yet delivered by exporting a JSON file.

Validation fixtures and deterministic ordering tests live in `services/nexusTagMap.test.ts`. Actual vendor PCS 7/ABB import formats remain out of scope and require issue #2.
