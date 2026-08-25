import { describe, expect, it } from 'vitest';
import type { ActivityEventType, RecordActivityEventInput } from '@better-you/contracts';
import { ActivityService } from '../activityService';
import { InMemoryActivityEventRepository } from '../activityEventRepository';

const NOW = new Date('2026-01-15T00:00:00.000Z');

// One representative input per event type, with realistic-looking values.
// If a new field is ever added to any ActivityEvent variant, this table (and
// ALLOWED_DATA_KEYS below) must be updated too - the point of this test is
// to force that to be a conscious, reviewed change rather than something
// that slips in silently.
const SAMPLE_INPUT_BY_TYPE: Record<ActivityEventType, RecordActivityEventInput> = {
  goal_created: {
    userId: 'user-1',
    type: 'goal_created',
    data: { goalId: 'goal-1', category: 'career', source: 'custom' },
  },
  goal_paused: { userId: 'user-1', type: 'goal_paused', data: { goalId: 'goal-1' } },
  goal_resumed: { userId: 'user-1', type: 'goal_resumed', data: { goalId: 'goal-1' } },
  goal_completed: { userId: 'user-1', type: 'goal_completed', data: { goalId: 'goal-1' } },
  goal_archived: { userId: 'user-1', type: 'goal_archived', data: { goalId: 'goal-1' } },
  check_in_recorded: {
    userId: 'user-1',
    type: 'check_in_recorded',
    data: { goalId: 'goal-1', checkInId: 'check-in-1', response: 'yes' },
  },
  roadmap_generated: {
    userId: 'user-1',
    type: 'roadmap_generated',
    data: { goalId: 'goal-1', roadmapId: 'roadmap-1', milestoneCount: 3 },
  },
  roadmap_step_completed: {
    userId: 'user-1',
    type: 'roadmap_step_completed',
    data: { goalId: 'goal-1', roadmapId: 'roadmap-1', milestoneId: 'milestone-1', actionStepId: 'step-1' },
  },
};

const ALLOWED_DATA_KEYS: Record<ActivityEventType, string[]> = {
  goal_created: ['goalId', 'category', 'source'],
  goal_paused: ['goalId'],
  goal_resumed: ['goalId'],
  goal_completed: ['goalId'],
  goal_archived: ['goalId'],
  check_in_recorded: ['goalId', 'checkInId', 'response'],
  roadmap_generated: ['goalId', 'roadmapId', 'milestoneCount'],
  roadmap_step_completed: ['goalId', 'roadmapId', 'milestoneId', 'actionStepId'],
};

// Any of these appearing anywhere in an event's data would mean free text
// (or something resembling it) leaked into the ledger - checked generically
// across every event type, not just the ones that historically had a
// tempting free-text field nearby (title/description on Goal, note on
// CheckIn).
const BANNED_KEYS = ['title', 'description', 'note', 'notes', 'text', 'message', 'prompt', 'content', 'summary', 'body'];

// SAMPLE_INPUT_BY_TYPE's `Record<ActivityEventType, ...>` type already forces
// a compile error if a 9th event type is ever added to the contract without
// a corresponding entry here - that exhaustiveness is enforced by the type
// checker, not by a runtime test.
describe('ActivityEvent shape (privacy audit)', () => {
  const eventTypes = Object.keys(SAMPLE_INPUT_BY_TYPE) as ActivityEventType[];

  it.each(eventTypes)('%s carries exactly its allowed minimal fields, nothing else', async (type) => {
    const service = new ActivityService(new InMemoryActivityEventRepository(), () => NOW);
    const event = await service.recordEvent(SAMPLE_INPUT_BY_TYPE[type]);

    const actualKeys = Object.keys(event.data).sort();
    const expectedKeys = [...ALLOWED_DATA_KEYS[type]].sort();
    expect(actualKeys).toEqual(expectedKeys);
  });

  it.each(eventTypes)('%s never carries a banned free-text-shaped key', async (type) => {
    const service = new ActivityService(new InMemoryActivityEventRepository(), () => NOW);
    const event = await service.recordEvent(SAMPLE_INPUT_BY_TYPE[type]);

    for (const banned of BANNED_KEYS) {
      expect(Object.keys(event.data)).not.toContain(banned);
    }
  });
});
