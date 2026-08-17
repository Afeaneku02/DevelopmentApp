export class GoalValidationError extends Error {
  constructor(
    public readonly field: string,
    message: string
  ) {
    super(message);
    this.name = 'GoalValidationError';
  }
}

export class GoalLimitExceededError extends Error {
  constructor(message = 'Active goal limit reached') {
    super(message);
    this.name = 'GoalLimitExceededError';
  }
}

// Thrown both when a goal truly doesn't exist and when it exists but belongs
// to a different user - same generic response either way, so a caller can't
// use it to enumerate other users' goal ids (same reasoning as Auth's
// InvalidCredentialsError).
export class GoalNotFoundError extends Error {
  constructor() {
    super('Goal not found');
    this.name = 'GoalNotFoundError';
  }
}

export class InvalidGoalTransitionError extends Error {
  constructor(from: string, to: string) {
    super(`Cannot move a goal from "${from}" to "${to}"`);
    this.name = 'InvalidGoalTransitionError';
  }
}
