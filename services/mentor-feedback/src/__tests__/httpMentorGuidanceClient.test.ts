import { describe, expect, it, vi } from 'vitest';
import { HttpMentorGuidanceClient } from '../httpMentorGuidanceClient';
import { UnavailableMentorGuidanceClient } from '../unavailableMentorGuidanceClient';

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

const INPUT = { contextKey: 'fitness_scheduling', goalTitle: 'Walk every morning' };

// Mirrors the AI project's MentorResponse envelope (src/llm/models.py).
function wireBody(overrides: Record<string, unknown> = {}) {
  return {
    status: 'openai',
    reason_code: null,
    guidance: {
      summary: 'Your check-ins show a steady routine.',
      recommendations: [
        {
          action: 'Try one extra short walk this week.',
          reason: 'You have completed most scheduled check-ins.',
          grounded_in_belief_ids: ['bel_u1_checkin_consistency'],
        },
      ],
      clarifying_question: null,
      needs_more_information: false,
      needs_web: false,
    },
    snapshot_id: 'abc123',
    telemetry: { provider: 'openai', model: 'gpt-x', estimated_cost_usd: 0.001, success: true },
    ...overrides,
  };
}

function clarificationGuidance() {
  return {
    summary: 'There is not enough approved context for a small, low-risk suggestion.',
    recommendations: [],
    clarifying_question: 'What small scheduling or learning habit would you like help with?',
    needs_more_information: true,
    needs_web: false,
  };
}

function client(fetchImpl: ReturnType<typeof vi.fn>, extra: Record<string, unknown> = {}) {
  return new HttpMentorGuidanceClient({ baseUrl: 'http://localhost:8100/', fetchImpl, ...extra });
}

describe('HttpMentorGuidanceClient', () => {
  it('POSTs exactly { context_key, goal } to <baseUrl>/users/<id>/mentor-guidance', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, wireBody()));
    await client(fetchImpl).getGuidance('user 1', INPUT);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('http://localhost:8100/users/user%201/mentor-guidance');
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.headers.Authorization).toBeUndefined();
    expect(JSON.parse(init.body)).toEqual({ context_key: 'fitness_scheduling', goal: 'Walk every morning' });
  });

  it('never forwards fields beyond the allowlist, even if the input object carries extras', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, wireBody()));
    const widened = { ...INPUT, description: 'private note about my divorce', userId: 'u1' };
    await client(fetchImpl).getGuidance('u1', widened);

    const body = fetchImpl.mock.calls[0][1].body as string;
    expect(Object.keys(JSON.parse(body)).sort()).toEqual(['context_key', 'goal']);
    expect(body).not.toContain('divorce');
  });

  it('sends the service token as a Bearer header when configured', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, wireBody()));
    await client(fetchImpl, { serviceToken: 'svc-token' }).getGuidance('u1', INPUT);
    expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBe('Bearer svc-token');
  });

  it("maps 'openai' to status 'guidance' / source 'openai' and translates to camelCase", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, wireBody()));
    const result = await client(fetchImpl).getGuidance('u1', INPUT);

    expect(result).toEqual({
      status: 'guidance',
      source: 'openai',
      summary: 'Your check-ins show a steady routine.',
      recommendations: [
        {
          action: 'Try one extra short walk this week.',
          reason: 'You have completed most scheduled check-ins.',
          groundedInBeliefIds: ['bel_u1_checkin_consistency'],
        },
      ],
      clarifyingQuestion: null,
      reasonCode: null,
      acceptsReply: false,
    });
    // Telemetry (model, cost) and snapshot ids never reach Better You's contract.
    expect(JSON.stringify(result)).not.toContain('estimated_cost');
    expect(JSON.stringify(result)).not.toContain('abc123');
  });

  it("maps 'mock' to source 'mock' so mock output is never presented as live AI", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, wireBody({ status: 'mock' })));
    const result = await client(fetchImpl).getGuidance('u1', INPUT);
    expect(result.status).toBe('guidance');
    expect(result.source).toBe('mock');
  });

  it("maps 'deterministic_fallback' to status 'fallback' / source 'deterministic' and keeps the reason code", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, wireBody({ status: 'deterministic_fallback', reason_code: 'timeout' })));
    const result = await client(fetchImpl).getGuidance('u1', INPUT);
    expect(result.status).toBe('fallback');
    expect(result.source).toBe('deterministic');
    expect(result.reasonCode).toBe('timeout');
    expect(result.recommendations).toHaveLength(1);
  });

  it("maps 'needs_more_information' with its clarifying question and no recommendations", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(
        200,
        wireBody({
          status: 'needs_more_information',
          reason_code: 'insufficient_authorized_evidence',
          guidance: clarificationGuidance(),
          telemetry: null,
        })
      )
    );
    const result = await client(fetchImpl).getGuidance('u1', INPUT);
    expect(result).toEqual({
      status: 'needs_more_information',
      source: null,
      summary: 'There is not enough approved context for a small, low-risk suggestion.',
      recommendations: [],
      clarifyingQuestion: 'What small scheduling or learning habit would you like help with?',
      reasonCode: 'insufficient_authorized_evidence',
      // A deterministic evidence gate: a reply cannot change it.
      acceptsReply: false,
    });
  });

  it('labels an LLM-generated clarification by its provider', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(200, wireBody({ status: 'needs_more_information', guidance: clarificationGuidance() }))
    );
    const result = await client(fetchImpl).getGuidance('u1', INPUT);
    expect(result.source).toBe('openai');
  });

  it("maps the wire's 'unavailable' envelope to unavailable without its contradictory clarification text", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(
        200,
        wireBody({ status: 'unavailable', reason_code: 'budget_exceeded', guidance: clarificationGuidance() })
      )
    );
    const result = await client(fetchImpl).getGuidance('u1', INPUT);
    expect(result).toEqual({
      status: 'unavailable',
      source: null,
      summary: null,
      recommendations: [],
      clarifyingQuestion: null,
      reasonCode: 'budget_exceeded',
      acceptsReply: false,
    });
  });

  it.each(['openai', 'mock', 'deterministic_fallback'])('preserves a valid %s summary without actions', async (status) => {
    const body = wireBody({ status, guidance: { ...wireBody().guidance, recommendations: [] } });
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, body));
    const result = await client(fetchImpl).getGuidance('u1', INPUT);
    expect(result).toMatchObject({
      status: status === 'deterministic_fallback' ? 'fallback' : 'guidance',
      summary: body.guidance.summary,
      recommendations: [],
      reasonCode: null,
    });
  });

  describe('failure modes never throw', () => {
    it.each([200, 503])('times out while reading an HTTP %s body after headers arrive', async (status) => {
      vi.useFakeTimers();
      try {
        const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => ({
          ok: status === 200,
          status,
          json: () => new Promise((_resolve, reject) => {
            init.signal!.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
          }),
        } as Response));
        const pending = client(fetchImpl, { timeoutMs: 20 }).getGuidance('u1', INPUT);
        await vi.advanceTimersByTimeAsync(20);
        expect(fetchImpl.mock.calls[0][1].signal!.aborted).toBe(true);
        expect(await pending).toMatchObject({ status: 'unavailable', reasonCode: 'timeout' });
        expect(vi.getTimerCount()).toBe(0);
      } finally {
        vi.useRealTimers();
      }
    });

    it('network error -> unavailable/network_error (no error message forwarded)', async () => {
      const fetchImpl = vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:8100'));
      const result = await client(fetchImpl).getGuidance('u1', INPUT);
      expect(result.status).toBe('unavailable');
      expect(result.reasonCode).toBe('network_error');
      expect(JSON.stringify(result)).not.toContain('ECONNREFUSED');
    });

    it('timeout -> unavailable/timeout', async () => {
      const fetchImpl = vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init.signal!.addEventListener('abort', () => {
              const err = new Error('aborted');
              err.name = 'AbortError';
              reject(err);
            });
          })
      );
      const result = await client(fetchImpl as never, { timeoutMs: 20 }).getGuidance('u1', INPUT);
      expect(result).toMatchObject({ status: 'unavailable', reasonCode: 'timeout' });
    });

    it("503 with the AI project's snake_case detail -> that detail as reasonCode", async () => {
      const fetchImpl = vi
        .fn()
        .mockResolvedValue(jsonResponse(503, { detail: 'mentor_configuration_invalid' }));
      const result = await client(fetchImpl).getGuidance('u1', INPUT);
      expect(result).toMatchObject({ status: 'unavailable', reasonCode: 'mentor_configuration_invalid' });
    });

    it('non-2xx with a free-text/structured detail -> generic http_<status>, detail not forwarded', async () => {
      const fetchImpl = vi.fn().mockResolvedValue(
        jsonResponse(422, { detail: [{ msg: 'Extra inputs are not permitted', input: 'secret' }] })
      );
      const result = await client(fetchImpl).getGuidance('u1', INPUT);
      expect(result).toMatchObject({ status: 'unavailable', reasonCode: 'http_422' });
      expect(JSON.stringify(result)).not.toContain('secret');
    });

    it('non-2xx with a non-JSON body -> http_<status>', async () => {
      const fetchImpl = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => {
          throw new SyntaxError('Unexpected token');
        },
      } as unknown as Response);
      const result = await client(fetchImpl).getGuidance('u1', INPUT);
      expect(result).toMatchObject({ status: 'unavailable', reasonCode: 'http_500' });
    });

    it('2xx with invalid JSON -> invalid_json', async () => {
      const fetchImpl = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => {
          throw new SyntaxError('Unexpected token');
        },
      } as unknown as Response);
      const result = await client(fetchImpl).getGuidance('u1', INPUT);
      expect(result).toMatchObject({ status: 'unavailable', reasonCode: 'invalid_json' });
    });

    const malformed: Array<[string, unknown]> = [
      ['null body', null],
      ['array body', []],
      ['unknown status', wireBody({ status: 'something_new' })],
      ['inherited constructor status', wireBody({ status: 'constructor' })],
      ['inherited toString status', wireBody({ status: 'toString' })],
      ['inherited __proto__ status', wireBody({ status: '__proto__' })],
      ['missing guidance', wireBody({ guidance: undefined })],
      ['non-string summary', wireBody({ guidance: { ...wireBody().guidance, summary: 5 } })],
      ['recommendations not an array', wireBody({ guidance: { ...wireBody().guidance, recommendations: {} } })],
      [
        'recommendation missing action',
        wireBody({
          guidance: { ...wireBody().guidance, recommendations: [{ reason: 'r', grounded_in_belief_ids: [] }] },
        }),
      ],
      [
        'non-string belief id',
        wireBody({
          guidance: {
            ...wireBody().guidance,
            recommendations: [{ action: 'a', reason: 'r', grounded_in_belief_ids: [1] }],
          },
        }),
      ],
      ['non-string clarifying question', wireBody({ guidance: { ...wireBody().guidance, clarifying_question: 3 } })],
    ];

    it.each(malformed)('%s -> unexpected_response', async (_label, body) => {
      const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, body));
      const result = await client(fetchImpl).getGuidance('u1', INPUT);
      expect(result).toMatchObject({ status: 'unavailable', reasonCode: 'unexpected_response' });
    });

    it('drops a non-code reason_code rather than forwarding arbitrary text', async () => {
      const fetchImpl = vi.fn().mockResolvedValue(
        jsonResponse(200, wireBody({ status: 'deterministic_fallback', reason_code: 'OpenAI said: key sk-123 invalid' }))
      );
      const result = await client(fetchImpl).getGuidance('u1', INPUT);
      expect(result.status).toBe('fallback');
      expect(result.reasonCode).toBeNull();
    });
  });
});

describe('UnavailableMentorGuidanceClient', () => {
  it('returns unavailable/not_configured without any network call', async () => {
    const result = await new UnavailableMentorGuidanceClient().getGuidance('u1', INPUT);
    expect(result).toEqual({
      status: 'unavailable',
      source: null,
      summary: null,
      recommendations: [],
      clarifyingQuestion: null,
      reasonCode: 'not_configured',
      acceptsReply: false,
    });
  });
});
