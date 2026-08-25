import type { GoalProgress, OverallProgress } from '@better-you/contracts';
import type { CheckInsView } from './checkInsView';
import type { RoadmapView } from './roadmapView';
import { summarizeProgress } from './progressMath';
import { computeRoadmapProgress } from './roadmapProgressMath';

export class ProgressService {
  constructor(
    private readonly checkInsView: CheckInsView,
    private readonly roadmapView: RoadmapView
  ) {}

  // Across every check-in the user has ever recorded, regardless of the
  // owning goal's current status - a check-in reflects real past effort
  // even if the goal was later paused, completed, or archived.
  async getOverallProgress(userId: string): Promise<OverallProgress> {
    const checkIns = await this.checkInsView.listCheckIns(userId);
    const summary = summarizeProgress(checkIns);
    const goalsWithCheckIns = new Set(checkIns.map((checkIn) => checkIn.goalId)).size;
    return { ...summary, goalsWithCheckIns };
  }

  // getGoalCheckIns() already validates the goal exists and is owned by
  // userId (via CheckInService's own goalLookup) - a fake or foreign goalId
  // rejects before Progress does any math. Roadmap progress is read
  // directly from the Roadmap's own milestone/step status (the
  // authoritative source of that state), not replayed from Activity events
  // - Activity is a log of what happened, not a second copy of current
  // state that Progress would need to keep in sync.
  async getGoalProgress(userId: string, goalId: string): Promise<GoalProgress> {
    const { checkIns } = await this.checkInsView.getGoalCheckIns(userId, goalId);
    const summary = summarizeProgress(checkIns);
    const roadmap = await this.roadmapView.getRoadmapForGoal(userId, goalId);
    return { ...summary, goalId, roadmap: roadmap ? computeRoadmapProgress(roadmap) : null };
  }
}
