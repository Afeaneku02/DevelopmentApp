import type { ErrorRequestHandler } from 'express';
import {
  AuthValidationError,
  EmailAlreadyInUseError,
  InvalidCredentialsError,
  SessionInvalidError,
} from '@better-you/auth';
import {
  GoalLimitExceededError,
  GoalNotFoundError,
  GoalValidationError,
  InvalidGoalTransitionError,
} from '@better-you/goals';
import { ProfileValidationError } from '@better-you/profile';
import { OnboardingAtFinalStepError, OnboardingValidationError } from '@better-you/onboarding';
import { BadRequestError } from '../errors';

// Blueprint §2: consistent error envelope. Never leak internal error details
// to the client - unrecognized errors log server-side and return a generic 500.
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Malformed JSON body' } });
    return;
  }
  if (err instanceof BadRequestError) {
    res.status(400).json({ error: { code: 'BAD_REQUEST', message: err.message } });
    return;
  }
  if (err instanceof AuthValidationError || err instanceof GoalValidationError || err instanceof ProfileValidationError) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: err.message, field: err.field } });
    return;
  }
  if (err instanceof EmailAlreadyInUseError) {
    res.status(409).json({ error: { code: 'EMAIL_IN_USE', message: err.message } });
    return;
  }
  if (err instanceof GoalLimitExceededError) {
    res.status(409).json({ error: { code: 'GOAL_LIMIT_EXCEEDED', message: err.message } });
    return;
  }
  if (err instanceof InvalidGoalTransitionError) {
    res.status(409).json({ error: { code: 'INVALID_GOAL_TRANSITION', message: err.message } });
    return;
  }
  if (err instanceof GoalNotFoundError) {
    res.status(404).json({ error: { code: 'GOAL_NOT_FOUND', message: err.message } });
    return;
  }
  if (err instanceof OnboardingValidationError) {
    res.status(400).json({ error: { code: 'ONBOARDING_VALIDATION_ERROR', message: err.message } });
    return;
  }
  if (err instanceof OnboardingAtFinalStepError) {
    res.status(409).json({ error: { code: 'ONBOARDING_AT_FINAL_STEP', message: err.message } });
    return;
  }
  if (err instanceof InvalidCredentialsError || err instanceof SessionInvalidError) {
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: err.message } });
    return;
  }

  console.error('Unhandled API error:', err);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
};
