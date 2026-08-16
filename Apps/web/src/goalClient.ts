import { GoalService, InMemoryGoalRepository } from '@better-you/goals';
import { getStubUserId } from '@better-you/config';

// Single in-memory instance for this browser tab. There is no API layer yet
// (ADR 0002), so this does not persist across reloads or sync across tabs.
export const goalService = new GoalService(new InMemoryGoalRepository());
export const currentUserId = getStubUserId();
