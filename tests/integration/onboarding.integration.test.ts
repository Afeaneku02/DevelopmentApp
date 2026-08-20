import { describe, it, expect } from 'vitest';
import { OnboardingService, InMemoryOnboardingRepository } from '@better-you/onboarding';
import { GoalService, InMemoryGoalRepository, InMemoryGoalHistoryRepository } from '@better-you/goals';

function createServices() {
  const goalService = new GoalService(new InMemoryGoalRepository(), new InMemoryGoalHistoryRepository());
  const onboardingService = new OnboardingService(new InMemoryOnboardingRepository(), goalService);
  return { goalService, onboardingService };
}

describe('First-Run Onboarding (integration)', () => {
  it('walks the full step sequence to awaiting_roadmap, gated on a real, owned first goal', async () => {
    const { goalService, onboardingService } = createServices();
    const userId = 'user-1';

    expect((await onboardingService.getState(userId)).currentStep).toBe('welcome');
    await onboardingService.nextStep(userId); // consent
    await onboardingService.nextStep(userId); // profile_basics
    await onboardingService.nextStep(userId); // preferences
    const atFirstGoal = await onboardingService.nextStep(userId);
    expect(atFirstGoal.currentStep).toBe('first_goal');

    await expect(onboardingService.nextStep(userId)).rejects.toThrow();

    const goal = await goalService.createGoal({
      userId,
      source: 'custom',
      category: 'career',
      title: 'Ship the Better You MVP',
    });

    await onboardingService.recordFirstGoal(userId, goal.id);
    const final = await onboardingService.nextStep(userId);
    expect(final.currentStep).toBe('awaiting_roadmap');
    expect(final.firstGoalId).toBe(goal.id);
  });

  it('rejects a goal id that does not exist against the real GoalService', async () => {
    const { onboardingService } = createServices();
    await onboardingService.getState('user-1');
    await expect(onboardingService.recordFirstGoal('user-1', 'not-a-real-goal')).rejects.toThrow();
  });

  it('rejects a real goal id that belongs to a different user', async () => {
    const { goalService, onboardingService } = createServices();

    const someoneElsesGoal = await goalService.createGoal({
      userId: 'user-2',
      source: 'custom',
      category: 'career',
      title: "Someone else's goal",
    });

    await onboardingService.getState('user-1');
    await expect(onboardingService.recordFirstGoal('user-1', someoneElsesGoal.id)).rejects.toThrow();
  });
});
