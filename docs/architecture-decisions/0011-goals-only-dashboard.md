# ADR 0011: Goals-only Dashboard, replaces Goals as the post-onboarding home

**Status:** Accepted

## Context

After First-Run Onboarding (ADR 0010), a user landed directly on the Goals screen - no summary, no guidance, just a list. The user asked for "the dashboard mentor home... instead of just dropping into the goals list," directly invoking CLAUDE.md's product framing (mentor, not generic list). Blueprint §10's "Dashboard" domain covers this, but formally depends on Goals, Roadmap, Check-ins, and Progress - only Goals exists, the same gap pattern as Onboarding's dependency on the AI Roadmap Engine (ADR 0010).

## Decision

- **Goals-only Dashboard.** `DashboardService.getDashboard()` assembles `activeGoals`, `pausedGoals`, `completedGoalsCount`, and a `nextAction`, entirely from real `Goal` data via a `GoalsView` interface (satisfied by the real `GoalService` - same dependency-inversion pattern as `GoalLookup` in `services/onboarding`).
- **`nextAction` is a deterministic, documented heuristic, not AI.** Priority order: resume the oldest paused goal → flag a stale active goal (>7 days untouched, an explicitly-labeled placeholder threshold, not a Vision-specified number) → suggest adding a goal if there's room → otherwise, an affirming "keep going" message. This ordering follows Vision §1/§20's "consistency over adding more" philosophy: address what's stalled before suggesting a new commitment. `NextAction`'s own doc comment in `packages/contracts` explicitly distinguishes it from Blueprint §10's separately-described AI "coach summary," which is not built.
- **Deliberately not built**: a check-in call-to-action (no Check-ins domain), "continue roadmap" (no Roadmap), `buildCoachSummaryInput()`/an AI summary (no AI integration - same reasoning as every other AI-dependent piece deferred so far, including Profile's `buildSafeProfileContext()`). No dead-end UI elements were added for any of these.
- **`completedGoalsCount` counts current status only**, not "ever completed" - a goal completed and later archived no longer counts. Proper historical tracking belongs to the future Progress domain; Dashboard doesn't invent it ad hoc by scanning goal history itself.
- **Dashboard becomes the new post-onboarding home**, replacing Goals as the default landing view. The Goals screen becomes "All Goals," reached via a new nav button; Profile's back-link now returns to Dashboard, not Goals.
- **One real, functional inline action**: when `nextAction.type === 'resume_goal'`, a "Resume goal" button on the dashboard itself calls the real resume endpoint and refreshes - not just a link elsewhere. `add_goal`/`review_goal` navigate to "All Goals" rather than duplicating the goal-creation form on the dashboard, keeping the screen focused.

## Consequences

- `services/dashboard` has no error types of its own - it's read-only, and `GoalsView.listGoals()` doesn't throw for a valid authenticated user (an empty list is a legitimate, intentional state per Blueprint §10's own "empty states are intentional" rule).
- When Roadmap/Check-ins/Progress eventually exist, `DashboardView` and `computeNextAction` extend to incorporate them - `nextAction`'s heuristic-only nature today is a known, documented, temporary limitation, not a hidden one.
- Verified live in both Sky and Midnight mode: the full state progression (no goals → 1 active → paused → resumed via the dashboard's own inline button) correctly drove the next-action message through every branch of the heuristic, with 0 console errors throughout.
