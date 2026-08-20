export class OnboardingValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OnboardingValidationError';
  }
}

// Thrown by nextStep() once currentStep is already the terminal step
// ('awaiting_roadmap') - deliberately not named an "already complete" error,
// since nothing here represents Blueprint §6 completion.
export class OnboardingAtFinalStepError extends Error {
  constructor() {
    super('Onboarding is already at its final step for this milestone');
    this.name = 'OnboardingAtFinalStepError';
  }
}
