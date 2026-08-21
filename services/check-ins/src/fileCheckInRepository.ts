import type { CheckIn } from '@better-you/contracts';
import { readJsonArray, writeJsonArrayAtomic } from '@better-you/persistence';
import type { CheckInRepository } from './checkInRepository';

// File-backed adapter (ADR 0016) - same semantics as InMemoryCheckInRepository
// (newest-first ordering), persisted to a JSON file.
export class FileCheckInRepository implements CheckInRepository {
  private checkIns: CheckIn[];

  constructor(private readonly filePath: string) {
    this.checkIns = readJsonArray<CheckIn>(filePath);
  }

  async create(checkIn: CheckIn): Promise<CheckIn> {
    this.checkIns.push(checkIn);
    writeJsonArrayAtomic(this.filePath, this.checkIns);
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
