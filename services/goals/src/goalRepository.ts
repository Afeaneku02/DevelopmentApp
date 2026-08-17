import type { Goal } from '@better-you/contracts';

export interface GoalRepository {
  create(goal: Goal): Promise<Goal>;
  listByUser(userId: string): Promise<Goal[]>;
  countActiveByUser(userId: string): Promise<number>;
  findById(id: string): Promise<Goal | null>;
  update(goal: Goal): Promise<Goal>;
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

  async findById(id: string): Promise<Goal | null> {
    return this.goals.find((goal) => goal.id === id) ?? null;
  }

  async update(goal: Goal): Promise<Goal> {
    const index = this.goals.findIndex((g) => g.id === goal.id);
    if (index !== -1) {
      this.goals[index] = goal;
    }
    return goal;
  }
}
