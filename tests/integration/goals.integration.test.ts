import { describe, it, expect, afterEach } from 'vitest';
import { GoalService, InMemoryGoalRepository, InMemoryGoalHistoryRepository } from '@better-you/goals';
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
    const service = new GoalService(new InMemoryGoalRepository(), new InMemoryGoalHistoryRepository());

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

  it('supports the full pause -> resume -> complete -> archive lifecycle with real history', async () => {
    const service = new GoalService(new InMemoryGoalRepository(), new InMemoryGoalHistoryRepository());
    const userId = 'lifecycle-user';

    const created = await service.createGoal({
      userId,
      source: 'custom',
      category: 'fitness',
      title: 'Run a marathon',
    });

    const paused = await service.pauseGoal(userId, created.id);
    expect(paused.status).toBe('paused');

    const resumed = await service.resumeGoal(userId, created.id);
    expect(resumed.status).toBe('active');

    const completed = await service.completeGoal(userId, created.id);
    expect(completed.status).toBe('completed');

    const archived = await service.archiveGoal(userId, created.id);
    expect(archived.status).toBe('archived');

    const history = await service.getGoalHistory(userId, created.id);
    expect(history.map((event) => event.eventType)).toEqual(['created', 'paused', 'resumed', 'completed', 'archived']);
  });
});
