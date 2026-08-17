import { describe, it, expect, beforeEach } from 'vitest';
import { AuthService } from '../authService';
import { LocalAuthProvider } from '../authProvider';
import { InMemoryUserRepository } from '../userRepository';
import {
  AuthValidationError,
  EmailAlreadyInUseError,
  InvalidCredentialsError,
  SessionInvalidError,
} from '../errors';

function createClock(startMs: number) {
  let current = startMs;
  return {
    now: () => new Date(current),
    advance: (ms: number) => {
      current += ms;
    },
  };
}

describe('AuthService', () => {
  const START = Date.parse('2026-01-01T00:00:00.000Z');
  let clock: ReturnType<typeof createClock>;
  let service: AuthService;

  beforeEach(() => {
    clock = createClock(START);
    const provider = new LocalAuthProvider(clock.now);
    const users = new InMemoryUserRepository();
    service = new AuthService(provider, users, clock.now);
  });

  describe('signUp', () => {
    it('creates an active user', async () => {
      const user = await service.signUp({ email: 'user@example.com', password: 'super-secret-1' });
      expect(user.email).toBe('user@example.com');
      expect(user.status).toBe('active');
      expect(user.authSubject).toBeTruthy();
    });

    it('rejects a duplicate email', async () => {
      await service.signUp({ email: 'user@example.com', password: 'super-secret-1' });
      await expect(
        service.signUp({ email: 'user@example.com', password: 'another-secret' })
      ).rejects.toThrow(EmailAlreadyInUseError);
    });

    it('rejects an invalid email', async () => {
      await expect(service.signUp({ email: 'not-an-email', password: 'super-secret-1' })).rejects.toThrow(
        AuthValidationError
      );
    });

    it('rejects a short password', async () => {
      await expect(service.signUp({ email: 'user@example.com', password: 'short' })).rejects.toThrow(
        AuthValidationError
      );
    });
  });

  describe('signIn', () => {
    beforeEach(async () => {
      await service.signUp({ email: 'user@example.com', password: 'super-secret-1' });
    });

    it('returns the user and a session token on correct credentials', async () => {
      const result = await service.signIn({ email: 'user@example.com', password: 'super-secret-1' });
      expect(result.user.email).toBe('user@example.com');
      expect(result.token).toBeTruthy();
      expect(result.expiresAt).toBeTruthy();
    });

    it('rejects a wrong password with a generic error', async () => {
      await expect(service.signIn({ email: 'user@example.com', password: 'wrong' })).rejects.toThrow(
        InvalidCredentialsError
      );
    });

    it('rejects an unknown email with the same generic error', async () => {
      await expect(
        service.signIn({ email: 'nobody@example.com', password: 'whatever1' })
      ).rejects.toThrow(InvalidCredentialsError);
    });

    it('locks out after 5 failed attempts, even with the correct password', async () => {
      for (let i = 0; i < 5; i++) {
        await expect(service.signIn({ email: 'user@example.com', password: 'wrong' })).rejects.toThrow(
          InvalidCredentialsError
        );
      }
      await expect(
        service.signIn({ email: 'user@example.com', password: 'super-secret-1' })
      ).rejects.toThrow(InvalidCredentialsError);
    });

    it('allows sign-in again once the lockout window passes', async () => {
      for (let i = 0; i < 5; i++) {
        await expect(service.signIn({ email: 'user@example.com', password: 'wrong' })).rejects.toThrow(
          InvalidCredentialsError
        );
      }
      clock.advance(16 * 60 * 1000);
      const result = await service.signIn({ email: 'user@example.com', password: 'super-secret-1' });
      expect(result.user.email).toBe('user@example.com');
    });
  });

  describe('session lifecycle', () => {
    let token: string;

    beforeEach(async () => {
      await service.signUp({ email: 'user@example.com', password: 'super-secret-1' });
      const result = await service.signIn({ email: 'user@example.com', password: 'super-secret-1' });
      token = result.token;
    });

    it('getCurrentUser returns the user for a valid token', async () => {
      const user = await service.getCurrentUser(token);
      expect(user?.email).toBe('user@example.com');
    });

    it('getCurrentUser returns null for an invalid token', async () => {
      expect(await service.getCurrentUser('bogus-token')).toBeNull();
    });

    it('requireUser throws SessionInvalidError for an invalid token', async () => {
      await expect(service.requireUser('bogus-token')).rejects.toThrow(SessionInvalidError);
    });

    it('requireUser returns the user for a valid token', async () => {
      const user = await service.requireUser(token);
      expect(user.email).toBe('user@example.com');
    });

    it('signOut revokes the session', async () => {
      await service.signOut(token);
      expect(await service.getCurrentUser(token)).toBeNull();
    });

    it('refreshSession issues a new token and invalidates the old one', async () => {
      const refreshed = await service.refreshSession(token);
      expect(refreshed.token).not.toBe(token);
      expect(await service.getCurrentUser(token)).toBeNull();
      expect(await service.getCurrentUser(refreshed.token)).not.toBeNull();
    });

    it('refreshSession throws on an already-invalid token', async () => {
      await service.signOut(token);
      await expect(service.refreshSession(token)).rejects.toThrow(SessionInvalidError);
    });
  });

  describe('deleteAccount', () => {
    it('revokes the session, marks the user deleted, and frees the email for re-signup', async () => {
      await service.signUp({ email: 'user@example.com', password: 'super-secret-1' });
      const { token } = await service.signIn({ email: 'user@example.com', password: 'super-secret-1' });

      await service.deleteAccount(token);

      await expect(service.requireUser(token)).rejects.toThrow(SessionInvalidError);
      await expect(
        service.signIn({ email: 'user@example.com', password: 'super-secret-1' })
      ).rejects.toThrow(InvalidCredentialsError);

      const newUser = await service.signUp({ email: 'user@example.com', password: 'a-new-secret' });
      expect(newUser.status).toBe('active');
    });
  });
});
