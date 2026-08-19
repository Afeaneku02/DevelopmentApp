import { describe, it, expect } from 'vitest';
import { validateEmail, validatePassword, normalizeEmail } from '../authValidation';
import { AuthValidationError } from '../errors';

describe('authValidation', () => {
  it('accepts and normalizes a valid email', () => {
    expect(validateEmail('  User@Example.com  ')).toBe('user@example.com');
  });

  it('rejects an email without an @', () => {
    expect(() => validateEmail('not-an-email')).toThrow(AuthValidationError);
  });

  it('rejects an email without a domain', () => {
    expect(() => validateEmail('user@')).toThrow(AuthValidationError);
  });

  it('normalizeEmail trims and lowercases without validating format', () => {
    expect(normalizeEmail('  Weird Email  ')).toBe('weird email');
  });

  it('accepts an 8-character password', () => {
    expect(validatePassword('abcdefgh')).toBe('abcdefgh');
  });

  it('rejects a password under 8 characters', () => {
    expect(() => validatePassword('short')).toThrow(AuthValidationError);
  });
});
