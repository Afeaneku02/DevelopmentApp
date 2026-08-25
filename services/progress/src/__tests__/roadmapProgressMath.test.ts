import { describe, expect, it } from 'vitest';
import type { ActionStep, Milestone, Roadmap } from '@better-you/contracts';
import { computeRoadmapProgress } from '../roadmapProgressMath';

function makeActionStep(overrides: Partial<ActionStep>): ActionStep {
  return { id: 'step-1', title: 'A step', description: '', status: 'pending', ...overrides };
}

function makeMilestone(overrides: Partial<Milestone>): Milestone {
  return {
    id: 'milestone-1',
    title: 'A milestone',
    description: '',
    status: 'pending',
    actionSteps: [makeActionStep({})],
    ...overrides,
  };
}

function makeRoadmap(milestones: Milestone[]): Roadmap {
  return {
    id: 'roadmap-1',
    userId: 'user-1',
    goalId: 'goal-1',
    status: 'active',
    milestones,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('computeRoadmapProgress', () => {
  it('reports zero completion for a freshly generated roadmap', () => {
    const roadmap = makeRoadmap([
      makeMilestone({
        id: 'm1',
        status: 'active',
        actionSteps: [makeActionStep({ id: 's1' }), makeActionStep({ id: 's2' })],
      }),
      makeMilestone({ id: 'm2', status: 'pending', actionSteps: [makeActionStep({ id: 's3' })] }),
    ]);

    const progress = computeRoadmapProgress(roadmap);
    expect(progress).toEqual({
      totalMilestones: 2,
      completedMilestones: 0,
      totalActionSteps: 3,
      completedActionSteps: 0,
      stepCompletionPercentage: 0,
    });
  });

  it('counts partial completion across milestones correctly', () => {
    const roadmap = makeRoadmap([
      makeMilestone({
        id: 'm1',
        status: 'completed',
        actionSteps: [makeActionStep({ id: 's1', status: 'completed' }), makeActionStep({ id: 's2', status: 'completed' })],
      }),
      makeMilestone({
        id: 'm2',
        status: 'active',
        actionSteps: [makeActionStep({ id: 's3', status: 'completed' }), makeActionStep({ id: 's4', status: 'pending' })],
      }),
      makeMilestone({ id: 'm3', status: 'pending', actionSteps: [makeActionStep({ id: 's5', status: 'pending' })] }),
    ]);

    const progress = computeRoadmapProgress(roadmap);
    expect(progress.totalMilestones).toBe(3);
    expect(progress.completedMilestones).toBe(1);
    expect(progress.totalActionSteps).toBe(5);
    expect(progress.completedActionSteps).toBe(3);
    expect(progress.stepCompletionPercentage).toBe(60); // 3/5 = 60%
  });

  it('reports 100% completion for a fully completed roadmap', () => {
    const roadmap = makeRoadmap([
      makeMilestone({
        id: 'm1',
        status: 'completed',
        actionSteps: [makeActionStep({ id: 's1', status: 'completed' })],
      }),
      makeMilestone({
        id: 'm2',
        status: 'completed',
        actionSteps: [makeActionStep({ id: 's2', status: 'completed' }), makeActionStep({ id: 's3', status: 'completed' })],
      }),
    ]);

    const progress = computeRoadmapProgress(roadmap);
    expect(progress.completedMilestones).toBe(2);
    expect(progress.completedActionSteps).toBe(3);
    expect(progress.stepCompletionPercentage).toBe(100);
  });

  it('rounds the percentage to the nearest whole number', () => {
    // 1/3 = 33.33...% -> rounds to 33
    const roadmap = makeRoadmap([
      makeMilestone({
        id: 'm1',
        status: 'active',
        actionSteps: [
          makeActionStep({ id: 's1', status: 'completed' }),
          makeActionStep({ id: 's2', status: 'pending' }),
          makeActionStep({ id: 's3', status: 'pending' }),
        ],
      }),
    ]);

    expect(computeRoadmapProgress(roadmap).stepCompletionPercentage).toBe(33);
  });

  it('does not divide by zero for a roadmap with no action steps', () => {
    // Not producible through real validation (every milestone requires at
    // least one action step), but the math stays total rather than partial.
    const roadmap = makeRoadmap([makeMilestone({ id: 'm1', actionSteps: [] })]);
    const progress = computeRoadmapProgress(roadmap);
    expect(progress.totalActionSteps).toBe(0);
    expect(progress.stepCompletionPercentage).toBe(0);
  });
});
