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
