import { describe, expect, it, vi } from 'vitest';
import type { ActivityEvent, ActivityEventType } from '@better-you/contracts';
import { HttpActivityEventSyncClient } from '../httpActivityEventSyncClient';

function jsonResponse(status: number): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => ({}) } as Response;
}

const OCCURRED_AT = '2026-01-15T00:00:00.000Z';

// One representative full ActivityEvent per type (id/userId/occurredAt
// included, unlike activityEventShape.test.ts's RecordActivityEventInput
// table) paired with the exact `structured_data` this client must send for
// it - mirrors that file's `Record<ActivityEventType, ...>` exhaustiveness
// pattern so a 9th event type added to the contract without an entry here
// is a compile error, not a silently-untested gap.
const SAMPLE_EVENT_BY_TYPE: Record<ActivityEventType, ActivityEvent> = {
  goal_created: {
    id: 'event-1',
    userId: 'user-1',
    occurredAt: OCCURRED_AT,
    type: 'goal_created',
    data: { goalId: 'goal-1', category: 'career', source: 'custom' },
  },
  goal_paused: {
    id: 'event-2',
    userId: 'user-1',
    occurredAt: OCCURRED_AT,
    type: 'goal_paused',
    data: { goalId: 'goal-1' },
  },
  goal_resumed: {
    id: 'event-3',
    userId: 'user-1',
    occurredAt: OCCURRED_AT,
    type: 'goal_resumed',
    data: { goalId: 'goal-1' },
  },
  goal_completed: {
    id: 'event-4',
    userId: 'user-1',
    occurredAt: OCCURRED_AT,
    type: 'goal_completed',
    data: { goalId: 'goal-1' },
  },
  goal_archived: {
    id: 'event-5',
    userId: 'user-1',
    occurredAt: OCCURRED_AT,
    type: 'goal_archived',
    data: { goalId: 'goal-1' },
  },
  check_in_recorded: {
    id: 'event-6',
    userId: 'user-1',
    occurredAt: OCCURRED_AT,
    type: 'check_in_recorded',
    data: { goalId: 'goal-1', checkInId: 'check-in-1', response: 'yes' },
  },
  roadmap_generated: {
    id: 'event-7',
    userId: 'user-1',
    occurredAt: OCCURRED_AT,
    type: 'roadmap_generated',
    data: { goalId: 'goal-1', roadmapId: 'roadmap-1', milestoneCount: 3 },
  },
  roadmap_step_completed: {
    id: 'event-8',
    userId: 'user-1',
    occurredAt: OCCURRED_AT,
    type: 'roadmap_step_completed',
    data: { goalId: 'goal-1', roadmapId: 'roadmap-1', milestoneId: 'milestone-1', actionStepId: 'step-1' },
  },
};

const EXPECTED_STRUCTURED_DATA_BY_TYPE: Record<ActivityEventType, Record<string, unknown>> = {
  goal_created: { goalId: 'goal-1', category: 'career', source: 'custom' },
  goal_paused: { goalId: 'goal-1' },
  goal_resumed: { goalId: 'goal-1' },
  goal_completed: { goalId: 'goal-1' },
  goal_archived: { goalId: 'goal-1' },
  check_in_recorded: { goalId: 'goal-1', checkInId: 'check-in-1', response: 'yes' },
  roadmap_generated: { goalId: 'goal-1', roadmapId: 'roadmap-1', milestoneCount: 3 },
  roadmap_step_completed: {
    goalId: 'goal-1',
    roadmapId: 'roadmap-1',
    milestoneId: 'milestone-1',
    actionStepId: 'step-1',
  },
};

// Same generic banned-key sweep as activityEventShape.test.ts, applied to
// the wire payload this client actually sends rather than the in-process
// ActivityEvent - it is the payload leaving the process that matters here.
const BANNED_KEYS = ['title', 'description', 'note', 'notes', 'text', 'message', 'prompt', 'content', 'summary', 'body'];

// A successful sync() now also fires the ADR 0028 processing trigger (a
// second, best-effort POST /users/{userId}/process) - these tests only
// care about the /events call, so this filters that trigger out rather
// than asserting a raw total call count. activityEventProcessingTrigger.test.ts
// covers the processing trigger itself in isolation.
function eventsCalls(fetchImpl: ReturnType<typeof vi.fn>): any[][] {
  return fetchImpl.mock.calls.filter((call: any[]) => typeof call[0] === 'string' && call[0].endsWith('/events'));
}

describe('HttpActivityEventSyncClient', () => {
  const eventTypes = Object.keys(SAMPLE_EVENT_BY_TYPE) as ActivityEventType[];

  it.each(eventTypes)('maps a %s ActivityEvent to the AI Models POST /events contract', async (type) => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(201));
    const client = new HttpActivityEventSyncClient({ baseUrl: 'http://localhost:8100', fetchImpl });

    await client.sync(SAMPLE_EVENT_BY_TYPE[type]);

    expect(eventsCalls(fetchImpl)).toHaveLength(1);
    const [url, init] = eventsCalls(fetchImpl)[0];
    expect(url).toBe('http://localhost:8100/events');
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');

    const body = JSON.parse(init.body);
    expect(body).toEqual({
      user_id: 'user-1',
      event_id: SAMPLE_EVENT_BY_TYPE[type].id,
      event_type: type,
      source: 'better_you',
      timestamp: OCCURRED_AT,
      structured_data: EXPECTED_STRUCTURED_DATA_BY_TYPE[type],
    });
  });

  it.each(eventTypes)('never sends a banned free-text-shaped key for a %s event', async (type) => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(201));
    const client = new HttpActivityEventSyncClient({ baseUrl: 'http://localhost:8100', fetchImpl });

    await client.sync(SAMPLE_EVENT_BY_TYPE[type]);

    const rawBody: string = fetchImpl.mock.calls[0][1].body;
    for (const banned of BANNED_KEYS) {
      expect(rawBody).not.toContain(`"${banned}"`);
    }
  });

  it('never sends a raw_content field - ActivityEvent carries no free text to put there', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(201));
    const client = new HttpActivityEventSyncClient({ baseUrl: 'http://localhost:8100', fetchImpl });

    await client.sync(SAMPLE_EVENT_BY_TYPE.goal_created);

    const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(body).not.toHaveProperty('raw_content');
  });

  it('includes an Authorization header only when a serviceToken is configured', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(201));
    const withToken = new HttpActivityEventSyncClient({
      baseUrl: 'http://localhost:8100',
      serviceToken: 'secret-token',
      fetchImpl,
    });
    await withToken.sync(SAMPLE_EVENT_BY_TYPE.goal_created);
    expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBe('Bearer secret-token');

    fetchImpl.mockClear();
    const withoutToken = new HttpActivityEventSyncClient({ baseUrl: 'http://localhost:8100', fetchImpl });
    await withoutToken.sync(SAMPLE_EVENT_BY_TYPE.goal_created);
    expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });

  it('strips a trailing slash from baseUrl', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(201));
    const client = new HttpActivityEventSyncClient({ baseUrl: 'http://localhost:8100/', fetchImpl });
    await client.sync(SAMPLE_EVENT_BY_TYPE.goal_created);
    expect(fetchImpl.mock.calls[0][0]).toBe('http://localhost:8100/events');
  });

  it('resolves without throwing when the AI server is unreachable', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    const client = new HttpActivityEventSyncClient({ baseUrl: 'http://localhost:8100', fetchImpl });
    await expect(client.sync(SAMPLE_EVENT_BY_TYPE.goal_created)).resolves.toBeUndefined();
  });

  it('resolves without throwing when the request times out', async () => {
    const fetchImpl = vi.fn().mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
        })
    );
    const client = new HttpActivityEventSyncClient({ baseUrl: 'http://localhost:8100', timeoutMs: 5, fetchImpl });
    await expect(client.sync(SAMPLE_EVENT_BY_TYPE.goal_created)).resolves.toBeUndefined();
  });

  it('resolves without throwing when the AI server rejects the event with a non-2xx response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(422));
    const client = new HttpActivityEventSyncClient({ baseUrl: 'http://localhost:8100', fetchImpl });
    await expect(client.sync(SAMPLE_EVENT_BY_TYPE.goal_created)).resolves.toBeUndefined();
  });
});
