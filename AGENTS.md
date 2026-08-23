# Template Foundry Agent Notes

Template Foundry is a local-first Digital Product Factory V0. Its first vertical is Framer template quality evaluation.

Source of truth:

- `README.md` for usage.
- `docs/PRODUCT.md` for product scope and quality model.
- `docs/ARCHITECTURE.md` for module boundaries.
- `docs/ENGINEERING.md` for conventions.
- `standards/golden-framer-v1.yml` for configurable scoring and gates.

Keep the V0 focused: CLI, Golden Standard, benchmark metadata, candidate input, deterministic audit engine, reports, fixtures, and tests. Do not build a SaaS, marketplace, scraper, visual editor, payment system, or full Framer automation.

Run before finishing changes:

```bash
pnpm type-check
pnpm test
pnpm lint
```
