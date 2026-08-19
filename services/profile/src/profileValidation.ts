import type { InteractionMethod, OnboardingMode, ProfilePreferences, UpdateProfileInput } from '@better-you/contracts';
import { ProfileValidationError } from './errors';

export const DISPLAY_NAME_MAX_LENGTH = 100;

const ONBOARDING_MODES: readonly OnboardingMode[] = ['dive_in', 'gradual', 'guided_middle_ground'];
const INTERACTION_METHODS: readonly InteractionMethod[] = ['typed', 'voice', 'blend'];

export function validateDisplayName(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new ProfileValidationError('displayName', 'displayName cannot be empty');
  }
  if (trimmed.length > DISPLAY_NAME_MAX_LENGTH) {
    throw new ProfileValidationError('displayName', `displayName must be ${DISPLAY_NAME_MAX_LENGTH} characters or fewer`);
  }
  return trimmed;
}

// Intl.supportedValuesOf('timeZone') looks like the obvious way to validate this,
// but its enumeration excludes some values Intl itself otherwise treats as fully
// valid - notably 'UTC' itself (confirmed empirically; see the Profile domain
// lessons-learned entry). Constructing a DateTimeFormat and catching the
// RangeError it throws for a genuinely invalid zone is the complete check.
export function validateTimezone(value: string): string {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return value;
  } catch {
    throw new ProfileValidationError('timezone', `unknown IANA timezone: ${value}`);
  }
}

// Validates BCP 47 syntax only (via Intl's own canonicalization), not that the
// locale is a real, populated locale - a reasonable minimal bar without a
// locale-data dependency.
export function validateLocale(value: string): string {
  try {
    const [canonical] = Intl.getCanonicalLocales(value);
    if (!canonical) {
      throw new Error('empty');
    }
    return canonical;
  } catch {
    throw new ProfileValidationError('locale', `invalid locale tag: ${value}`);
  }
}

export function validatePreferences(value: Partial<ProfilePreferences>): Partial<ProfilePreferences> {
  const result: Partial<ProfilePreferences> = {};

  if (value.onboardingMode !== undefined) {
    if (!ONBOARDING_MODES.includes(value.onboardingMode)) {
      throw new ProfileValidationError(
        'preferences.onboardingMode',
        `onboardingMode must be one of: ${ONBOARDING_MODES.join(', ')}`
      );
    }
    result.onboardingMode = value.onboardingMode;
  }

  if (value.interactionMethod !== undefined) {
    if (!INTERACTION_METHODS.includes(value.interactionMethod)) {
      throw new ProfileValidationError(
        'preferences.interactionMethod',
        `interactionMethod must be one of: ${INTERACTION_METHODS.join(', ')}`
      );
    }
    result.interactionMethod = value.interactionMethod;
  }

  return result;
}

export interface ValidatedProfileUpdate {
  displayName?: string;
  timezone?: string;
  locale?: string;
  preferences?: Partial<ProfilePreferences>;
}

export function validateProfileUpdate(input: UpdateProfileInput): ValidatedProfileUpdate {
  const result: ValidatedProfileUpdate = {};

  if (input.displayName !== undefined) {
    result.displayName = validateDisplayName(input.displayName);
  }
  if (input.timezone !== undefined) {
    result.timezone = validateTimezone(input.timezone);
  }
  if (input.locale !== undefined) {
    result.locale = validateLocale(input.locale);
  }
  if (input.preferences !== undefined) {
    result.preferences = validatePreferences(input.preferences);
  }

  return result;
}
