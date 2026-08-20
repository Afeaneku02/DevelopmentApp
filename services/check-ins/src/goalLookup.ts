import type { Goal } from '@better-you/contracts';

// Minimal structural interface for what Check-ins needs from Goals. The real
// GoalService satisfies this shape and also enforces ownership.
export interface GoalLookup {
  getGoal(userId: string, goalId: string): Promise<Goal>;
}
