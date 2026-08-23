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

Browser automation is infrastructure. The audit domain remains browser-provider agnostic:

```text
PlaywrightInspector -> InspectionArtifact (v1, one page)
                    -> SiteInspectionArtifact (v2, bounded multi-page)
                    -> inspectionToCandidate -> auditCandidate
```

`inspection.json` (v1) and `site.json` (v2) can both be audited repeatedly against different standards without relaunching a browser. Version 2 is a superset: per-page artifacts live under `pages/<slug>.json`, findings carry their origin `page`, and `site.json` aggregates checks.

## Multi-Page Discovery

`inspect` discovers routes from the root page's same-origin links only (depth 1 — no recursion, no crawler). `selectRoutes` dedupes discovered paths, ranks commercially important routes first (`/pricing`, `/about`, `/contact`, `/blog`, `/services`, `/work`, `/portfolio`), and caps the run by an explicit budget: `maxPages` (5), `maxDepth` (1), `maxLinksPerPage` (20), `timeoutMsPerPage` (15s). All are CLI-configurable.

## Score Aggregation

Per-criterion site score = `0.7 * mean(pages) + 0.3 * worst(page)`. A single broken page (a broken pricing page, an overflowing about page) cannot hide behind a polished homepage, while one weak outlier does not dominate the whole product. Page completeness rewards real route coverage and penalizes pages that failed to load.

## Extension Points

Future evaluators should produce the same candidate evaluation shape:

- Playwright/browser checks for overflow, links, console errors, and screenshots;
- visual analysis for typography, composition, and similarity;
- LLM review for polish, originality, copywriting, and buyer experience.

Those adapters should stay outside the domain. The audit engine remains deterministic for a given candidate and standard.

## ADR: Browser Runtime

Decision: use Playwright as the Template Foundry runtime browser for V1.

Evidence from a local fixture benchmark:

- Playwright opened the page, captured title/links/status/viewport, listened to console and page errors, took screenshots, changed viewport, and exposed low-level request/response events in about 1.25s.
- BetterWright was discovered after the initial MCPIMP/tool search miss. It is valuable for agents: persistent managed browser, policy guard, compressed snapshots, proof artifacts, and sandboxed snippets. The same fixture task worked after `betterwright setup`, in about 2.65s, but its sandbox did not expose the full Playwright `page.on` event API used by deterministic scanners.
- BetterWright also requires a separate BetterChromium setup and stores proof artifacts in its own home directory by default.

Conclusion: Playwright is the product runtime because it is direct, deterministic, portable in CI, and gives full programmatic control. BetterWright is a strong agent QA/development tool, but not a production dependency for Template Foundry V1.
