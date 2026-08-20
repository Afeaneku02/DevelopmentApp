import { useEffect, useState } from 'react';
import type { OnboardingState } from '@better-you/contracts';
import { AuthProvider, useAuth } from './auth/AuthContext';
import * as onboardingApi from './api/onboardingApi';
import { ApiError } from './api/client';
import AuthScreen from './screens/AuthScreen';
import GoalsScreen from './screens/GoalsScreen';
import ProfileScreen from './screens/ProfileScreen';
import OnboardingFlow from './screens/OnboardingFlow';

type View = 'goals' | 'profile';

function AppShell() {
  const { user, token } = useAuth();
  const [view, setView] = useState<View>('goals');
  const [onboarding, setOnboarding] = useState<OnboardingState | null>(null);
  const [loadingOnboarding, setLoadingOnboarding] = useState(true);
  const [onboardingLoadError, setOnboardingLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    setLoadingOnboarding(true);
    setOnboardingLoadError(null);
    onboardingApi
      .getOnboardingState(token)
      .then(({ onboarding: state }) => {
        setOnboarding(state);
      })
      .catch((err) => {
        setOnboardingLoadError(err instanceof ApiError ? err.message : 'Could not load your account');
      })
      .finally(() => {
        setLoadingOnboarding(false);
      });
  }, [token]);

  if (!user) {
    return <AuthScreen />;
  }

  if (onboardingLoadError) {
    return <p className="error">{onboardingLoadError}</p>;
  }

  if (loadingOnboarding || !onboarding) {
    return <p className="loading">Loading…</p>;
  }

  // 'awaiting_roadmap' means first-run onboarding is done for what this
  // milestone builds (not Blueprint §6 "complete" - see ADR 0010) - from
  // here on, the main app is home.
  if (onboarding.currentStep !== 'awaiting_roadmap') {
    return <OnboardingFlow state={onboarding} onStateChange={setOnboarding} />;
  }

  if (view === 'profile') {
    return <ProfileScreen onBack={() => setView('goals')} />;
  }
  return <GoalsScreen onOpenProfile={() => setView('profile')} />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
