import { describe, expect, it, vi } from 'vitest';
import type { ActivityEvent } from '@better-you/contracts';
import { NoopActivityEventSyncClient } from '../noopActivityEventSyncClient';

const EVENT: ActivityEvent = {
  id: 'event-1',
  userId: 'user-1',
  occurredAt: '2026-01-15T00:00:00.000Z',
  type: 'goal_created',
  data: { goalId: 'goal-1', category: 'career', source: 'custom' },
};

describe('NoopActivityEventSyncClient', () => {
  it('resolves successfully without making a network call', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    await expect(new NoopActivityEventSyncClient().sync(EVENT)).resolves.toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();

    fetchSpy.mockRestore();
  });
});
