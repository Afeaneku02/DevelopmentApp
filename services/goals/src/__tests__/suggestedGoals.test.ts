import { describe, it, expect } from 'vitest';
import { GOAL_CATEGORIES } from '@better-you/contracts';
import { SUGGESTED_GOALS, getSuggestedGoalsByCategory, findSuggestedGoal } from '../suggestedGoals';

describe('suggested goals content', () => {
  it('has at least one suggested goal per category', () => {
    for (const category of GOAL_CATEGORIES) {
      expect(getSuggestedGoalsByCategory(category).length).toBeGreaterThan(0);
    }
  });

  it('has unique ids', () => {
    const ids = SUGGESTED_GOALS.map((goal) => goal.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('finds a suggested goal by id', () => {
    expect(findSuggestedGoal('fitness-shape')?.title).toBe('Get in better shape');
  });

  it('returns undefined for an unknown id', () => {
    expect(findSuggestedGoal('nope')).toBeUndefined();
  });
});
