# services/dashboard

Blueprint §10's "Dashboard" domain formally depends on Goals, Roadmap, Check-ins, and Progress. Only Goals exists, so this is a **Goals-only Dashboard** - `assembleGoalCards()`-equivalent logic and a deterministic `getNextActions()`-equivalent heuristic, both computed purely from `Goal` data (via the `GoalsView` interface, satisfied by the real `GoalService`).

Deliberately not built: a check-in call-to-action (no Check-ins domain), "continue roadmap" (no Roadmap), and `buildCoachSummaryInput()`/an AI coach summary (no AI integration - same reasoning as Profile's deferred `buildSafeProfileContext()` and every other AI-dependent piece so far). `NextAction` is a rule-based heuristic over Goals data, not AI-generated - see `nextAction.ts`'s own comments for the exact rules and their priority order.
