export class CheckInValidationError extends Error {
  constructor(
    public readonly field: string,
    message: string
  ) {
    super(message);
    this.name = 'CheckInValidationError';
  }
}

export class CheckInGoalNotActiveError extends Error {
  constructor() {
    super('Check-ins can only be recorded for active goals');
    this.name = 'CheckInGoalNotActiveError';
  }
}
