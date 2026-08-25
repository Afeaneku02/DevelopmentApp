import { describe, expect, it, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import type { ActivityEvent } from '@better-you/contracts';
import { FileActivityEventRepository } from '../fileActivityEventRepository';

const tempDirs: string[] = [];

function makeTempFilePath(name: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'better-you-activity-'));
  tempDirs.push(dir);
  return path.join(dir, name);
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function makeEvent(overrides: Partial<ActivityEvent>): ActivityEvent {
  return {
    id: 'event-1',
    userId: 'user-1',
    type: 'goal_created',
    data: { goalId: 'goal-1', category: 'career', source: 'custom' },
    occurredAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  } as ActivityEvent;
}

describe('FileActivityEventRepository', () => {
  it('survives a simulated restart and preserves chronological ordering', async () => {
    const filePath = makeTempFilePath('activity.json');
    const before = new FileActivityEventRepository(filePath);
    await before.create(makeEvent({ id: 'event-2', occurredAt: '2026-01-02T00:00:00.000Z' }));
    await before.create(makeEvent({ id: 'event-1', occurredAt: '2026-01-01T00:00:00.000Z' }));

    const after = new FileActivityEventRepository(filePath);
    const events = await after.listByUser('user-1');
    expect(events.map((e) => e.id)).toEqual(['event-1', 'event-2']);
  });

  it('preserves insertion order for events with identical occurredAt timestamps, even after a restart', async () => {
    const filePath = makeTempFilePath('activity.json');
    const before = new FileActivityEventRepository(filePath);
    const tiedTimestamp = '2026-01-01T00:00:00.000Z';
    await before.create(makeEvent({ id: 'event-1', occurredAt: tiedTimestamp }));
    await before.create(makeEvent({ id: 'event-2', occurredAt: tiedTimestamp }));
    await before.create(makeEvent({ id: 'event-3', occurredAt: tiedTimestamp }));

    const after = new FileActivityEventRepository(filePath);
    const events = await after.listByUser('user-1');
    expect(events.map((e) => e.id)).toEqual(['event-1', 'event-2', 'event-3']);
  });

  it('scopes listByUser correctly after a restart', async () => {
    const filePath = makeTempFilePath('activity.json');
    const before = new FileActivityEventRepository(filePath);
    await before.create(makeEvent({ id: 'event-1', userId: 'user-1' }));
    await before.create(makeEvent({ id: 'event-2', userId: 'user-2' }));

    const after = new FileActivityEventRepository(filePath);
    const user1Events = await after.listByUser('user-1');
    expect(user1Events).toHaveLength(1);
    expect(user1Events[0].id).toBe('event-1');
  });

  it('starts empty against a data directory that does not exist yet', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'better-you-activity-'));
    tempDirs.push(dir);
    const filePath = path.join(dir, 'nested', 'activity.json');
    const repo = new FileActivityEventRepository(filePath);
    expect(await repo.listByUser('user-1')).toEqual([]);
  });
});
