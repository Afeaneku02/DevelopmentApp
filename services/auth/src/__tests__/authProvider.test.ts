import { describe, it, expect, beforeEach } from 'vitest';
import { LocalAuthProvider } from '../authProvider';

function createClock(startMs: number) {
  let current = startMs;
  return {
    now: () => new Date(current),
    advance: (ms: number) => {
      current += ms;
    },
  };
}

describe('LocalAuthProvider', () => {
  const START = Date.parse('2026-01-01T00:00:00.000Z');
  let clock: ReturnType<typeof createClock>;
  let provider: LocalAuthProvider;

  beforeEach(() => {
    clock = createClock(START);
    provider = new LocalAuthProvider(clock.now, 60 * 60 * 1000); // 1h TTL for the test
  });

  it('verifies correct credentials after identity creation', async () => {
    const { authSubject } = await provider.createIdentity('user@example.com', 'super-secret-1');
    const result = await provider.verifyCredentials('user@example.com', 'super-secret-1');
    expect(result?.authSubject).toBe(authSubject);
  });

  it('rejects an incorrect password', async () => {
    await provider.createIdentity('user@example.com', 'super-secret-1');
    expect(await provider.verifyCredentials('user@example.com', 'wrong')).toBeNull();
  });

  it('rejects an unknown email', async () => {
    expect(await provider.verifyCredentials('nobody@example.com', 'anything')).toBeNull();
  });

  it('issues a session that verifies back to the same authSubject', async () => {
    const { authSubject } = await provider.createIdentity('user@example.com', 'super-secret-1');
    const session = await provider.issueSession(authSubject);
    const verified = await provider.verifySession(session.token);
    expect(verified?.authSubject).toBe(authSubject);
  });

  it('returns null for an unknown session token', async () => {
    expect(await provider.verifySession('does-not-exist')).toBeNull();
  });

  it('returns null for an expired session', async () => {
    const { authSubject } = await provider.createIdentity('user@example.com', 'super-secret-1');
    const session = await provider.issueSession(authSubject);
    clock.advance(61 * 60 * 1000);
    expect(await provider.verifySession(session.token)).toBeNull();
  });

  it('revokeSession invalidates that token', async () => {
    const { authSubject } = await provider.createIdentity('user@example.com', 'super-secret-1');
    const session = await provider.issueSession(authSubject);
    await provider.revokeSession(session.token);
    expect(await provider.verifySession(session.token)).toBeNull();
  });

  it('revokeAllSessionsForSubject invalidates only that subject\'s sessions', async () => {
    const a = await provider.createIdentity('a@example.com', 'super-secret-1');
    const b = await provider.createIdentity('b@example.com', 'super-secret-2');
    const sessionA = await provider.issueSession(a.authSubject);
    const sessionB = await provider.issueSession(b.authSubject);

    await provider.revokeAllSessionsForSubject(a.authSubject);

    expect(await provider.verifySession(sessionA.token)).toBeNull();
    expect(await provider.verifySession(sessionB.token)).not.toBeNull();
  });

  it('deleteIdentity prevents future credential verification', async () => {
    const { authSubject } = await provider.createIdentity('user@example.com', 'super-secret-1');
    await provider.deleteIdentity(authSubject);
    expect(await provider.verifyCredentials('user@example.com', 'super-secret-1')).toBeNull();
  });
});
