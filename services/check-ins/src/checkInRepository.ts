import type { CheckIn } from '@better-you/contracts';

export interface CheckInRepository {
  create(checkIn: CheckIn): Promise<CheckIn>;
  listByUser(userId: string): Promise<CheckIn[]>;
  listByGoalId(goalId: string): Promise<CheckIn[]>;
}

export class InMemoryCheckInRepository implements CheckInRepository {
  private checkIns: CheckIn[] = [];

  async create(checkIn: CheckIn): Promise<CheckIn> {
    this.checkIns.push(checkIn);
    return checkIn;
  }

  async listByUser(userId: string): Promise<CheckIn[]> {
    return this.sortNewestFirst(this.checkIns.filter((checkIn) => checkIn.userId === userId));
  }

  async listByGoalId(goalId: string): Promise<CheckIn[]> {
    return this.sortNewestFirst(this.checkIns.filter((checkIn) => checkIn.goalId === goalId));
  }

  private sortNewestFirst(checkIns: CheckIn[]): CheckIn[] {
    return [...checkIns].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}
