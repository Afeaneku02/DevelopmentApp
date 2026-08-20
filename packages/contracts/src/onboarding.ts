// First-Run Onboarding (not "Onboarding" - deliberately scoped short of
// Blueprint §6's full definition, which ends in AI-generated "Create Plan").
// 'awaiting_roadmap' is the terminal step THIS milestone can reach - it means
// "finished everything currently built," not "onboarding complete" per
// Blueprint §6. There is no `completedAt` field for the same reason: adding
// one would claim a completion this milestone doesn't deliver.
export const ONBOARDING_STEPS = [
  'welcome',
  'consent',
  'profile_basics',
  'preferences',
  'first_goal',
  'awaiting_roadmap',
] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

// This is a thin progress tracker, not a duplicate data store - the real
// answers already live in Profile (basics, preferences) and Goals (the first
// goal itself); this only remembers which step a user is on so they can
// resume instead of restarting.
export interface OnboardingState {
  userId: string;
  currentStep: OnboardingStep;
  firstGoalId?: string;
  createdAt: string;
  updatedAt: string;
}
