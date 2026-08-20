import { useState } from 'react';
import { ONBOARDING_STEPS, type Goal, type OnboardingState } from '@better-you/contracts';
import { useAuth } from '../auth/AuthContext';
import * as onboardingApi from '../api/onboardingApi';
import { ApiError } from '../api/client';
import WelcomeStep from '../onboarding/WelcomeStep';
import ConsentStep from '../onboarding/ConsentStep';
import ProfileBasicsStep from '../onboarding/ProfileBasicsStep';
import PreferencesStep from '../onboarding/PreferencesStep';
import FirstGoalStep from '../onboarding/FirstGoalStep';

// The step shown to a user, never the true Blueprint §6 "onboarding complete"
// state - reaching 'awaiting_roadmap' just means App.tsx switches away from
// this flow, since there's nothing further this milestone renders here.
const VISIBLE_STEPS = ONBOARDING_STEPS.filter((step) => step !== 'awaiting_roadmap');

interface OnboardingFlowProps {
  state: OnboardingState;
  onStateChange: (state: OnboardingState) => void;
}

export default function OnboardingFlow({ state, onStateChange }: OnboardingFlowProps) {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function advance() {
    if (!token) return;
    setError(null);
    setLoading(true);
    try {
      const { onboarding } = await onboardingApi.nextOnboardingStep(token);
      onStateChange(onboarding);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  async function handleFirstGoalCreated(goal: Goal) {
    if (!token) return;
    setError(null);
    setLoading(true);
    try {
      await onboardingApi.recordFirstGoal(token, goal.id);
      const { onboarding } = await onboardingApi.nextOnboardingStep(token);
      onStateChange(onboarding);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  const stepIndex = ONBOARDING_STEPS.indexOf(state.currentStep);

  return (
    <div className="onboarding-page">
      <div className="horizon-band" aria-hidden="true" />

      <p className="onboarding-progress">
        Step {stepIndex + 1} of {VISIBLE_STEPS.length}
      </p>

      {state.currentStep === 'welcome' && <WelcomeStep onNext={advance} loading={loading} />}
      {state.currentStep === 'consent' && <ConsentStep onNext={advance} loading={loading} />}
      {state.currentStep === 'profile_basics' && <ProfileBasicsStep onNext={advance} loading={loading} />}
      {state.currentStep === 'preferences' && <PreferencesStep onNext={advance} loading={loading} />}
      {state.currentStep === 'first_goal' && <FirstGoalStep onGoalCreated={handleFirstGoalCreated} />}

      {error && <p className="error">{error}</p>}
    </div>
  );
}
