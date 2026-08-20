// Minimal structural interface for the one thing this domain needs from
// Goals - GoalService already satisfies this shape, so the concrete
// implementation is passed in without services/onboarding depending on the
// whole @better-you/goals package surface (same dependency-inversion pattern
// as GoalRepository/ProfileRepository/AuthProvider elsewhere in this codebase).
export interface GoalLookup {
  getGoal(userId: string, goalId: string): Promise<unknown>;
}
