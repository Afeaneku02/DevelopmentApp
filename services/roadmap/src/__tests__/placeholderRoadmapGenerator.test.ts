import { describe, expect, it } from 'vitest';
import type { Goal } from '@better-you/contracts';
import { PlaceholderRoadmapGenerator } from '../placeholderRoadmapGenerator';
import { validateRoadmapDraft } from '../roadmapValidation';

function makeGoal(overrides: Partial<Goal>): Goal {
  return {
    id: 'goal-1',
    userId: 'user-1',
    title: 'Ship the Better You MVP',
    description: '',
    category: 'career',
    source: 'custom',
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('PlaceholderRoadmapGenerator', () => {
  it('produces a draft that passes validation for any goal', async () => {
    const generator = new PlaceholderRoadmapGenerator();
    const draft = await generator.generateRoadmap({ goal: makeGoal({}) });
    expect(() => validateRoadmapDraft(draft)).not.toThrow();
    expect(draft.milestones.length).toBeGreaterThan(0);
  });

  it('references the goal title in the generated milestones', async () => {
    const generator = new PlaceholderRoadmapGenerator();
    const draft = await generator.generateRoadmap({ goal: makeGoal({ title: 'Run a marathon' }) });
    expect(draft.milestones.some((m) => m.title.includes('Run a marathon'))).toBe(true);
  });
});
