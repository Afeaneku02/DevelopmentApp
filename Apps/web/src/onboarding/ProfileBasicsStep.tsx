import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../auth/AuthContext';
import * as profileApi from '../api/profileApi';
import { ApiError } from '../api/client';
import { TIMEZONE_OPTIONS, LOCALE_OPTIONS } from '../constants/profileOptions';

interface ProfileBasicsStepProps {
  onNext: () => void;
  loading: boolean;
}

export default function ProfileBasicsStep({ onNext, loading }: ProfileBasicsStepProps) {
  const { token } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [timezone, setTimezone] = useState('UTC');
  const [locale, setLocale] = useState('en-US');
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!token) return;
    profileApi
      .getProfile(token)
      .then(({ profile }) => {
        setDisplayName(profile.displayName);
        setTimezone(profile.timezone);
        setLocale(profile.locale);
        setReady(true);
      })
      .catch((err) => {
        setLoadError(err instanceof ApiError ? err.message : 'Could not load your profile');
      });
  }, [token]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!token) return;
    setError(null);
    setFieldErrors({});
    setSaving(true);
    try {
      await profileApi.updateProfile(token, { displayName, timezone, locale });
      onNext();
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

  if (loadError) {
    return <p className="error">{loadError}</p>;
  }

  if (!ready) {
    return <p className="loading">Loading…</p>;
  }

  return (
    <div className="onboarding-step">
      <h1>A little about you</h1>
      <p className="subtitle">This is how Better You will refer to you and schedule around your time.</p>

      <form onSubmit={handleSubmit}>
        <label className="field">
          <span>Display name</span>
          <input
            type="text"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="What should we call you?"
            maxLength={100}
            required
          />
          {fieldErrors.displayName && <span className="field-error">{fieldErrors.displayName}</span>}
        </label>

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

        <button type="submit" disabled={saving || loading}>
          Continue
        </button>
        {error && <p className="error">{error}</p>}
      </form>
    </div>
  );
}
