import type { Profile, UpdateProfileInput } from '@better-you/contracts';
import { validateProfileUpdate } from './profileValidation';
import type { ProfileRepository } from './profileRepository';

// Defaults chosen from Vision §5.2/"Decisions Already Made": Guided Middle
// Ground is the recommended default for most users, and typed is the only
// interaction method actually implemented in this MVP (voice isn't built yet).
function buildDefaultProfile(userId: string, now: Date): Profile {
  const timestamp = now.toISOString();
  return {
    userId,
    displayName: '',
    timezone: 'UTC',
    locale: 'en-US',
    preferences: {
      onboardingMode: 'guided_middle_ground',
      interactionMethod: 'typed',
    },
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export class ProfileService {
  constructor(
    private readonly repository: ProfileRepository,
    private readonly now: () => Date = () => new Date()
  ) {}

  // Blueprint §5 names no explicit createProfile() - a profile is lazily
  // created with defaults on first access, so "profile loads after sign-in"
  // holds without a separate creation step or endpoint.
  async getProfile(userId: string): Promise<Profile> {
    const existing = await this.repository.findByUserId(userId);
    if (existing) {
      return existing;
    }
    return this.repository.create(buildDefaultProfile(userId, this.now()));
  }

  async updateProfile(userId: string, input: UpdateProfileInput): Promise<Profile> {
    const current = await this.getProfile(userId);
    const validated = validateProfileUpdate(input);

    const updated: Profile = {
      ...current,
      ...validated,
      // Partial preference updates merge into existing preferences rather than
      // replacing them, so defaults for untouched keys survive (Blueprint §5:
      // "preferences have explicit defaults").
      preferences: { ...current.preferences, ...validated.preferences },
      updatedAt: this.now().toISOString(),
    };

    return this.repository.update(updated);
  }
}
