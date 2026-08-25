import { describe, it, expect } from 'vitest';
import type { CheckIn, CheckInResponse, Goal, GoalCheckInsView, Roadmap } from '@better-you/contracts';
import { ProgressService } from '../progressService';
import type { CheckInsView } from '../checkInsView';
import type { RoadmapView } from '../roadmapView';

class GoalNotFoundError extends Error {}

class FakeCheckInsView implements CheckInsView {
  private checkIns: CheckIn[] = [];
  private goals = new Map<string, Goal>();
  private counter = 0;

  setGoal(goal: Goal): void {
    this.goals.set(goal.id, goal);
  }

  addCheckIn(userId: string, goalId: string, response: CheckInResponse, createdAt: string): void {
    this.counter += 1;
    this.checkIns.push({ id: `check-in-${this.counter}`, userId, goalId, response, note: '', createdAt });
  }

  async listCheckIns(userId: string): Promise<CheckIn[]> {
    return this.checkIns.filter((checkIn) => checkIn.userId === userId);
  }

  async getGoalCheckIns(userId: string, goalId: string): Promise<GoalCheckInsView> {
    const goal = this.goals.get(goalId);
    if (!goal || goal.userId !== userId) {
      throw new GoalNotFoundError('Goal not found');
    }
    const checkIns = this.checkIns.filter((checkIn) => checkIn.userId === userId && checkIn.goalId === goalId);
    return {
      goal,
      checkIns,
      summary: { totalCount: checkIns.length, responseCounts: { yes: 0, no: 0, partly: 0, skipped: 0 } },
    };
  }
}

class FakeRoadmapView implements RoadmapView {
  private roadmaps = new Map<string, Roadmap>();

  setRoadmap(roadmap: Roadmap): void {
    this.roadmaps.set(roadmap.goalId, roadmap);
  }

  async getRoadmapForGoal(_userId: string, goalId: string): Promise<Roadmap | null> {
    return this.roadmaps.get(goalId) ?? null;
  }
}

function makeGoal(overrides: Partial<Goal>): Goal {
  return {
    id: 'goal-1',
    userId: 'user-1',
    title: 'A goal',
    description: '',
    category: 'career',
    source: 'custom',
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeRoadmap(goalId: string): Roadmap {
  return {
    id: 'roadmap-1',
    userId: 'user-1',
    goalId,
    status: 'active',
    milestones: [
      {
        id: 'm1',
        title: 'Milestone one',
        description: '',
        status: 'active',
        actionSteps: [
          { id: 's1', title: 'Step one', description: '', status: 'completed' },
          { id: 's2', title: 'Step two', description: '', status: 'pending' },
        ],
      },
    ],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('ProgressService', () => {
  it('computes overall progress across every goal the user has checked in on', async () => {
    const view = new FakeCheckInsView();
    view.setGoal(makeGoal({ id: 'goal-1' }));
    view.setGoal(makeGoal({ id: 'goal-2' }));
    view.addCheckIn('user-1', 'goal-1', 'yes', '2026-01-01T00:00:00.000Z');
    view.addCheckIn('user-1', 'goal-2', 'no', '2026-01-02T00:00:00.000Z');
    view.addCheckIn('user-2', 'goal-1', 'yes', '2026-01-03T00:00:00.000Z');

    const service = new ProgressService(view, new FakeRoadmapView());
    const overall = await service.getOverallProgress('user-1');

    expect(overall.totalCheckIns).toBe(2);
    expect(overall.goalsWithCheckIns).toBe(2);
    expect(overall.consistency).toBeCloseTo(0.5, 5);
  });

  it('returns zeroed overall progress for a user with no check-ins', async () => {
    const service = new ProgressService(new FakeCheckInsView(), new FakeRoadmapView());
    const overall = await service.getOverallProgress('user-1');
    expect(overall.totalCheckIns).toBe(0);
    expect(overall.goalsWithCheckIns).toBe(0);
    expect(overall.consistency).toBeNull();
  });

  it('computes per-goal progress scoped to that goal only', async () => {
    const view = new FakeCheckInsView();
    view.setGoal(makeGoal({ id: 'goal-1' }));
    view.setGoal(makeGoal({ id: 'goal-2' }));
    view.addCheckIn('user-1', 'goal-1', 'yes', '2026-01-01T00:00:00.000Z');
    view.addCheckIn('user-1', 'goal-2', 'no', '2026-01-02T00:00:00.000Z');

    const service = new ProgressService(view, new FakeRoadmapView());
    const progress = await service.getGoalProgress('user-1', 'goal-1');

    expect(progress.goalId).toBe('goal-1');
    expect(progress.totalCheckIns).toBe(1);
    expect(progress.consistency).toBe(1);
  });

  it('rejects a goal owned by someone else', async () => {
    const view = new FakeCheckInsView();
    view.setGoal(makeGoal({ id: 'goal-1', userId: 'user-2' }));

    const service = new ProgressService(view, new FakeRoadmapView());
    await expect(service.getGoalProgress('user-1', 'goal-1')).rejects.toThrow(GoalNotFoundError);
  });

  it('returns roadmap: null for a goal with no roadmap yet', async () => {
    const checkIns = new FakeCheckInsView();
    checkIns.setGoal(makeGoal({ id: 'goal-1' }));

    const service = new ProgressService(checkIns, new FakeRoadmapView());
    const progress = await service.getGoalProgress('user-1', 'goal-1');

    expect(progress.roadmap).toBeNull();
  });

  it('includes computed roadmap progress for a goal that has one', async () => {
    const checkIns = new FakeCheckInsView();
    checkIns.setGoal(makeGoal({ id: 'goal-1' }));
    const roadmaps = new FakeRoadmapView();
    roadmaps.setRoadmap(makeRoadmap('goal-1'));

    const service = new ProgressService(checkIns, roadmaps);
    const progress = await service.getGoalProgress('user-1', 'goal-1');

    expect(progress.roadmap).toEqual({
      totalMilestones: 1,
      completedMilestones: 0,
      totalActionSteps: 2,
      completedActionSteps: 1,
      stepCompletionPercentage: 50,
    });
  });

  it('reflects roadmap progress after completing more steps', async () => {
    const checkIns = new FakeCheckInsView();
    checkIns.setGoal(makeGoal({ id: 'goal-1' }));
    const roadmaps = new FakeRoadmapView();
    const roadmap = makeRoadmap('goal-1');
    roadmaps.setRoadmap(roadmap);

    const service = new ProgressService(checkIns, roadmaps);
    const before = await service.getGoalProgress('user-1', 'goal-1');
    expect(before.roadmap?.stepCompletionPercentage).toBe(50);

    // Simulate the second step being completed (RoadmapService's own
    // responsibility elsewhere) and re-fetch.
    roadmaps.setRoadmap({
      ...roadmap,
      status: 'completed',
      milestones: [{ ...roadmap.milestones[0], status: 'completed', actionSteps: roadmap.milestones[0].actionSteps.map((s) => ({ ...s, status: 'completed' })) }],
    });

    const after = await service.getGoalProgress('user-1', 'goal-1');
    expect(after.roadmap).toEqual({
      totalMilestones: 1,
      completedMilestones: 1,
      totalActionSteps: 2,
      completedActionSteps: 2,
      stepCompletionPercentage: 100,
    });
  });
});
