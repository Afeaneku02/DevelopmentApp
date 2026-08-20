import type { OnboardingState } from '@better-you/contracts';
import { apiFetch } from './client';

export function getOnboardingState(token: string): Promise<{ onboarding: OnboardingState }> {
  return apiFetch('/api/v1/onboarding', { token });
}

export function nextOnboardingStep(token: string): Promise<{ onboarding: OnboardingState }> {
  return apiFetch('/api/v1/onboarding/next', { method: 'POST', token });
}

export function recordFirstGoal(token: string, goalId: string): Promise<{ onboarding: OnboardingState }> {
  return apiFetch('/api/v1/onboarding/first-goal', { method: 'POST', token, body: { goalId } });
}
