import { describe, it, expect, beforeEach } from 'vitest';
import { OnboardingService } from '../onboardingService';
import { InMemoryOnboardingRepository } from '../onboardingRepository';
import { OnboardingAtFinalStepError, OnboardingValidationError } from '../errors';
import type { GoalLookup } from '../goalLookup';

class NotFoundError extends Error {}

// A minimal, controllable stand-in for GoalService's getGoal() - accepts only
// goal ids explicitly registered as owned by a given user, matching the real
// ownership-check contract (GoalNotFoundError for "doesn't exist or isn't
// yours") without needing a real GoalService/repositories in a unit test.
class FakeGoalLookup implements GoalLookup {
  private ownedGoals = new Map<string, string>(); // goalId -> userId

  registerGoal(goalId: string, ownerId: string): void {
    this.ownedGoals.set(goalId, ownerId);
  }

  async getGoal(userId: string, goalId: string): Promise<unknown> {
    if (this.ownedGoals.get(goalId) !== userId) {
      throw new NotFoundError('Goal not found');
    }
    return { id: goalId, userId };
  }
}

describe('OnboardingService', () => {
  let goalLookup: FakeGoalLookup;
  let service: OnboardingService;

  beforeEach(() => {
    goalLookup = new FakeGoalLookup();
    service = new OnboardingService(new InMemoryOnboardingRepository(), goalLookup);
  });

  it('lazily creates state at the welcome step on first access', async () => {
    const state = await service.getState('user-1');
    expect(state.currentStep).toBe('welcome');
    expect(state.firstGoalId).toBeUndefined();
  });

  it('returns the same persisted state on subsequent calls', async () => {
    const first = await service.getState('user-1');
    const second = await service.getState('user-1');
    expect(second).toEqual(first);
  });

  it('advances one step at a time in order', async () => {
    await service.getState('user-1');
    expect((await service.nextStep('user-1')).currentStep).toBe('consent');
    expect((await service.nextStep('user-1')).currentStep).toBe('profile_basics');
    expect((await service.nextStep('user-1')).currentStep).toBe('preferences');
  });

  it('requires a first goal before leaving the first_goal step', async () => {
    goalLookup.registerGoal('goal-123', 'user-1');

    await service.getState('user-1');
    await service.nextStep('user-1'); // consent
    await service.nextStep('user-1'); // profile_basics
    await service.nextStep('user-1'); // preferences
    await service.nextStep('user-1'); // first_goal

    await expect(service.nextStep('user-1')).rejects.toThrow(OnboardingValidationError);

    await service.recordFirstGoal('user-1', 'goal-123');
    const advanced = await service.nextStep('user-1');
    expect(advanced.currentStep).toBe('awaiting_roadmap');
  });

  it('throws once already at the final step', async () => {
    goalLookup.registerGoal('goal-123', 'user-1');

    await service.getState('user-1');
    for (let i = 0; i < 4; i++) {
      await service.nextStep('user-1');
    }
    await service.recordFirstGoal('user-1', 'goal-123');
    await service.nextStep('user-1'); // now at awaiting_roadmap

    await expect(service.nextStep('user-1')).rejects.toThrow(OnboardingAtFinalStepError);
  });

  it('keeps state isolated between users', async () => {
    await service.getState('user-1');
    await service.nextStep('user-1');
    const other = await service.getState('user-2');
    expect(other.currentStep).toBe('welcome');
  });

  it('records the first goal id without advancing the step, once ownership is verified', async () => {
    goalLookup.registerGoal('goal-123', 'user-1');

    await service.getState('user-1');
    const state = await service.recordFirstGoal('user-1', 'goal-123');
    expect(state.firstGoalId).toBe('goal-123');
    expect(state.currentStep).toBe('welcome');
  });

  it('rejects a goal id that does not exist', async () => {
    await service.getState('user-1');
    await expect(service.recordFirstGoal('user-1', 'does-not-exist')).rejects.toThrow(NotFoundError);
  });

  it('rejects a goal id that belongs to a different user', async () => {
    goalLookup.registerGoal('goal-123', 'user-2');

    await service.getState('user-1');
    await expect(service.recordFirstGoal('user-1', 'goal-123')).rejects.toThrow(NotFoundError);
  });

  it('does not record firstGoalId when ownership verification fails', async () => {
    goalLookup.registerGoal('goal-123', 'user-2');

    await service.getState('user-1');
    await expect(service.recordFirstGoal('user-1', 'goal-123')).rejects.toThrow();

    const state = await service.getState('user-1');
    expect(state.firstGoalId).toBeUndefined();
  });
});
