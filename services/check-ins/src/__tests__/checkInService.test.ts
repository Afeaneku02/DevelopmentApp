import { describe, expect, it, beforeEach } from 'vitest';
import type { Goal } from '@better-you/contracts';
import { CheckInService, summarizeCheckIns } from '../checkInService';
import { InMemoryCheckInRepository } from '../checkInRepository';
import type { GoalLookup } from '../goalLookup';
import { CheckInGoalNotActiveError, CheckInValidationError } from '../errors';

const NOW = new Date('2026-01-15T00:00:00.000Z');

class GoalNotFoundError extends Error {}

class FakeGoalLookup implements GoalLookup {
  private goals = new Map<string, Goal>();

  setGoal(goal: Goal): void {
    this.goals.set(goal.id, goal);
  }

  async getGoal(userId: string, goalId: string): Promise<Goal> {
    const goal = this.goals.get(goalId);
    if (!goal || goal.userId !== userId) {
      throw new GoalNotFoundError('Goal not found');
    }
    return goal;
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
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

describe('CheckInService', () => {
  let goals: FakeGoalLookup;
  let service: CheckInService;

  beforeEach(() => {
    goals = new FakeGoalLookup();
    service = new CheckInService(new InMemoryCheckInRepository(), goals, () => NOW);
  });

  it('creates a check-in for an active owned goal', async () => {
    goals.setGoal(makeGoal({ id: 'goal-1' }));

    const checkIn = await service.createCheckIn({
      userId: 'user-1',
      goalId: 'goal-1',
      response: 'partly',
      note: 'Did half',
    });

    expect(checkIn.response).toBe('partly');
    expect(checkIn.note).toBe('Did half');
    expect(checkIn.createdAt).toBe(NOW.toISOString());
  });

  it('rejects a goal owned by someone else', async () => {
    goals.setGoal(makeGoal({ id: 'goal-1', userId: 'user-2' }));

    await expect(
      service.createCheckIn({ userId: 'user-1', goalId: 'goal-1', response: 'yes' })
    ).rejects.toThrow(GoalNotFoundError);
  });

  it('rejects paused, completed, or archived goals', async () => {
    for (const status of ['paused', 'completed', 'archived'] as const) {
      goals.setGoal(makeGoal({ id: status, status }));
      await expect(
        service.createCheckIn({ userId: 'user-1', goalId: status, response: 'yes' })
      ).rejects.toThrow(CheckInGoalNotActiveError);
    }
  });

  it('validates response and note', async () => {
    goals.setGoal(makeGoal({ id: 'goal-1' }));

    await expect(
      service.createCheckIn({ userId: 'user-1', goalId: 'goal-1', response: 'maybe' as never })
    ).rejects.toThrow(CheckInValidationError);

    await expect(
      service.createCheckIn({ userId: 'user-1', goalId: 'goal-1', response: 'yes', note: 'x'.repeat(1001) })
    ).rejects.toThrow(CheckInValidationError);
  });

  it('lists a user check-ins newest first', async () => {
    goals.setGoal(makeGoal({ id: 'goal-1' }));
    const repository = new InMemoryCheckInRepository();
    let now = NOW;
    service = new CheckInService(repository, goals, () => now);

    await service.createCheckIn({ userId: 'user-1', goalId: 'goal-1', response: 'no' });
    now = new Date('2026-01-16T00:00:00.000Z');
    await service.createCheckIn({ userId: 'user-1', goalId: 'goal-1', response: 'yes' });

    const checkIns = await service.listCheckIns('user-1');
    expect(checkIns.map((checkIn) => checkIn.response)).toEqual(['yes', 'no']);
  });

  it('returns goal check-ins with a factual summary', async () => {
    goals.setGoal(makeGoal({ id: 'goal-1' }));

    await service.createCheckIn({ userId: 'user-1', goalId: 'goal-1', response: 'yes' });
    await service.createCheckIn({ userId: 'user-1', goalId: 'goal-1', response: 'partly' });

    const view = await service.getGoalCheckIns('user-1', 'goal-1');
    expect(view.checkIns).toHaveLength(2);
    expect(view.summary.totalCount).toBe(2);
    expect(view.summary.responseCounts.yes).toBe(1);
    expect(view.summary.responseCounts.partly).toBe(1);
  });
});

describe('summarizeCheckIns', () => {
  it('returns zero counts for empty input', () => {
    expect(summarizeCheckIns([])).toEqual({
      totalCount: 0,
      responseCounts: { yes: 0, no: 0, partly: 0, skipped: 0 },
    });
  });
});
