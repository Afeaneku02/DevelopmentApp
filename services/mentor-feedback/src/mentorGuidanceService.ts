import type { Goal, MentorGuidanceResult } from '@better-you/contracts';
import type { MentorGuidanceClient } from './mentorGuidanceClient';
import { buildMentorGuidanceInput, validateMentorGuidanceClarifications } from './mentorGuidanceInput';

// Structural subset of GoalService, same pattern as Roadmap's GoalLookup.
// GoalService.getGoal() enforces ownership (generic 404 for someone else's
// goal), so guidance can only ever be requested about the caller's own goal.
export interface MentorGuidanceGoalLookup {
  getGoal(userId: string, goalId: string): Promise<Goal>;
}

// No persistence (ADR 0029): guidance is shown, not stored, and this service
// never writes to Goals, Roadmap, Check-ins, Profile, or Activity.
// Clarification turns are forwarded for this one request only - there is no
// conversation state here; the web panel owns the (per-interaction) context
// and resends it each time.
export class MentorGuidanceService {
  constructor(
    private readonly goalLookup: MentorGuidanceGoalLookup,
    private readonly client: MentorGuidanceClient
  ) {}

  async getGuidance(userId: string, goalId: string, clarifications?: unknown): Promise<MentorGuidanceResult> {
    // Ownership first, so someone else's goal is a 404 whatever the turns
    // look like; then the turns are validated before anything is sent.
    const goal = await this.goalLookup.getGoal(userId, goalId);
    const validTurns = validateMentorGuidanceClarifications(clarifications);
    return this.client.getGuidance(userId, buildMentorGuidanceInput(goal, validTurns));
  }
}
