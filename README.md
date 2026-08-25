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
pnpm dev -- audit .template-foundry/inspections/<site-id>/site.json --standard standards/golden-framer-v1.yml --visual-evaluation ./visual-evaluation.yml
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

Performance evidence is measurement-first: each page artifact stores request
count, transferred bytes, resource breakdown, image/font/JavaScript details,
DOM size, and desktop/mobile LCP observations. `site.json` references the same
page evidence for deterministic re-audits. Bytes remain bytes internally; the
CLI only formats them as KiB/MiB for display. Resource weights are measured at
the named primary desktop viewport; mobile receives its own cold-ish LCP load.

## Multi-Page Inspection

A template is a product, not a homepage. `inspect` discovers same-origin routes from the root page (depth 1, no crawling), prioritizes commercially important routes (`/pricing`, `/about`, `/contact`, `/blog`, …), and inspects up to `--max-pages` pages (default 5, `1` keeps the single-page v1 artifact):

```text
inspections/<site-id>/
  site.json                  aggregated artifact (version 2)
  pages/home.json            per-page artifacts (version 1)
  pages/pricing.json
  screenshots/home-desktop.png, pricing-mobile.png, …
```

Every finding carries its origin `page`. Site scores aggregate as `70% mean + 30% worst page`, so a broken pricing page cannot hide behind a polished homepage. Old single-page `inspection.json` artifacts remain auditable.

```bash
pnpm dev -- inspect https://<template>.framer.website --max-pages 5 --max-depth 1 --max-links-per-page 20 --timeout-per-page 15000
pnpm dev -- audit .template-foundry/inspections/<site-id>/site.json --standard standards/golden-framer-v1.yml
```

The site artifact records discovered, inspected, and failed page counts. Audit
reports surface that coverage, the worst page, critical-finding count, and the
origin page for every observed issue. Set `--max-depth 0` for a root-only site
artifact; depth is intentionally capped at 1.

Performance thresholds live under `performance` in the Golden Standard. The
existing `technical.performance` criterion is derived from available evidence;
missing observations remain `not-evaluated`. A compact report includes average
and worst transfer, LCP, and heavy-asset counts.

## Real-Template Workflow

```text
framer template URL -> inspect -> site.json -> audit -> report -> human review -> standard tuning
```

```bash
pnpm dev -- inspect https://<template>.framer.website --out .template-foundry/inspections
pnpm dev -- audit .template-foundry/inspections/<inspection-id>/site.json --standard standards/golden-framer-v1.yml --out .template-foundry/reports
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

## Subjective visual evidence

`audit --visual-evaluation <file>` validates and applies a versioned subjective
review before the deterministic audit. The artifact records screenshots,
reference set, criterion scores, actionable findings, sellability, and explicit
`human` or `llm` provenance. It does not call a model and never relabels visual
judgment as browser evidence. An explicit `not-evaluated` result remains valid
when screenshots or a reviewer are unavailable.

The first production experiment is [Candidate 001](experiments/candidate-001/BRIEF.md),
a three-page React/Vite prototype named Kern. It proves the loop
reference → brief → build → screenshots → subjective review → correction →
technical audit. It is intentionally described as a web prototype, not a
native Framer template. Generated candidates declare a behavioral profile from
the [Motion Standard](docs/MOTION.md); Kern currently demonstrates `medium`.
