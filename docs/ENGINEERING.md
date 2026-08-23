# Engineering

## Stack

- TypeScript with strict mode.
- Node.js ESM.
- `commander` for CLI commands.
- `zod` for runtime validation at file boundaries.
- `yaml` for human-editable standards and fixtures.
- `playwright` for rendered URL inspection.
- `@axe-core/playwright` for basic accessibility checks.
- `vitest` for tests.
- `biome` for linting and formatting.

## Rules

- Keep scoring weights and thresholds in the standard file.
- Add runtime schemas for new external input.
- Do not hard-code marketplace or reference template content.
- Distinguish automated, manual, and not-evaluated checks.
- Keep browser automation in infrastructure; never import Playwright from domain code.
- Use deterministic tests for domain behavior.

## Test Layers

- Unit: scoring, thresholds, gates, verdicts, validation.
- Integration: YAML/JSON loading and schema validation.
- E2E: real CLI process against temporary workspaces and fixtures.
- Browser E2E: local fixture server, `tfoundry inspect`, screenshots, then `tfoundry audit inspection.json`.
