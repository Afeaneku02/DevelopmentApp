import { randomBytes, randomUUID } from 'node:crypto';
import { hashPassword, verifyPassword } from './passwordHasher';

// Blueprint §2 identity boundary: the rest of the app depends on this interface,
// not a specific vendor SDK. A future SupabaseAuthProvider/CognitoAuthProvider
// implements the same contract without AuthService changing (ADR 0001, ADR 0004).
export interface AuthProvider {
  createIdentity(email: string, password: string): Promise<{ authSubject: string }>;
  verifyCredentials(email: string, password: string): Promise<{ authSubject: string } | null>;
  issueSession(authSubject: string): Promise<{ token: string; expiresAt: Date }>;
  verifySession(token: string): Promise<{ authSubject: string } | null>;
  revokeSession(token: string): Promise<void>;
  revokeAllSessionsForSubject(authSubject: string): Promise<void>;
  deleteIdentity(authSubject: string): Promise<void>;
}

interface StoredIdentity {
  authSubject: string;
  email: string;
  passwordHash: string;
}

interface StoredSession {
  authSubject: string;
  expiresAt: number;
}

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

// In-memory, single-process only, server-side only (see README). This is the
// provider's own credential/session store - analogous to what a managed
// provider like Supabase would hold on its side, not the app's `users` table.
export class LocalAuthProvider implements AuthProvider {
  private identitiesByEmail = new Map<string, StoredIdentity>();
  private identitiesBySubject = new Map<string, StoredIdentity>();
  private sessions = new Map<string, StoredSession>();

  constructor(
    private readonly now: () => Date = () => new Date(),
    private readonly sessionTtlMs: number = SESSION_TTL_MS
  ) {}

  async createIdentity(email: string, password: string): Promise<{ authSubject: string }> {
    const passwordHash = await hashPassword(password);
    const authSubject = randomUUID();
    const identity: StoredIdentity = { authSubject, email, passwordHash };
    this.identitiesByEmail.set(email, identity);
    this.identitiesBySubject.set(authSubject, identity);
    return { authSubject };
  }

  async verifyCredentials(email: string, password: string): Promise<{ authSubject: string } | null> {
    const identity = this.identitiesByEmail.get(email);
    if (!identity) {
      return null;
    }
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
    if (!session) {
      return null;
    }
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
    const identity = this.identitiesBySubject.get(authSubject);
    if (identity) {
      this.identitiesByEmail.delete(identity.email);
      this.identitiesBySubject.delete(authSubject);
    }
  }
}
