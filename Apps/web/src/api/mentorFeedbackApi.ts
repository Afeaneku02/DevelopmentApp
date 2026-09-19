import type { MentorFeedbackResult } from '@better-you/contracts';
import { apiFetch } from './client';

// GET /api/v1/mentor-feedback (ADR 0026) - read-only; never mutates
// anything. `contextKey` is an optional policy-selector string; the
// Dashboard call omits it (no single context applies across every active
// goal at once).
export function getMentorFeedback(
  token: string,
  contextKey?: string
): Promise<{ mentorFeedback: MentorFeedbackResult }> {
  const query = contextKey ? `?contextKey=${encodeURIComponent(contextKey)}` : '';
  return apiFetch(`/api/v1/mentor-feedback${query}`, { token });
}
