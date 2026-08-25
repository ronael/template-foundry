# Motion Profiles

Motion is part of template art direction, not decoration added at the end. Every
candidate declares one profile and must pass the universal safeguards below.
Profile compliance is currently a documented review outcome, not a new Golden
Standard weight.

## Universal safeguards

- Every motion has a named purpose: orientation, hierarchy, feedback, state, or storytelling.
- Navigation always has one recognizable motion signature.
- Keyboard, touch, and pointer interactions expose equivalent states.
- `prefers-reduced-motion: reduce` removes movement without hiding content or breaking controls.
- Motion must not introduce layout shift, block navigation, delay primary actions, or change measured evidence.
- Continuous or automatic motion pauses during direct interaction when appropriate.
- Prefer compositor-friendly transforms; justify expensive filters, masks, video, or scroll effects.

## Minimal

For restrained utility, documentation, editorial, and conversion templates.

- Required: one navigation signature, mobile-menu transition, and hover/focus/press feedback.
- Optional: one page entrance or one small state animation.
- Motion families: 2–4.
- Typical duration: 120–400ms.
- Continuously moving regions visible at once: 0.
- Commercial bar: the site feels intentionally alive, never static or generic.

## Medium

Default target for premium product and SaaS templates. Inherits `minimal`.

- Required: coordinated section entrances, staggered repeated content, and at least one product/data-story motion.
- May include one automatic product demonstration when it pauses on interaction.
- Motion families: 4–7.
- Typical duration: 160–700ms; automatic state cadence at least 2s.
- Continuously moving regions visible at once: at most 2.
- Commercial bar: motion reinforces the narrative and creates a memorable browsing rhythm without competing with reading.

## High

Reserved for art-directed launches and expressive portfolio/editorial concepts.
Inherits `medium`; it does not mean animating every element.

- Required: a coordinated page-transition or scroll-story system and one bespoke motion asset or interaction.
- Motion families: 6–10, governed by one timing/easing system.
- Typical duration: 180–1000ms; longer sequences require user control or clear narrative value.
- Continuously moving regions visible at once: at most 3.
- Requires an explicit performance review, mobile simplification strategy, and focused motion QA.
- Commercial bar: motion is a defensible part of the template identity, not a collection of effects.

## Review

Review profile compliance separately from visual taste:

1. Navigation originality and orientation.
2. Purpose and relationship to product storytelling.
3. Timing, easing, orchestration, and restraint.
4. Pointer, keyboard, touch, and responsive behavior.
5. Reduced-motion equivalence.
6. Runtime stability, layout stability, and performance cost.

Numeric score thresholds remain intentionally unset until `minimal`, `medium`,
and `high` have each been observed on multiple real candidates.
