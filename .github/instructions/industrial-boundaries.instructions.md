---
applyTo: "services/**/*.ts,server/**/*.ts,eval/**/*.ts"
---

# Vision2DCS: scoped Copilot testing guidance

These rules complement .github/copilot-instructions.md.

## Safe engineering changes
- Read adjacent unit tests and TECHNICAL_GUIDE.md before changing behavior.
- Preserve the existing tag-parser, canonical identity and topology contracts. Add regression tests for edge cases rather than changing behavior based on assumptions.
- Keep unrecognized signal types and mapping values visible as Unknown with low confidence. Do not replace missing model evidence with inferred confidence.
- Export changes require CSV escaping, Unicode and XML-format regression tests. Describe vendor outputs as conceptual prototypes only.
- Keep API credentials in the server layer and use synthetic fixture data.

## Offline development and hosted CI
- Use Node 24.15+ (pinned 24.22.0). Run `npm test -- <affected.test.ts>` for focused tests, `npm run typecheck`, `npm test`, `npm run docs:check` and `npm run build` as applicable.
- Do not run npm run eval or invoke external model APIs for routine unit tests.
- Prefer normal PR-triggered GitHub Actions and CircleCI checks; do not bypass exact-head CI or use `[skip ci]` for acceptance. An agent may not claim CI passed without checking actual workflow outcomes.
- Record exact checks run and checks not run. Do not describe a source-only review as a passing build.
- Keep commits small and reviewable. Do not bypass required status checks or merge unvalidated changes.
