import type { Profile } from '@better-you/contracts';

export interface ProfileRepository {
  findByUserId(userId: string): Promise<Profile | null>;
  create(profile: Profile): Promise<Profile>;
  update(profile: Profile): Promise<Profile>;
}

// In-memory only, same adapter pattern as GoalRepository/UserRepository (ADR 0001).
export class InMemoryProfileRepository implements ProfileRepository {
  private profiles = new Map<string, Profile>();

  async findByUserId(userId: string): Promise<Profile | null> {
    return this.profiles.get(userId) ?? null;
  }

  async create(profile: Profile): Promise<Profile> {
    this.profiles.set(profile.userId, profile);
    return profile;
  }

  async update(profile: Profile): Promise<Profile> {
    this.profiles.set(profile.userId, profile);
    return profile;
  }
}
