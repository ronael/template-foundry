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

## Performance Evidence

Performance follows the same boundary as other observations:

```text
Playwright + CDP -> PagePerformanceEvidence -> Candidate evidence
                 -> Golden Standard thresholds -> existing AuditResult
```

The collector uses CDP `Network.loadingFinished.encodedDataLength` as
`transferBytes`: total bytes Chrome reports receiving for the request. It is
not named `Content-Length`, body size, or decoded size. Resource Timing was not
chosen for transfer accounting because cross-origin entries often expose zero
without `Timing-Allow-Origin`. Lighthouse was not added: its trace, simulated
network, scoring, and dependency graph solve a broader problem than this
bounded product-quality evidence layer.

Each page uses a fresh non-persistent browser context. CDP disables cache,
clears browser cache, and bypasses service workers before navigation. This is a
documented "cold-ish" load, not a laboratory CPU/network benchmark. Network
listeners and CDP sessions are scoped to that page and detached before context
closure.

Transfer totals include the existing inspection's one controlled full-page
scroll, so lazy resources used by the sellable page are observed. LCP is frozen
before that scroll. Resource transfer evidence is collected once at the primary
desktop viewport and names that viewport explicitly; responsive resizing is not
allowed to mix additional downloads into the total. Each resource and page total records whether CDP completed
the byte measurement; incomplete totals are `not-evaluated`, never silently
treated as zero.

LCP uses a buffered `PerformanceObserver` installed before navigation. Desktop
and mobile receive separate cold-ish loads; tablet is explicitly
`not-evaluated` to avoid tripling inspection time. CLS and INP are not collected
because the current automated visit has neither a representative observation
window nor user interaction.

The domain knows only evidence in bytes, milliseconds, counts, and provenance.
It applies standard-owned warning/error thresholds, maps each available metric
to transparent score bands (100 / 75 / 50), then uses the existing 70% mean +
30% worst-page aggregation. Resource-level findings use the existing finding
model. Third-party resources remain visible in actual transfer totals, but
third-party scripts do not receive individual oversized-script findings because
template authors may not control platform bundles.

Performance fields are optional additions to artifact versions 1 and 2, so old
artifacts remain readable without a migration framework.

## Multi-Page Discovery

`inspect` discovers routes from the root page's same-origin links only (depth 1 — no recursion, no crawler). `selectRoutes` dedupes equivalent route variants, ranks commercially important routes first (`/pricing`, `/about`, `/contact`, `/blog`, `/services`, `/work`, `/portfolio`), and caps the run by an explicit budget: `maxPages` (5), `maxDepth` (0 or 1), `maxLinksPerPage` (20), `timeoutMsPerPage` (15s). All are CLI-configurable and the effective values are stored in `site.json`.

## Score Aggregation

Per-criterion site score = `0.7 * mean(pages) + 0.3 * worst(page)`. A single broken page (a broken pricing page, an overflowing about page) cannot hide behind a polished homepage, while one weak outlier does not dominate the whole product. Page completeness rewards real route coverage and penalizes pages that failed to load.

The candidate projection also carries a browser-agnostic inspection summary:
discovered, inspected, and failed page counts plus the worst route. The audit
result copies this summary so terminal, JSON, and Markdown reports can expose
product coverage without teaching the audit engine about Playwright.

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
