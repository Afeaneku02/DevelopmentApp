import type { CheckInResponse } from './checkIn';

export type ProgressTrend = 'improving' | 'steady' | 'declining' | 'not_enough_data';

export interface ProgressSummary {
  totalCheckIns: number;
  responseCounts: Record<CheckInResponse, number>;
  // 0-1 consistency score across scorable check-ins (yes=1, partly=0.5, no=0;
  // skipped is excluded from both numerator and denominator). Null when
  // there are no scorable check-ins yet.
  consistency: number | null;
  trend: ProgressTrend;
}

// Purely factual counts/percentage derived directly from a Roadmap's own
// milestone/action-step status fields (services/progress/src/roadmapProgressMath.ts)
// - no interpretation, no AI, nothing beyond what's directly countable.
export interface RoadmapProgress {
  totalMilestones: number;
  completedMilestones: number;
  totalActionSteps: number;
  completedActionSteps: number;
  // 0-100, rounded to the nearest whole number.
  stepCompletionPercentage: number;
}

export interface GoalProgress extends ProgressSummary {
  goalId: string;
  // null when this goal has no roadmap yet (ADR 0020/0021's Roadmap domain
  // is independent of Goals - not every goal has one).
  roadmap: RoadmapProgress | null;
}

export interface OverallProgress extends ProgressSummary {
  goalsWithCheckIns: number;
}
