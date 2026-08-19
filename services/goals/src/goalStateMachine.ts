import type { GoalStatus } from '@better-you/contracts';

// Blueprint §7 lists exactly these four transition actions (pause, resume,
// complete, archive) - no "unarchive"/"reopen", so archived is terminal and
// completed can only move to archived.
const TRANSITIONS: Record<GoalStatus, readonly GoalStatus[]> = {
  active: ['paused', 'completed', 'archived'],
  paused: ['active', 'completed', 'archived'],
  completed: ['archived'],
  archived: [],
};

export function canTransition(from: GoalStatus, to: GoalStatus): boolean {
  return TRANSITIONS[from].includes(to);
}
