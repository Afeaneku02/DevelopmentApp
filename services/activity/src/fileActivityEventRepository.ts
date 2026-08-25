import type { ActivityEvent } from '@better-you/contracts';
import { readJsonArray, writeJsonArrayAtomic } from '@better-you/persistence';
import type { ActivityEventRepository } from './activityEventRepository';

// File-backed adapter (ADR 0016 pattern) - same semantics as
// InMemoryActivityEventRepository, persisted to a JSON file. Append-only,
// same as the in-memory version: no update/delete method.
export class FileActivityEventRepository implements ActivityEventRepository {
  private events: ActivityEvent[];

  constructor(private readonly filePath: string) {
    this.events = readJsonArray<ActivityEvent>(filePath);
  }

  async create(event: ActivityEvent): Promise<ActivityEvent> {
    this.events.push(event);
    writeJsonArrayAtomic(this.filePath, this.events);
    return event;
  }

  async listByUser(userId: string): Promise<ActivityEvent[]> {
    return this.events
      .filter((event) => event.userId === userId)
      .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  }
}
