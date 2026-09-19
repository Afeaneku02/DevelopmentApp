import type { ActivityEvent } from '@better-you/contracts';
import type { ActivityEventSyncClient } from './activityEventSyncClient';

// Default when AI_MODELS_BASE_URL is not configured (server.ts) - does
// nothing, successfully, every time. With this as the default,
// ActivityService's behavior is unchanged from before this integration
// existed: no network call is ever made, and recordEvent() cannot be slowed
// down or failed by it.
export class NoopActivityEventSyncClient implements ActivityEventSyncClient {
  async sync(_event: ActivityEvent): Promise<void> {
    return undefined;
  }
}
