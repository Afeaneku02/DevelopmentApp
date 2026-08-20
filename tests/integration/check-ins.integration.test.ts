import { describe, expect, it } from 'vitest';
import { CheckInService, InMemoryCheckInRepository } from '@better-you/check-ins';
import { GoalService, InMemoryGoalHistoryRepository, InMemoryGoalRepository } from '@better-you/goals';

function createServices() {
  const goalService = new GoalService(new InMemoryGoalRepository(), new InMemoryGoalHistoryRepository());
  const checkInService = new CheckInService(new InMemoryCheckInRepository(), goalService);
  return { goalService, checkInService };
}

describe('Check-ins (integration)', () => {
  it('records and summarizes check-ins against real Goals state', async () => {
    const { goalService, checkInService } = createServices();
    const goal = await goalService.createGoal({
      userId: 'user-1',
      source: 'custom',
      category: 'fitness',
      title: 'Run today',
    });

    await checkInService.createCheckIn({ userId: 'user-1', goalId: goal.id, response: 'yes' });
    await checkInService.createCheckIn({ userId: 'user-1', goalId: goal.id, response: 'skipped' });

    const view = await checkInService.getGoalCheckIns('user-1', goal.id);
    expect(view.summary.totalCount).toBe(2);
    expect(view.summary.responseCounts.yes).toBe(1);
    expect(view.summary.responseCounts.skipped).toBe(1);
  });

  it('rejects non-active goals against real Goals state', async () => {
    const { goalService, checkInService } = createServices();
    const goal = await goalService.createGoal({
      userId: 'user-1',
      source: 'custom',
      category: 'fitness',
      title: 'Run today',
    });
    await goalService.pauseGoal('user-1', goal.id);

    await expect(
      checkInService.createCheckIn({ userId: 'user-1', goalId: goal.id, response: 'yes' })
    ).rejects.toThrow();
  });
});
