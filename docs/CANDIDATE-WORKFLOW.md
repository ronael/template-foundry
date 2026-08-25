# Candidate Creation Workflow

Template Foundry validates visual demand before paying the cost of production.
The default sequence is deliberately gated:

```text
brief + premium references
  -> visual directions
  -> human direction selection
  -> lightweight visual prototype
  -> DA_APPROVED (human)
  -> coherent homepage prototype
  -> PRODUCT_DIRECTION_APPROVED (human)
  -> premiumization and sellable production
  -> Template Foundry audit
  -> SELLABLE_CANDIDATE
```

Passing tests is never evidence that a direction deserves to be produced.

## 1. Visual exploration

Start from the niche, buyer, positioning, real reference screenshots, and a
clear visual promise. When no direction has already been selected, present
three genuinely distinct directions. A user may explicitly delegate the
choice of one direction instead.

Do not create routes, a component library, complete tokens, Framer structure,
or marketplace packaging during exploration.

## 2. Lightweight visual prototype

Default implementation: Vite Vanilla with HTML, CSS, JavaScript, and npm.
Plain HTML/CSS/JS is also valid when no package or motion dependency is useful.
React, a production framework, or native Framer require a concrete reason at
this stage.

The prototype should contain only enough surface to judge the direction:

- one homepage slice: hero plus two or three decisive sections;
- realistic fictional content, never lorem ipsum;
- the primary navigation idea and one representative motion behavior;
- a convincing 1440px composition and one intentional 390px composition;
- a handful of working CSS variables for palette, type, spacing, container,
  and motion when needed.

These variables are iteration aids, not a finished commercial token system.
Use semantic HTML, visible focus, legible contrast, and no overflow from the
start because they are cheap constraints and may invalidate a visual idea.

Early validation is intentionally bounded to: a working preview, stable
1440/390 screenshots, the primary navigation and motion idea, console sanity,
and obvious overflow/legibility checks. Do not run a multi-page production
audit, performance calibration, exhaustive component-state inventory, or
packaging review at this stage.

## Gate 1: DA_APPROVED

This is an explicit human decision. The reviewer judges the prototype beside
the selected references and answers:

- Would the marketplace thumbnail earn a click?
- Does the hero feel premium and immediately understandable?
- Is the identity recognizable rather than generically generated?
- Are typography, composition, color, imagery, and motion coherent?
- Does the mobile composition preserve the art direction?
- Is copying/similarity risk acceptable?

Allowed outcomes: `REJECTED`, `REWORK`, `DA_APPROVED`.

Do not continue because a deadline exists, an automated score is high, or the
prototype is technically clean. Record the human decision and evidence.

Each gate record names the status, human reviewer, date, evidence reviewed,
decision rationale, and remaining blockers. An agent may recommend a decision
but may not self-approve a human gate.

```yaml
gate: DA_APPROVED
status: approved
reviewer: human
date: YYYY-MM-DD
evidence: []
rationale: ""
remainingBlockers: []
```

## 3. Product-direction prototype

After `DA_APPROVED`, complete the homepage and add only the pages or states
needed to prove that the visual language extends beyond the hero. Continue to
prefer the lightweight stack. Validate narrative rhythm, repeated components,
responsive behavior, and the motion language without yet optimizing for final
Framer editability or packaging.

## Gate 2: PRODUCT_DIRECTION_APPROVED

The reviewer confirms that the approved identity survives a complete homepage,
representative secondary content, real interaction, and mobile. Allowed
outcomes: `REWORK`, `PRODUCT_DIRECTION_APPROVED`.

## 4. Premiumization and sellable production

Only now apply the full
[Premium Template Finish prompt](prompt-finition-premium-templates.md). This is
where complete tokens, reusable components, all relevant states, multi-page
production, asset optimization, accessibility hardening, performance budgets,
Framer translation, buyer customization, documentation, and packaging belong.
The prompt is a quality-of-execution standard, not a source of art direction.

The chosen production technology must follow the sale target. A Vite prototype
is not called a Framer template until it has actually been rebuilt and verified
in Framer.

## 5. Final verification

Run interaction QA, screenshots, subjective comparison, and the complete
Template Foundry technical audit. The final outcome may become
`SELLABLE_CANDIDATE` only when visual approval and production evidence both
exist.

## Anti-patterns

- Building six polished pages before the hero direction is accepted.
- Treating a complete token inventory as prerequisite to visual exploration.
- Using technical audit scores as a proxy for taste or buyer appeal.
- Rewriting the lightweight prototype into React without a production reason.
- Applying the premium-finish checklist to every discarded visual experiment.
- Continuing to production without an explicit human gate decision.
