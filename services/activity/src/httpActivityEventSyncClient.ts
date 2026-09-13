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
const DEFAULT_SOURCE = 'better_you';

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
export class HttpActivityEventSyncClient implements ActivityEventSyncClient {
  private readonly baseUrl: string;
  private readonly serviceToken: string | undefined;
  private readonly timeoutMs: number;
  private readonly source: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: HttpActivityEventSyncClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.serviceToken = options.serviceToken;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
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
      }
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
}
