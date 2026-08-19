import type { GoalHistoryEvent } from '@better-you/contracts';

export interface GoalHistoryRepository {
  record(event: GoalHistoryEvent): Promise<GoalHistoryEvent>;
  listByGoalId(goalId: string): Promise<GoalHistoryEvent[]>;
}

// In-memory only, same adapter pattern as GoalRepository (ADR 0001). History
// is append-only from the normal application flow - no update/delete method
// exists, matching Blueprint §7's "history immutable to normal user flows."
export class InMemoryGoalHistoryRepository implements GoalHistoryRepository {
  private events: GoalHistoryEvent[] = [];

  async record(event: GoalHistoryEvent): Promise<GoalHistoryEvent> {
    this.events.push(event);
    return event;
  }

  async listByGoalId(goalId: string): Promise<GoalHistoryEvent[]> {
    return this.events
      .filter((event) => event.goalId === goalId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
}
