// The optional mentor-feedback integration with the separate
// DevelopmentApp_AI_Models project (ADR 0026, following the same
// product-side-first pattern as Roadmap's AI adapter - ADR 0020/0023/0024).
//
// Camel-cased to match every other contract in this project.
// HttpMentorFeedbackClient (services/mentor-feedback) is the one place that
// translates the AI project's snake_case wire response
// (`grounded_in_belief_ids`, `needs_more_data_reason`, `risk_tier`) into
// this shape - nothing else in Better You ever sees the wire format.
export type MentorFeedbackRiskTier = 'low' | 'medium' | 'high';

// 'ready' / 'needs_more_data' come from the AI project itself. 'unavailable'
// is Better-You-owned and does not exist on the wire: it is what
// MentorFeedbackClient reports when the integration is unconfigured, or the
// AI Models server could not be reached or returned something unusable.
// See services/mentor-feedback/src/mentorFeedbackClient.ts - unlike
// RoadmapGenerator, this integration's contract is "never throw", so
// 'unavailable' is a normal value, not an exception.
export type MentorFeedbackStatus = 'ready' | 'needs_more_data' | 'unavailable';

export interface MentorFeedbackItem {
  message: string;
  confidence: number;
  groundedInBeliefIds: string[];
  why: string;
  recommendedNextAction?: string | null;
  riskTier: MentorFeedbackRiskTier;
}

export interface MentorFeedbackResult {
  status: MentorFeedbackStatus;
  feedback: MentorFeedbackItem[];
  // Only meaningful when status === 'needs_more_data'.
  needsMoreDataReason?: string | null;
  // Only meaningful when status === 'unavailable'. Safe to display to the
  // user (it never echoes anything Better You sent) but is not a claim
  // about the user's data - just why nothing could be shown.
  unavailableReason?: string | null;
}
