import { describe, expect, it } from 'vitest';
import { GoalService, InMemoryGoalRepository, InMemoryGoalHistoryRepository } from '@better-you/goals';
import {
  RoadmapService,
  InMemoryRoadmapRepository,
  PlaceholderRoadmapGenerator,
  RoadmapAlreadyExistsError,
} from '@better-you/roadmap';

function createServices() {
  const goalService = new GoalService(new InMemoryGoalRepository(), new InMemoryGoalHistoryRepository());
  const roadmapService = new RoadmapService(
    new InMemoryRoadmapRepository(),
    goalService,
    new PlaceholderRoadmapGenerator()
  );
  return { goalService, roadmapService };
}

describe('Roadmap (integration)', () => {
  it('generates a placeholder roadmap from a real goal and completes it step by step', async () => {
    const { goalService, roadmapService } = createServices();
    const goal = await goalService.createGoal({
      userId: 'user-1',
      source: 'custom',
      category: 'career',
      title: 'Ship the Better You MVP',
    });

    const generated = await roadmapService.generateRoadmap('user-1', goal.id);
    expect(generated.goalId).toBe(goal.id);
    expect(generated.milestones.length).toBeGreaterThan(0);

    const forGoal = await roadmapService.getRoadmapForGoal('user-1', goal.id);
    expect(forGoal?.id).toBe(generated.id);

    const stepIds = generated.milestones.flatMap((m) => m.actionSteps.map((s) => s.id));
    let latest = generated;
    for (const stepId of stepIds) {
      latest = await roadmapService.completeActionStep('user-1', generated.id, stepId);
    }
    expect(latest.status).toBe('completed');
  });

  it('rejects generating a roadmap against a goal owned by a different user', async () => {
    const { goalService, roadmapService } = createServices();
    const goal = await goalService.createGoal({
      userId: 'user-1',
      source: 'custom',
      category: 'career',
      title: "User 1's goal",
    });

    await expect(roadmapService.generateRoadmap('user-2', goal.id)).rejects.toThrow();
  });

  it('rejects a second roadmap for the same goal', async () => {
    const { goalService, roadmapService } = createServices();
    const goal = await goalService.createGoal({
      userId: 'user-1',
      source: 'custom',
      category: 'career',
      title: 'Ship the MVP',
    });

    await roadmapService.generateRoadmap('user-1', goal.id);
    await expect(roadmapService.generateRoadmap('user-1', goal.id)).rejects.toThrow(RoadmapAlreadyExistsError);
  });

  it('returns null for a goal that has no roadmap yet, without erroring', async () => {
    const { goalService, roadmapService } = createServices();
    const goal = await goalService.createGoal({
      userId: 'user-1',
      source: 'custom',
      category: 'career',
      title: 'No roadmap yet',
    });

    expect(await roadmapService.getRoadmapForGoal('user-1', goal.id)).toBeNull();
  });
});
