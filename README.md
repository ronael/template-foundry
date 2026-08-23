# Template Foundry

Template Foundry is a local CLI for evaluating sellable digital templates. The V0 focuses on Framer templates and validates the quality engine: Golden Standard, structured benchmarks, candidate audit input, weighted scoring, quality gates, verdicts, and reports.

It does not generate Framer projects, scrape marketplaces, publish products, or automate payments. It turns explicit evidence into an actionable `REJECTED`, `NEEDS_WORK`, `READY`, or `PREMIUM` verdict.

## Install

```bash
pnpm install
pnpm build
```

## Commands

```bash
pnpm dev -- init ./demo-workspace
pnpm dev -- standard validate standards/golden-framer-v1.yml
pnpm dev -- benchmark validate fixtures/benchmarks/framer-public-benchmark-notes.yml
pnpm dev -- inspect https://example.framer.website --out .template-foundry/inspections
pnpm dev -- audit fixtures/candidates/acceptable-template.yml --standard standards/golden-framer-v1.yml --out .template-foundry/reports
pnpm dev -- audit .template-foundry/inspections/<inspection-id>/inspection.json --standard standards/golden-framer-v1.yml
pnpm dev -- report .template-foundry/reports/acceptable-saas-template-audit.json
```

After build, the CLI binary is `tfoundry`.

## Example Output

```text
Template: Acceptable SaaS Template
Standard: golden-framer-v1 v1

Overall           84.2
Visual Quality    84.3
Technical Quality 85.3
UX / Responsive   82.8
Ease of Customization 84.4
Originality       83.0
Packaging / Documentation 80.4

Verdict:
NEEDS_WORK
```

## Data Model

The Golden Standard is human-editable YAML in `standards/golden-framer-v1.yml`. It defines:

- axes and criteria;
- weights and minimums;
- verdict thresholds;
- automated, manual, and not-evaluated quality gates.

Candidate files provide structured facts and evaluations. Scores may come from `manual`, `automated`, `llm`, `imported`, or `inferred` sources; the domain engine only cares about validated evidence.

Inspection artifacts are reusable JSON files created from rendered URLs. They store page metadata, console and network evidence, 3 viewport screenshots, objective findings, and provenance. Auditing an inspection does not relaunch the browser.

## Real-Template Workflow

```text
framer template URL -> inspect -> inspection.json -> audit -> report -> human review -> standard tuning
```

```bash
pnpm dev -- inspect https://<template>.framer.website --out .template-foundry/inspections
pnpm dev -- audit .template-foundry/inspections/<inspection-id>/inspection.json --standard standards/golden-framer-v1.yml --out .template-foundry/reports
pnpm dev -- report .template-foundry/reports/<inspection-id>-audit.json
```

What a rendered URL can prove (console/page errors, broken links and images, horizontal overflow, touch targets, axe-core accessibility) is scored from evidence. What it cannot prove (visual quality, originality, buyer editability, documentation) is reported as `n/e` — those criteria are excluded from scoring and gates instead of being padded with placeholder scores. Any `critical` finding rejects the template; any `error` finding caps the verdict at `NEEDS_WORK`.

`fixtures/candidates/framer-like-*.yml` keep deterministic stand-ins of real inspection outcomes so tests never depend on the network.

## Development

```bash
pnpm type-check
pnpm test
pnpm lint
pnpm smoke
pnpm smoke:browser
```

Core behavior lives in `src/domain`. Filesystem, YAML, and CLI concerns stay outside the domain so future Playwright or LLM evaluators can plug in through adapters.
