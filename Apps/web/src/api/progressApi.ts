import type { GoalProgress, OverallProgress } from '@better-you/contracts';
import { apiFetch } from './client';

export function getOverallProgress(token: string): Promise<{ progress: OverallProgress }> {
  return apiFetch('/api/v1/progress', { token });
}

export function getGoalProgress(token: string, goalId: string): Promise<{ progress: GoalProgress }> {
  return apiFetch(`/api/v1/goals/${goalId}/progress`, { token });
}
