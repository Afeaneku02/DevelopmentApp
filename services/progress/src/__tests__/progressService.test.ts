import { describe, it, expect } from 'vitest';
import type { CheckIn, CheckInResponse, Goal, GoalCheckInsView } from '@better-you/contracts';
import { ProgressService } from '../progressService';
import type { CheckInsView } from '../checkInsView';

class GoalNotFoundError extends Error {}

class FakeCheckInsView implements CheckInsView {
  private checkIns: CheckIn[] = [];
  private goals = new Map<string, Goal>();
  private counter = 0;

  setGoal(goal: Goal): void {
    this.goals.set(goal.id, goal);
  }

  addCheckIn(userId: string, goalId: string, response: CheckInResponse, createdAt: string): void {
    this.counter += 1;
    this.checkIns.push({ id: `check-in-${this.counter}`, userId, goalId, response, note: '', createdAt });
  }

  async listCheckIns(userId: string): Promise<CheckIn[]> {
    return this.checkIns.filter((checkIn) => checkIn.userId === userId);
  }

  async getGoalCheckIns(userId: string, goalId: string): Promise<GoalCheckInsView> {
    const goal = this.goals.get(goalId);
    if (!goal || goal.userId !== userId) {
      throw new GoalNotFoundError('Goal not found');
    }
    const checkIns = this.checkIns.filter((checkIn) => checkIn.userId === userId && checkIn.goalId === goalId);
    return {
      goal,
      checkIns,
      summary: { totalCount: checkIns.length, responseCounts: { yes: 0, no: 0, partly: 0, skipped: 0 } },
    };
  }
}

function makeGoal(overrides: Partial<Goal>): Goal {
  return {
    id: 'goal-1',
    userId: 'user-1',
    title: 'A goal',
    description: '',
    category: 'career',
    source: 'custom',
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('ProgressService', () => {
  it('computes overall progress across every goal the user has checked in on', async () => {
    const view = new FakeCheckInsView();
    view.setGoal(makeGoal({ id: 'goal-1' }));
    view.setGoal(makeGoal({ id: 'goal-2' }));
    view.addCheckIn('user-1', 'goal-1', 'yes', '2026-01-01T00:00:00.000Z');
    view.addCheckIn('user-1', 'goal-2', 'no', '2026-01-02T00:00:00.000Z');
    view.addCheckIn('user-2', 'goal-1', 'yes', '2026-01-03T00:00:00.000Z');

    const service = new ProgressService(view);
    const overall = await service.getOverallProgress('user-1');

    expect(overall.totalCheckIns).toBe(2);
    expect(overall.goalsWithCheckIns).toBe(2);
    expect(overall.consistency).toBeCloseTo(0.5, 5);
  });

  it('returns zeroed overall progress for a user with no check-ins', async () => {
    const service = new ProgressService(new FakeCheckInsView());
    const overall = await service.getOverallProgress('user-1');
    expect(overall.totalCheckIns).toBe(0);
    expect(overall.goalsWithCheckIns).toBe(0);
    expect(overall.consistency).toBeNull();
  });

  it('computes per-goal progress scoped to that goal only', async () => {
    const view = new FakeCheckInsView();
    view.setGoal(makeGoal({ id: 'goal-1' }));
    view.setGoal(makeGoal({ id: 'goal-2' }));
    view.addCheckIn('user-1', 'goal-1', 'yes', '2026-01-01T00:00:00.000Z');
    view.addCheckIn('user-1', 'goal-2', 'no', '2026-01-02T00:00:00.000Z');

    const service = new ProgressService(view);
    const progress = await service.getGoalProgress('user-1', 'goal-1');

    expect(progress.goalId).toBe('goal-1');
    expect(progress.totalCheckIns).toBe(1);
    expect(progress.consistency).toBe(1);
  });

  it('rejects a goal owned by someone else', async () => {
    const view = new FakeCheckInsView();
    view.setGoal(makeGoal({ id: 'goal-1', userId: 'user-2' }));

    const service = new ProgressService(view);
    await expect(service.getGoalProgress('user-1', 'goal-1')).rejects.toThrow(GoalNotFoundError);
  });
});
