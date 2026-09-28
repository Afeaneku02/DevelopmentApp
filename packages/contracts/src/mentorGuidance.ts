import type { GoalCategory } from './goal';

// The optional, user-triggered mentor-guidance integration with the separate
// DevelopmentApp_AI_Models project's `POST /users/{user_id}/mentor-guidance`
// (ADR 0029). Sibling of mentorFeedback.ts (ADR 0026): that one is the
// passive, deterministic rule-based read; this one is an explicit request
// that may call an LLM on the AI project's side (the OpenAI key lives only
// there - Better You never sees or sends it).
//
// Camel-cased like every other contract. HttpMentorGuidanceClient
// (services/mentor-feedback) is the one place that translates the AI
// project's snake_case wire envelope into this shape.

// What Better You is willing to send for one guidance request - an explicit
// allowlist, same reference pattern as RoadmapGenerationInput (ADR 0023).
// `contextKey` is a policy selector derived deterministically from the
// goal's closed-set category, never free text; `goalTitle` is the goal's
// required, length-capped title. A goal's free-text description, check-in
// notes, and profile data never cross this boundary.
//
// `clarifications` is the one free-text exception (ADR 0029, "Clarification
// replies"): within the current interaction only, each clarifying question
// the model asked and the answer the user explicitly typed and submitted,
// oldest first, the last one being the answer just sent. The web panel holds
// them in component state and resends them each request - neither project
// stores them, and they never become user-model evidence.
export interface MentorGuidanceClarification {
  question: string;
  answer: string;
}

export interface MentorGuidanceInput {
  contextKey: string;
  goalTitle: string;
  clarifications?: MentorGuidanceClarification[];
}

// The AI endpoint's own limits (ClarificationTurn question/answer
// max_length=500 - Python counts Unicode code points, so Better You does too).
export const MENTOR_GUIDANCE_REPLY_MAX_LENGTH = 500;

// Turns per interaction - equal to the AI endpoint's MAX_CLARIFICATION_TURNS.
// Bounds the exchange so a model that keeps asking can't turn this into an
// open-ended chat, and bounds the context sent with each request.
export const MENTOR_GUIDANCE_MAX_REPLIES = 2;

// Better-You-owned statuses (the wire uses different values - see the
// client for the mapping):
// - 'guidance': the AI project produced validated guidance (LLM or its mock
//   provider - see `source`).
// - 'fallback': the LLM path failed or was rejected, and the AI project
//   answered with its own deterministic, rule-based guidance instead.
// - 'needs_more_information': not enough authorized evidence about this user
//   yet, or the request needs clarification (e.g. a higher-risk context).
// - 'unavailable': unconfigured integration, unreachable/failed AI service,
//   or a response Better You could not use.
export type MentorGuidanceStatus = 'guidance' | 'fallback' | 'needs_more_information' | 'unavailable';

// Where displayed guidance came from, so the UI never presents deterministic
// or mock output as if it were live AI output. null when nothing was
// generated (needs_more_information/unavailable).
export type MentorGuidanceSource = 'openai' | 'mock' | 'deterministic' | null;

export interface MentorGuidanceRecommendation {
  action: string;
  reason: string;
  groundedInBeliefIds: string[];
}

export interface MentorGuidanceResult {
  status: MentorGuidanceStatus;
  source: MentorGuidanceSource;
  summary: string | null;
  recommendations: MentorGuidanceRecommendation[];
  clarifyingQuestion: string | null;
  // The AI project's non-secret reason code (e.g.
  // 'insufficient_authorized_evidence', 'timeout'), or a Better You one for
  // failures on this side of the boundary. Never an SDK message.
  reasonCode: string | null;
  // True only when a reply can actually change the next response: the
  // clarifying question came from the model (openai/mock provider), not from
  // one of the AI project's deterministic gates. Those gates -
  // insufficient_authorized_evidence, policy_requires_resolution,
  // consequential_request - are decided before `question` is ever read (or,
  // for consequential_request, can only be triggered by it, never cleared),
  // so offering a reply there would just loop on the same answer.
  acceptsReply: boolean;
}

export interface MentorGuidanceRequest {
  goalId: string;
  // This interaction's question/answer turns so far, oldest first; the last
  // turn's answer is the one being submitted. Omitted on a first request.
  clarifications?: MentorGuidanceClarification[];
}

// Deterministic category -> AI-project context-key mapping. The AI project
// owns risk policy for each key (it can only raise risk, never lower it);
// Better You's job is only to pick the honest label. `finances` maps to the
// AI project's own higher-risk context rather than a low-risk one, so that
// project's policy - not this table - decides it needs clarification.
// `habit_nudge` is the AI project's only general-purpose low-risk context
// today; see ADR 0029 for why the non-fitness categories use it.
export const MENTOR_GUIDANCE_CONTEXT_BY_CATEGORY: Record<GoalCategory, string> = {
  fitness: 'fitness_scheduling',
  finances: 'financial_planning',
  career: 'habit_nudge',
  education: 'habit_nudge',
  personal_development: 'habit_nudge',
};
