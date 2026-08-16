import type { Goal } from '@better-you/contracts';

export interface GoalRepository {
  create(goal: Goal): Promise<Goal>;
  listByUser(userId: string): Promise<Goal[]>;
  countActiveByUser(userId: string): Promise<number>;
}

// In-memory only. Swap for a real adapter (Blueprint §1: keep vendor-specific code
// behind adapters) once a database is chosen - GoalService does not change.
export class InMemoryGoalRepository implements GoalRepository {
  private goals: Goal[] = [];

  async create(goal: Goal): Promise<Goal> {
    this.goals.push(goal);
    return goal;
  }

  async listByUser(userId: string): Promise<Goal[]> {
    return this.goals
      .filter((goal) => goal.userId === userId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async countActiveByUser(userId: string): Promise<number> {
    return this.goals.filter((goal) => goal.userId === userId && goal.status === 'active').length;
  }
}
