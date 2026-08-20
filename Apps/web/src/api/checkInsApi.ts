import type { CheckIn, CheckInResponse, GoalCheckInsView } from '@better-you/contracts';
import { apiFetch } from './client';

export function createCheckIn(
  token: string,
  input: { goalId: string; response: CheckInResponse; note?: string }
): Promise<{ checkIn: CheckIn }> {
  return apiFetch('/api/v1/check-ins', { method: 'POST', token, body: input });
}

export function listGoalCheckIns(token: string, goalId: string): Promise<GoalCheckInsView> {
  return apiFetch(`/api/v1/goals/${goalId}/check-ins`, { token });
}
