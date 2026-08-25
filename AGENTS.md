# Template Foundry Agent Notes

Template Foundry is a local-first Digital Product Factory V0. Its first vertical is Framer template quality evaluation.

Source of truth:

- `README.md` for usage.
- `docs/PRODUCT.md` for product scope and quality model.
- `docs/ARCHITECTURE.md` for module boundaries.
- `docs/ENGINEERING.md` for conventions.
- `standards/golden-framer-v1.yml` for configurable scoring and gates.

Keep the V0 focused: CLI, Golden Standard, benchmark metadata, candidate input, deterministic audit engine, reports, fixtures, and tests. Do not build a SaaS, marketplace, scraper, visual editor, payment system, or full Framer automation.

Browser automation is infrastructure. The audit domain must remain browser-provider agnostic.

Every generated template candidate must include at least a restrained, original navigation motion system with a `prefers-reduced-motion` fallback. Treat `minimal` as the current required profile; do not invent `medium` or `high` scoring thresholds until they are calibrated on real candidates.

Run before finishing changes:

```bash
pnpm type-check
pnpm test
pnpm lint
```
