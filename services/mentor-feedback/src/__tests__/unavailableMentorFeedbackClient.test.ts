import { describe, expect, it, vi } from 'vitest';
import { UnavailableMentorFeedbackClient } from '../unavailableMentorFeedbackClient';

describe('UnavailableMentorFeedbackClient', () => {
  it('resolves to an unavailable result without making a network call', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const result = await new UnavailableMentorFeedbackClient().getFeedback('user-1', 'fitness_scheduling');

    expect(result).toEqual({
      status: 'unavailable',
      feedback: [],
      unavailableReason: 'the mentor-feedback integration is not configured',
    });
    expect(fetchSpy).not.toHaveBeenCalled();

    fetchSpy.mockRestore();
  });
});
