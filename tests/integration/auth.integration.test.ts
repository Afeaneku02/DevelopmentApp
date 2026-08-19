import { describe, it, expect } from 'vitest';
import { AuthService, LocalAuthProvider, InMemoryUserRepository } from '@better-you/auth';

describe('Minimal Real Auth (integration)', () => {
  it('supports the full signup -> signin -> requireUser -> refresh -> signout lifecycle', async () => {
    const service = new AuthService(new LocalAuthProvider(), new InMemoryUserRepository());

    const signedUp = await service.signUp({ email: 'jamie@example.com', password: 'first-goal-2026' });
    expect(signedUp.status).toBe('active');

    const { token, user } = await service.signIn({ email: 'jamie@example.com', password: 'first-goal-2026' });
    expect(user.id).toBe(signedUp.id);

    const current = await service.requireUser(token);
    expect(current.email).toBe('jamie@example.com');

    const refreshed = await service.refreshSession(token);
    expect(await service.getCurrentUser(token)).toBeNull();
    expect(await service.requireUser(refreshed.token)).toMatchObject({ email: 'jamie@example.com' });

    await service.signOut(refreshed.token);
    expect(await service.getCurrentUser(refreshed.token)).toBeNull();
  });
});
