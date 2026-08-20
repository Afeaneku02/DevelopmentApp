import { describe, it, expect } from 'vitest';
import { DashboardService } from '@better-you/dashboard';
import { GoalService, InMemoryGoalRepository, InMemoryGoalHistoryRepository } from '@better-you/goals';

function createServices() {
  const goalService = new GoalService(new InMemoryGoalRepository(), new InMemoryGoalHistoryRepository());
  const dashboardService = new DashboardService(goalService);
  return { goalService, dashboardService };
}

describe('Dashboard (integration)', () => {
  it('reflects real Goals domain state end to end', async () => {
    const { goalService, dashboardService } = createServices();
    const userId = 'user-1';

    const empty = await dashboardService.getDashboard(userId);
    expect(empty.activeGoals).toEqual([]);
    expect(empty.nextAction.type).toBe('add_goal');

    const goal = await goalService.createGoal({
      userId,
      source: 'custom',
      category: 'fitness',
      title: 'Run a marathon',
    });

    const afterCreate = await dashboardService.getDashboard(userId);
    expect(afterCreate.activeGoals).toHaveLength(1);
    expect(afterCreate.activeGoals[0].id).toBe(goal.id);

    await goalService.pauseGoal(userId, goal.id);
    const afterPause = await dashboardService.getDashboard(userId);
    expect(afterPause.activeGoals).toHaveLength(0);
    expect(afterPause.pausedGoals).toHaveLength(1);
    expect(afterPause.nextAction.type).toBe('resume_goal');
    expect(afterPause.nextAction.goalId).toBe(goal.id);

    await goalService.resumeGoal(userId, goal.id);
    await goalService.completeGoal(userId, goal.id);
    const afterComplete = await dashboardService.getDashboard(userId);
    expect(afterComplete.activeGoals).toHaveLength(0);
    expect(afterComplete.completedGoalsCount).toBe(1);
    expect(afterComplete.nextAction.type).toBe('add_goal');
  });

  it('keeps dashboards isolated between users', async () => {
    const { goalService, dashboardService } = createServices();
    await goalService.createGoal({ userId: 'user-1', source: 'custom', category: 'career', title: 'A' });

    const dashboardB = await dashboardService.getDashboard('user-2');
    expect(dashboardB.activeGoals).toEqual([]);
  });
});
