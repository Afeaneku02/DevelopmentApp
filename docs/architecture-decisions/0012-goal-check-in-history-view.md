# ADR 0012: Goal check-in history view

**Status:** Accepted

## Context

While planning a minimal Check-ins domain, it turned out Codex had already designed and merged one via GitHub PR #4 ("Add quick response check-ins", commit `d8787f7`) in parallel with that planning. Per `AGENTS.md`'s multi-agent rule ("do not assume another agent's changes are correct... inspect the actual diff, compare it against the specifications, test meaningful behavior"), the implementation was reviewed file by file rather than replaced: `CheckInResponse = 'yes' | 'no' | 'partly' | 'skipped'`, ownership + active-goal-only enforcement via the same structural `GoalLookup` pattern used by Onboarding and Dashboard, and API routes for creating a check-in and reading a single goal's check-ins + summary (`GET /api/v1/goals/:id/check-ins`). It matched the independently-planned scope closely enough, and typechecked and passed its full test suite (185/185 across the repo) as-is, so no changes were made to it.

That review surfaced a real gap: the API's `GoalCheckInsView` already returns a goal's complete check-in list, but the only place check-ins were surfaced in the UI was a single "Last check-in: X" line on the Dashboard card (via `mostRecentCheckIn`). The full history - what a user actually needs to see their own consistency over time - was unused. The current branch name (`goal-check-in-history-ui`) independently pointed at the same gap.

## Decision

- **History lives on the Goals screen, inline, not a new screen or route.** Each goal already renders as a card with lifecycle actions (Edit/Pause/Complete/Archive); a "History" button toggles an expandable panel on that same card using the existing `GET /api/v1/goals/:id/check-ins` endpoint - no backend changes were needed.
- **Available on goals of any status**, not just active ones. Check-ins can only be *created* against active goals (enforced by `CheckInService`), but a goal that is now paused, completed, or archived can still have check-ins recorded from when it was active, and that history remains legitimate to review.
- **Fetched fresh on every open, not cached across opens** (`historyByGoal: Record<string, GoalCheckInsView>` still holds the last-loaded view per goal so the panel has something to render, but `toggleHistory` re-fetches every time the panel is expanded rather than skipping the request when an entry already exists). A cache-on-first-load version was tried first and caught in review before pushing: if a user opened a goal's history, then recorded a new check-in from the Dashboard's quick-response buttons, then reopened that same goal's history in the same app session, it showed the stale pre-check-in data until a full page reload - defeating the point of a "history" view. Re-fetching on every open costs one extra request per toggle in exchange for always being correct.
- **Response color-coding** reuses the existing semantic tokens (`--color-success-*` for yes, `--color-warning-*` for partly, `--color-error-*` for no, neutral border/text for skipped) rather than introducing new ones, consistent with `.status-badge`'s existing use of the same tokens for goal lifecycle states.
- **No new AI or narrative summary** - the panel shows the same factual `CheckInSummary` (total count, per-response counts) the API already computes, plus each check-in's response, timestamp, and optional note in reverse-chronological order. No interpretation of the pattern is added.

## Consequences

- No backend or contract changes; this is a frontend-only consumer of an endpoint that already existed but was unused.
- Codex's Check-ins domain itself (services/check-ins, its routes, its tests) has no ADR of its own - it predates this one and was reviewed rather than authored here. That's a real documentation gap worth closing at some point, but backfilling an ADR for another agent's already-merged, already-tested work wasn't done unilaterally as part of this change.
- Verified live against the real API in both Sky and Midnight mode: seeded a user through signup, real onboarding fast-forward via the onboarding API, a goal, and two check-ins (one with a note), then opened/closed the history panel in the browser - correct newest-first ordering, correct summary counts, correct color-coding, 0 console errors in either theme.
