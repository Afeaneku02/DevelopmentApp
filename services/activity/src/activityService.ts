import type { ActivityEvent, RecordActivityEventInput } from '@better-you/contracts';
import type { ActivityEventRepository } from './activityEventRepository';
import type { ActivityEventSyncClient } from './activityEventSyncClient';
import { NoopActivityEventSyncClient } from './noopActivityEventSyncClient';

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
    private readonly now: () => Date = () => new Date(),
    // Best-effort forward to the separate DevelopmentApp_AI_Models
    // project's POST /events (ADR 0027). NoopActivityEventSyncClient is the
    // default - with no third argument, this class's behavior is unchanged
    // from before this integration existed. server.ts supplies
    // HttpActivityEventSyncClient only when AI_MODELS_BASE_URL is
    // configured.
    private readonly syncClient: ActivityEventSyncClient = new NoopActivityEventSyncClient()
  ) {}

  async recordEvent(input: RecordActivityEventInput): Promise<ActivityEvent> {
    const event = {
      ...input,
      id: crypto.randomUUID(),
      occurredAt: this.now().toISOString(),
    } as ActivityEvent;

    const recorded = await this.repository.create(event);

    // This repository write above is the durable, source-of-truth record -
    // Better You remains source of truth for its own activity ledger, and
    // recordEvent() resolves as soon as it completes. The AI sync below is
    // a best-effort courtesy copy sent afterward, and deliberately NOT
    // awaited: recordActivityBestEffort (apps/api/src/recordActivityBestEffort.ts)
    // awaits this whole method before its route sends a response, so if
    // this call also awaited the sync, a slow or hung AI Models server
    // would delay every product action that records an event - up to
    // HttpActivityEventSyncClient's own timeout, per event. Firing it
    // without awaiting means recordEvent() can never be delayed by the AI
    // integration's latency, regardless of that timeout's value.
    //
    // The returned promise is still handled (not left as a bare floating
    // promise) so a rejection here can never surface as an unhandled
    // rejection: HttpActivityEventSyncClient.sync() already never throws,
    // and this .catch() is defense in depth for any future
    // ActivityEventSyncClient implementation that might.
    void this.syncClient.sync(recorded).catch((err) => {
      console.error('Failed to sync activity event to AI Models:', err);
    });

    return recorded;
  }

  async listEvents(userId: string): Promise<ActivityEvent[]> {
    return this.repository.listByUser(userId);
  }
}
