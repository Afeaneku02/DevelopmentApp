import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActivityEvent } from '@better-you/contracts';
import { HttpActivityEventSyncClient } from '../httpActivityEventSyncClient';
import { NoopActivityEventSyncClient } from '../noopActivityEventSyncClient';

// Covers the ADR 0028 processing trigger this client fires after a
// successful `POST /events` call - httpActivityEventSyncClient.test.ts
// already covers the /events payload mapping itself, so every test here
// only cares about whether/how `POST /users/{userId}/process` gets called.

const EVENT: ActivityEvent = {
  id: 'event-1',
  userId: 'user-1',
  occurredAt: '2026-01-15T00:00:00.000Z',
  type: 'goal_created',
  data: { goalId: 'goal-1', category: 'career', source: 'custom' },
};

function otherUserEvent(userId: string, id: string): ActivityEvent {
  return { ...EVENT, id, userId };
}

function eventsResponse(status: number): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => ({}) } as Response;
}

function processingResponse(status: number, body: unknown = { counts: { processed: 1, failed: 0 } }): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

function malformedJsonResponse(status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => {
      throw new Error('invalid json');
    },
  } as unknown as Response;
}

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

async function flush(): Promise<void> {
  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));
}

function processingCalls(fetchImpl: ReturnType<typeof vi.fn>): any[][] {
  return fetchImpl.mock.calls.filter((call: any[]) => typeof call[0] === 'string' && call[0].includes('/process'));
}

describe('HttpActivityEventSyncClient processing trigger (ADR 0028)', () => {
  let consoleInfoSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleInfoSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('triggers POST /users/{userId}/process with { dry_run: false } after a successful event sync', async () => {
    const fetchImpl = vi.fn().mockImplementation((url: string) =>
      url.endsWith('/events') ? Promise.resolve(eventsResponse(201)) : Promise.resolve(processingResponse(200))
    );
    const client = new HttpActivityEventSyncClient({ baseUrl: 'http://localhost:8100', fetchImpl });

    await client.sync(EVENT);
    await flush();

    const calls = processingCalls(fetchImpl);
    expect(calls).toHaveLength(1);
    const [url, init] = calls[0];
    expect(url).toBe('http://localhost:8100/users/user-1/process');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ dry_run: false });
  });

  it('includes an Authorization header on the processing request when a serviceToken is configured', async () => {
    const fetchImpl = vi.fn().mockImplementation((url: string) =>
      url.endsWith('/events') ? Promise.resolve(eventsResponse(201)) : Promise.resolve(processingResponse(200))
    );
    const client = new HttpActivityEventSyncClient({
      baseUrl: 'http://localhost:8100',
      serviceToken: 'secret-token',
      fetchImpl,
    });

    await client.sync(EVENT);
    await flush();

    const [, init] = processingCalls(fetchImpl)[0];
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer secret-token');
  });

  it('never triggers processing when configuration is absent (NoopActivityEventSyncClient)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const client = new NoopActivityEventSyncClient();

    await client.sync(EVENT);

    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('does not trigger processing when the event sync itself fails (network error)', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    const client = new HttpActivityEventSyncClient({ baseUrl: 'http://localhost:8100', fetchImpl });

    await client.sync(EVENT);
    await flush();

    expect(processingCalls(fetchImpl)).toHaveLength(0);
  });

  it('does not trigger processing when the event sync receives a non-2xx response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(eventsResponse(422));
    const client = new HttpActivityEventSyncClient({ baseUrl: 'http://localhost:8100', fetchImpl });

    await client.sync(EVENT);
    await flush();

    expect(processingCalls(fetchImpl)).toHaveLength(0);
  });

  it('resolves sync() without waiting for the processing request to complete', async () => {
    const fetchImpl = vi.fn().mockImplementation((url: string) =>
      url.endsWith('/events') ? Promise.resolve(eventsResponse(201)) : new Promise<Response>(() => {})
    );
    const client = new HttpActivityEventSyncClient({ baseUrl: 'http://localhost:8100', fetchImpl });

    const startedAt = Date.now();
    await client.sync(EVENT);
    expect(Date.now() - startedAt).toBeLessThan(100);
  });

  it('resolves without throwing and logs a warning when the processing request fails (network error)', async () => {
    const fetchImpl = vi.fn().mockImplementation((url: string) =>
      url.endsWith('/events') ? Promise.resolve(eventsResponse(201)) : Promise.reject(new Error('ECONNREFUSED'))
    );
    const client = new HttpActivityEventSyncClient({ baseUrl: 'http://localhost:8100', fetchImpl });

    await expect(client.sync(EVENT)).resolves.toBeUndefined();
    await flush();

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('"status":"error"')
    );
    expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('"errorCategory":"network_error"'));
  });

  it('resolves without throwing and logs a timeout when the processing request times out', async () => {
    // A fetch that hangs on /process until the client's own AbortController
    // fires - the same pattern httpActivityEventSyncClient.test.ts uses for
    // the /events timeout case.
    const hangingFetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url.endsWith('/events')) return Promise.resolve(eventsResponse(201));
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () =>
          reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))
        );
      });
    });
    const client = new HttpActivityEventSyncClient({
      baseUrl: 'http://localhost:8100',
      processingTimeoutMs: 5,
      fetchImpl: hangingFetch,
    });

    await expect(client.sync(EVENT)).resolves.toBeUndefined();
    // sync() itself doesn't wait on the processing trigger (that's the
    // point of the previous test), so this needs real wall-clock time for
    // processingTimeoutMs's own abort timer to fire - longer than flush()'s
    // couple of zero-delay ticks.
    await new Promise((r) => setTimeout(r, 50));

    expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('"errorCategory":"timeout"'));
  });

  it('resolves without throwing and logs a warning when the processing service responds with a non-2xx status', async () => {
    const fetchImpl = vi.fn().mockImplementation((url: string) =>
      url.endsWith('/events') ? Promise.resolve(eventsResponse(201)) : Promise.resolve(processingResponse(500))
    );
    const client = new HttpActivityEventSyncClient({ baseUrl: 'http://localhost:8100', fetchImpl });

    await expect(client.sync(EVENT)).resolves.toBeUndefined();
    await flush();

    expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('"status":"http_error"'));
    expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('"httpStatus":500'));
  });

  it('resolves without throwing and logs a warning when the processing response is not valid JSON', async () => {
    const fetchImpl = vi.fn().mockImplementation((url: string) =>
      url.endsWith('/events') ? Promise.resolve(eventsResponse(201)) : Promise.resolve(malformedJsonResponse())
    );
    const client = new HttpActivityEventSyncClient({ baseUrl: 'http://localhost:8100', fetchImpl });

    await expect(client.sync(EVENT)).resolves.toBeUndefined();
    await flush();

    expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('"status":"malformed_response"'));
  });

  it('resolves without throwing and logs a warning when the processing response is valid JSON but the wrong shape', async () => {
    const fetchImpl = vi.fn().mockImplementation((url: string) =>
      url.endsWith('/events') ? Promise.resolve(eventsResponse(201)) : Promise.resolve(processingResponse(200, ['not', 'an', 'object']))
    );
    const client = new HttpActivityEventSyncClient({ baseUrl: 'http://localhost:8100', fetchImpl });

    await expect(client.sync(EVENT)).resolves.toBeUndefined();
    await flush();

    expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('"status":"malformed_response"'));
  });

  it('logs processed/failed counts and treats a response with failures as a partial failure, without throwing', async () => {
    const fetchImpl = vi.fn().mockImplementation((url: string) =>
      url.endsWith('/events')
        ? Promise.resolve(eventsResponse(201))
        : Promise.resolve(processingResponse(200, { counts: { processed: 5, failed: 2 } }))
    );
    const client = new HttpActivityEventSyncClient({ baseUrl: 'http://localhost:8100', fetchImpl });

    await expect(client.sync(EVENT)).resolves.toBeUndefined();
    await flush();

    expect(consoleInfoSpy).toHaveBeenCalledWith(expect.stringContaining('"status":"partial_failure"'));
    expect(consoleInfoSpy).toHaveBeenCalledWith(expect.stringContaining('"processed":5'));
    expect(consoleInfoSpy).toHaveBeenCalledWith(expect.stringContaining('"failed":2'));
  });

  it('never logs activity contents - only structured metadata keys ever appear in a processing log line', async () => {
    const bannedSubstrings = ['goalId', 'goal_id', 'title', 'description', 'notes', 'checkInId', 'roadmapId'];
    const fetchImpl = vi.fn().mockImplementation((url: string) =>
      url.endsWith('/events')
        ? Promise.resolve(eventsResponse(201))
        : Promise.resolve(
            processingResponse(200, {
              counts: { processed: 1, failed: 0 },
              goalId: 'should-never-be-logged',
            })
          )
    );
    const client = new HttpActivityEventSyncClient({ baseUrl: 'http://localhost:8100', fetchImpl });

    await client.sync(EVENT);
    await flush();

    const loggedLines = [...consoleInfoSpy.mock.calls, ...consoleWarnSpy.mock.calls, ...consoleErrorSpy.mock.calls]
      .map((call) => call.join(' '))
      .join('\n');
    for (const banned of bannedSubstrings) {
      expect(loggedLines).not.toContain(banned);
    }
  });

  it('allows only one processing request per user in flight, running exactly one coalesced follow-up for events that arrive mid-run', async () => {
    const processingDeferreds: Array<Deferred<Response>> = [];
    const fetchImpl = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith('/events')) return Promise.resolve(eventsResponse(201));
      const d = deferred<Response>();
      processingDeferreds.push(d);
      return d.promise;
    });
    const client = new HttpActivityEventSyncClient({ baseUrl: 'http://localhost:8100', fetchImpl });

    // First event starts processing run #1, which stays in flight.
    await client.sync(otherUserEvent('user-1', 'event-1'));
    await flush();
    expect(processingCalls(fetchImpl)).toHaveLength(1);

    // Two more events for the same user arrive while run #1 is still in
    // flight - neither should start a second concurrent request.
    await client.sync(otherUserEvent('user-1', 'event-2'));
    await client.sync(otherUserEvent('user-1', 'event-3'));
    await flush();
    expect(processingCalls(fetchImpl)).toHaveLength(1);

    // Run #1 finishes - exactly one coalesced follow-up run should start,
    // not one per queued event.
    processingDeferreds[0].resolve(processingResponse(200));
    await flush();
    expect(processingCalls(fetchImpl)).toHaveLength(2);

    // Run #2 finishes with nothing further queued - no third run starts.
    processingDeferreds[1].resolve(processingResponse(200));
    await flush();
    expect(processingCalls(fetchImpl)).toHaveLength(2);
  });

  it('tracks processing state independently per user - one user in flight never blocks another', async () => {
    const processingDeferreds: Array<Deferred<Response>> = [];
    const fetchImpl = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith('/events')) return Promise.resolve(eventsResponse(201));
      const d = deferred<Response>();
      processingDeferreds.push(d);
      return d.promise;
    });
    const client = new HttpActivityEventSyncClient({ baseUrl: 'http://localhost:8100', fetchImpl });

    await client.sync(otherUserEvent('user-1', 'event-1'));
    await client.sync(otherUserEvent('user-2', 'event-2'));
    await flush();

    const calls = processingCalls(fetchImpl);
    expect(calls).toHaveLength(2);
    const urls = calls.map(([url]) => url);
    expect(urls).toContain('http://localhost:8100/users/user-1/process');
    expect(urls).toContain('http://localhost:8100/users/user-2/process');

    processingDeferreds[0].resolve(processingResponse(200));
    processingDeferreds[1].resolve(processingResponse(200));
    await flush();
  });
});
