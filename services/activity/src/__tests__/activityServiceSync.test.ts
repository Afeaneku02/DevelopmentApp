import { describe, expect, it, vi } from 'vitest';
import type { ActivityEvent, RecordActivityEventInput } from '@better-you/contracts';
import { ActivityService } from '../activityService';
import { InMemoryActivityEventRepository } from '../activityEventRepository';
import type { ActivityEventSyncClient } from '../activityEventSyncClient';
import { HttpActivityEventSyncClient } from '../httpActivityEventSyncClient';

const NOW = new Date('2026-01-15T00:00:00.000Z');

const GOAL_CREATED_INPUT: RecordActivityEventInput = {
  userId: 'user-1',
  type: 'goal_created',
  data: { goalId: 'goal-1', category: 'career', source: 'custom' },
};

function jsonResponse(status: number): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => ({}) } as Response;
}

// This file covers the guarantees that live at the ActivityService level
// (constructor default, and the write path surviving a sync failure);
// httpActivityEventSyncClient.test.ts covers the wire-payload mapping in
// isolation, and activityEventShape.test.ts covers the underlying
// ActivityEvent privacy invariant independent of any sync client.
describe('ActivityService (AI Models sync, ADR 0027)', () => {
  it('is a no-op with no third constructor argument (AI_MODELS_BASE_URL unset) - behavior is unchanged', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const repository = new InMemoryActivityEventRepository();
    const service = new ActivityService(repository, () => NOW);

    const event = await service.recordEvent(GOAL_CREATED_INPUT);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(event.userId).toBe('user-1');
    expect(await service.listEvents('user-1')).toEqual([event]);

    fetchSpy.mockRestore();
  });

  it('still records the event and returns normally when the AI server is unreachable', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    const syncClient = new HttpActivityEventSyncClient({ baseUrl: 'http://localhost:8100', fetchImpl });
    const repository = new InMemoryActivityEventRepository();
    const service = new ActivityService(repository, () => NOW, syncClient);

    const event = await service.recordEvent(GOAL_CREATED_INPUT);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(event.id).toBeTruthy();
    expect(await service.listEvents('user-1')).toEqual([event]);
  });

  it('still records the event and returns normally when the AI server rejects the event', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(422));
    const syncClient = new HttpActivityEventSyncClient({ baseUrl: 'http://localhost:8100', fetchImpl });
    const repository = new InMemoryActivityEventRepository();
    const service = new ActivityService(repository, () => NOW, syncClient);

    const event = await service.recordEvent(GOAL_CREATED_INPUT);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(await service.listEvents('user-1')).toEqual([event]);
  });

  it('still records the event and returns normally even if a syncClient breaks its own never-throw contract', async () => {
    // Defense in depth: ActivityService's own try/catch around the sync
    // call must protect the write path even if some future
    // ActivityEventSyncClient implementation has a bug and rejects.
    const brokenSyncClient: ActivityEventSyncClient = {
      sync: vi.fn().mockRejectedValue(new Error('bug: this should never happen')),
    };
    const repository = new InMemoryActivityEventRepository();
    const service = new ActivityService(repository, () => NOW, brokenSyncClient);

    const event = await service.recordEvent(GOAL_CREATED_INPUT);

    expect(brokenSyncClient.sync).toHaveBeenCalledTimes(1);
    expect(await service.listEvents('user-1')).toEqual([event]);
  });

  it('forwards the fully-stamped event (server-assigned id and occurredAt) to the sync client', async () => {
    const syncedEvents: ActivityEvent[] = [];
    const syncClient: ActivityEventSyncClient = {
      sync: vi.fn().mockImplementation(async (event: ActivityEvent) => {
        syncedEvents.push(event);
      }),
    };
    const repository = new InMemoryActivityEventRepository();
    const service = new ActivityService(repository, () => NOW, syncClient);

    const event = await service.recordEvent(GOAL_CREATED_INPUT);

    expect(syncedEvents).toEqual([event]);
    expect(syncedEvents[0].id).toBeTruthy();
    expect(syncedEvents[0].occurredAt).toBe(NOW.toISOString());
  });

  // The two tests below are the actual regression guard for the
  // non-blocking requirement: recordEvent() must never wait on the sync
  // call, regardless of how slow or hung it is. If recordEvent() ever goes
  // back to awaiting syncClient.sync() directly, the first test here hangs
  // until vitest's own test timeout and fails - it cannot pass by
  // coincidence the way a loose "elapsed < N ms" assertion alone might.
  it('resolves without waiting for a sync client that never settles', async () => {
    const hungSyncClient: ActivityEventSyncClient = {
      sync: () => new Promise<void>(() => {}), // deliberately never resolves or rejects
    };
    const repository = new InMemoryActivityEventRepository();
    const service = new ActivityService(repository, () => NOW, hungSyncClient);

    const startedAt = Date.now();
    const event = await service.recordEvent(GOAL_CREATED_INPUT);
    const elapsedMs = Date.now() - startedAt;

    expect(elapsedMs).toBeLessThan(100);
    expect(await service.listEvents('user-1')).toEqual([event]);
  });

  it('resolves in well under HttpActivityEventSyncClient\'s own timeout when the AI server is slow to respond', async () => {
    // A realistic "slow/hung server" simulation: the fetch call only
    // settles when HttpActivityEventSyncClient's own AbortController fires,
    // exactly like a real fetch would behave against a server that never
    // responds. If ActivityService still awaited the sync call, this test
    // would take the full 2000ms below; instead it must return almost
    // immediately.
    const fetchImpl = vi.fn().mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
        })
    );
    const syncClient = new HttpActivityEventSyncClient({ baseUrl: 'http://localhost:8100', timeoutMs: 2000, fetchImpl });
    const repository = new InMemoryActivityEventRepository();
    const service = new ActivityService(repository, () => NOW, syncClient);

    const startedAt = Date.now();
    const event = await service.recordEvent(GOAL_CREATED_INPUT);
    const elapsedMs = Date.now() - startedAt;

    expect(elapsedMs).toBeLessThan(100);
    expect(await service.listEvents('user-1')).toEqual([event]);
  });
});
