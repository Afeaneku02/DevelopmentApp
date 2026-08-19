import { describe, it, expect } from 'vitest';
import type { CreateGoalInput } from '@better-you/contracts';
import { validateCreateGoalInput } from '../goalValidation';
import { GoalValidationError } from '../errors';

function customInput(overrides: Partial<CreateGoalInput> = {}): CreateGoalInput {
  return {
    userId: 'user-1',
    source: 'custom',
    category: 'fitness',
    title: 'Run a 5k',
    description: 'Train consistently to finish a 5k.',
    ...overrides,
  } as CreateGoalInput;
}

describe('validateCreateGoalInput', () => {
  it('accepts a valid custom goal', () => {
    const result = validateCreateGoalInput(customInput());
    expect(result.title).toBe('Run a 5k');
  });

  it('rejects an empty title', () => {
    expect(() => validateCreateGoalInput(customInput({ title: '   ' }))).toThrow(GoalValidationError);
  });

  it('rejects a title over the max length', () => {
    expect(() => validateCreateGoalInput(customInput({ title: 'x'.repeat(201) }))).toThrow(GoalValidationError);
  });

  it('rejects an invalid category', () => {
    expect(() =>
      validateCreateGoalInput(customInput({ category: 'not-a-category' as CreateGoalInput['category'] }))
    ).toThrow(GoalValidationError);
  });

  it('accepts a valid suggested goal and fills in default title/description', () => {
    const input: CreateGoalInput = {
      userId: 'user-1',
      source: 'suggested',
      category: 'fitness',
      suggestedGoalId: 'fitness-shape',
    };
    const result = validateCreateGoalInput(input);
    expect(result.title).toBe('Get in better shape');
  });

  it('allows personalizing a suggested goal title', () => {
    const input: CreateGoalInput = {
      userId: 'user-1',
      source: 'suggested',
      category: 'fitness',
      suggestedGoalId: 'fitness-shape',
      title: 'Get back in shape before summer',
    };
    const result = validateCreateGoalInput(input);
    expect(result.title).toBe('Get back in shape before summer');
  });

  it('rejects an unknown suggestedGoalId', () => {
    const input: CreateGoalInput = {
      userId: 'user-1',
      source: 'suggested',
      category: 'fitness',
      suggestedGoalId: 'does-not-exist',
    };
    expect(() => validateCreateGoalInput(input)).toThrow(GoalValidationError);
  });

  it('rejects a suggested goal whose category does not match', () => {
    const input: CreateGoalInput = {
      userId: 'user-1',
      source: 'suggested',
      category: 'career',
      suggestedGoalId: 'fitness-shape',
    };
    expect(() => validateCreateGoalInput(input)).toThrow(GoalValidationError);
  });
});
