import { AuthValidationError } from './errors';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MIN_PASSWORD_LENGTH = 8;

export function normalizeEmail(rawEmail: string): string {
  return rawEmail.trim().toLowerCase();
}

export function validateEmail(rawEmail: string): string {
  const email = normalizeEmail(rawEmail);
  if (!EMAIL_REGEX.test(email)) {
    throw new AuthValidationError('email', 'A valid email address is required');
  }
  return email;
}

export function validatePassword(password: string): string {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new AuthValidationError('password', `Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }
  return password;
}
