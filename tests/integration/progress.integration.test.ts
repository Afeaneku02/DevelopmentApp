import { describe, expect, it } from 'vitest';
import { ProgressService } from '@better-you/progress';
import { CheckInService, InMemoryCheckInRepository } from '@better-you/check-ins';
import { GoalService, InMemoryGoalHistoryRepository, InMemoryGoalRepository } from '@better-you/goals';
import { RoadmapService, InMemoryRoadmapRepository, PlaceholderRoadmapGenerator } from '@better-you/roadmap';

function createServices() {
  const goalService = new GoalService(new InMemoryGoalRepository(), new InMemoryGoalHistoryRepository());
  const checkInService = new CheckInService(new InMemoryCheckInRepository(), goalService);
  const roadmapService = new RoadmapService(
    new InMemoryRoadmapRepository(),
    goalService,
    new PlaceholderRoadmapGenerator()
  );
  const progressService = new ProgressService(checkInService, roadmapService);
  return { goalService, checkInService, roadmapService, progressService };
}

describe('Progress (integration)', () => {
  it('reflects real Check-ins state end to end', async () => {
    const { goalService, checkInService, progressService } = createServices();
    const userId = 'user-1';

    const goal = await goalService.createGoal({
      userId,
      source: 'custom',
      category: 'fitness',
      title: 'Run a marathon',
    });

    await checkInService.createCheckIn({ userId, goalId: goal.id, response: 'yes' });
    await checkInService.createCheckIn({ userId, goalId: goal.id, response: 'no' });

    const overall = await progressService.getOverallProgress(userId);
    expect(overall.totalCheckIns).toBe(2);
    expect(overall.consistency).toBe(0.5);

    const perGoal = await progressService.getGoalProgress(userId, goal.id);
    expect(perGoal.goalId).toBe(goal.id);
    expect(perGoal.totalCheckIns).toBe(2);
  });

  it('still returns progress for a goal after it is paused, since past check-ins remain valid history', async () => {
    const { goalService, checkInService, progressService } = createServices();
    const userId = 'user-1';

    const goal = await goalService.createGoal({
      userId,
      source: 'custom',
      category: 'fitness',
      title: 'Run a marathon',
    });
    await checkInService.createCheckIn({ userId, goalId: goal.id, response: 'yes' });
    await goalService.pauseGoal(userId, goal.id);

    const perGoal = await progressService.getGoalProgress(userId, goal.id);
    expect(perGoal.totalCheckIns).toBe(1);
    expect(perGoal.consistency).toBe(1);
  });

  it('keeps progress isolated between users', async () => {
    const { goalService, checkInService, progressService } = createServices();
    const goal = await goalService.createGoal({ userId: 'user-1', source: 'custom', category: 'career', title: 'A' });
    await checkInService.createCheckIn({ userId: 'user-1', goalId: goal.id, response: 'yes' });

    const overallB = await progressService.getOverallProgress('user-2');
    expect(overallB.totalCheckIns).toBe(0);
  });

  it('returns roadmap: null for a goal that has no roadmap yet', async () => {
    const { goalService, progressService } = createServices();
    const userId = 'user-1';
    const goal = await goalService.createGoal({ userId, source: 'custom', category: 'career', title: 'A' });

    const perGoal = await progressService.getGoalProgress(userId, goal.id);
    expect(perGoal.roadmap).toBeNull();
  });

  it('reflects real roadmap progress against the actual RoadmapService, updating as steps complete', async () => {
    const { goalService, roadmapService, progressService } = createServices();
    const userId = 'user-1';
    const goal = await goalService.createGoal({
      userId,
      source: 'custom',
      category: 'career',
      title: 'Ship the Better You MVP',
    });

    const roadmap = await roadmapService.generateRoadmap(userId, goal.id);
    const totalSteps = roadmap.milestones.flatMap((m) => m.actionSteps).length;

    const before = await progressService.getGoalProgress(userId, goal.id);
    expect(before.roadmap).toEqual({
      totalMilestones: roadmap.milestones.length,
      completedMilestones: 0,
      totalActionSteps: totalSteps,
      completedActionSteps: 0,
      stepCompletionPercentage: 0,
    });

    const firstStep = roadmap.milestones[0].actionSteps[0];
    await roadmapService.completeActionStep(userId, roadmap.id, firstStep.id);

    const after = await progressService.getGoalProgress(userId, goal.id);
    expect(after.roadmap?.completedActionSteps).toBe(1);
    expect(after.roadmap?.stepCompletionPercentage).toBe(Math.round((1 / totalSteps) * 100));
  });
});
