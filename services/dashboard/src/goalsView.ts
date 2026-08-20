import type { Goal } from '@better-you/contracts';

// Minimal structural interface for the one thing this domain needs from
// Goals - GoalService already satisfies this shape, so the concrete
// implementation is passed in without services/dashboard depending on the
// whole @better-you/goals package surface (same dependency-inversion pattern
// as GoalLookup in services/onboarding).
export interface GoalsView {
  listGoals(userId: string): Promise<Goal[]>;
}
