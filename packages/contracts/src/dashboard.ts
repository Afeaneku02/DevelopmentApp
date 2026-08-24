import type { Goal } from './goal';
import type { Roadmap } from './roadmap';

// Blueprint §10 formally lists Dashboard's dependencies as Goals, Roadmap,
// Check-ins, and Progress - Goals and now Roadmap exist (Check-ins/Progress
// are surfaced separately on Dashboard/Goals rather than folded into
// NextAction). NextAction is a deterministic heuristic over Goals+Roadmap
// data (see services/dashboard/src/nextAction.ts), not the AI "coach
// summary" Blueprint separately describes - that stays unbuilt, same as
// every other AI-dependent piece so far.
export type NextActionType = 'resume_goal' | 'review_goal' | 'continue_roadmap' | 'add_goal' | 'none';

export interface NextAction {
  type: NextActionType;
  goalId?: string;
  roadmapId?: string;
  actionStepId?: string;
  message: string;
}

export interface DashboardView {
  activeGoals: Goal[];
  pausedGoals: Goal[];
  completedGoalsCount: number;
  totalGoalsCount: number;
  roadmaps: Roadmap[];
  nextAction: NextAction;
  generatedAt: string;
}
