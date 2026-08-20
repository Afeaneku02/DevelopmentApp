# services/onboarding

**First-Run Onboarding** - deliberately scoped short of MVP Blueprint §6's full "Onboarding" domain, which ends in AI-generated "Create Plan." This domain only gets a user from account creation through their first goal; see `docs/architecture-decisions/0010-first-run-onboarding.md` for why.

`OnboardingState` is a thin progress tracker (current step + a reference to the first goal once created), not a duplicate data store - the real answers live in `services/profile` and `services/goals`. There is no `completedAt` field and no `completeOnboarding()` function: the terminal step value is `'awaiting_roadmap'`, which means "finished everything this milestone builds," not "onboarding complete" per Blueprint §6.
