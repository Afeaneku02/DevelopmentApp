import { MAX_ACTIVE_GOALS, type ActionStep, type Goal, type Milestone, type NextAction, type Roadmap } from '@better-you/contracts';

// Placeholder heuristic, not a Vision/Blueprint-specified number - unlike
// MAX_ACTIVE_GOALS (Vision §22.1), this threshold is our own reasonable
// default, easy to tune or replace once a real Progress/Check-ins signal
// exists instead of "time since a goal's status last changed."
const STALE_ACTIVE_GOAL_MS = 7 * 24 * 60 * 60 * 1000;

function findNextPendingActionStep(roadmap: Roadmap): { milestone: Milestone; actionStep: ActionStep } | null {
  for (const milestone of roadmap.milestones) {
    if (milestone.status === 'completed') continue;
    const actionStep = milestone.actionSteps.find((step) => step.status === 'pending');
    if (actionStep) {
      return { milestone, actionStep };
    }
  }
  return null;
}

// Priority order reflects Vision §1/§20's "consistency over adding more":
// address a stalled goal (paused, then stale-active) before continuing an
// existing roadmap, and continue an existing roadmap before ever suggesting
// a new commitment. Purely rule-based over Goal/Roadmap data - not the AI
// "coach summary" Blueprint §10 separately describes.
export function computeNextAction(activeGoals: Goal[], pausedGoals: Goal[], roadmaps: Roadmap[], now: Date): NextAction {
  if (pausedGoals.length > 0) {
    const oldestPaused = [...pausedGoals].sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))[0];
    return {
      type: 'resume_goal',
      goalId: oldestPaused.id,
      message: `"${oldestPaused.title}" is paused — resume it, or archive it if it's no longer a priority.`,
    };
  }

  const stale = activeGoals.find(
    (goal) => now.getTime() - new Date(goal.updatedAt).getTime() > STALE_ACTIVE_GOAL_MS
  );
  if (stale) {
    return {
      type: 'review_goal',
      goalId: stale.id,
      message: `"${stale.title}" hasn't been updated in a while — take a look.`,
    };
  }

  for (const goal of activeGoals) {
    const roadmap = roadmaps.find((candidate) => candidate.goalId === goal.id && candidate.status === 'active');
    if (!roadmap) continue;
    const next = findNextPendingActionStep(roadmap);
    if (next) {
      return {
        type: 'continue_roadmap',
        goalId: goal.id,
        roadmapId: roadmap.id,
        actionStepId: next.actionStep.id,
        message: `Next step toward "${goal.title}": ${next.actionStep.title}`,
      };
    }
  }

  if (activeGoals.length < MAX_ACTIVE_GOALS) {
    const remaining = MAX_ACTIVE_GOALS - activeGoals.length;
    return {
      type: 'add_goal',
      message: `You have room for ${remaining} more active goal${remaining === 1 ? '' : 's'}.`,
    };
  }

  return {
    type: 'none',
    message: "You're actively working on all three goals — keep going.",
  };
}
