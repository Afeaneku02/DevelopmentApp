import { describe, expect, it, beforeEach } from 'vitest';
import type { Goal, RoadmapDraft, RoadmapGenerationInput } from '@better-you/contracts';
import { RoadmapService } from '../roadmapService';
import { InMemoryRoadmapRepository } from '../roadmapRepository';
import type { GoalLookup } from '../goalLookup';
import type { RoadmapGenerator } from '../roadmapGenerator';
import {
  RoadmapAlreadyExistsError,
  RoadmapMilestoneNotActiveError,
  RoadmapNotFoundError,
  RoadmapStepNotFoundError,
  RoadmapValidationError,
} from '../errors';

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

class FakeGenerator implements RoadmapGenerator {
  constructor(private readonly draft: RoadmapDraft) {}
  async generateRoadmap(_input: RoadmapGenerationInput): Promise<RoadmapDraft> {
    return this.draft;
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

function twoMilestoneDraft(): RoadmapDraft {
  return {
    milestones: [
      { title: 'First', actionSteps: [{ title: 'Step A' }, { title: 'Step B' }] },
      { title: 'Second', actionSteps: [{ title: 'Step C' }] },
    ],
  };
}

describe('RoadmapService', () => {
  let goals: FakeGoalLookup;

  beforeEach(() => {
    goals = new FakeGoalLookup();
    goals.setGoal(makeGoal({ id: 'goal-1' }));
  });

  function createService(draft: RoadmapDraft = twoMilestoneDraft()) {
    return new RoadmapService(new InMemoryRoadmapRepository(), goals, new FakeGenerator(draft), () => NOW);
  }

  it('generates a roadmap with the first milestone active and the rest pending', async () => {
    const service = createService();
    const roadmap = await service.generateRoadmap('user-1', 'goal-1');

    expect(roadmap.goalId).toBe('goal-1');
    expect(roadmap.status).toBe('active');
    expect(roadmap.milestones).toHaveLength(2);
    expect(roadmap.milestones[0].status).toBe('active');
    expect(roadmap.milestones[1].status).toBe('pending');
    expect(roadmap.milestones[0].actionSteps.every((step) => step.status === 'pending')).toBe(true);
  });

  it('rejects a goal owned by someone else', async () => {
    goals.setGoal(makeGoal({ id: 'goal-1', userId: 'user-2' }));
    const service = createService();
    await expect(service.generateRoadmap('user-1', 'goal-1')).rejects.toThrow(GoalNotFoundError);
  });

  it('rejects generating a second roadmap for the same goal', async () => {
    const service = createService();
    await service.generateRoadmap('user-1', 'goal-1');
    await expect(service.generateRoadmap('user-1', 'goal-1')).rejects.toThrow(RoadmapAlreadyExistsError);
  });

  it('rejects an invalid generator draft instead of persisting it', async () => {
    const service = createService({ milestones: [] });
    await expect(service.generateRoadmap('user-1', 'goal-1')).rejects.toThrow(RoadmapValidationError);
  });

  it('rejects fetching a roadmap owned by someone else', async () => {
    const service = createService();
    const roadmap = await service.generateRoadmap('user-1', 'goal-1');
    await expect(service.getRoadmap('user-2', roadmap.id)).rejects.toThrow(RoadmapNotFoundError);
  });

  it('returns null from getRoadmapForGoal when no roadmap exists yet', async () => {
    const service = createService();
    expect(await service.getRoadmapForGoal('user-1', 'goal-1')).toBeNull();
  });

  it('rejects completing an unknown action step', async () => {
    const service = createService();
    const roadmap = await service.generateRoadmap('user-1', 'goal-1');
    await expect(service.completeActionStep('user-1', roadmap.id, 'not-a-real-step')).rejects.toThrow(
      RoadmapStepNotFoundError
    );
  });

  it('completes a milestone and activates the next one once all its steps are done', async () => {
    const service = createService();
    const roadmap = await service.generateRoadmap('user-1', 'goal-1');
    const [stepA, stepB] = roadmap.milestones[0].actionSteps;

    const afterA = await service.completeActionStep('user-1', roadmap.id, stepA.id);
    expect(afterA.milestones[0].status).toBe('active');
    expect(afterA.status).toBe('active');

    const afterB = await service.completeActionStep('user-1', roadmap.id, stepB.id);
    expect(afterB.milestones[0].status).toBe('completed');
    expect(afterB.milestones[1].status).toBe('active');
    expect(afterB.status).toBe('active');
  });

  it('rejects completing a step in a future, not-yet-active milestone', async () => {
    const service = createService();
    const roadmap = await service.generateRoadmap('user-1', 'goal-1');
    const futureStep = roadmap.milestones[1].actionSteps[0];

    await expect(service.completeActionStep('user-1', roadmap.id, futureStep.id)).rejects.toThrow(
      RoadmapMilestoneNotActiveError
    );
  });

  it('rejects re-completing a step in an already-completed milestone', async () => {
    const service = createService();
    const roadmap = await service.generateRoadmap('user-1', 'goal-1');
    const [stepA, stepB] = roadmap.milestones[0].actionSteps;

    await service.completeActionStep('user-1', roadmap.id, stepA.id);
    await service.completeActionStep('user-1', roadmap.id, stepB.id); // completes milestone 0

    await expect(service.completeActionStep('user-1', roadmap.id, stepA.id)).rejects.toThrow(
      RoadmapMilestoneNotActiveError
    );
  });

  it('completes the roadmap once every milestone is done', async () => {
    const service = createService();
    const roadmap = await service.generateRoadmap('user-1', 'goal-1');
    const stepIds = roadmap.milestones.flatMap((milestone) => milestone.actionSteps.map((step) => step.id));

    let latest = roadmap;
    for (const stepId of stepIds) {
      latest = await service.completeActionStep('user-1', roadmap.id, stepId);
    }

    expect(latest.status).toBe('completed');
    expect(latest.milestones.every((m) => m.status === 'completed')).toBe(true);
  });
});
