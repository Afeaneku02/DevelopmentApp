// Same shape as GoalValidationError/ProfileValidationError, so the API's
// error handler maps it to the standard 400 VALIDATION_ERROR envelope.
export class MentorGuidanceValidationError extends Error {
  constructor(
    public readonly field: string,
    message: string
  ) {
    super(message);
    this.name = 'MentorGuidanceValidationError';
  }
}
