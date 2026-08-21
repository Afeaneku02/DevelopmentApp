# ADR 0010: First-Run Onboarding - scoped short of Blueprint §6

**Status:** Accepted

## Context

With Auth, Profile, and Goals all real, signing up dropped a user straight into an empty Goals screen - no welcome, no consent, no profile setup, nothing matching Vision §5.1's entry sequence. Blueprint §6's "Onboarding" domain covers this, but its flow ends in AI-generated "Create Plan," which depends on the AI Roadmap Engine - a domain this project can't build and verify honestly right now for the same reason Supabase Auth was deferred (ADR 0004): no way to provision and test against a real model-provider API key.

The user explicitly flagged the risk of calling this "onboarding complete" when Blueprint §6 isn't satisfied, and asked that the scoping stay honest at the code/data level, not just in prose.

## Decision

- **Named "First-Run Onboarding," never "Onboarding" bare**, in code, routes, and docs.
- **No `completed_at` field**, despite Blueprint §6's core data naming one. `OnboardingState` has `currentStep` and nothing else claiming completion. The step enum's own terminal value carries the honesty: `'awaiting_roadmap'` means "finished everything this milestone builds," not "onboarding complete."
- **No `completeOnboarding()` function**, despite Blueprint §6 naming one. Only `nextStep()`, advancing through a fixed sequence (`welcome → consent → profile_basics → preferences → first_goal → awaiting_roadmap`) with no operation named "complete" anywhere in the domain.
- **`OnboardingState` is a thin progress tracker, not a duplicate data store.** Real answers live in `services/profile` (basics, preferences) and `services/goals` (the first goal) - onboarding only remembers which step a user is on, plus a reference (`firstGoalId`) to the goal created during the flow, so it can require one exist before leaving `first_goal`.
- **The `first_goal` step reuses `services/goals`/`AddGoalForm` directly** rather than reimplementing goal creation inside onboarding - extracted `apps/web/src/components/AddGoalForm.tsx` out of `GoalsScreen` (previously inline) so both the main app and the onboarding flow share one goal-creation experience, not two that could drift apart.
- **`apps/web`'s `App.tsx` gates on onboarding state**: any user whose `currentStep !== 'awaiting_roadmap'` sees `OnboardingFlow` instead of the main app, regardless of how they arrived (fresh signup or returning mid-flow) - this is what makes resuming real rather than aspirational.
- **The horizon-band signature element is used throughout the onboarding flow**, unlike `GoalsScreen` (ADR 0008 reserved it for Auth only). Onboarding is a single bounded first-run journey, not a repeatedly-visited screen, so it's the same category as Auth, not a dilution of the motif.

## Consequences

- Reaching `awaiting_roadmap` is *not* Blueprint §6 completion. When the AI Roadmap Engine eventually exists, a real "Create Plan" step - and only then a genuine `completedAt`/completion concept - gets added to this domain; it isn't half-built now.
- Verified live that resuming is real, not just non-crashing: signed up, advanced to `profile_basics`, closed the session, signed back in from a fresh browser context, and confirmed the app landed directly on `profile_basics` rather than restarting at `welcome`.
- A stale, multi-day-old Vite dev server process (running since the very first `apps/web` session) started failing to resolve the `@better-you/contracts` alias for newly-added files partway through this session - confirmed as a dev-server-state issue, not a code defect, by restarting it fresh and seeing the exact same request resolve immediately. Worth remembering: a `apps/web` dev server that's been running across many hours of heavy file churn is itself a plausible root cause if imports mysteriously fail to resolve, before assuming the code is wrong.

## Addendum (post-review): `recordFirstGoal` did not verify goal ownership

A Codex review of this milestone found a real gap: `OnboardingService.recordFirstGoal(userId, goalId)` stored whatever `goalId` string it was given, with no check that the goal existed or belonged to the caller. `apps/web`'s own UI always passes a real, just-created goal id, so the gap was invisible through the app - but the API itself would have accepted a fake id or another user's goal id, and onboarding state (which gates step advancement) would have recorded it as if valid.

**Fix:** `OnboardingService` now takes a `GoalLookup` dependency (`services/onboarding/src/goalLookup.ts`) - a minimal structural interface (`getGoal(userId, goalId): Promise<unknown>`), satisfied by the real `GoalService` without `services/onboarding` depending on the whole `@better-you/goals` package surface, matching the dependency-inversion pattern already used for `GoalRepository`/`ProfileRepository`/`AuthProvider`. `recordFirstGoal()` calls `goalLookup.getGoal(userId, goalId)` first; whatever it throws for "not found or not yours" (`GoalNotFoundError` from the real `GoalService`, mapped to 404 by the existing error handler) propagates unchanged, so the fix required no new error type and no route-layer change - `apps/api/src/routes/onboarding.ts` was already correctly structured to let this propagate.

The validation lives in the domain service, not duplicated at the route layer, for the same reason `GoalService` validates ownership internally rather than trusting callers: it holds for every caller, not just the one HTTP route that happens to check today. Verified against the real running API (`curl` with a fabricated `goalId` → `404 GOAL_NOT_FOUND`) and confirmed the legitimate flow (real, owned goal) still works end to end in a live browser afterward.
