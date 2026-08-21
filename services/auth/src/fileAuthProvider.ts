import { randomBytes, randomUUID } from 'node:crypto';
import { readJsonArray, writeJsonArrayAtomic } from '@better-you/persistence';
import { hashPassword, verifyPassword } from './passwordHasher';
import type { AuthProvider } from './authProvider';

interface StoredIdentity {
  authSubject: string;
  email: string;
  passwordHash: string;
}

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

// File-backed adapter (ADR 0016) for the AuthProvider credential boundary
// (ADR 0004) - persists identities (email + password hash) so accounts can
// still log in after a restart, the same reasoning as every other
// File*Repository. Sessions stay in-memory only, deliberately: they're
// short-lived (24h TTL) and re-authenticating after a real server restart is
// normal, expected behavior - not the kind of data loss this milestone is
// about (an unusable account with no valid password would be).
export class FileAuthProvider implements AuthProvider {
  private identities: StoredIdentity[];
  private readonly sessions = new Map<string, { authSubject: string; expiresAt: number }>();

  constructor(
    private readonly filePath: string,
    private readonly now: () => Date = () => new Date(),
    private readonly sessionTtlMs: number = SESSION_TTL_MS
  ) {
    this.identities = readJsonArray<StoredIdentity>(filePath);
  }

  private persist(): void {
    writeJsonArrayAtomic(this.filePath, this.identities);
  }

  async createIdentity(email: string, password: string): Promise<{ authSubject: string }> {
    const passwordHash = await hashPassword(password);
    const authSubject = randomUUID();
    this.identities.push({ authSubject, email, passwordHash });
    this.persist();
    return { authSubject };
  }

  async verifyCredentials(email: string, password: string): Promise<{ authSubject: string } | null> {
    const identity = this.identities.find((i) => i.email === email);
    if (!identity) return null;
    const valid = await verifyPassword(password, identity.passwordHash);
    return valid ? { authSubject: identity.authSubject } : null;
  }

  async issueSession(authSubject: string): Promise<{ token: string; expiresAt: Date }> {
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(this.now().getTime() + this.sessionTtlMs);
    this.sessions.set(token, { authSubject, expiresAt: expiresAt.getTime() });
    return { token, expiresAt };
  }

  async verifySession(token: string): Promise<{ authSubject: string } | null> {
    const session = this.sessions.get(token);
    if (!session) return null;
    if (session.expiresAt <= this.now().getTime()) {
      this.sessions.delete(token);
      return null;
    }
    return { authSubject: session.authSubject };
  }

  async revokeSession(token: string): Promise<void> {
    this.sessions.delete(token);
  }

  async revokeAllSessionsForSubject(authSubject: string): Promise<void> {
    for (const [token, session] of this.sessions) {
      if (session.authSubject === authSubject) {
        this.sessions.delete(token);
      }
    }
  }

  async deleteIdentity(authSubject: string): Promise<void> {
    const index = this.identities.findIndex((i) => i.authSubject === authSubject);
    if (index !== -1) {
      this.identities.splice(index, 1);
      this.persist();
    }
  }
}
