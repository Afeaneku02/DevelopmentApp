# ADR 0002: Goal Creation Core milestone scope

**Status:** Accepted

## Context

Product Vision §6, §10 (FR-06/FR-07), §15.1, §22.1; MVP Blueprint §7 ("Goals" domain) and §3 (build order) define goal creation as: pick a category, choose a suggested goal or describe a custom one, validate it, and save it, with a hard cap of 3 active starting goals. The blueprint formally lists Goals as depending on Auth and Profile, neither of which exist yet.

## Decision

Implement only the creation slice of the Goals domain now:

- `Goal` data model, validation, 5 suggested-goal categories (career, fitness, finances, education, personal_development per Vision §12/§22.2), custom-goal entry, `createGoal()`, `listGoals()`.
- Identity is resolved through a development-only stub user (`@better-you/config`'s `getStubUserId()`, driven by the `DEV_USER_ID` env var) instead of building real Auth first.
- Explicitly deferred: AI goal refinement/clarification, roadmap generation, and the rest of the goal lifecycle (pause/resume/complete/archive, `goal_history`).

## Consequences

- `Goal.status` is always `'active'` at creation; no transition functions exist yet.
- There is no real cross-user authorization yet (no Auth to enforce it) - isolation is only by the `userId` parameter each caller supplies. Real enforcement arrives with the Auth milestone.
- Suggested-goal content is hard-coded in `services/goals/src/suggestedGoals.ts` and will likely move to a managed content source later.
- No HTTP API layer was added - `GoalService` is called directly (see `tests/integration`) since no client or Auth layer exists yet to expose it through.
