import type { Profile } from '@better-you/contracts';
import { readJsonArray, writeJsonArrayAtomic } from '@better-you/persistence';
import type { ProfileRepository } from './profileRepository';

// File-backed adapter (ADR 0016) - same semantics as InMemoryProfileRepository
// (one profile per userId), persisted as a JSON array of profiles on disk,
// rehydrated into the same Map<userId, Profile> shape in memory.
export class FileProfileRepository implements ProfileRepository {
  private profiles: Map<string, Profile>;

  constructor(private readonly filePath: string) {
    this.profiles = new Map(readJsonArray<Profile>(filePath).map((profile) => [profile.userId, profile]));
  }

  private persist(): void {
    writeJsonArrayAtomic(this.filePath, Array.from(this.profiles.values()));
  }

  async findByUserId(userId: string): Promise<Profile | null> {
    return this.profiles.get(userId) ?? null;
  }

  async create(profile: Profile): Promise<Profile> {
    this.profiles.set(profile.userId, profile);
    this.persist();
    return profile;
  }

  async update(profile: Profile): Promise<Profile> {
    this.profiles.set(profile.userId, profile);
    this.persist();
    return profile;
  }
}
