import type { MentorGuidanceClarification, MentorGuidanceRequest, MentorGuidanceResult } from '@better-you/contracts';
import { apiFetch } from './client';

// POST /api/v1/mentor-guidance (ADR 0029) - user-triggered only. Sends the
// goal id and, only when the user has answered the mentor, this
// interaction's question/answer turns (the last one being the new answer).
// The API decides what (sanitized) goal context reaches the AI service, and
// always asks about the signed-in user.
export function requestMentorGuidance(
  token: string,
  goalId: string,
  clarifications?: MentorGuidanceClarification[]
): Promise<{ mentorGuidance: MentorGuidanceResult }> {
  const body: MentorGuidanceRequest =
    clarifications && clarifications.length > 0 ? { goalId, clarifications } : { goalId };
  return apiFetch('/api/v1/mentor-guidance', { method: 'POST', token, body });
}
