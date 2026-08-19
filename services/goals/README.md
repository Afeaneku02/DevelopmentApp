# services/goals

The Goals domain (MVP Blueprint §7), scoped to the Goal Creation Core milestone: data model + validation, suggested-goal content, custom-goal entry, and `createGoal`/`listGoals`. Persistence is in-memory behind a `GoalRepository` interface so a real database adapter can replace it later without changing `GoalService`. The full lifecycle (pause/resume/complete/archive/history) and AI-assisted goal clarification are separate, later milestones.
