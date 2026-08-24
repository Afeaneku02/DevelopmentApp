import { describe, it, expect } from 'vitest';
import type { Goal, Roadmap } from '@better-you/contracts';
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

function makeRoadmap(overrides: Partial<Roadmap>): Roadmap {
  return {
    id: 'roadmap-1',
    userId: 'user-1',
    goalId: 'goal-1',
    status: 'active',
    milestones: [
      {
        id: 'm-1',
        title: 'Milestone one',
        description: '',
        status: 'active',
        actionSteps: [{ id: 'step-1', title: 'Do the first thing', description: '', status: 'pending' }],
      },
    ],
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

describe('computeNextAction', () => {
  it('suggests adding a goal when there is room and nothing paused, stale, or roadmapped', () => {
    const action = computeNextAction([makeGoal({ id: 'a' })], [], [], NOW);
    expect(action.type).toBe('add_goal');
    expect(action.message).toContain('2 more');
  });

  it('prioritizes resuming a paused goal over suggesting a new one', () => {
    const active = [makeGoal({ id: 'a' })];
    const paused = [makeGoal({ id: 'p', status: 'paused', title: 'Paused goal' })];
    const action = computeNextAction(active, paused, [], NOW);
    expect(action.type).toBe('resume_goal');
    expect(action.goalId).toBe('p');
    expect(action.message).toContain('Paused goal');
  });

  it('picks the oldest-updated paused goal when several are paused', () => {
    const paused = [
      makeGoal({ id: 'newer', status: 'paused', title: 'Newer', updatedAt: '2026-01-10T00:00:00.000Z' }),
      makeGoal({ id: 'older', status: 'paused', title: 'Older', updatedAt: '2026-01-01T00:00:00.000Z' }),
    ];
    const action = computeNextAction([], paused, [], NOW);
    expect(action.goalId).toBe('older');
  });

  it('flags a stale active goal when nothing is paused', () => {
    const stale = makeGoal({ id: 'stale', title: 'Old goal', updatedAt: '2025-12-01T00:00:00.000Z' });
    const action = computeNextAction([stale], [], [], NOW);
    expect(action.type).toBe('review_goal');
    expect(action.goalId).toBe('stale');
  });

  it('does not flag a recently-updated active goal as stale', () => {
    const recent = makeGoal({ id: 'recent', updatedAt: '2026-01-14T00:00:00.000Z' });
    const action = computeNextAction([recent], [], [], NOW);
    expect(action.type).not.toBe('review_goal');
  });

  it('returns none when at the active-goal cap with nothing paused, stale, or roadmapped', () => {
    const active = [
      makeGoal({ id: 'a', updatedAt: NOW.toISOString() }),
      makeGoal({ id: 'b', updatedAt: NOW.toISOString() }),
      makeGoal({ id: 'c', updatedAt: NOW.toISOString() }),
    ];
    const action = computeNextAction(active, [], [], NOW);
    expect(action.type).toBe('none');
  });

  it('suggests adding a goal for a brand-new user with none at all', () => {
    const action = computeNextAction([], [], [], NOW);
    expect(action.type).toBe('add_goal');
  });

  it('continues an active goal\'s roadmap before suggesting a new goal', () => {
    const active = [makeGoal({ id: 'goal-1', title: 'Ship the MVP' })];
    const roadmap = makeRoadmap({ goalId: 'goal-1' });
    const action = computeNextAction(active, [], [roadmap], NOW);
    expect(action.type).toBe('continue_roadmap');
    expect(action.goalId).toBe('goal-1');
    expect(action.roadmapId).toBe(roadmap.id);
    expect(action.actionStepId).toBe('step-1');
    expect(action.message).toContain('Do the first thing');
  });

  it('prioritizes resuming a paused goal over continuing a roadmap', () => {
    const active = [makeGoal({ id: 'goal-1' })];
    const paused = [makeGoal({ id: 'p', status: 'paused', title: 'Paused goal' })];
    const roadmap = makeRoadmap({ goalId: 'goal-1' });
    const action = computeNextAction(active, paused, [roadmap], NOW);
    expect(action.type).toBe('resume_goal');
  });

  it('falls through to add_goal when a roadmap has no pending steps', () => {
    const active = [makeGoal({ id: 'goal-1' })];
    const roadmap = makeRoadmap({
      goalId: 'goal-1',
      status: 'completed',
      milestones: [
        {
          id: 'm-1',
          title: 'Done',
          description: '',
          status: 'completed',
          actionSteps: [{ id: 'step-1', title: 'Done step', description: '', status: 'completed' }],
        },
      ],
    });
    const action = computeNextAction(active, [], [roadmap], NOW);
    expect(action.type).toBe('add_goal');
  });

  it('ignores a roadmap that belongs to a different goal', () => {
    const active = [makeGoal({ id: 'goal-1' })];
    const roadmap = makeRoadmap({ goalId: 'some-other-goal' });
    const action = computeNextAction(active, [], [roadmap], NOW);
    expect(action.type).toBe('add_goal');
  });
});
