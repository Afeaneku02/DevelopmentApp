import { describe, it, expect, beforeEach } from 'vitest';
import type { CreateGoalInput } from '@better-you/contracts';
import { GoalService } from '../goalService';
import { InMemoryGoalRepository } from '../goalRepository';
import { InMemoryGoalHistoryRepository } from '../goalHistoryRepository';
import {
  GoalLimitExceededError,
  GoalNotFoundError,
  GoalValidationError,
  InvalidGoalTransitionError,
} from '../errors';

describe('GoalService', () => {
  let service: GoalService;

  beforeEach(() => {
    service = new GoalService(new InMemoryGoalRepository(), new InMemoryGoalHistoryRepository());
  });

  describe('createGoal', () => {
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

    it('records a "created" history event', async () => {
      const goal = await service.createGoal({ userId: 'user-1', source: 'custom', category: 'career', title: 'A' });
      const history = await service.getGoalHistory('user-1', goal.id);
      expect(history.map((e) => e.eventType)).toEqual(['created']);
    });
  });

  describe('listGoals', () => {
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

  describe('getGoal', () => {
    it('returns the goal for its owner', async () => {
      const created = await service.createGoal({ userId: 'user-1', source: 'custom', category: 'career', title: 'A' });
      const found = await service.getGoal('user-1', created.id);
      expect(found).toEqual(created);
    });

    it('throws GoalNotFoundError for an unknown id', async () => {
      await expect(service.getGoal('user-1', 'does-not-exist')).rejects.toThrow(GoalNotFoundError);
    });

    it('throws GoalNotFoundError when the goal belongs to someone else', async () => {
      const created = await service.createGoal({ userId: 'user-1', source: 'custom', category: 'career', title: 'A' });
      await expect(service.getGoal('user-2', created.id)).rejects.toThrow(GoalNotFoundError);
    });
  });

  describe('updateGoal', () => {
    it('updates only the provided fields', async () => {
      const created = await service.createGoal({ userId: 'user-1', source: 'custom', category: 'career', title: 'A' });
      const updated = await service.updateGoal('user-1', created.id, { title: 'B' });
      expect(updated.title).toBe('B');
      expect(updated.category).toBe('career');
    });

    it('rejects an empty title', async () => {
      const created = await service.createGoal({ userId: 'user-1', source: 'custom', category: 'career', title: 'A' });
      await expect(service.updateGoal('user-1', created.id, { title: '' })).rejects.toThrow(GoalValidationError);
    });

    it('records an "updated" history event', async () => {
      const created = await service.createGoal({ userId: 'user-1', source: 'custom', category: 'career', title: 'A' });
      await service.updateGoal('user-1', created.id, { title: 'B' });
      const history = await service.getGoalHistory('user-1', created.id);
      expect(history.map((e) => e.eventType)).toEqual(['created', 'updated']);
    });

    it('denies updating another user\'s goal', async () => {
      const created = await service.createGoal({ userId: 'user-1', source: 'custom', category: 'career', title: 'A' });
      await expect(service.updateGoal('user-2', created.id, { title: 'B' })).rejects.toThrow(GoalNotFoundError);
    });
  });

  describe('lifecycle transitions', () => {
    async function createActiveGoal(userId = 'user-1') {
      return service.createGoal({ userId, source: 'custom', category: 'career', title: 'A' });
    }

    it('pauses an active goal', async () => {
      const goal = await createActiveGoal();
      const paused = await service.pauseGoal('user-1', goal.id);
      expect(paused.status).toBe('paused');
    });

    it('resumes a paused goal', async () => {
      const goal = await createActiveGoal();
      await service.pauseGoal('user-1', goal.id);
      const resumed = await service.resumeGoal('user-1', goal.id);
      expect(resumed.status).toBe('active');
    });

    it('completes an active goal', async () => {
      const goal = await createActiveGoal();
      const completed = await service.completeGoal('user-1', goal.id);
      expect(completed.status).toBe('completed');
    });

    it('completes a paused goal', async () => {
      const goal = await createActiveGoal();
      await service.pauseGoal('user-1', goal.id);
      const completed = await service.completeGoal('user-1', goal.id);
      expect(completed.status).toBe('completed');
    });

    it('archives an active, paused, or completed goal', async () => {
      const active = await createActiveGoal();
      expect((await service.archiveGoal('user-1', active.id)).status).toBe('archived');

      const paused = await createActiveGoal();
      await service.pauseGoal('user-1', paused.id);
      expect((await service.archiveGoal('user-1', paused.id)).status).toBe('archived');

      const completed = await createActiveGoal();
      await service.completeGoal('user-1', completed.id);
      expect((await service.archiveGoal('user-1', completed.id)).status).toBe('archived');
    });

    it('rejects resuming an active goal', async () => {
      const goal = await createActiveGoal();
      await expect(service.resumeGoal('user-1', goal.id)).rejects.toThrow(InvalidGoalTransitionError);
    });

    it('rejects pausing a completed goal', async () => {
      const goal = await createActiveGoal();
      await service.completeGoal('user-1', goal.id);
      await expect(service.pauseGoal('user-1', goal.id)).rejects.toThrow(InvalidGoalTransitionError);
    });

    it('rejects any transition from an archived goal', async () => {
      const goal = await createActiveGoal();
      await service.archiveGoal('user-1', goal.id);
      await expect(service.pauseGoal('user-1', goal.id)).rejects.toThrow(InvalidGoalTransitionError);
      await expect(service.resumeGoal('user-1', goal.id)).rejects.toThrow(InvalidGoalTransitionError);
      await expect(service.completeGoal('user-1', goal.id)).rejects.toThrow(InvalidGoalTransitionError);
      await expect(service.archiveGoal('user-1', goal.id)).rejects.toThrow(InvalidGoalTransitionError);
    });

    it('denies transitioning another user\'s goal', async () => {
      const goal = await createActiveGoal();
      await expect(service.pauseGoal('user-2', goal.id)).rejects.toThrow(GoalNotFoundError);
    });

    it('does not count a paused, completed, or archived goal against the active limit', async () => {
      const input = (title: string): CreateGoalInput => ({
        userId: 'user-1',
        source: 'custom',
        category: 'career',
        title,
      });
      const a = await service.createGoal(input('A'));
      await service.createGoal(input('B'));
      await service.createGoal(input('C'));

      await service.pauseGoal('user-1', a.id);

      // Only 2 remain active (B, C), so a 4th active goal should now be allowed.
      const d = await service.createGoal(input('D'));
      expect(d.status).toBe('active');
    });

    it('records a full history trail across the lifecycle', async () => {
      const goal = await createActiveGoal();
      await service.pauseGoal('user-1', goal.id);
      await service.resumeGoal('user-1', goal.id);
      await service.completeGoal('user-1', goal.id);
      await service.archiveGoal('user-1', goal.id);

      const history = await service.getGoalHistory('user-1', goal.id);
      expect(history.map((e) => e.eventType)).toEqual(['created', 'paused', 'resumed', 'completed', 'archived']);
    });
  });
});
