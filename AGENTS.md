# Template Foundry Agent Notes

Template Foundry is a local-first Digital Product Factory V0. Its first vertical is Framer template quality evaluation.

Source of truth:

- `README.md` for usage.
- `docs/PRODUCT.md` for product scope and quality model.
- `docs/ARCHITECTURE.md` for module boundaries.
- `docs/ENGINEERING.md` for conventions.
- `docs/CANDIDATE-WORKFLOW.md` for gated candidate creation.
- `docs/prompt-finition-premium-templates.md` for post-approval premiumization.
- `standards/golden-framer-v1.yml` for configurable scoring and gates.

Keep the V0 focused: CLI, Golden Standard, benchmark metadata, candidate input, deterministic audit engine, reports, fixtures, and tests. Do not build a SaaS, marketplace, scraper, visual editor, payment system, or full Framer automation.

Browser automation is infrastructure. The audit domain must remain browser-provider agnostic.

Do not productionize an unapproved visual direction. Candidate creation must follow `docs/CANDIDATE-WORKFLOW.md`: lightweight Vite Vanilla or plain HTML/CSS/JS first, explicit human `DA_APPROVED`, then `PRODUCT_DIRECTION_APPROVED`, then complete tokens, production framework/Framer work, packaging, and full audit. The premium-finish prompt is forbidden during initial exploration.

After `PRODUCT_DIRECTION_APPROVED`, every template candidate must declare and satisfy a motion profile from `docs/MOTION.md`, with `minimal` as the floor, an original navigation signature, and a `prefers-reduced-motion` fallback. Before that gate, validate only one representative motion idea. Do not invent numeric profile scoring thresholds until `minimal`, `medium`, and `high` are calibrated on real candidates.

Screenshots and automated audits do not replace interaction QA. Before a sellable-candidate handoff, exercise every public route and primary navigation item on desktop and mobile. Verify the destination or anchor, visible active state, exactly one appropriate `aria-current` item, keyboard behavior, browser back/forward behavior, and add a regression test for the navigation state model. This exhaustive check does not run during disposable DA exploration.

Run before finishing changes:

```bash
pnpm type-check
pnpm test
pnpm lint
```
