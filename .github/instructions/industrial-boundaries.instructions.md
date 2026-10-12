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

## No-CI validation
- Use npm test -- <affected.test.ts> for a focused check, npm run typecheck, npm test, and npm run build when relevant and available locally.
- Do not run npm run eval or invoke external model APIs for routine unit tests.
- Do not manually launch GitHub Actions or CircleCI. Check provider triggers before creating a pull request; a [skip ci] commit may not suppress all trigger types.
- Record exact checks run and checks not run. Do not describe a source-only review as a passing build.
- Keep commits small and reviewable. Do not bypass required status checks or merge unvalidated changes.
