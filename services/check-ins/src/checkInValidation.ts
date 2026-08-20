import type { CheckInResponse } from '@better-you/contracts';
import { CheckInValidationError } from './errors';

const RESPONSES: readonly CheckInResponse[] = ['yes', 'no', 'partly', 'skipped'];
const NOTE_MAX_LENGTH = 1000;

export function validateCheckInResponse(value: CheckInResponse): CheckInResponse {
  if (!RESPONSES.includes(value)) {
    throw new CheckInValidationError('response', `response must be one of: ${RESPONSES.join(', ')}`);
  }
  return value;
}

export function validateNote(value: string | undefined): string {
  const trimmed = (value ?? '').trim();
  if (trimmed.length > NOTE_MAX_LENGTH) {
    throw new CheckInValidationError('note', `note must be ${NOTE_MAX_LENGTH} characters or fewer`);
  }
  return trimmed;
}
