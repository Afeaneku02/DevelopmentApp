import { useEffect, useState } from 'react';
import type { InteractionMethod, OnboardingMode } from '@better-you/contracts';
import { useAuth } from '../auth/AuthContext';
import * as profileApi from '../api/profileApi';
import { ApiError } from '../api/client';
import { ONBOARDING_MODE_OPTIONS, INTERACTION_METHOD_OPTIONS } from '../constants/profileOptions';

interface PreferencesStepProps {
  onNext: () => void;
  loading: boolean;
}

export default function PreferencesStep({ onNext, loading }: PreferencesStepProps) {
  const { token } = useAuth();
  const [onboardingMode, setOnboardingMode] = useState<OnboardingMode>('guided_middle_ground');
  const [interactionMethod, setInteractionMethod] = useState<InteractionMethod>('typed');
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    profileApi
      .getProfile(token)
      .then(({ profile }) => {
        setOnboardingMode(profile.preferences.onboardingMode);
        setInteractionMethod(profile.preferences.interactionMethod);
        setReady(true);
      })
      .catch((err) => {
        setLoadError(err instanceof ApiError ? err.message : 'Could not load your preferences');
      });
  }, [token]);

  async function handleContinue() {
    if (!token) return;
    setError(null);
    setSaving(true);
    try {
      await profileApi.updateProfile(token, { preferences: { onboardingMode, interactionMethod } });
      onNext();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  if (loadError) {
    return <p className="error">{loadError}</p>;
  }

  if (!ready) {
    return <p className="loading">Loading…</p>;
  }

  return (
    <div className="onboarding-step">
      <h1>How should this work?</h1>
      <p className="subtitle">You can always change these later from your profile.</p>

      <section className="profile-section">
        <h2>How Better You learns about you</h2>
        <div className="option-cards">
          {ONBOARDING_MODE_OPTIONS.map((option) => (
            <button
              type="button"
              key={option.value}
              className={`option-card ${onboardingMode === option.value ? 'selected' : ''}`}
              onClick={() => setOnboardingMode(option.value)}
            >
              <span className="option-card-title">
                {option.label}
                {option.recommended && <span className="recommended-badge">Recommended</span>}
              </span>
              <span className="option-card-description">{option.description}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="profile-section">
        <h2>How you&apos;ll interact with Better You</h2>
        <div className="option-cards">
          {INTERACTION_METHOD_OPTIONS.map((option) => (
            <button
              type="button"
              key={option.value}
              className={`option-card ${interactionMethod === option.value ? 'selected' : ''}`}
              onClick={() => setInteractionMethod(option.value)}
            >
              <span className="option-card-title">{option.label}</span>
              <span className="option-card-description">{option.description}</span>
              {option.note && <span className="option-card-note">{option.note}</span>}
            </button>
          ))}
        </div>
      </section>

      <button onClick={handleContinue} disabled={saving || loading}>
        Continue
      </button>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
