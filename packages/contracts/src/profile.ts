// Vision §5.2 ("Decisions Already Made"): users choose between Dive In, Gradual,
// and Guided Middle Ground onboarding, and interact via typed, voice, or both.
export type OnboardingMode = 'dive_in' | 'gradual' | 'guided_middle_ground';
export type InteractionMethod = 'typed' | 'voice' | 'blend';

export interface ProfilePreferences {
  onboardingMode: OnboardingMode;
  interactionMethod: InteractionMethod;
}

// Blueprint §5 core data: user_id, display_name, timezone, locale,
// preferences_json, onboarding_completed_at, updated_at.
export interface Profile {
  userId: string;
  displayName: string;
  timezone: string;
  locale: string;
  preferences: ProfilePreferences;
  onboardingCompletedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateProfileInput {
  displayName?: string;
  timezone?: string;
  locale?: string;
  preferences?: Partial<ProfilePreferences>;
}
