import type { MentorFeedbackResult } from '@better-you/contracts';

// The one seam mentor-feedback content enters Better You through - same
// "narrow adapter interface, optional, never a production dependency"
// pattern as RoadmapGenerator (ADR 0020/0024), applied to the separate
// DevelopmentApp_AI_Models project's `GET /users/{user_id}/mentor-feedback`
// (ADR 0026). UnavailableMentorFeedbackClient is the default;
// HttpMentorFeedbackClient only activates when AI_MODELS_BASE_URL is
// configured (server.ts) - mirroring exactly how HttpRoadmapGenerator is
// wired in.
//
// Unlike RoadmapGenerator, this interface's contract is "never throw": a
// network error, timeout, non-2xx response, or malformed body must all
// resolve to a normal MentorFeedbackResult with status 'unavailable', never
// an exception. Mentor feedback is a passive, supplementary read (a future
// Dashboard panel), not a user-initiated action the way generating a
// roadmap is - a failure here must never turn into an app error the rest
// of Better You has to handle. It degrades to "nothing to show yet," the
// same way an empty check-ins list is a normal state, not an error one.
//
// `contextKey` is an optional policy-selector string (e.g.
// "fitness_scheduling"), never free text - the same kind of value Roadmap's
// context/risk policy already uses. Nothing else about the user (profile,
// check-in notes, a goal's free-text description) is ever a parameter here.
export interface MentorFeedbackClient {
  getFeedback(userId: string, contextKey?: string): Promise<MentorFeedbackResult>;
}
