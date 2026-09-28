import { describe, it, expect, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Goal } from '@better-you/contracts';
import { RoadmapService } from '../roadmapService';
import { FileRoadmapRepository } from '../fileRoadmapRepository';
import { InMemoryRoadmapRepository } from '../roadmapRepository';

const goal = { id: 'g', userId: 'u', status: 'active' } as Goal;
const lookup = { getGoal: async () => goal };
const generator = { generateRoadmap: vi.fn(async () => ({ milestones: [{ title: 'Existing', actionSteps: [{ title: 'Original' }] }] })) };

describe('mentor action persistence', () => {
  it('retains long action text after a repository restart without invoking AI', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'better-you-accepted-action-'));
    try {
      const file = join(dir, 'roadmaps.json');
      const service = new RoadmapService(new FileRoadmapRepository(file), lookup, generator);
      const action = '🚶'.repeat(500);
      const saved = await service.addMentorAction('u', 'g', action);
      const reloaded = new RoadmapService(new FileRoadmapRepository(file), lookup, generator);
      expect(await reloaded.getRoadmapForGoal('u', 'g')).toEqual(saved);
      expect(saved.milestones[0].actionSteps[0].description).toBe(action);
      expect(await reloaded.addMentorAction('u', 'g', action)).toEqual(saved);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('serializes acceptance with completion so neither write is lost', async () => {
    const service = new RoadmapService(new InMemoryRoadmapRepository(), lookup, generator);
    const original = await service.generateRoadmap('u', 'g');
    await Promise.all([
      service.completeActionStep('u', original.id, original.milestones[0].actionSteps[0].id),
      service.addMentorAction('u', 'g', 'New action'),
    ]);
    const roadmap = (await service.getRoadmapForGoal('u', 'g'))!;
    const steps = roadmap.milestones.flatMap((m) => m.actionSteps);
    expect(steps).toHaveLength(2);
    expect(steps.find((s) => s.title === 'Original')?.status).toBe('completed');
    expect(steps.find((s) => s.title === 'New action')?.status).toBe('pending');
    expect(roadmap.status).toBe('active');
  });

  it('rejects inactive goals and leaves a full roadmap unchanged', async () => {
    const repository = new InMemoryRoadmapRepository();
    const service = new RoadmapService(repository, lookup, generator);
    const paused = new RoadmapService(repository, { getGoal: async () => ({ ...goal, status: 'paused' }) }, generator);
    await expect(paused.addMentorAction('u', 'g', 'New')).rejects.toThrow('Only active');
    for (let i = 0; i < 10; i++) {
      const roadmap = await service.addMentorAction('u', 'g', `Action ${i}`);
      const active = roadmap.milestones.find((m) => m.status === 'active')!;
      await service.completeActionStep('u', roadmap.id, active.actionSteps[0].id);
    }
    const before = await service.getRoadmapForGoal('u', 'g');
    await expect(service.addMentorAction('u', 'g', 'Overflow')).rejects.toThrow('between 1 and 10');
    expect(await service.getRoadmapForGoal('u', 'g')).toEqual(before);
  });
});
