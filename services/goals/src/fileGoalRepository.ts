import type { Goal } from '@better-you/contracts';
import { readJsonArray, writeJsonArrayAtomic } from '@better-you/persistence';
import type { GoalRepository } from './goalRepository';

// File-backed adapter (ADR 0016) - same semantics as InMemoryGoalRepository,
// just loaded from and persisted to a JSON file instead of only living in
// process memory. GoalService does not change (ADR 0001).
export class FileGoalRepository implements GoalRepository {
  private goals: Goal[];

  constructor(private readonly filePath: string) {
    this.goals = readJsonArray<Goal>(filePath);
  }

  private persist(): void {
    writeJsonArrayAtomic(this.filePath, this.goals);
  }

  async create(goal: Goal): Promise<Goal> {
    this.goals.push(goal);
    this.persist();
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
      this.persist();
    }
    return goal;
  }
}
