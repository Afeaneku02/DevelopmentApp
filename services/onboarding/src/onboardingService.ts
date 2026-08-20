import { ONBOARDING_STEPS, type OnboardingState } from '@better-you/contracts';
import { OnboardingAtFinalStepError, OnboardingValidationError } from './errors';
import type { OnboardingRepository } from './onboardingRepository';
import type { GoalLookup } from './goalLookup';

function buildInitialState(userId: string, now: Date): OnboardingState {
  const timestamp = now.toISOString();
  return {
    userId,
    currentStep: ONBOARDING_STEPS[0],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export class OnboardingService {
  constructor(
    private readonly repository: OnboardingRepository,
    private readonly goalLookup: GoalLookup,
    private readonly now: () => Date = () => new Date()
  ) {}

  // Lazy creation on first access, same pattern as ProfileService - a client
  // can always GET the current step right after signing up.
  async getState(userId: string): Promise<OnboardingState> {
    const existing = await this.repository.findByUserId(userId);
    if (existing) {
      return existing;
    }
    return this.repository.create(buildInitialState(userId, this.now()));
  }

  // Deliberately not named completeOnboarding(). Advances exactly one step;
  // requires a first goal to already be recorded before leaving 'first_goal',
  // so a client can't skip straight to 'awaiting_roadmap' without one.
  async nextStep(userId: string): Promise<OnboardingState> {
    const state = await this.getState(userId);
    const currentIndex = ONBOARDING_STEPS.indexOf(state.currentStep);

    if (currentIndex === ONBOARDING_STEPS.length - 1) {
      throw new OnboardingAtFinalStepError();
    }
    if (state.currentStep === 'first_goal' && !state.firstGoalId) {
      throw new OnboardingValidationError('A first goal must be created before continuing');
    }

    const updated: OnboardingState = {
      ...state,
      currentStep: ONBOARDING_STEPS[currentIndex + 1],
      updatedAt: this.now().toISOString(),
    };
    return this.repository.update(updated);
  }

  // Verifies goalId is real AND owned by this user before recording it -
  // otherwise onboarding state (which gates whether the user can advance)
  // could be pushed forward with a fake or someone-else's goal id. Whatever
  // GoalLookup.getGoal() throws for "not found or not yours" (GoalNotFoundError
  // in the real GoalService) propagates unchanged - this domain doesn't need
  // to know the specific error type, only that failure means "reject."
  async recordFirstGoal(userId: string, goalId: string): Promise<OnboardingState> {
    await this.goalLookup.getGoal(userId, goalId);

    const state = await this.getState(userId);
    const updated: OnboardingState = {
      ...state,
      firstGoalId: goalId,
      updatedAt: this.now().toISOString(),
    };
    return this.repository.update(updated);
  }
}
