import type { ActivityEvent } from '@better-you/contracts';

export interface ActivityEventRepository {
  create(event: ActivityEvent): Promise<ActivityEvent>;
  // Oldest-first - "chronological" means the order things actually
  // happened, matching how a consumer (today's tests, eventually the
  // external AI project) would want to read a history back.
  listByUser(userId: string): Promise<ActivityEvent[]>;
}

// In-memory only. Swap for a real adapter once a database is chosen -
// ActivityService does not change (ADR 0001 adapter pattern, same as every
// other repository in this project). Events are append-only - there is no
// update/delete method, matching Goals' history repository.
export class InMemoryActivityEventRepository implements ActivityEventRepository {
  private events: ActivityEvent[] = [];

  async create(event: ActivityEvent): Promise<ActivityEvent> {
    this.events.push(event);
    return event;
  }

  async listByUser(userId: string): Promise<ActivityEvent[]> {
    return this.events
      .filter((event) => event.userId === userId)
      .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  }
}
