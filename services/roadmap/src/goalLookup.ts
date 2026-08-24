import type { Goal } from '@better-you/contracts';

// Minimal structural interface for what Roadmap needs from Goals. The real
// GoalService satisfies this shape and also enforces ownership (same pattern
// as services/check-ins/src/goalLookup.ts and services/onboarding/src/goalLookup.ts).
export interface GoalLookup {
  getGoal(userId: string, goalId: string): Promise<Goal>;
}
