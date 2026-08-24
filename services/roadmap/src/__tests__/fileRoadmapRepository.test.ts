import { describe, expect, it, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import type { Roadmap } from '@better-you/contracts';
import { FileRoadmapRepository } from '../fileRoadmapRepository';

const tempDirs: string[] = [];

function makeTempFilePath(name: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'better-you-roadmap-'));
  tempDirs.push(dir);
  return path.join(dir, name);
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function makeRoadmap(overrides: Partial<Roadmap>): Roadmap {
  return {
    id: 'roadmap-1',
    userId: 'user-1',
    goalId: 'goal-1',
    status: 'active',
    milestones: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('FileRoadmapRepository', () => {
  it('survives a simulated restart', async () => {
    const filePath = makeTempFilePath('roadmaps.json');
    const before = new FileRoadmapRepository(filePath);
    await before.create(makeRoadmap({ id: 'roadmap-1', goalId: 'goal-1' }));

    const after = new FileRoadmapRepository(filePath);
    const found = await after.findByGoalId('goal-1');
    expect(found?.id).toBe('roadmap-1');
  });

  it('persists updates across a restart', async () => {
    const filePath = makeTempFilePath('roadmaps.json');
    const before = new FileRoadmapRepository(filePath);
    const created = await before.create(makeRoadmap({ id: 'roadmap-1' }));
    await before.update({ ...created, status: 'completed' });

    const after = new FileRoadmapRepository(filePath);
    const found = await after.findById('roadmap-1');
    expect(found?.status).toBe('completed');
  });

  it('starts empty against a data directory that does not exist yet', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'better-you-roadmap-'));
    tempDirs.push(dir);
    const filePath = path.join(dir, 'nested', 'roadmaps.json');
    const repo = new FileRoadmapRepository(filePath);
    expect(await repo.listByUser('user-1')).toEqual([]);
  });
});
