import { BadRequestError } from './errors';

// Boundary check only: is this the right shape at all? Whether the *content*
// is acceptable (email format, password strength, category enum, ...) is the
// domain layer's job (services/auth, services/goals) - duplicating it here
// would just create two sources of truth for the same rule.
export function expectString(value: unknown, field: string): string {
  if (typeof value !== 'string') {
    throw new BadRequestError(`${field} is required and must be a string`);
  }
  return value;
}

export function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}
