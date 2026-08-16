import { describe, it, expect, afterEach } from 'vitest';
import { GoalService, InMemoryGoalRepository } from '@better-you/goals';
import { getStubUserId } from '@better-you/config';

describe('Goal Creation Core (integration)', () => {
  const originalDevUserId = process.env.DEV_USER_ID;

  afterEach(() => {
    if (originalDevUserId === undefined) {
      delete process.env.DEV_USER_ID;
    } else {
      process.env.DEV_USER_ID = originalDevUserId;
    }
  });

  it('creates and lists goals for the configured dev stub user', async () => {
    process.env.DEV_USER_ID = 'integration-test-user';
    const userId = getStubUserId();
    const service = new GoalService(new InMemoryGoalRepository());

    await service.createGoal({
      userId,
      source: 'suggested',
      category: 'education',
      suggestedGoalId: 'education-skill',
    });
    await service.createGoal({
      userId,
      source: 'custom',
      category: 'personal_development',
      title: 'Meditate consistently',
    });

    const goals = await service.listGoals(userId);
    expect(goals).toHaveLength(2);
    expect(goals.every((goal) => goal.userId === 'integration-test-user')).toBe(true);
  });

  it('falls back to the default dev user id when DEV_USER_ID is unset', () => {
    delete process.env.DEV_USER_ID;
    expect(getStubUserId()).toBe('dev-user-local');
  });
});
