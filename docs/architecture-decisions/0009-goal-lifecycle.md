# ADR 0009: Goal lifecycle - state machine, history, and UI

**Status:** Accepted

## Context

ADR 0002 deliberately scoped Goal Creation Core to creation-only (`createGoal`/`listGoals`), deferring `pause`/`resume`/`complete`/`archive`/edit/history - the rest of Blueprint §7's Goals domain. With Auth, the API layer, and Profile all real, this was the last explicitly-deferred piece of the Goals domain itself.

## Decision

- **Explicit state machine** (`services/goals/src/goalStateMachine.ts`): `active ⇄ paused`, both can move to `completed` or `archived`, `completed` can only move to `archived`, `archived` is terminal. This matches Blueprint §7's own action list exactly - it names `pause`, `resume`, `complete`, `archive` and nothing else, so there is no "unarchive"/"reopen" transition.
- **`GoalHistoryRepository`/`GoalHistoryEvent`**, a separate append-only store (Blueprint §7: `goal_history(id, goal_id, event_type, snapshot_json, created_at)`, "history immutable to normal user flows"). Every create, edit, and status transition records an event with a full snapshot of the goal at that point - no `update`/`delete` method exists on the repository, so the only way history changes is by new events being appended.
- **`GoalNotFoundError` is used for both "doesn't exist" and "belongs to someone else"** - a caller can't distinguish the two, matching the same enumeration-avoidance reasoning already applied to Auth's `InvalidCredentialsError`.
- **`updateGoal()` only edits `title`/`description`/`category`** - status changes go exclusively through the dedicated `pauseGoal`/`resumeGoal`/`completeGoal`/`archiveGoal` methods, never through a generic status field, so the state machine can't be bypassed by a client sending `{ status: 'completed' }` in a PATCH body.
- **A real, if minor, bug fixed while wiring the UI**: `apps/web`'s active-goal count (and the 3-goal-limit check) was counting *all* goals regardless of status, not just active ones - meaning a completed or archived goal would have permanently occupied a slot in the 3-goal cap. Fixed to filter by `status === 'active'`, matching what the backend's `countActiveByUser` already did correctly.
- **History has no UI yet.** Blueprint §7's own frontend-pieces list marks "history view" as `later`, distinct from "goal list/cards; goal editor; status actions" which are not deferred - so `GET /api/v1/goals/:id/history` exists and is tested, but nothing in `apps/web` calls it yet.
- **No new visual-design skill invocation for this UI.** Status badges, action buttons, and the inline edit form all reuse patterns already established (ADR 0007/0008's tokens, `.badge`, `.option-card`, form styling) rather than introducing anything new - this was applying the existing system, not designing.

## Consequences

- `GoalService`'s constructor signature changed (`repository`, `historyRepository`, optional `now`) - every construction site (`apps/api/src/server.ts`, both `tests/integration` files, `services/goals`'s own unit tests) needed updating.
- A goal's edit history and status-transition history are both fully auditable via the API even though no UI surfaces it yet - this data won't need to be retrofitted later when a history view is eventually built.
- The active-goal-count bug is a good example of why live browser verification (not just backend tests) keeps mattering: the backend's `countActiveByUser` was already correct, but the frontend had silently duplicated the same "active-only" logic incorrectly, and only became visibly wrong once completed/archived goals actually existed in a real session.
