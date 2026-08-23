# Architecture

## Boundaries

`src/domain` contains the business model:

- `QualityStandard`;
- `Candidate`;
- `BenchmarkReference`;
- `AuditResult`;
- score calculation;
- gate evaluation;
- verdict selection;
- validation rules.

The domain does not depend on the filesystem, CLI framework, browser automation, or LLM APIs.

`src/application` orchestrates use cases such as workspace initialization and report rendering.

`src/infrastructure` handles YAML/JSON file IO.

`src/cli` maps command-line inputs to application use cases and prints useful errors.

## Extension Points

Future evaluators should produce the same candidate evaluation shape:

- Playwright/browser checks for overflow, links, console errors, and screenshots;
- visual analysis for typography, composition, and similarity;
- LLM review for polish, originality, copywriting, and buyer experience.

Those adapters should stay outside the domain. The audit engine remains deterministic for a given candidate and standard.
