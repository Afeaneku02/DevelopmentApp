import type { Goal } from './goal';

export type CheckInResponse = 'yes' | 'no' | 'partly' | 'skipped';

export interface CheckIn {
  id: string;
  userId: string;
  goalId: string;
  response: CheckInResponse;
  note: string;
  createdAt: string;
}

export interface CreateCheckInInput {
  userId: string;
  goalId: string;
  response: CheckInResponse;
  note?: string;
}

export interface CheckInSummary {
  totalCount: number;
  responseCounts: Record<CheckInResponse, number>;
  mostRecentCheckIn?: CheckIn;
}

export interface GoalCheckInsView {
  goal: Goal;
  checkIns: CheckIn[];
  summary: CheckInSummary;
}
