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

Rendered-site inspection is not the same as an editable-template buyer test. It can prove what the published site does in a browser, but it cannot prove that a Framer buyer can easily swap branding, CMS entries, components, or sections. Buyer tests remain a future editor/template-structure workflow.

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

## References

Public Framer ecosystem references such as Framer Marketplace, Framer Blocks-like patterns, Damas, and Rivero may inform analysis. The project stores derived criteria and benchmark notes only. It must not copy, bundle, or redistribute proprietary template code, assets, or content.
