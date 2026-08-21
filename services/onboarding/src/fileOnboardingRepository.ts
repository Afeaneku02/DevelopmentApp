import type { OnboardingState } from '@better-you/contracts';
import { readJsonArray, writeJsonArrayAtomic } from '@better-you/persistence';
import type { OnboardingRepository } from './onboardingRepository';

// File-backed adapter (ADR 0016) - same semantics as InMemoryOnboardingRepository
// (one state per userId), persisted as a JSON array on disk, rehydrated into
// the same Map<userId, OnboardingState> shape in memory.
export class FileOnboardingRepository implements OnboardingRepository {
  private states: Map<string, OnboardingState>;

  constructor(private readonly filePath: string) {
    this.states = new Map(readJsonArray<OnboardingState>(filePath).map((state) => [state.userId, state]));
  }

  private persist(): void {
    writeJsonArrayAtomic(this.filePath, Array.from(this.states.values()));
  }

  async findByUserId(userId: string): Promise<OnboardingState | null> {
    return this.states.get(userId) ?? null;
  }

  async create(state: OnboardingState): Promise<OnboardingState> {
    this.states.set(state.userId, state);
    this.persist();
    return state;
  }

  async update(state: OnboardingState): Promise<OnboardingState> {
    this.states.set(state.userId, state);
    this.persist();
    return state;
  }
}
