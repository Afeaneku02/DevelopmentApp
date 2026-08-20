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

export interface GoalProgress extends ProgressSummary {
  goalId: string;
}

export interface OverallProgress extends ProgressSummary {
  goalsWithCheckIns: number;
}
