import { describe, expect, it, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import type { CheckIn } from '@better-you/contracts';
import { FileCheckInRepository } from '../fileCheckInRepository';

const tempDirs: string[] = [];

function makeTempFilePath(name: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'better-you-check-ins-'));
  tempDirs.push(dir);
  return path.join(dir, name);
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function makeCheckIn(overrides: Partial<CheckIn>): CheckIn {
  return {
    id: 'check-in-1',
    userId: 'user-1',
    goalId: 'goal-1',
    response: 'yes',
    note: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('FileCheckInRepository', () => {
  it('survives a simulated restart and preserves newest-first ordering', async () => {
    const filePath = makeTempFilePath('check-ins.json');
    const before = new FileCheckInRepository(filePath);
    await before.create(makeCheckIn({ id: 'check-in-1', response: 'no', createdAt: '2026-01-01T00:00:00.000Z' }));
    await before.create(makeCheckIn({ id: 'check-in-2', response: 'yes', createdAt: '2026-01-02T00:00:00.000Z' }));

    const after = new FileCheckInRepository(filePath);
    const checkIns = await after.listByUser('user-1');
    expect(checkIns.map((c) => c.response)).toEqual(['yes', 'no']);
  });

  it('scopes listByGoalId correctly after a restart', async () => {
    const filePath = makeTempFilePath('check-ins.json');
    const before = new FileCheckInRepository(filePath);
    await before.create(makeCheckIn({ id: 'check-in-1', goalId: 'goal-1' }));
    await before.create(makeCheckIn({ id: 'check-in-2', goalId: 'goal-2' }));

    const after = new FileCheckInRepository(filePath);
    const goal1CheckIns = await after.listByGoalId('goal-1');
    expect(goal1CheckIns).toHaveLength(1);
    expect(goal1CheckIns[0].id).toBe('check-in-1');
  });

  it('starts empty against a data directory that does not exist yet', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'better-you-check-ins-'));
    tempDirs.push(dir);
    const filePath = path.join(dir, 'nested', 'check-ins.json');
    const repo = new FileCheckInRepository(filePath);
    expect(await repo.listByUser('user-1')).toEqual([]);
  });
});
