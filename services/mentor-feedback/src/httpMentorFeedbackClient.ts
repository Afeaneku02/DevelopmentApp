import type { MentorFeedbackItem, MentorFeedbackResult, MentorFeedbackRiskTier } from '@better-you/contracts';
import type { MentorFeedbackClient } from './mentorFeedbackClient';

export interface HttpMentorFeedbackClientOptions {
  baseUrl: string;
  serviceToken?: string;
  timeoutMs?: number;
  // Injected for testability (this project's usual "inject for testing,
  // default to the real implementation" pattern - see HttpRoadmapGenerator)
  // - tests never need a real network call or a running AI Models server.
  fetchImpl?: typeof fetch;
}

const DEFAULT_TIMEOUT_MS = 10_000;
const RISK_TIERS: readonly MentorFeedbackRiskTier[] = ['low', 'medium', 'high'];

function unavailable(reason: string): MentorFeedbackResult {
  return { status: 'unavailable', feedback: [], unavailableReason: reason };
}

function isNullableString(value: unknown): value is string | null | undefined {
  return value === undefined || value === null || typeof value === 'string';
}

// Runtime-validates the AI project's response the same way
// roadmapValidation.ts treats a RoadmapGenerator's output: `unknown`, never
// assumed to match a TS type just because a fetch call happened to return
// 200 and parse as JSON. A malformed body degrades to `null` here (the
// caller turns that into an 'unavailable' result) instead of crashing
// anything downstream with a bare `.map` on `undefined` or similar.
function parseMentorFeedbackResponse(value: unknown): MentorFeedbackResult | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const obj = value as Record<string, unknown>;

  if (obj.status !== 'ready' && obj.status !== 'needs_more_data') return null;
  if (!Array.isArray(obj.feedback)) return null;
  if (!isNullableString(obj.needs_more_data_reason)) return null;

  const feedback: MentorFeedbackItem[] = [];
  for (const raw of obj.feedback) {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
    const item = raw as Record<string, unknown>;

    if (typeof item.message !== 'string') return null;
    if (typeof item.confidence !== 'number' || !Number.isFinite(item.confidence)) return null;
    if (
      !Array.isArray(item.grounded_in_belief_ids) ||
      !item.grounded_in_belief_ids.every((id) => typeof id === 'string')
    ) {
      return null;
    }
    if (typeof item.why !== 'string') return null;
    if (typeof item.risk_tier !== 'string' || !RISK_TIERS.includes(item.risk_tier as MentorFeedbackRiskTier)) {
      return null;
    }
    if (!isNullableString(item.recommended_next_action)) return null;

    feedback.push({
      message: item.message,
      confidence: item.confidence,
      groundedInBeliefIds: item.grounded_in_belief_ids as string[],
      why: item.why,
      recommendedNextAction: (item.recommended_next_action as string | null | undefined) ?? null,
      riskTier: item.risk_tier as MentorFeedbackRiskTier,
    });
  }

  return {
    status: obj.status,
    feedback,
    needsMoreDataReason: (obj.needs_more_data_reason as string | null | undefined) ?? null,
  };
}

// Optional, config-gated MentorFeedbackClient implementation that calls the
// separate DevelopmentApp_AI_Models project's real
// `GET /users/{user_id}/mentor-feedback` (ADR 0026) - the read-side sibling
// of HttpRoadmapGenerator (ADR 0024). This is local integration only, never
// the default: apps/api/src/server.ts only constructs this when
// AI_MODELS_BASE_URL is explicitly configured; UnavailableMentorFeedbackClient
// remains the default otherwise, with no behavior change.
//
// Sends only a path-scoped user id and an optional `context_key` query
// param - never profile data, check-in notes, or a goal's free-text
// description; there is no field on `getFeedback()`, or on the request it
// builds, for any of that to travel through even by accident.
//
// Every failure mode - network error, timeout, non-2xx response, a response
// body that isn't valid JSON, or one that parses but doesn't match the
// expected shape - is normalized into a `status: 'unavailable'` result
// rather than a thrown error (see MentorFeedbackClient's own docstring for
// why this integration cannot fail the same way HttpRoadmapGenerator does).
export class HttpMentorFeedbackClient implements MentorFeedbackClient {
  private readonly baseUrl: string;
  private readonly serviceToken: string | undefined;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: HttpMentorFeedbackClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.serviceToken = options.serviceToken;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async getFeedback(userId: string, contextKey?: string): Promise<MentorFeedbackResult> {
    const url = new URL(`${this.baseUrl}/users/${encodeURIComponent(userId)}/mentor-feedback`);
    if (contextKey) {
      url.searchParams.set('context_key', contextKey);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await this.fetchImpl(url.toString(), {
        method: 'GET',
        headers: {
          ...(this.serviceToken ? { Authorization: `Bearer ${this.serviceToken}` } : {}),
        },
        signal: controller.signal,
      });
    } catch (err) {
      const timedOut = err instanceof Error && err.name === 'AbortError';
      return unavailable(
        timedOut
          ? `mentor feedback request timed out after ${this.timeoutMs}ms`
          : `mentor feedback request failed: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      return unavailable(`mentor feedback service responded with HTTP ${response.status}`);
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      return unavailable('mentor feedback service returned a response that was not valid JSON');
    }

    const parsed = parseMentorFeedbackResponse(body);
    if (!parsed) {
      return unavailable('mentor feedback service returned an unexpected response shape');
    }
    return parsed;
  }
}
