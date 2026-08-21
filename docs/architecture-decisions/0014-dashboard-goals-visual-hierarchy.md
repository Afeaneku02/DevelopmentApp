# ADR 0014: Dashboard/Goals visual hierarchy pass

**Status:** Accepted

## Context

Dashboard and Goals had grown incrementally across several milestones (ADR 0011's next-action/stats, ADR 0012's check-in history panel, ADR 0013's progress section) - each addition was styled to be internally consistent with the existing Sky/Midnight tokens, but no one had stepped back to compose either screen as a whole. Both had become plain vertical stacks of `<section>` blocks with uniform spacing and no visual differentiation between "the one thing to act on" and supporting detail - directly requested as a "visual/UX polish pass" once the Goals→Check-ins→Progress chain was functionally complete.

## Decision

- **Uniform, quiet section-heading treatment.** `<h2>` previously had no dedicated rule at all and fell back to the browser default (bold, ~1.5em), which competed visually with `<h1>` on every screen. A new global `section h2` rule (small, uppercase, `--color-text-secondary`) demotes every section label to the same quiet weight - this alone is most of what creates real hierarchy, since it frees up one element per screen to be the visually loud one instead of everything competing equally.
- **`.next-action` becomes the one elevated element on Dashboard**: a two-tone gradient background (`--color-horizon-start → --color-sky-100`, the same stops `.horizon-band` uses, but as a flat gradient fill rather than the literal banded motif reserved for Auth/Onboarding by ADR 0008), a small "NEXT" label, and `--shadow-card` for lift. Nothing else on Dashboard competes with it now.
- **Dashboard's stats and progress sections merged into one "Overview"** (`.dashboard-overview` / `.overview-tiles`), rather than two separately-headed sections stacked in the order they happened to be built - both are "at a glance" numeric reads, and having only one heading for both reduces the read from four visual segments (next-action, stats, progress, goals) to three (next-action, overview, goals).
- **A shared `ConsistencyMeter` component** (`apps/web/src/components/ConsistencyMeter.tsx`), replacing markup that had been duplicated ad hoc between `DashboardScreen` and `GoalsScreen`. It renders the consistency percentage, the trend badge, and a new thin gradient-filled bar (`--color-sky-300 → --color-sky-600`) - the one new visual idea this pass introduces, used identically everywhere Progress appears so it reads as "this is what progress looks like in Better You" rather than a one-off widget.
- **The Goals history panel restructured into three visual tiers**: the `ConsistencyMeter` at the top, then per-response counts as small colored count badges (reusing the same success/warning/error tokens `.response-badge` already established) instead of one run-on sentence of numbers, then the entry timeline below - each tier now reads as a distinct step (how am I doing → the breakdown → the specifics) instead of three plain paragraphs in a row.

## Consequences

- No functional or data-model changes; this is a presentation-only pass. All API contracts, routes, and domain logic from ADR 0011-0013 are untouched.
- The `section h2` rule is global, so it applies to every screen that uses `<section><h2>` (Dashboard, Goals, and by extension Profile/Onboarding), not just the two screens this pass targeted - intentional, since theme consistency (per the visual-designer skill's own rule 6) means a heading shouldn't look different by accident depending on which screen it's on.
- `ConsistencyMeter` is the only new shared component; no new dependency was added, and it composes entirely from existing tokens plus one new gradient (`--color-sky-300 → --color-sky-600`), so both Sky and Midnight mode render correctly without any new dark-mode-specific CSS - the existing token overrides carry through automatically.
- Verified live against the real API in both Sky and Midnight mode: seeded a user, a goal, and four check-ins (no, no, yes, yes, matching ADR 0013's own trend-verification data) through the real API and real onboarding fast-forward, then confirmed Dashboard's Overview strip and the Goals history panel both render the new hierarchy correctly - 0 console errors in either theme.
