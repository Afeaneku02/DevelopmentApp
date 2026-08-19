import { describe, it, expect } from 'vitest';
import {
  validateDisplayName,
  validateTimezone,
  validateLocale,
  validatePreferences,
  validateProfileUpdate,
} from '../profileValidation';
import { ProfileValidationError } from '../errors';

describe('validateDisplayName', () => {
  it('trims and accepts a valid name', () => {
    expect(validateDisplayName('  Jamie  ')).toBe('Jamie');
  });

  it('rejects an empty name', () => {
    expect(() => validateDisplayName('   ')).toThrow(ProfileValidationError);
  });

  it('rejects a name over the max length', () => {
    expect(() => validateDisplayName('x'.repeat(101))).toThrow(ProfileValidationError);
  });
});

describe('validateTimezone', () => {
  it('accepts a real IANA timezone', () => {
    expect(validateTimezone('America/New_York')).toBe('America/New_York');
  });

  it('rejects an unknown timezone', () => {
    expect(() => validateTimezone('Not/AZone')).toThrow(ProfileValidationError);
  });
});

describe('validateLocale', () => {
  it('accepts a valid BCP 47 locale', () => {
    expect(validateLocale('en-US')).toBe('en-US');
  });

  it('accepts a bare language tag', () => {
    expect(validateLocale('fr')).toBe('fr');
  });

  it('rejects a malformed locale tag', () => {
    expect(() => validateLocale('not a locale!!!')).toThrow(ProfileValidationError);
  });
});

describe('validatePreferences', () => {
  it('accepts a valid partial update', () => {
    expect(validatePreferences({ onboardingMode: 'dive_in' })).toEqual({ onboardingMode: 'dive_in' });
  });

  it('accepts both fields', () => {
    expect(validatePreferences({ onboardingMode: 'gradual', interactionMethod: 'voice' })).toEqual({
      onboardingMode: 'gradual',
      interactionMethod: 'voice',
    });
  });

  it('rejects an invalid onboardingMode', () => {
    expect(() => validatePreferences({ onboardingMode: 'not-a-mode' as never })).toThrow(ProfileValidationError);
  });

  it('rejects an invalid interactionMethod', () => {
    expect(() => validatePreferences({ interactionMethod: 'telepathy' as never })).toThrow(ProfileValidationError);
  });

  it('returns an empty object for an empty input', () => {
    expect(validatePreferences({})).toEqual({});
  });
});

describe('validateProfileUpdate', () => {
  it('validates only the fields present', () => {
    expect(validateProfileUpdate({ displayName: 'Jamie' })).toEqual({ displayName: 'Jamie' });
  });

  it('returns an empty object for an empty input', () => {
    expect(validateProfileUpdate({})).toEqual({});
  });

  it('validates every field when all are present', () => {
    const result = validateProfileUpdate({
      displayName: 'Jamie',
      timezone: 'UTC',
      locale: 'en-US',
      preferences: { onboardingMode: 'dive_in' },
    });
    expect(result).toEqual({
      displayName: 'Jamie',
      timezone: 'UTC',
      locale: 'en-US',
      preferences: { onboardingMode: 'dive_in' },
    });
  });

  it('propagates a validation error from a nested field', () => {
    expect(() => validateProfileUpdate({ timezone: 'Not/AZone' })).toThrow(ProfileValidationError);
  });
});
