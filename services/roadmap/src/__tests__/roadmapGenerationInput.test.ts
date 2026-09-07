import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Goal } from '@better-you/contracts';
import { buildRoadmapGenerationInput } from '../roadmapGenerationInput';

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

// This is the AI-adapter privacy boundary: buildRoadmapGenerationInput() is
// the one function standing between a full Goal and anything a
// RoadmapGenerator (placeholder today, an external AI provider later - ADR
// 0023) ever sees. These tests prove that boundary actually holds, not just
// that the TypeScript type says so.
const ALLOWED_KEYS = ['goalCategory', 'goalTitle'];

describe('buildRoadmapGenerationInput (AI adapter privacy boundary)', () => {
  it('only includes the allowed structured fields, nothing else', () => {
    const input = buildRoadmapGenerationInput(makeGoal({}));
    expect(Object.keys(input).sort()).toEqual([...ALLOWED_KEYS].sort());
  });

  it('carries the real category and title through unchanged', () => {
    const goal = makeGoal({ category: 'fitness', title: 'Run a marathon' });
    const input = buildRoadmapGenerationInput(goal);
    expect(input).toEqual({ goalCategory: 'fitness', goalTitle: 'Run a marathon' });
  });

  it("never includes the goal's free-text description, even a long or sensitive one", () => {
    const goal = makeGoal({
      description: 'Very personal reflection about my marriage that must never reach an AI provider',
    });
    const input = buildRoadmapGenerationInput(goal);
    expect(JSON.stringify(input)).not.toContain('personal reflection');
    expect(JSON.stringify(input)).not.toContain('marriage');
  });

  it('never includes userId, id, status, timestamps, or source', () => {
    const goal = makeGoal({});
    const input = buildRoadmapGenerationInput(goal);
    const serialized = JSON.stringify(input);
    expect(serialized).not.toContain(goal.userId);
    expect(serialized).not.toContain(goal.id);
    expect(input).not.toHaveProperty('status');
    expect(input).not.toHaveProperty('createdAt');
    expect(input).not.toHaveProperty('updatedAt');
    expect(input).not.toHaveProperty('source');
    expect(input).not.toHaveProperty('suggestedGoalId');
    expect(input).not.toHaveProperty('description');
  });

  it('never carries a reference to docs/, .docx, or other local-only file paths even if present in the goal description', () => {
    const goal = makeGoal({
      description: 'See docs/private-notes.docx and my local journal.md for context',
    });
    const input = buildRoadmapGenerationInput(goal);
    const serialized = JSON.stringify(input);
    expect(serialized).not.toMatch(/docs\//);
    expect(serialized).not.toMatch(/\.docx/i);
    expect(serialized).not.toMatch(/\.md\b/i);
  });
});

// Static check that the AI adapter's own source code never references a
// private-docs path itself - not just that runtime data stays clean. Scans
// every non-test .ts file in this domain, since that's the actual "AI
// pathway": the generator interface, the placeholder implementation, the
// input-sanitization boundary, and the service that wires them together.
describe('Roadmap generation source code never references private docs paths', () => {
  const sourceDir = path.resolve(__dirname, '..');
  const filesToCheck = fs
    .readdirSync(sourceDir)
    .filter((entry) => entry.endsWith('.ts') && fs.statSync(path.join(sourceDir, entry)).isFile());

  it('found at least the expected roadmap generation source files to check', () => {
    // Guards against this test silently checking nothing if the directory
    // layout ever changes.
    expect(filesToCheck).toEqual(
      expect.arrayContaining([
        'roadmapGenerator.ts',
        'placeholderRoadmapGenerator.ts',
        'roadmapGenerationInput.ts',
        'roadmapService.ts',
      ])
    );
  });

  it.each(filesToCheck)('%s does not reference docs/, .docx, or .env paths', (file) => {
    const content = fs.readFileSync(path.join(sourceDir, file), 'utf-8');
    expect(content).not.toMatch(/docs\//);
    expect(content).not.toMatch(/\.docx/i);
    expect(content).not.toMatch(/\.env\b/);
  });
});
