import type { Goal } from './goal';

// Blueprint §10 formally lists Dashboard's dependencies as Goals, Roadmap,
// Check-ins, and Progress - only Goals exists. NextAction is a deterministic
// heuristic over Goals data (see services/dashboard/src/nextAction.ts), not
// the AI "coach summary" Blueprint separately describes - that stays
// unbuilt, same as every other AI-dependent piece so far.
export type NextActionType = 'resume_goal' | 'review_goal' | 'add_goal' | 'none';

export interface NextAction {
  type: NextActionType;
  goalId?: string;
  message: string;
}

export interface DashboardView {
  activeGoals: Goal[];
  pausedGoals: Goal[];
  completedGoalsCount: number;
  totalGoalsCount: number;
  nextAction: NextAction;
  generatedAt: string;
}
