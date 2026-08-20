import { describe, it, expect } from 'vitest';
import type { Goal } from '@better-you/contracts';
import { DashboardService } from '../dashboardService';
import type { GoalsView } from '../goalsView';

const NOW = new Date('2026-01-15T00:00:00.000Z');

class FakeGoalsView implements GoalsView {
  constructor(private readonly goals: Goal[]) {}
  async listGoals(): Promise<Goal[]> {
    return this.goals;
  }
}

function makeGoal(overrides: Partial<Goal>): Goal {
  return {
    id: overrides.id ?? 'goal-1',
    userId: 'user-1',
    title: 'A goal',
    description: '',
    category: 'career',
    source: 'custom',
    status: 'active',
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

describe('DashboardService', () => {
  it('returns empty, intentional state for a brand-new user', async () => {
    const service = new DashboardService(new FakeGoalsView([]), () => NOW);
    const dashboard = await service.getDashboard('user-1');
    expect(dashboard.activeGoals).toEqual([]);
    expect(dashboard.pausedGoals).toEqual([]);
    expect(dashboard.completedGoalsCount).toBe(0);
    expect(dashboard.totalGoalsCount).toBe(0);
    expect(dashboard.nextAction.type).toBe('add_goal');
  });

  it('separates active, paused, and completed goals correctly', async () => {
    const goals = [
      makeGoal({ id: 'a', status: 'active' }),
      makeGoal({ id: 'p', status: 'paused' }),
      makeGoal({ id: 'c', status: 'completed' }),
      makeGoal({ id: 'ar', status: 'archived' }),
    ];
    const service = new DashboardService(new FakeGoalsView(goals), () => NOW);
    const dashboard = await service.getDashboard('user-1');

    expect(dashboard.activeGoals.map((g) => g.id)).toEqual(['a']);
    expect(dashboard.pausedGoals.map((g) => g.id)).toEqual(['p']);
    expect(dashboard.completedGoalsCount).toBe(1);
    expect(dashboard.totalGoalsCount).toBe(4);
  });

  it('excludes archived goals from completedGoalsCount', async () => {
    const goals = [makeGoal({ id: 'ar', status: 'archived' })];
    const service = new DashboardService(new FakeGoalsView(goals), () => NOW);
    const dashboard = await service.getDashboard('user-1');
    expect(dashboard.completedGoalsCount).toBe(0);
  });

  it('stamps generatedAt from the injected clock', async () => {
    const service = new DashboardService(new FakeGoalsView([]), () => NOW);
    const dashboard = await service.getDashboard('user-1');
    expect(dashboard.generatedAt).toBe(NOW.toISOString());
  });

  it('derives nextAction from the same active/paused split it returns', async () => {
    const goals = [makeGoal({ id: 'p', status: 'paused', title: 'Needs a resume' })];
    const service = new DashboardService(new FakeGoalsView(goals), () => NOW);
    const dashboard = await service.getDashboard('user-1');
    expect(dashboard.nextAction.type).toBe('resume_goal');
    expect(dashboard.nextAction.goalId).toBe('p');
  });
});
