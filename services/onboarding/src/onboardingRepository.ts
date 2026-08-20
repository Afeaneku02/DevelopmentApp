import type { OnboardingState } from '@better-you/contracts';

export interface OnboardingRepository {
  findByUserId(userId: string): Promise<OnboardingState | null>;
  create(state: OnboardingState): Promise<OnboardingState>;
  update(state: OnboardingState): Promise<OnboardingState>;
}

// In-memory only, same adapter pattern as every other repository (ADR 0001).
export class InMemoryOnboardingRepository implements OnboardingRepository {
  private states = new Map<string, OnboardingState>();

  async findByUserId(userId: string): Promise<OnboardingState | null> {
    return this.states.get(userId) ?? null;
  }

  async create(state: OnboardingState): Promise<OnboardingState> {
    this.states.set(state.userId, state);
    return state;
  }

  async update(state: OnboardingState): Promise<OnboardingState> {
    this.states.set(state.userId, state);
    return state;
  }
}
