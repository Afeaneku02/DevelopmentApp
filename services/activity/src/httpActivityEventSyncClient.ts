import type { ActivityEvent } from '@better-you/contracts';
import type { ActivityEventSyncClient } from './activityEventSyncClient';

export interface HttpActivityEventSyncClientOptions {
  baseUrl: string;
  serviceToken?: string;
  timeoutMs?: number;
  // Identifies Better You as the origin system in the AI project's
  // `source` field (its EventIn.source, distinct from a goal's own
  // `GoalSource`). Overridable for tests; real callers should not need to.
  source?: string;
  // Timeout for the separate POST /users/{userId}/process trigger (ADR
  // 0028), kept distinct from `timeoutMs` above since processing a user's
  // event backlog is a heavier operation than accepting one event - it
  // reuses HttpRoadmapGenerator/HttpMentorFeedbackClient's 10s default
  // rather than the 2s event-sync one.
  processingTimeoutMs?: number;
  // Injected for testability (this project's usual "inject for testing,
  // default to the real implementation" pattern - see HttpRoadmapGenerator)
  // - tests never need a real network call or a running AI Models server.
  fetchImpl?: typeof fetch;
}

// Sharply shorter than HttpRoadmapGenerator/HttpMentorFeedbackClient's 10s
// default. Since ActivityService fires sync() without awaiting it (see its
// own comment), this timeout no longer gates how long a Better You product
// action can take - but an unbounded background request would still leave
// an open connection and a pending abort timer for the life of that
// timeout on every single event, for as long as the AI server stays
// unreachable or slow. Bounding it keeps that resource usage in check for
// what is deliberately best-effort telemetry, not a foreground request.
const DEFAULT_TIMEOUT_MS = 2_000;
const DEFAULT_PROCESSING_TIMEOUT_MS = 10_000;
const DEFAULT_SOURCE = 'better_you';

// Per-user processing state for the coalescing scheme below (ADR 0028):
// 'running' means one POST /users/{userId}/process request for this user is
// currently in flight; 'running-pending' additionally means at least one
// more event synced for that same user while it was in flight, so exactly
// one more processing run must follow before this user is considered idle
// again. No entry in the map at all means idle - nothing in flight, nothing
// queued.
type ProcessingState = 'running' | 'running-pending';

interface ProcessingResult {
  processed: number;
  failed: number;
}

// Deliberately narrow: only ever pulls two numeric counts out of the AI
// project's response, exactly like HttpMentorFeedbackClient's runtime
// validation of an untrusted response body. Nothing else on that response
// is ever read or logged - see logProcessingOutcome below - so a future AI
// response shape carrying free text can never end up in a log line through
// this path. Any shape that isn't a plain object is treated as malformed
// rather than crashing on a bad property access.
function parseProcessingResponse(value: unknown): ProcessingResult | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const obj = value as Record<string, unknown>;
  const counts = obj.counts;
  if (typeof counts !== 'object' || counts === null || Array.isArray(counts)) return null;
  const countValues = counts as Record<string, unknown>;
  if (typeof countValues.processed !== 'number' || typeof countValues.failed !== 'number') return null;
  return {
    processed: countValues.processed,
    failed: countValues.failed,
  };
}

// The only logging this integration ever does for the processing trigger -
// structured metadata only (user id, status, counts, error category), never
// anything read from request/response bodies beyond the two numeric counts
// above. Matches the "log only structured metadata" requirement this
// integration was built under (ADR 0028): no activity contents, goal
// titles, notes, beliefs, or mentor-feedback text ever appear in a log line
// here, because nothing carrying that content is ever passed in.
function logProcessingOutcome(metadata: {
  userId: string;
  status: 'ok' | 'partial_failure' | 'http_error' | 'malformed_response' | 'error';
  processed?: number;
  failed?: number;
  httpStatus?: number;
  errorCategory?: 'timeout' | 'network_error';
}): void {
  const logFn = metadata.status === 'ok' || metadata.status === 'partial_failure' ? console.info : console.warn;
  logFn(`[activity-sync] processing ${JSON.stringify(metadata)}`);
}

// Rebuilt field-by-field per event type, never a blind spread of
// `event.data` - the same defense-in-depth reasoning as
// HttpRoadmapGenerator's request body ("so this request body can never
// widen beyond the allowlist even if some future bug or bypass" adds a
// field to a variant's data). The `never` branch below is a compile-time
// guarantee: a 9th ActivityEventType added to the contract without a
// matching case here fails the build instead of silently forwarding
// whatever shape that new variant happens to carry.
function toStructuredData(event: ActivityEvent): Record<string, unknown> {
  switch (event.type) {
    case 'goal_created':
      return { goalId: event.data.goalId, category: event.data.category, source: event.data.source };
    case 'goal_paused':
    case 'goal_resumed':
    case 'goal_completed':
    case 'goal_archived':
      return { goalId: event.data.goalId };
    case 'check_in_recorded':
      return { goalId: event.data.goalId, checkInId: event.data.checkInId, response: event.data.response };
    case 'roadmap_generated':
      return {
        goalId: event.data.goalId,
        roadmapId: event.data.roadmapId,
        milestoneCount: event.data.milestoneCount,
      };
    case 'roadmap_step_completed':
      return {
        goalId: event.data.goalId,
        roadmapId: event.data.roadmapId,
        milestoneId: event.data.milestoneId,
        actionStepId: event.data.actionStepId,
      };
    default: {
      const exhaustiveCheck: never = event;
      throw new Error(`Unhandled ActivityEvent type: ${JSON.stringify(exhaustiveCheck)}`);
    }
  }
}

// Translates one Better You ActivityEvent into the separate
// DevelopmentApp_AI_Models project's `POST /events` contract (EventIn -
// snake_case, see src/api/models.py in that project). No `raw_content` key
// is ever sent: ActivityEvent never carries free text (see activity.ts), so
// there is nothing to put there, and this client does not accept anything
// that could fill it in.
function toEventPayload(event: ActivityEvent, source: string): Record<string, unknown> {
  return {
    user_id: event.userId,
    event_id: event.id,
    event_type: event.type,
    source,
    timestamp: event.occurredAt,
    structured_data: toStructuredData(event),
  };
}

// Optional, config-gated ActivityEventSyncClient implementation that calls
// the separate DevelopmentApp_AI_Models project's real `POST /events`
// (ADR 0027) - the write-side sibling of HttpRoadmapGenerator (ADR 0024)
// and HttpMentorFeedbackClient (ADR 0026). This is local integration only,
// never the default: apps/api/src/server.ts only constructs this when
// AI_MODELS_BASE_URL is explicitly configured; NoopActivityEventSyncClient
// remains the default otherwise, with no behavior change.
//
// This is best-effort telemetry, not a second source of truth - Better
// You's own ActivityEventRepository write already happened by the time
// ActivityService calls this. Every failure mode - network error, timeout,
// non-2xx response - is caught here and never rethrown; ActivityService.
// recordEvent() also fires this call without awaiting it and attaches its
// own .catch() as defense in depth, but this method must never depend on
// either of those - it must resolve cleanly on its own.
//
// ADR 0028 extends this client with one more best-effort side effect: once
// an event for a user is successfully forwarded, this also triggers that
// user's AI Models processing (`POST /users/{userId}/process`), coalesced
// per user so at most one processing request per user is ever in flight -
// see scheduleProcessing()/runProcessingLoop() below. Like the event sync
// itself, this is fire-and-forget from sync()'s point of view: sync()
// starts the processing run (or coalesces into the one already running)
// and returns without waiting for it to finish.
export class HttpActivityEventSyncClient implements ActivityEventSyncClient {
  private readonly baseUrl: string;
  private readonly serviceToken: string | undefined;
  private readonly timeoutMs: number;
  private readonly processingTimeoutMs: number;
  private readonly source: string;
  private readonly fetchImpl: typeof fetch;
  private readonly processingStateByUser = new Map<string, ProcessingState>();

  constructor(options: HttpActivityEventSyncClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.serviceToken = options.serviceToken;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.processingTimeoutMs = options.processingTimeoutMs ?? DEFAULT_PROCESSING_TIMEOUT_MS;
    this.source = options.source ?? DEFAULT_SOURCE;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async sync(event: ActivityEvent): Promise<void> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchImpl(`${this.baseUrl}/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.serviceToken ? { Authorization: `Bearer ${this.serviceToken}` } : {}),
        },
        body: JSON.stringify(toEventPayload(event, this.source)),
        signal: controller.signal,
      });
      if (!response.ok) {
        console.warn(
          `[activity-sync] AI Models responded with HTTP ${response.status} for event ${event.id} (${event.type})`
        );
        return;
      }
      // Only a successfully-synced event triggers processing - a rejected
      // or unreachable AI server never should, since there is then nothing
      // new for it to process anyway.
      this.scheduleProcessing(event.userId);
    } catch (err) {
      const timedOut = err instanceof Error && err.name === 'AbortError';
      console.warn(
        `[activity-sync] ${
          timedOut
            ? `request timed out after ${this.timeoutMs}ms`
            : `request failed: ${err instanceof Error ? err.message : String(err)}`
        } for event ${event.id} (${event.type})`
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  // Allows only one POST /users/{userId}/process request per user at a
  // time. If a call arrives for a user whose processing run is already in
  // flight, it doesn't start a second, concurrent request - it just marks
  // that one more run should follow once the current one finishes, so the
  // event that arrived mid-run is never silently dropped. Multiple calls
  // that arrive while already in the 'running-pending' state collapse into
  // that same single follow-up run - there is never a need for more than
  // one, since one processing run picks up everything queued so far.
  private scheduleProcessing(userId: string): void {
    const state = this.processingStateByUser.get(userId);
    if (state === 'running') {
      this.processingStateByUser.set(userId, 'running-pending');
      return;
    }
    if (state === 'running-pending') {
      return;
    }
    this.processingStateByUser.set(userId, 'running');
    // Not awaited - see the class-level comment on why sync() must not
    // wait for this. runProcessingLoop() never throws (triggerProcessing()
    // catches everything internally), but the .catch() below is defense in
    // depth against a future bug the same way ActivityService.recordEvent()
    // guards its own call into this class.
    void this.runProcessingLoop(userId).catch((err) => {
      console.error('[activity-sync] processing loop failed unexpectedly:', err);
    });
  }

  private async runProcessingLoop(userId: string): Promise<void> {
    for (;;) {
      await this.triggerProcessing(userId);
      if (this.processingStateByUser.get(userId) === 'running-pending') {
        this.processingStateByUser.set(userId, 'running');
        continue;
      }
      this.processingStateByUser.delete(userId);
      return;
    }
  }

  private async triggerProcessing(userId: string): Promise<void> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.processingTimeoutMs);

    try {
      const response = await this.fetchImpl(`${this.baseUrl}/users/${encodeURIComponent(userId)}/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.serviceToken ? { Authorization: `Bearer ${this.serviceToken}` } : {}),
        },
        body: JSON.stringify({ dry_run: false }),
        signal: controller.signal,
      });

      if (!response.ok) {
        logProcessingOutcome({ userId, status: 'http_error', httpStatus: response.status });
        return;
      }

      let body: unknown;
      try {
        body = await response.json();
      } catch {
        logProcessingOutcome({ userId, status: 'malformed_response' });
        return;
      }

      const parsed = parseProcessingResponse(body);
      if (!parsed) {
        logProcessingOutcome({ userId, status: 'malformed_response' });
        return;
      }

      logProcessingOutcome({
        userId,
        status: parsed.failed > 0 ? 'partial_failure' : 'ok',
        processed: parsed.processed,
        failed: parsed.failed,
      });
    } catch (err) {
      const timedOut = err instanceof Error && err.name === 'AbortError';
      logProcessingOutcome({ userId, status: 'error', errorCategory: timedOut ? 'timeout' : 'network_error' });
    } finally {
      clearTimeout(timeout);
    }
  }
}
