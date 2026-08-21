# ADR 0013: Goals + Check-ins-only Progress domain

**Status:** Accepted

## Context

Dashboard (ADR 0011) formally named Progress as one of its unbuilt Blueprint §10 dependencies. With Check-ins now producing real, structured data (`yes`/`no`/`partly`/`skipped` responses over time, per ADR 0012's history review confirming the underlying domain works), aggregating that into something a user can actually read as "how am I doing" was the next honest increment - the direct request was "Progress domain next, scoped around Goals + Check-ins only... deterministic progress summaries/trends... surfaced lightly in Dashboard/Goals."

No Blueprint text for Progress's exact requirements was consulted for this decision - the repo's `.docx` Blueprint file is binary and wasn't parsed. This ADR documents what was built from the ADR 0011 dependency note and the direct request, not from a specific Blueprint section.

## Decision

- **`services/progress`**: a `ProgressService` with exactly one dependency, `CheckInsView` (`listCheckIns`, `getGoalCheckIns` - the same two methods the real `CheckInService` already exposes, so no new wiring surface is needed beyond passing it in). Two read operations: `getOverallProgress(userId)` across every check-in the user has ever recorded, and `getGoalProgress(userId, goalId)` scoped to one goal (ownership/existence validated for free via `CheckInService.getGoalCheckIns`'s existing `GoalLookup` check - a fake or foreign `goalId` rejects with the same `GoalNotFoundError` → 404 the check-ins domain already produces).
- **Consistency score**: `yes` = 1, `partly` = 0.5, `no` = 0, averaged; `skipped` is excluded from both the numerator and denominator (a skip represents no attempt either way, not a negative result) - `null` when there are no scorable check-ins yet.
- **Trend**: a deterministic earlier-half vs. later-half comparison of scorable check-ins (oldest-first, split at the midpoint), labeled `improving`/`declining`/`steady` past a threshold delta, or `not_enough_data` below a minimum scorable-count. Both the minimum count and the threshold are explicitly labeled placeholder heuristics in `progressMath.ts` - the same documented-placeholder status as Dashboard's 7-day staleness threshold (ADR 0011) - since no defined check-in cadence exists yet to measure a real streak against.
- **Progress reflects a goal's full history regardless of its current status.** A paused, completed, or archived goal's past check-ins remain valid effort history; only new check-in *creation* is active-goal-only (that restriction lives in Check-ins, not Progress).
- **Surfaced lightly, not as a new screen**: Dashboard gets a small "Progress" section (consistency % + trend badge) near the existing stat tiles, shown only once the user has at least one check-in; the Goals screen's existing per-goal history panel (ADR 0012) gets one added line (consistency % + trend badge) above the check-in list, fetched alongside history on every open.
- **`GET /api/v1/progress`** (overall) and **`GET /api/v1/goals/:id/progress`** (per-goal), both behind `requireAuth`, wired the same way as the equivalent Check-ins routes. No new error types or `errorHandler.ts` changes were needed - `GoalNotFoundError` already maps to 404.

## Consequences

- Dashboard's `handleCheckIn` and `GoalsScreen`'s history-open both now also fetch progress data on the same action that would make it stale, rather than caching it separately and risking the exact staleness bug caught in ADR 0012's history-view review - built correctly from the start this time, not fixed after the fact.
- No trend charts, calendar-based streaks, or AI interpretation of the numbers were built - only factual counts and one deterministic label, matching the "not AI, clearly labeled as such" instruction the request repeated from Dashboard's own precedent (ADR 0011).
- When a real check-in cadence is eventually defined (e.g. "daily" or "3x/week" per goal), `computeTrend()`'s placeholder thresholds are the one place to revisit - they're isolated in `progressMath.ts` specifically so that revision doesn't touch `ProgressService`, the routes, or the UI.
- Verified live against the real API in both Sky and Midnight mode: seeded a user through signup, real onboarding fast-forward, a goal, and four check-ins deliberately ordered to produce an `improving` trend (no, no, yes, yes) - confirmed the Dashboard progress section and the Goals history progress line both showed "50% consistent — Improving" correctly, 0 console errors in either theme.
