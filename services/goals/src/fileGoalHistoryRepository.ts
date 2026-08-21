import type { GoalHistoryEvent } from '@better-you/contracts';
import { readJsonArray, writeJsonArrayAtomic } from '@better-you/persistence';
import type { GoalHistoryRepository } from './goalHistoryRepository';

// File-backed adapter (ADR 0016) - same semantics as InMemoryGoalHistoryRepository
// (append-only, no update/delete), persisted to a JSON file.
export class FileGoalHistoryRepository implements GoalHistoryRepository {
  private events: GoalHistoryEvent[];

  constructor(private readonly filePath: string) {
    this.events = readJsonArray<GoalHistoryEvent>(filePath);
  }

  async record(event: GoalHistoryEvent): Promise<GoalHistoryEvent> {
    this.events.push(event);
    writeJsonArrayAtomic(this.filePath, this.events);
    return event;
  }

  async listByGoalId(goalId: string): Promise<GoalHistoryEvent[]> {
    return this.events
      .filter((event) => event.goalId === goalId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
}
