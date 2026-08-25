# Product

## Problem

AI can produce a visually pleasant page, but it does not automatically know whether the result is technically clean, responsive, editable, original, complete, and sellable as a premium Framer template.

Template Foundry replaces intuition-only review with:

```text
benchmarks -> golden standard -> candidate -> audit -> scoring -> gates -> verdict
```

## V0 Scope

The V0 is a local CLI that can:

- initialize an evaluation workspace;
- validate a Golden Standard;
- validate structured benchmark references;
- audit structured Framer template candidates;
- produce terminal, JSON, and Markdown reports;
- prove the flow through fixtures and E2E tests.

The V0 does not automate Framer, scrape marketplaces, generate products, publish templates, or process payments.

## V1 Rendered Inspection

V1 adds deterministic inspection of a rendered URL:

```text
URL -> browser inspection -> inspection.json -> Candidate projection -> existing audit engine
```

The browser inspection captures page load metadata, desktop/tablet/mobile screenshots, horizontal overflow, console and page errors, relevant network failures, broken internal links, broken anchors, broken images, small mobile touch targets, and basic accessibility findings through axe-core.

The performance evidence layer additionally captures cold-ish transferred
bytes, request and resource-type counts, heavy images and scripts, loaded font
resources/faces, DOM size/depth, and sampled desktop/mobile LCP. These are
observations before they are evaluations: configurable Golden Standard
thresholds produce findings and the existing `technical.performance` score.

Rendered-site inspection is not the same as an editable-template buyer test. It can prove what the published site does in a browser, but it cannot prove that a Framer buyer can easily swap branding, CMS entries, components, or sections. Buyer tests remain a future editor/template-structure workflow.

## Objective vs Subjective Evaluation

The audit engine separates what is measured from what is judged:

- criteria a rendered URL can prove (technical performance, accessibility, responsive behavior, navigation links) are scored from inspection evidence;
- criteria it cannot prove (visual quality, originality, buyer editability, documentation, demo content) are declared with source `not-evaluated` and are excluded from weighted scores, minimum checks, and gates instead of being padded with placeholder numbers.

An axis with no evaluated criteria shows as `n/e` in reports; gates targeting it report `NOT_EVALUATED`. A versioned visual-evaluation artifact can now import an explicit vision/LLM or human review. It must cite screenshots and a reference set, produce actionable existing findings, and keep its separate sellability verdict distinct from the technical `READY/PREMIUM` verdict.

Verdicts are honest about defects: any `critical` finding rejects the template, and any `error` finding caps the verdict at `NEEDS_WORK` — a template with known console errors or serious accessibility violations is not sellable, whatever the average says. Findings carry a `confidence` value (0–1) per check type, since automated detection certainty varies (hard overflow ≈ 0.98, touch-target heuristics ≈ 0.7).

## Real-Template Calibration (2026-08-23)

Four public Framer template preview URLs were inspected and audited (URLs only; no proprietary content stored):

- `benbox.framer.website` (free portfolio): 1 serious axe violation (prohibited ARIA attributes), heading-order issues.
- `portfr.framer.website` (free portfolio): color-contrast violations, small touch targets.
- `unvoid.framer.website` (paid SaaS landing): small touch targets, 1 serious axe violation. Earlier runs falsely counted Framer platform `edit.framer.com` CORS errors; these are now filtered as platform noise.
- `enigma-ai.framer.website` (paid SaaS): unhandled React hydration exceptions (error #418), color-contrast and link-name violations → `REJECTED`.

Calibration outcomes fixed in the engine and standard:

- placeholder scores no longer fake coverage: unmeasurable criteria are `not-evaluated`;
- the buyer-test gate no longer auto-fails rendered-URL audits;
- `linksChecked` reports links actually examined;
- Framer platform requests/console noise is excluded from template findings.

Known limits: route discovery is deliberately root-only and capped rather than recursive; performance measurements are local lab-style evidence without network/CPU throttling; CLS, INP, decoded body size, and unused JavaScript are not evaluated; landmark-related axe warnings are common to most Framer sites and currently informational.

## Performance Calibration (2026-08-24)

Seven pages across BenBox, Portfr, Unvoid, and Enigma were measured outside CI.
Transfers ranged from about 354 KiB to 1.89 MiB, JavaScript from 265 KiB to
771 KiB, fonts from 41 KiB to 112 KiB, and DOM size from 181 to 1,096 nodes.
Enigma was the clear image-weight outlier at roughly 1.04 MiB per page. Local
unthrottled mobile LCP ranged from 104–316 ms, confirming that this signal is a
comparative lab observation rather than field performance. The initial
thresholds were kept above these normal distributions and target clear
outliers; no global axis weights changed.

## Golden Standard

The standard is a versioned YAML file. It separates quality into:

- visual quality: 30%;
- technical quality: 25%;
- UX / responsive: 15%;
- ease of customization: 15%;
- originality: 10%;
- packaging / documentation: 5%.

Thresholds:

- below 75: `REJECTED`;
- 75 to 84.9: `NEEDS_WORK`;
- 85 to 92.9: `READY`;
- 93 and above: `PREMIUM`.

Quality gates can block an otherwise good weighted average. V0 supports automated, manual, and not-evaluated gates and does not pretend to test manual criteria.

## Candidate 001 production experiment

Candidate 001, Kern, is the first end-to-end production experiment: a premium
AI/SaaS web prototype with Home, Product, and Pricing routes. Its direction is a
technical editorial field manual rather than the common gradient/glass AI
landing-page treatment. Four current public references set the quality bar;
their URLs and derived observations are stored, not their proprietary assets.

The first review returned `NEEDS_POLISH`. After one correction loop, the
subjective sellability verdict became `SELLABLE`; the independent Golden
Standard audit returned `READY`. This does not prove native Framer editability,
publication readiness, or buyer customization, so those remain explicit manual
boundaries.

Candidate production now requires a minimal motion profile: at least one
original, purposeful navigation behavior plus a reduced-motion fallback.
The three behavioral profiles are defined in `docs/MOTION.md`; Candidate 001 now
targets `medium`. They remain compliance labels rather than scored claims until
each profile is calibrated on multiple real candidates. Motion stays a
subjective visual criterion; browser checks only verify technical behavior and
accessibility.

## References

Public Framer ecosystem references such as Framer Marketplace, Framer Blocks-like patterns, Damas, and Rivero may inform analysis. The project stores derived criteria and benchmark notes only. It must not copy, bundle, or redistribute proprietary template code, assets, or content.
