import type { ActivityService } from '@better-you/activity';
import type { RecordActivityEventInput } from '@better-you/contracts';

// Activity recording is a secondary, best-effort concern (ADR 0021) - a
// failure to record an event must never turn an otherwise-successful
// product action into a failed response. Awaited (not fire-and-forget) so
// the event is reliably recorded before the response is sent, with any
// failure caught and logged rather than propagated to the route's error
// handler.
export async function recordActivityBestEffort(
  activityService: ActivityService,
  input: RecordActivityEventInput
): Promise<void> {
  try {
    await activityService.recordEvent(input);
  } catch (err) {
    console.error('Failed to record activity event:', err);
  }
}
