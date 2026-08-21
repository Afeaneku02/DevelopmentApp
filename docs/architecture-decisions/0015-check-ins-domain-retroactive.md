# ADR 0015: Check-ins domain (retroactive)

**Status:** Accepted

## Context

`services/check-ins` was designed and merged via GitHub PR #4 ("Add quick response check-ins", commit `d8787f7`) without an ADR of its own - discovered mid-session while independently scoping the same domain, and reviewed file-by-file against the running test suite rather than rebuilt (per `AGENTS.md`'s multi-agent rule). Both ADR 0012 (the check-in history view) and ADR 0013 (the Progress domain built on top of Check-ins) explicitly flagged this missing ADR as a known documentation gap rather than silently backfilling one at the time. This ADR closes that gap: it documents the domain as it was actually reviewed and verified (typecheck clean, full test suite passing at review time), not a new decision made now.

## Decision

- **Quick-response model, not a raw scale.** `CheckInResponse = 'yes' | 'no' | 'partly' | 'skipped'` - a bounded enum, not Blueprint's open-ended progress-value/confidence scales, and not a free-text log. An optional `note` (trimmed, capped at 1000 characters) is the only free-form field.
- **Active-goal-only creation, ownership-enforced.** `CheckInService.createCheckIn()` depends on a minimal structural `GoalLookup` interface (`getGoal(userId, goalId): Promise<Goal>`) - the same dependency-inversion pattern already used by Onboarding's `GoalLookup` and Dashboard's `GoalsView` - satisfied by the real `GoalService`, which validates both existence and ownership. A check-in is rejected if the goal doesn't exist, isn't the caller's, or isn't currently `active` (`CheckInGoalNotActiveError` for the last case) - a paused, completed, or archived goal cannot receive new check-ins, though its past ones remain valid history (the basis ADR 0013's Progress domain later relied on).
- **Two read shapes, not one.** `listCheckIns(userId)` returns every check-in the user has recorded, across all goals, newest-first. `getGoalCheckIns(userId, goalId)` scopes to one goal and additionally returns a computed `CheckInSummary` (total count, per-response counts, most recent check-in) - a factual aggregation, not an interpretation.
- **In-memory repository**, sorted newest-first by `createdAt`, matching every other domain's current persistence approach (no real database yet, per ADR 0001).
- **API surface**: `POST /api/v1/check-ins` (create), `GET /api/v1/check-ins` (list all of the caller's), `GET /api/v1/goals/:id/check-ins` (one goal's check-ins + summary) - all behind `requireAuth`, no new error-handling conventions beyond the existing `CheckInValidationError`/`CheckInGoalNotActiveError` → 400/409 mappings.
- **Deliberately not built** (per the domain's own README): Blueprint's AI-driven check-in summary or plan-adjustment behavior, since neither Roadmap nor an AI provider integration exists yet - the same reasoning applied to every other AI-adjacent deferral in this project (Profile's `buildSafeProfileContext()`, Dashboard's coach summary). A dedicated history UI and a Progress domain were also not part of this domain itself - both were built later as their own milestones (ADR 0012, ADR 0013), consuming this domain's existing API rather than requiring changes to it.

## Consequences

- No functional changes were made as part of writing this ADR - it is a record of the domain as already reviewed, tested, and relied upon by two later milestones, not a new architectural decision.
- Future readers now have a complete design record for Check-ins matching every other domain in the project, closing the gap ADR 0012 and ADR 0013 both explicitly flagged rather than silently working around.
- If this domain's actual behavior is ever changed, that change gets its own ADR (or an addendum here) rather than an edit to this one - consistent with the project's "preserve historical accuracy" journal convention.
