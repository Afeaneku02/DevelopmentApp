import type { Roadmap, RoadmapProgress } from '@better-you/contracts';

// Purely deterministic counting over a Roadmap's own milestone/action-step
// status fields - no AI, no interpretation, no signal beyond what's directly
// countable. Roadmap's own validation (MIN_MILESTONES/each milestone
// requiring at least one action step) means a real, persisted Roadmap always
// has totalActionSteps >= 1, but stepCompletionPercentage is still guarded
// against division by zero for robustness against any future relaxation of
// that rule.
export function computeRoadmapProgress(roadmap: Roadmap): RoadmapProgress {
  const totalMilestones = roadmap.milestones.length;
  const completedMilestones = roadmap.milestones.filter((milestone) => milestone.status === 'completed').length;

  const totalActionSteps = roadmap.milestones.reduce((sum, milestone) => sum + milestone.actionSteps.length, 0);
  const completedActionSteps = roadmap.milestones.reduce(
    (sum, milestone) => sum + milestone.actionSteps.filter((step) => step.status === 'completed').length,
    0
  );

  const stepCompletionPercentage =
    totalActionSteps === 0 ? 0 : Math.round((completedActionSteps / totalActionSteps) * 100);

  return { totalMilestones, completedMilestones, totalActionSteps, completedActionSteps, stepCompletionPercentage };
}
