import type { ActivityEvent, RecordActivityEventInput } from '@better-you/contracts';
import type { ActivityEventRepository } from './activityEventRepository';

// Deliberately not validated the way Roadmap's AI-generator boundary is
// (ADR 0020/0021): every event recorded here is constructed by our own
// trusted route/service code from already-validated domain data (a Goal's
// category, a CheckIn's response, ...), not accepted as arbitrary input from
// an external caller. If a public "record an arbitrary event" endpoint is
// ever added, it would need the same untrusted-input validation treatment
// Roadmap's generator output gets.
export class ActivityService {
  constructor(
    private readonly repository: ActivityEventRepository,
    private readonly now: () => Date = () => new Date()
  ) {}

  async recordEvent(input: RecordActivityEventInput): Promise<ActivityEvent> {
    const event = {
      ...input,
      id: crypto.randomUUID(),
      occurredAt: this.now().toISOString(),
    } as ActivityEvent;

    return this.repository.create(event);
  }

  async listEvents(userId: string): Promise<ActivityEvent[]> {
    return this.repository.listByUser(userId);
  }
}
