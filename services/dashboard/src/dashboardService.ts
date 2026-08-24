import type { DashboardView } from '@better-you/contracts';
import { computeNextAction } from './nextAction';
import type { GoalsView } from './goalsView';
import type { RoadmapsView } from './roadmapsView';

export class DashboardService {
  constructor(
    private readonly goalsView: GoalsView,
    private readonly roadmapsView: RoadmapsView,
    private readonly now: () => Date = () => new Date()
  ) {}

  // Blueprint §10 business rules: "prioritize active/urgent items," "empty
  // states are intentional," "dashboard never invents progress" - every
  // field here is a direct read or simple derivation from real Goal/Roadmap
  // data, never a duplicated/cached source of truth.
  async getDashboard(userId: string): Promise<DashboardView> {
    const [goals, roadmaps] = await Promise.all([
      this.goalsView.listGoals(userId),
      this.roadmapsView.listRoadmaps(userId),
    ]);
    const activeGoals = goals.filter((goal) => goal.status === 'active');
    const pausedGoals = goals.filter((goal) => goal.status === 'paused');
    // Counts current status only - a goal completed and later archived no
    // longer counts here. Proper "ever completed" tracking belongs to the
    // future Progress domain, not invented ad hoc in Dashboard.
    const completedGoalsCount = goals.filter((goal) => goal.status === 'completed').length;
    const now = this.now();

    return {
      activeGoals,
      pausedGoals,
      completedGoalsCount,
      totalGoalsCount: goals.length,
      roadmaps,
      nextAction: computeNextAction(activeGoals, pausedGoals, roadmaps, now),
      generatedAt: now.toISOString(),
    };
  }
}
