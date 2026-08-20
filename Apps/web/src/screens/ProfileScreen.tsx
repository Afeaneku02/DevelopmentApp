import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { InteractionMethod, OnboardingMode, Profile } from '@better-you/contracts';
import { useAuth } from '../auth/AuthContext';
import * as profileApi from '../api/profileApi';
import { ApiError } from '../api/client';
import {
  TIMEZONE_OPTIONS,
  LOCALE_OPTIONS,
  ONBOARDING_MODE_OPTIONS,
  INTERACTION_METHOD_OPTIONS,
} from '../constants/profileOptions';

interface ProfileScreenProps {
  onBack: () => void;
}

export default function ProfileScreen({ onBack }: ProfileScreenProps) {
  const { token } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [timezone, setTimezone] = useState('UTC');
  const [locale, setLocale] = useState('en-US');
  const [onboardingMode, setOnboardingMode] = useState<OnboardingMode>('guided_middle_ground');
  const [interactionMethod, setInteractionMethod] = useState<InteractionMethod>('typed');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  function applyProfile(loaded: Profile) {
    setProfile(loaded);
    setDisplayName(loaded.displayName);
    setTimezone(loaded.timezone);
    setLocale(loaded.locale);
    setOnboardingMode(loaded.preferences.onboardingMode);
    setInteractionMethod(loaded.preferences.interactionMethod);
  }

  useEffect(() => {
    if (!token) return;
    profileApi.getProfile(token).then(({ profile: loaded }) => {
      applyProfile(loaded);
      setLoading(false);
    });
  }, [token]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!token) return;
    setError(null);
    setFieldErrors({});
    setSaved(false);
    setSaving(true);
    try {
      const { profile: updated } = await profileApi.updateProfile(token, {
        displayName,
        timezone,
        locale,
        preferences: { onboardingMode, interactionMethod },
      });
      applyProfile(updated);
      setSaved(true);
    } catch (err) {
      if (err instanceof ApiError && err.field) {
        setFieldErrors({ [err.field]: err.message });
      } else if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Something went wrong');
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading || !profile) {
    return (
      <div className="profile-page">
        <div className="horizon-band" aria-hidden="true" />
        <p className="loading">Loading your profile…</p>
      </div>
    );
  }

  return (
    <div className="profile-page">
      <div className="horizon-band" aria-hidden="true" />

      <header className="profile-header">
        <button className="back-link" onClick={onBack}>
          ← Back to goals
        </button>
        <h1>Your Profile</h1>
        <p className="subtitle">This is how Better You knows and talks to you.</p>
      </header>

      <form onSubmit={handleSubmit}>
        <section className="profile-section">
          <h2>Identity</h2>
          <label className="field">
            <span>Display name</span>
            <input
              type="text"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="What should we call you?"
              maxLength={100}
            />
            {fieldErrors.displayName && <span className="field-error">{fieldErrors.displayName}</span>}
          </label>
        </section>

        <section className="profile-section">
          <h2>Locale &amp; time</h2>
          <label className="field">
            <span>Timezone</span>
            <select value={timezone} onChange={(event) => setTimezone(event.target.value)}>
              {TIMEZONE_OPTIONS.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
            {fieldErrors.timezone && <span className="field-error">{fieldErrors.timezone}</span>}
          </label>

          <label className="field">
            <span>Language &amp; region</span>
            <select value={locale} onChange={(event) => setLocale(event.target.value)}>
              {LOCALE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {fieldErrors.locale && <span className="field-error">{fieldErrors.locale}</span>}
          </label>
        </section>

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

        <div className="profile-actions">
          <button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          {saved && <span className="info">Saved.</span>}
          {error && <span className="error">{error}</span>}
        </div>
      </form>
    </div>
  );
}
