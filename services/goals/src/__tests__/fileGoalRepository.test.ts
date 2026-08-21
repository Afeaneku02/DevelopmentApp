import { describe, expect, it, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import type { Goal } from '@better-you/contracts';
import { FileGoalRepository } from '../fileGoalRepository';
import { FileGoalHistoryRepository } from '../fileGoalHistoryRepository';

const tempDirs: string[] = [];

function makeTempFilePath(name: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'better-you-goals-'));
  tempDirs.push(dir);
  return path.join(dir, name);
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function makeGoal(overrides: Partial<Goal>): Goal {
  return {
    id: 'goal-1',
    userId: 'user-1',
    title: 'A goal',
    description: '',
    category: 'career',
    source: 'custom',
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('FileGoalRepository', () => {
  it('survives a simulated restart: a new instance sees data written by a previous one', async () => {
    const filePath = makeTempFilePath('goals.json');
    const before = new FileGoalRepository(filePath);
    await before.create(makeGoal({ id: 'goal-1', title: 'Run a marathon' }));
    await before.create(makeGoal({ id: 'goal-2', title: 'Read more', createdAt: '2026-01-02T00:00:00.000Z' }));

    // A brand-new instance, as server startup would construct after a
    // restart - no shared in-memory state with `before`.
    const after = new FileGoalRepository(filePath);
    const goals = await after.listByUser('user-1');
    expect(goals.map((g) => g.title)).toEqual(['Run a marathon', 'Read more']);
  });

  it('persists updates, not just creates', async () => {
    const filePath = makeTempFilePath('goals.json');
    const before = new FileGoalRepository(filePath);
    const goal = await before.create(makeGoal({ id: 'goal-1', status: 'active' }));
    await before.update({ ...goal, status: 'paused' });

    const after = new FileGoalRepository(filePath);
    const found = await after.findById('goal-1');
    expect(found?.status).toBe('paused');
  });

  it('starts empty against a data directory that does not exist yet', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'better-you-goals-'));
    tempDirs.push(dir);
    const filePath = path.join(dir, 'nested', 'goals.json');
    const repo = new FileGoalRepository(filePath);
    expect(await repo.listByUser('user-1')).toEqual([]);
  });
});

describe('FileGoalHistoryRepository', () => {
  it('survives a simulated restart and preserves oldest-first ordering', async () => {
    const filePath = makeTempFilePath('goal-history.json');
    const before = new FileGoalHistoryRepository(filePath);
    const snapshot = makeGoal({ id: 'goal-1' });
    await before.record({
      id: 'event-1',
      goalId: 'goal-1',
      eventType: 'created',
      snapshot,
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    await before.record({
      id: 'event-2',
      goalId: 'goal-1',
      eventType: 'paused',
      snapshot: { ...snapshot, status: 'paused' },
      createdAt: '2026-01-02T00:00:00.000Z',
    });

    const after = new FileGoalHistoryRepository(filePath);
    const events = await after.listByGoalId('goal-1');
    expect(events.map((e) => e.eventType)).toEqual(['created', 'paused']);
  });
});
