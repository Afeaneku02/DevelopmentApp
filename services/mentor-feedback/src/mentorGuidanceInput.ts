import {
  MENTOR_GUIDANCE_CONTEXT_BY_CATEGORY,
  MENTOR_GUIDANCE_MAX_REPLIES,
  MENTOR_GUIDANCE_REPLY_MAX_LENGTH,
  type Goal,
  type MentorGuidanceClarification,
  type MentorGuidanceInput,
} from '@better-you/contracts';
import { MentorGuidanceValidationError } from './errors';

function validText(value: unknown, label: string): string {
  if (typeof value !== 'string') {
    throw new MentorGuidanceValidationError('clarifications', `${label} must be a string`);
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new MentorGuidanceValidationError('clarifications', `${label} must not be blank`);
  }
  // Code points (not UTF-16 units): that's how the AI endpoint's Pydantic
  // max_length counts. Rejected rather than truncated, so what is sent is
  // exactly what the user typed (or what the mentor asked).
  if ([...trimmed].length > MENTOR_GUIDANCE_REPLY_MAX_LENGTH) {
    throw new MentorGuidanceValidationError(
      'clarifications',
      `${label} must be at most ${MENTOR_GUIDANCE_REPLY_MAX_LENGTH} characters`
    );
  }
  return trimmed;
}

// Validates the interaction's clarification turns. `undefined` means none (a
// first request). Otherwise: an array of 1..MENTOR_GUIDANCE_MAX_REPLIES
// `{ question, answer }` objects, each field a non-blank string of at most
// MENTOR_GUIDANCE_REPLY_MAX_LENGTH code points after trimming - the same
// bounds the AI endpoint enforces. Each turn is rebuilt from its two named
// fields, so extra keys never travel further.
export function validateMentorGuidanceClarifications(value: unknown): MentorGuidanceClarification[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length === 0) {
    throw new MentorGuidanceValidationError('clarifications', 'clarifications must be a non-empty array');
  }
  if (value.length > MENTOR_GUIDANCE_MAX_REPLIES) {
    throw new MentorGuidanceValidationError(
      'clarifications',
      `at most ${MENTOR_GUIDANCE_MAX_REPLIES} clarification answers are allowed per interaction`
    );
  }
  return value.map((turn, index) => {
    if (typeof turn !== 'object' || turn === null || Array.isArray(turn)) {
      throw new MentorGuidanceValidationError('clarifications', `clarification ${index + 1} must be an object`);
    }
    const { question, answer } = turn as Record<string, unknown>;
    return {
      question: validText(question, `clarification ${index + 1} question`),
      answer: validText(answer, `clarification ${index + 1} answer`),
    };
  });
}

// The one place a full Goal is narrowed to what the AI project may see for a
// guidance request - same reference pattern as buildRoadmapGenerationInput
// (ADR 0023). Only the closed-set category (as a policy context key) and the
// required, length-capped title cross the boundary, plus - only when the
// user explicitly answered the mentor - this interaction's already-validated
// clarification turns. Deliberately excluded: description (free text),
// id/userId/status/source/timestamps (internal state). The user id travels
// separately, as the path parameter the AI project's endpoint is scoped by.
export function buildMentorGuidanceInput(
  goal: Goal,
  clarifications?: MentorGuidanceClarification[]
): MentorGuidanceInput {
  return {
    contextKey: MENTOR_GUIDANCE_CONTEXT_BY_CATEGORY[goal.category],
    goalTitle: goal.title,
    ...(clarifications && clarifications.length > 0 ? { clarifications } : {}),
  };
}
