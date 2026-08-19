import type { Goal, GoalCategory } from '@better-you/contracts';
import { apiFetch } from './client';

// userId is deliberately absent - the API always derives it from the bearer
// token (ADR 0005), never from the request body.
export type CreateGoalRequest =
  | { source: 'suggested'; category: GoalCategory; suggestedGoalId: string; title?: string; description?: string }
  | { source: 'custom'; category: GoalCategory; title: string; description?: string };

export function listGoals(token: string): Promise<{ goals: Goal[] }> {
  return apiFetch('/api/v1/goals', { token });
}

export function createGoal(token: string, input: CreateGoalRequest): Promise<{ goal: Goal }> {
  return apiFetch('/api/v1/goals', { method: 'POST', token, body: input });
}

export interface UpdateGoalRequest {
  title?: string;
  description?: string;
  category?: GoalCategory;
}

export function updateGoal(token: string, goalId: string, input: UpdateGoalRequest): Promise<{ goal: Goal }> {
  return apiFetch(`/api/v1/goals/${goalId}`, { method: 'PATCH', token, body: input });
}

export function pauseGoal(token: string, goalId: string): Promise<{ goal: Goal }> {
  return apiFetch(`/api/v1/goals/${goalId}/pause`, { method: 'POST', token });
}

export function resumeGoal(token: string, goalId: string): Promise<{ goal: Goal }> {
  return apiFetch(`/api/v1/goals/${goalId}/resume`, { method: 'POST', token });
}

export function completeGoal(token: string, goalId: string): Promise<{ goal: Goal }> {
  return apiFetch(`/api/v1/goals/${goalId}/complete`, { method: 'POST', token });
}

export function archiveGoal(token: string, goalId: string): Promise<{ goal: Goal }> {
  return apiFetch(`/api/v1/goals/${goalId}/archive`, { method: 'POST', token });
}
