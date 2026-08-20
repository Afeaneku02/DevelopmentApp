import { describe, it, expect } from 'vitest';
import type { Goal } from '@better-you/contracts';
import { computeNextAction } from '../nextAction';

const NOW = new Date('2026-01-15T00:00:00.000Z');

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

describe('computeNextAction', () => {
  it('suggests adding a goal when there is room and nothing paused or stale', () => {
    const action = computeNextAction([makeGoal({ id: 'a' })], [], NOW);
    expect(action.type).toBe('add_goal');
    expect(action.message).toContain('2 more');
  });

  it('prioritizes resuming a paused goal over suggesting a new one', () => {
    const active = [makeGoal({ id: 'a' })];
    const paused = [makeGoal({ id: 'p', status: 'paused', title: 'Paused goal' })];
    const action = computeNextAction(active, paused, NOW);
    expect(action.type).toBe('resume_goal');
    expect(action.goalId).toBe('p');
    expect(action.message).toContain('Paused goal');
  });

  it('picks the oldest-updated paused goal when several are paused', () => {
    const paused = [
      makeGoal({ id: 'newer', status: 'paused', title: 'Newer', updatedAt: '2026-01-10T00:00:00.000Z' }),
      makeGoal({ id: 'older', status: 'paused', title: 'Older', updatedAt: '2026-01-01T00:00:00.000Z' }),
    ];
    const action = computeNextAction([], paused, NOW);
    expect(action.goalId).toBe('older');
  });

  it('flags a stale active goal when nothing is paused', () => {
    const stale = makeGoal({ id: 'stale', title: 'Old goal', updatedAt: '2025-12-01T00:00:00.000Z' });
    const action = computeNextAction([stale], [], NOW);
    expect(action.type).toBe('review_goal');
    expect(action.goalId).toBe('stale');
  });

  it('does not flag a recently-updated active goal as stale', () => {
    const recent = makeGoal({ id: 'recent', updatedAt: '2026-01-14T00:00:00.000Z' });
    const action = computeNextAction([recent], [], NOW);
    expect(action.type).not.toBe('review_goal');
  });

  it('returns none when at the active-goal cap with nothing paused or stale', () => {
    const active = [
      makeGoal({ id: 'a', updatedAt: NOW.toISOString() }),
      makeGoal({ id: 'b', updatedAt: NOW.toISOString() }),
      makeGoal({ id: 'c', updatedAt: NOW.toISOString() }),
    ];
    const action = computeNextAction(active, [], NOW);
    expect(action.type).toBe('none');
  });

  it('suggests adding a goal for a brand-new user with none at all', () => {
    const action = computeNextAction([], [], NOW);
    expect(action.type).toBe('add_goal');
  });
});
