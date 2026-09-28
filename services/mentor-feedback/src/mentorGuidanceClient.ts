import type { MentorGuidanceInput, MentorGuidanceResult } from '@better-you/contracts';

// The one seam AI-generated mentor guidance enters Better You through (ADR
// 0029) - same "narrow adapter interface, optional, never a production
// dependency" pattern as MentorFeedbackClient (ADR 0026).
// UnavailableMentorGuidanceClient is the default; HttpMentorGuidanceClient
// only activates when AI_MODELS_BASE_URL is configured (server.ts).
//
// Like MentorFeedbackClient, the contract is "never throw": every failure
// resolves to a normal result with status 'unavailable', because the UI
// must show an honest "unavailable" state rather than a generic app error.
// `input` is the full allowlist of what may cross the boundary - see
// buildMentorGuidanceInput().
export interface MentorGuidanceClient {
  getGuidance(userId: string, input: MentorGuidanceInput): Promise<MentorGuidanceResult>;
}
