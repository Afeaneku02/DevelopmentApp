import type {
  MentorGuidanceInput,
  MentorGuidanceRecommendation,
  MentorGuidanceResult,
  MentorGuidanceSource,
  MentorGuidanceStatus,
} from '@better-you/contracts';
import type { MentorGuidanceClient } from './mentorGuidanceClient';

export interface HttpMentorGuidanceClientOptions {
  baseUrl: string;
  serviceToken?: string;
  timeoutMs?: number;
  // Injected for testability, same as HttpMentorFeedbackClient.
  fetchImpl?: typeof fetch;
}

// Longer than the 10s other AI Models clients use: this request may wait on
// an LLM call, which the AI project itself bounds at 20s by default
// (MENTOR_TIMEOUT_SECONDS). Leaving headroom above that means the AI
// project's own timeout - and its deterministic fallback - normally wins,
// rather than Better You abandoning a request that was about to fall back.
const DEFAULT_TIMEOUT_MS = 30_000;

// Wire status -> Better You status/source. Anything outside this table is
// treated as an unusable response, never guessed at.
const WIRE_STATUS: Record<string, { status: MentorGuidanceStatus; source: MentorGuidanceSource }> = {
  openai: { status: 'guidance', source: 'openai' },
  mock: { status: 'guidance', source: 'mock' },
  deterministic_fallback: { status: 'fallback', source: 'deterministic' },
  needs_more_information: { status: 'needs_more_information', source: null },
  unavailable: { status: 'unavailable', source: null },
};

// Only short snake_case codes are passed through as a reasonCode - anything
// else from the wire (a long FastAPI validation detail, say) is replaced by
// a generic code rather than forwarded to the browser.
const REASON_CODE_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;

function unavailable(reasonCode: string): MentorGuidanceResult {
  return {
    status: 'unavailable',
    source: null,
    summary: null,
    recommendations: [],
    clarifyingQuestion: null,
    reasonCode,
    acceptsReply: false,
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function safeReasonCode(value: unknown): string | null {
  return typeof value === 'string' && REASON_CODE_PATTERN.test(value) ? value : null;
}

// Runtime-validates the AI project's MentorResponse envelope the same way
// HttpMentorFeedbackClient validates its response: `unknown` in, a Better
// You result or null out. Only the fields Better You displays are read -
// `telemetry` (model, token counts, cost estimates) and `snapshot_id` are
// deliberately not forwarded to the browser.
function parseMentorGuidanceResponse(value: unknown): MentorGuidanceResult | null {
  if (!isPlainObject(value)) return null;
  if (typeof value.status !== 'string' || !Object.prototype.hasOwnProperty.call(WIRE_STATUS, value.status)) return null;
  const mapped = WIRE_STATUS[value.status];

  const guidance = value.guidance;
  if (!isPlainObject(guidance)) return null;
  if (typeof guidance.summary !== 'string') return null;
  if (!Array.isArray(guidance.recommendations)) return null;
  const clarifyingQuestion = guidance.clarifying_question;
  if (clarifyingQuestion !== null && clarifyingQuestion !== undefined && typeof clarifyingQuestion !== 'string') {
    return null;
  }

  const recommendations: MentorGuidanceRecommendation[] = [];
  for (const raw of guidance.recommendations) {
    if (!isPlainObject(raw)) return null;
    if (typeof raw.action !== 'string' || typeof raw.reason !== 'string') return null;
    if (!Array.isArray(raw.grounded_in_belief_ids) || !raw.grounded_in_belief_ids.every((id) => typeof id === 'string')) {
      return null;
    }
    recommendations.push({
      action: raw.action,
      reason: raw.reason,
      groundedInBeliefIds: raw.grounded_in_belief_ids as string[],
    });
  }

  // The upstream contract allows a summary without suggested actions.

  const reasonCode = safeReasonCode(value.reason_code);

  if (mapped.status === 'unavailable') {
    // The wire's 'unavailable' envelope still carries a generic
    // clarification summary; showing it next to "unavailable" would be
    // contradictory, so only the reason code is kept.
    return unavailable(reasonCode ?? 'ai_unavailable');
  }

  // The clarifying question itself may come from the LLM, so a
  // needs_more_information result is labeled by the provider that actually
  // ran (the AI project reports it in telemetry.provider) rather than
  // assumed deterministic.
  let source = mapped.source;
  if (mapped.status === 'needs_more_information' && isPlainObject(value.telemetry)) {
    const provider = value.telemetry.provider;
    if (provider === 'openai' || provider === 'mock') source = provider;
  }

  const question = typeof clarifyingQuestion === 'string' && clarifyingQuestion.trim() ? clarifyingQuestion : null;

  return {
    status: mapped.status,
    source,
    summary: guidance.summary,
    recommendations: mapped.status === 'needs_more_information' ? [] : recommendations,
    clarifyingQuestion: question,
    reasonCode,
    // A reply can only matter when the model itself asked: the AI project's
    // deterministic clarifications always carry a reason_code and no
    // provider telemetry, and are decided before `question` is read (see
    // MentorGuidanceResult.acceptsReply).
    acceptsReply:
      mapped.status === 'needs_more_information' && source !== null && reasonCode === null && question !== null,
  };
}

// Optional, config-gated client for the AI project's
// `POST /users/{user_id}/mentor-guidance` (ADR 0029). Sends exactly
// `{ context_key, goal }` - built from the MentorGuidanceInput allowlist -
// plus the opaque user id in the path, and `clarifications` only when the
// user explicitly answered the mentor in this interaction.
//
// Never throws: network error, timeout, non-2xx, invalid JSON, and
// wrong-shaped bodies all become status 'unavailable' with a non-secret
// reasonCode.
export class HttpMentorGuidanceClient implements MentorGuidanceClient {
  private readonly baseUrl: string;
  private readonly serviceToken: string | undefined;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: HttpMentorGuidanceClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.serviceToken = options.serviceToken;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async getGuidance(userId: string, input: MentorGuidanceInput): Promise<MentorGuidanceResult> {
    const url = `${this.baseUrl}/users/${encodeURIComponent(userId)}/mentor-guidance`;
    // Rebuilt field-by-field rather than spreading `input`, so a future
    // widening of MentorGuidanceInput can't silently widen the request.
    // Turns are rebuilt from their two named fields too. They go in the AI
    // endpoint's `clarifications` (question + answer pairs), so the model
    // reads each answer against the question it asked; `question` (a free
    // standalone user question) is not used by Better You.
    const turns = (input.clarifications ?? []).map((t) => ({ question: t.question, answer: t.answer }));
    const body = {
      context_key: input.contextKey,
      goal: input.goalTitle,
      ...(turns.length > 0 ? { clarifications: turns } : {}),
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchImpl(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.serviceToken ? { Authorization: `Bearer ${this.serviceToken}` } : {}),
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      // Keep the timeout active through body consumption, including error
      // bodies: fetch resolves as soon as headers arrive.
      let parsedBody: unknown;
      try {
        parsedBody = await response.json();
      } catch (err) {
        if (controller.signal.aborted || (err instanceof Error && err.name === 'AbortError')) {
          return unavailable('timeout');
        }
        return unavailable(response.ok ? 'invalid_json' : `http_${response.status}`);
      }

      if (!response.ok) {
        const detail = isPlainObject(parsedBody) ? safeReasonCode(parsedBody.detail) : null;
        return unavailable(detail ?? `http_${response.status}`);
      }

      return parseMentorGuidanceResponse(parsedBody) ?? unavailable('unexpected_response');
    } catch (err) {
      const timedOut = controller.signal.aborted || (err instanceof Error && err.name === 'AbortError');
      return unavailable(timedOut ? 'timeout' : 'network_error');
    } finally {
      clearTimeout(timeout);
    }
  }
}
