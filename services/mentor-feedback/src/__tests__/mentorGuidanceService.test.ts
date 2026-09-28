import { describe, expect, it, vi } from 'vitest';
import { GOAL_CATEGORIES, type Goal, type GoalCategory } from '@better-you/contracts';
import { GoalNotFoundError } from '@better-you/goals';
import { buildMentorGuidanceInput } from '../mentorGuidanceInput';
import { MentorGuidanceService } from '../mentorGuidanceService';
import { UnavailableMentorGuidanceClient } from '../unavailableMentorGuidanceClient';

function goal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: 'goal-1',
    userId: 'user-1',
    title: 'Walk every morning',
    description: 'Private: my doctor at St. Mary said my blood pressure is high',
    category: 'fitness',
    status: 'active',
    source: 'custom',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  } as Goal;
}

describe('buildMentorGuidanceInput', () => {
  it('produces exactly { contextKey, goalTitle } - no description, ids, or timestamps', () => {
    const input = buildMentorGuidanceInput(goal());
    expect(input).toEqual({ contextKey: 'fitness_scheduling', goalTitle: 'Walk every morning' });
    const serialized = JSON.stringify(input);
    for (const leaked of ['blood pressure', 'St. Mary', 'user-1', 'goal-1', '2026-09-01', 'custom']) {
      expect(serialized).not.toContain(leaked);
    }
  });

  const expected: Record<GoalCategory, string> = {
    fitness: 'fitness_scheduling',
    finances: 'financial_planning',
    career: 'habit_nudge',
    education: 'habit_nudge',
    personal_development: 'habit_nudge',
  };

  it.each(GOAL_CATEGORIES.map((c) => [c]))('maps category %s to a fixed context key', (category) => {
    expect(buildMentorGuidanceInput(goal({ category })).contextKey).toBe(expected[category]);
  });
});

describe('MentorGuidanceService', () => {
  it("looks the goal up as the caller (ownership) and sends only the sanitized input with the caller's id", async () => {
    const getGoal = vi.fn().mockResolvedValue(goal());
    const client = { getGuidance: vi.fn().mockResolvedValue({ status: 'unavailable' }) };
    const service = new MentorGuidanceService({ getGoal }, client);

    await service.getGuidance('user-1', 'goal-1');

    expect(getGoal).toHaveBeenCalledWith('user-1', 'goal-1');
    expect(client.getGuidance).toHaveBeenCalledWith('user-1', {
      contextKey: 'fitness_scheduling',
      goalTitle: 'Walk every morning',
    });
  });

  it('propagates a not-found goal without calling the AI client', async () => {
    const getGoal = vi.fn().mockRejectedValue(new GoalNotFoundError());
    const client = { getGuidance: vi.fn() };
    const service = new MentorGuidanceService({ getGoal }, client);

    await expect(service.getGuidance('user-1', 'someone-elses-goal')).rejects.toBeInstanceOf(GoalNotFoundError);
    expect(client.getGuidance).not.toHaveBeenCalled();
  });

  it("returns the client's result unchanged", async () => {
    const service = new MentorGuidanceService({ getGoal: async () => goal() }, new UnavailableMentorGuidanceClient());
    expect((await service.getGuidance('user-1', 'goal-1')).reasonCode).toBe('not_configured');
  });
});
