import type { MentorFeedbackResult } from '@better-you/contracts';
import type { MentorFeedbackClient } from './mentorFeedbackClient';

// The default MentorFeedbackClient when AI_MODELS_BASE_URL is not
// configured (server.ts) - no network call, ever. Mirrors
// PlaceholderRoadmapGenerator's role: the integration being off is a
// normal, fully-supported state, not a degraded one, so Better You behaves
// exactly as it did before this integration existed.
export class UnavailableMentorFeedbackClient implements MentorFeedbackClient {
  async getFeedback(_userId: string, _contextKey?: string): Promise<MentorFeedbackResult> {
    return {
      status: 'unavailable',
      feedback: [],
      unavailableReason: 'the mentor-feedback integration is not configured',
    };
  }
}
