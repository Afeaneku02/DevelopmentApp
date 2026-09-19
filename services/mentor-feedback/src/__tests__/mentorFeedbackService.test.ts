import { describe, expect, it } from 'vitest';
import type { MentorFeedbackClient } from '../mentorFeedbackClient';
import { MentorFeedbackService } from '../mentorFeedbackService';

describe('MentorFeedbackService', () => {
  it('passes userId and contextKey straight through to the client and returns its result', async () => {
    let seenArgs: [string, string | undefined] | undefined;
    const stubClient: MentorFeedbackClient = {
      async getFeedback(userId, contextKey) {
        seenArgs = [userId, contextKey];
        return { status: 'ready', feedback: [], needsMoreDataReason: null };
      },
    };

    const result = await new MentorFeedbackService(stubClient).getFeedback('user-1', 'fitness_scheduling');

    expect(seenArgs).toEqual(['user-1', 'fitness_scheduling']);
    expect(result).toEqual({ status: 'ready', feedback: [], needsMoreDataReason: null });
  });

  it('does not swallow or alter an unavailable result', async () => {
    const stubClient: MentorFeedbackClient = {
      async getFeedback() {
        return { status: 'unavailable', feedback: [], unavailableReason: 'not configured' };
      },
    };

    const result = await new MentorFeedbackService(stubClient).getFeedback('user-1');

    expect(result).toEqual({ status: 'unavailable', feedback: [], unavailableReason: 'not configured' });
  });
});
