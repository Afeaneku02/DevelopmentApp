import { describe, expect, it, vi } from 'vitest';
import { HttpMentorFeedbackClient } from '../httpMentorFeedbackClient';

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

function readyBody() {
  return {
    status: 'ready',
    feedback: [
      {
        message: 'You have kept a steady after-work routine.',
        confidence: 0.62,
        grounded_in_belief_ids: ['bel_1', 'bel_2'],
        why: 'Grounded in 4 supporting observations.',
        recommended_next_action: 'Consider one more session this week.',
        risk_tier: 'low',
      },
    ],
    needs_more_data_reason: null,
  };
}

describe('HttpMentorFeedbackClient', () => {
  it('GETs <baseUrl>/users/<id>/mentor-feedback and translates the wire response to camelCase', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, readyBody()));
    const client = new HttpMentorFeedbackClient({ baseUrl: 'http://localhost:8100', fetchImpl });

    const result = await client.getFeedback('user-1');

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('http://localhost:8100/users/user-1/mentor-feedback');
    expect(init.method).toBe('GET');
    expect(init.body).toBeUndefined();

    expect(result).toEqual({
      status: 'ready',
      feedback: [
        {
          message: 'You have kept a steady after-work routine.',
          confidence: 0.62,
          groundedInBeliefIds: ['bel_1', 'bel_2'],
          why: 'Grounded in 4 supporting observations.',
          recommendedNextAction: 'Consider one more session this week.',
          riskTier: 'low',
        },
      ],
      needsMoreDataReason: null,
    });
  });

  it('appends context_key only when a contextKey is given', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, readyBody()));
    const client = new HttpMentorFeedbackClient({ baseUrl: 'http://localhost:8100', fetchImpl });

    await client.getFeedback('user-1');
    expect(fetchImpl.mock.calls[0][0]).toBe('http://localhost:8100/users/user-1/mentor-feedback');

    fetchImpl.mockClear();
    await client.getFeedback('user-1', 'fitness_scheduling');
    expect(fetchImpl.mock.calls[0][0]).toBe(
      'http://localhost:8100/users/user-1/mentor-feedback?context_key=fitness_scheduling'
    );
  });

  it('URL-encodes the user id', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, readyBody()));
    const client = new HttpMentorFeedbackClient({ baseUrl: 'http://localhost:8100', fetchImpl });

    await client.getFeedback('user with spaces/slash');

    expect(fetchImpl.mock.calls[0][0]).toBe(
      'http://localhost:8100/users/user%20with%20spaces%2Fslash/mentor-feedback'
    );
  });

  it('strips a trailing slash from baseUrl', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, readyBody()));
    const client = new HttpMentorFeedbackClient({ baseUrl: 'http://localhost:8100/', fetchImpl });

    await client.getFeedback('user-1');

    expect(fetchImpl.mock.calls[0][0]).toBe('http://localhost:8100/users/user-1/mentor-feedback');
  });

  it('includes an Authorization header only when a service token is provided', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, readyBody()));

    await new HttpMentorFeedbackClient({ baseUrl: 'http://localhost:8100', fetchImpl }).getFeedback('user-1');
    expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBeUndefined();

    fetchImpl.mockClear();
    await new HttpMentorFeedbackClient({
      baseUrl: 'http://localhost:8100',
      serviceToken: 'secret-token',
      fetchImpl,
    }).getFeedback('user-1');
    expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBe('Bearer secret-token');
  });

  it('never sends anything beyond the user id and context key - no request body at all', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, readyBody()));
    const client = new HttpMentorFeedbackClient({ baseUrl: 'http://localhost:8100', fetchImpl });

    await client.getFeedback('user-1', 'fitness_scheduling');

    const [url, init] = fetchImpl.mock.calls[0];
    expect(init.body).toBeUndefined();
    const parsed = new URL(url);
    expect(parsed.pathname).toBe('/users/user-1/mentor-feedback');
    expect([...parsed.searchParams.keys()]).toEqual(['context_key']);
  });

  it('passes needs_more_data through untranslated in shape, camelCased in field name', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(200, { status: 'needs_more_data', feedback: [], needs_more_data_reason: 'no beliefs yet' })
    );
    const client = new HttpMentorFeedbackClient({ baseUrl: 'http://localhost:8100', fetchImpl });

    const result = await client.getFeedback('user-1');

    expect(result).toEqual({ status: 'needs_more_data', feedback: [], needsMoreDataReason: 'no beliefs yet' });
  });

  it('resolves to status "unavailable" on a non-2xx response, without throwing', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(503, { detail: 'service unavailable' }));
    const client = new HttpMentorFeedbackClient({ baseUrl: 'http://localhost:8100', fetchImpl });

    const result = await client.getFeedback('user-1');

    expect(result.status).toBe('unavailable');
    expect(result.feedback).toEqual([]);
    expect(result.unavailableReason).toContain('503');
  });

  it('resolves to status "unavailable" on a network error, without throwing', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('getaddrinfo ENOTFOUND'));
    const client = new HttpMentorFeedbackClient({ baseUrl: 'http://localhost:8100', fetchImpl });

    const result = await client.getFeedback('user-1');

    expect(result.status).toBe('unavailable');
    expect(result.unavailableReason).toContain('getaddrinfo ENOTFOUND');
  });

  it('resolves to status "unavailable" when the request times out', async () => {
    const fetchImpl = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const err = new Error('The operation was aborted');
          err.name = 'AbortError';
          reject(err);
        });
      });
    });
    const client = new HttpMentorFeedbackClient({ baseUrl: 'http://localhost:8100', timeoutMs: 20, fetchImpl });

    const result = await client.getFeedback('user-1');

    expect(result.status).toBe('unavailable');
    expect(result.unavailableReason).toContain('timed out');
  });

  it('resolves to status "unavailable" when the response body is not valid JSON', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError('Unexpected token in JSON');
      },
    } as unknown as Response);
    const client = new HttpMentorFeedbackClient({ baseUrl: 'http://localhost:8100', fetchImpl });

    const result = await client.getFeedback('user-1');

    expect(result.status).toBe('unavailable');
    expect(result.unavailableReason).toContain('not valid JSON');
  });

  it.each([
    ['not an object', 'a string'],
    ['an array', ['not', 'an', 'object']],
    ['missing status', { feedback: [] }],
    ['an unexpected status value', { status: 'ok', feedback: [] }],
    ['a non-array feedback', { status: 'ready', feedback: 'not-an-array' }],
    ['a feedback item missing message', { status: 'ready', feedback: [{ confidence: 0.5 }] }],
    [
      'a feedback item with a non-numeric confidence',
      { status: 'ready', feedback: [{ message: 'x', confidence: 'high', grounded_in_belief_ids: [], why: 'x', risk_tier: 'low' }] },
    ],
    [
      'a feedback item with non-string belief ids',
      {
        status: 'ready',
        feedback: [{ message: 'x', confidence: 0.5, grounded_in_belief_ids: [1, 2], why: 'x', risk_tier: 'low' }],
      },
    ],
    [
      'a feedback item with an invalid risk_tier',
      {
        status: 'ready',
        feedback: [{ message: 'x', confidence: 0.5, grounded_in_belief_ids: [], why: 'x', risk_tier: 'extreme' }],
      },
    ],
    [
      'a feedback item with a non-string recommended_next_action',
      {
        status: 'ready',
        feedback: [
          { message: 'x', confidence: 0.5, grounded_in_belief_ids: [], why: 'x', risk_tier: 'low', recommended_next_action: 5 },
        ],
      },
    ],
  ])('resolves to status "unavailable" for a malformed response shape: %s', async (_label, malformedBody) => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, malformedBody));
    const client = new HttpMentorFeedbackClient({ baseUrl: 'http://localhost:8100', fetchImpl });

    const result = await client.getFeedback('user-1');

    expect(result.status).toBe('unavailable');
    expect(result.feedback).toEqual([]);
    expect(result.unavailableReason).toBeTruthy();
  });
});
