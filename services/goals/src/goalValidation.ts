import { GOAL_CATEGORIES, type CreateGoalInput } from '@better-you/contracts';
import { GoalValidationError } from './errors';
import { findSuggestedGoal } from './suggestedGoals';

export const TITLE_MAX_LENGTH = 200;
export const DESCRIPTION_MAX_LENGTH = 1000;

function validateText(field: string, value: string, maxLength: number, required: boolean): string {
  const trimmed = value.trim();
  if (required && trimmed.length === 0) {
    throw new GoalValidationError(field, `${field} is required`);
  }
  if (trimmed.length > maxLength) {
    throw new GoalValidationError(field, `${field} must be ${maxLength} characters or fewer`);
  }
  return trimmed;
}

// Treats input as untrusted at this boundary even though CreateGoalInput is typed,
// since real callers (future HTTP layer) won't be guaranteed to match the type at runtime.
export function validateCreateGoalInput(input: CreateGoalInput): { title: string; description: string } {
  if (!input.userId || input.userId.trim().length === 0) {
    throw new GoalValidationError('userId', 'userId is required');
  }
  if (!GOAL_CATEGORIES.includes(input.category)) {
    throw new GoalValidationError('category', `category must be one of: ${GOAL_CATEGORIES.join(', ')}`);
  }

  if (input.source === 'suggested') {
    const suggested = findSuggestedGoal(input.suggestedGoalId);
    if (!suggested) {
      throw new GoalValidationError('suggestedGoalId', `unknown suggestedGoalId: ${input.suggestedGoalId}`);
    }
    if (suggested.category !== input.category) {
      throw new GoalValidationError('category', 'category does not match the selected suggested goal');
    }
    const title = validateText('title', input.title ?? suggested.title, TITLE_MAX_LENGTH, true);
    const description = validateText(
      'description',
      input.description ?? suggested.description,
      DESCRIPTION_MAX_LENGTH,
      false
    );
    return { title, description };
  }

  if (input.source === 'custom') {
    const title = validateText('title', input.title, TITLE_MAX_LENGTH, true);
    const description = validateText('description', input.description ?? '', DESCRIPTION_MAX_LENGTH, false);
    return { title, description };
  }

  throw new GoalValidationError('source', 'source must be "suggested" or "custom"');
}
