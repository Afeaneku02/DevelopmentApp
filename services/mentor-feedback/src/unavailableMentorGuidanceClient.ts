import type { MentorGuidanceInput, MentorGuidanceResult } from '@better-you/contracts';
import type { MentorGuidanceClient } from './mentorGuidanceClient';

// Default MentorGuidanceClient when AI_MODELS_BASE_URL is not configured -
// no network call, ever (mirrors UnavailableMentorFeedbackClient).
export class UnavailableMentorGuidanceClient implements MentorGuidanceClient {
  async getGuidance(_userId: string, _input: MentorGuidanceInput): Promise<MentorGuidanceResult> {
    return {
      status: 'unavailable',
      source: null,
      summary: null,
      recommendations: [],
      clarifyingQuestion: null,
      reasonCode: 'not_configured',
      acceptsReply: false,
    };
  }
}
