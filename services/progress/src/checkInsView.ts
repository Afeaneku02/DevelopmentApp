import type { CheckIn, GoalCheckInsView } from '@better-you/contracts';

// Minimal structural interface for what Progress needs from Check-ins. The
// real CheckInService satisfies this shape and also enforces goal ownership
// on getGoalCheckIns (a fake/foreign goalId rejects the same way it does
// for the check-ins domain itself - Progress doesn't re-implement that).
export interface CheckInsView {
  listCheckIns(userId: string): Promise<CheckIn[]>;
  getGoalCheckIns(userId: string, goalId: string): Promise<GoalCheckInsView>;
}
