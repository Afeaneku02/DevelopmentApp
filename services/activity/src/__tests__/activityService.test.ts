import { describe, expect, it } from 'vitest';
import type { RecordActivityEventInput } from '@better-you/contracts';
import { ActivityService } from '../activityService';
import { InMemoryActivityEventRepository } from '../activityEventRepository';

const NOW = new Date('2026-01-15T00:00:00.000Z');

describe('ActivityService', () => {
  it('records an event, stamping id and occurredAt from the injected clock', async () => {
    const service = new ActivityService(new InMemoryActivityEventRepository(), () => NOW);
    const input: RecordActivityEventInput = {
      userId: 'user-1',
      type: 'goal_created',
      data: { goalId: 'goal-1', category: 'career', source: 'custom' },
    };

    const event = await service.recordEvent(input);
    expect(event.id).toBeTruthy();
    expect(event.occurredAt).toBe(NOW.toISOString());
    expect(event.userId).toBe('user-1');
    expect(event.type).toBe('goal_created');
    expect(event.data).toEqual({ goalId: 'goal-1', category: 'career', source: 'custom' });
  });

  it('never includes free-text fields for any event type it can record', async () => {
    const service = new ActivityService(new InMemoryActivityEventRepository(), () => NOW);
    const event = await service.recordEvent({
      userId: 'user-1',
      type: 'check_in_recorded',
      data: { goalId: 'goal-1', checkInId: 'check-in-1', response: 'partly' },
    });
    expect(Object.keys(event.data)).not.toContain('note');
  });

  it('lists a user\'s events oldest first', async () => {
    const repository = new InMemoryActivityEventRepository();
    let now = new Date('2026-01-15T00:00:00.000Z');
    const service = new ActivityService(repository, () => now);

    await service.recordEvent({ userId: 'user-1', type: 'goal_created', data: { goalId: 'a', category: 'career', source: 'custom' } });
    now = new Date('2026-01-16T00:00:00.000Z');
    await service.recordEvent({ userId: 'user-1', type: 'goal_paused', data: { goalId: 'a' } });

    const events = await service.listEvents('user-1');
    expect(events.map((e) => e.type)).toEqual(['goal_created', 'goal_paused']);
  });

  it('keeps events isolated between users', async () => {
    const service = new ActivityService(new InMemoryActivityEventRepository(), () => NOW);
    await service.recordEvent({ userId: 'user-1', type: 'goal_created', data: { goalId: 'a', category: 'career', source: 'custom' } });
    await service.recordEvent({ userId: 'user-2', type: 'goal_created', data: { goalId: 'b', category: 'fitness', source: 'custom' } });

    const eventsForUser1 = await service.listEvents('user-1');
    expect(eventsForUser1).toHaveLength(1);
    expect(eventsForUser1[0].data).toMatchObject({ goalId: 'a' });
  });

  it('records roadmap and check-in events with their expected minimal shapes', async () => {
    const service = new ActivityService(new InMemoryActivityEventRepository(), () => NOW);

    const roadmapGenerated = await service.recordEvent({
      userId: 'user-1',
      type: 'roadmap_generated',
      data: { goalId: 'goal-1', roadmapId: 'roadmap-1', milestoneCount: 3 },
    });
    expect(roadmapGenerated.data).toEqual({ goalId: 'goal-1', roadmapId: 'roadmap-1', milestoneCount: 3 });

    const stepCompleted = await service.recordEvent({
      userId: 'user-1',
      type: 'roadmap_step_completed',
      data: { goalId: 'goal-1', roadmapId: 'roadmap-1', milestoneId: 'milestone-1', actionStepId: 'step-1' },
    });
    expect(stepCompleted.data).toEqual({
      goalId: 'goal-1',
      roadmapId: 'roadmap-1',
      milestoneId: 'milestone-1',
      actionStepId: 'step-1',
    });
  });
});
