import { describe, it, expect, beforeEach } from 'vitest';
import type { CreateGoalInput } from '@better-you/contracts';
import { GoalService } from '../goalService';
import { InMemoryGoalRepository } from '../goalRepository';
import { GoalLimitExceededError, GoalValidationError } from '../errors';

describe('GoalService', () => {
  let service: GoalService;

  beforeEach(() => {
    service = new GoalService(new InMemoryGoalRepository());
  });

  it('creates a goal from a suggested goal', async () => {
    const goal = await service.createGoal({
      userId: 'user-1',
      source: 'suggested',
      category: 'fitness',
      suggestedGoalId: 'fitness-shape',
    });
    expect(goal.title).toBe('Get in better shape');
    expect(goal.status).toBe('active');
    expect(goal.userId).toBe('user-1');
    expect(goal.suggestedGoalId).toBe('fitness-shape');
  });

  it('creates a goal from custom text', async () => {
    const goal = await service.createGoal({
      userId: 'user-1',
      source: 'custom',
      category: 'career',
      title: 'Get promoted this year',
    });
    expect(goal.title).toBe('Get promoted this year');
    expect(goal.source).toBe('custom');
    expect(goal.suggestedGoalId).toBeUndefined();
  });

  it('rejects invalid input', async () => {
    await expect(
      service.createGoal({
        userId: 'user-1',
        source: 'custom',
        category: 'career',
        title: '',
      })
    ).rejects.toThrow(GoalValidationError);
  });

  it('enforces the max active goal limit', async () => {
    const input = (title: string): CreateGoalInput => ({
      userId: 'user-1',
      source: 'custom',
      category: 'career',
      title,
    });
    await service.createGoal(input('Goal 1'));
    await service.createGoal(input('Goal 2'));
    await service.createGoal(input('Goal 3'));

    await expect(service.createGoal(input('Goal 4'))).rejects.toThrow(GoalLimitExceededError);
  });

  it('lists only the requesting user\'s goals, oldest first', async () => {
    await service.createGoal({ userId: 'user-1', source: 'custom', category: 'career', title: 'A' });
    await service.createGoal({ userId: 'user-2', source: 'custom', category: 'career', title: 'B' });
    await service.createGoal({ userId: 'user-1', source: 'custom', category: 'fitness', title: 'C' });

    const goals = await service.listGoals('user-1');
    expect(goals.map((goal) => goal.title)).toEqual(['A', 'C']);
  });

  it('returns an empty list for a user with no goals', async () => {
    expect(await service.listGoals('nobody')).toEqual([]);
  });
});
