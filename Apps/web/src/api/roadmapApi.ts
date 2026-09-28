import type { Roadmap } from '@better-you/contracts';
import { apiFetch } from './client';

export function getRoadmapForGoal(token: string, goalId: string): Promise<{ roadmap: Roadmap | null }> {
  return apiFetch(`/api/v1/goals/${goalId}/roadmap`, { token });
}

export function generateRoadmap(token: string, goalId: string): Promise<{ roadmap: Roadmap }> {
  return apiFetch(`/api/v1/goals/${goalId}/roadmap`, { method: 'POST', token });
}

export function addMentorAction(token: string, goalId: string, action: string): Promise<{ roadmap: Roadmap }> {
  return apiFetch(`/api/v1/goals/${encodeURIComponent(goalId)}/roadmap/mentor-actions`, {
    method: 'POST', token, body: { action },
  });
}

export function completeActionStep(token: string, roadmapId: string, stepId: string): Promise<{ roadmap: Roadmap }> {
  return apiFetch(`/api/v1/roadmaps/${roadmapId}/steps/${stepId}/complete`, { method: 'POST', token });
}
