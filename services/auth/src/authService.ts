import { randomUUID } from 'node:crypto';
import type { SignInInput, SignUpInput, User } from '@better-you/contracts';
import { EmailAlreadyInUseError, InvalidCredentialsError, SessionInvalidError } from './errors';
import { normalizeEmail, validateEmail, validatePassword } from './authValidation';
import type { AuthProvider } from './authProvider';
import type { UserRepository } from './userRepository';

// Blueprint §4 security rule: rate-limit auth-sensitive actions. Real IP/network-level
// limiting belongs to the future API layer; this is the part that's meaningful at the
// service level - locking a specific email out after repeated failed sign-ins.
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

interface FailedAttemptState {
  count: number;
  lockedUntil?: number;
}

export class AuthService {
  private failedAttempts = new Map<string, FailedAttemptState>();

  constructor(
    private readonly authProvider: AuthProvider,
    private readonly userRepository: UserRepository,
    private readonly now: () => Date = () => new Date()
  ) {}

  async signUp(input: SignUpInput): Promise<User> {
    const email = validateEmail(input.email);
    const password = validatePassword(input.password);

    const existing = await this.userRepository.findByEmail(email);
    if (existing) {
      throw new EmailAlreadyInUseError(email);
    }

    const { authSubject } = await this.authProvider.createIdentity(email, password);
    const user: User = {
      id: randomUUID(),
      authSubject,
      email,
      status: 'active',
      createdAt: this.now().toISOString(),
    };
    return this.userRepository.create(user);
  }

  async signIn(input: SignInInput): Promise<{ user: User; token: string; expiresAt: string }> {
    const email = normalizeEmail(input.email);
    const nowMs = this.now().getTime();

    const lockState = this.failedAttempts.get(email);
    if (lockState?.lockedUntil && nowMs < lockState.lockedUntil) {
      throw new InvalidCredentialsError();
    }

    const identityMatch = await this.authProvider.verifyCredentials(email, input.password);
    const user = identityMatch ? await this.userRepository.findByAuthSubject(identityMatch.authSubject) : null;

    if (!identityMatch || !user || user.status !== 'active') {
      this.recordFailedAttempt(email, nowMs);
      throw new InvalidCredentialsError();
    }

    this.failedAttempts.delete(email);

    const session = await this.authProvider.issueSession(identityMatch.authSubject);
    return { user, token: session.token, expiresAt: session.expiresAt.toISOString() };
  }

  async signOut(token: string): Promise<void> {
    await this.authProvider.revokeSession(token);
  }

  async getCurrentUser(token: string): Promise<User | null> {
    const session = await this.authProvider.verifySession(token);
    if (!session) {
      return null;
    }
    const user = await this.userRepository.findByAuthSubject(session.authSubject);
    if (!user || user.status !== 'active') {
      return null;
    }
    return user;
  }

  async requireUser(token: string): Promise<User> {
    const user = await this.getCurrentUser(token);
    if (!user) {
      throw new SessionInvalidError();
    }
    return user;
  }

  async refreshSession(token: string): Promise<{ token: string; expiresAt: string }> {
    const session = await this.authProvider.verifySession(token);
    if (!session) {
      throw new SessionInvalidError();
    }
    await this.authProvider.revokeSession(token);
    const newSession = await this.authProvider.issueSession(session.authSubject);
    return { token: newSession.token, expiresAt: newSession.expiresAt.toISOString() };
  }

  async deleteAccount(token: string): Promise<void> {
    const user = await this.requireUser(token);
    await this.authProvider.revokeAllSessionsForSubject(user.authSubject);
    await this.authProvider.deleteIdentity(user.authSubject);
    await this.userRepository.markDeleted(user.id, this.now().toISOString());
  }

  private recordFailedAttempt(email: string, nowMs: number): void {
    const state = this.failedAttempts.get(email) ?? { count: 0 };
    state.count += 1;
    if (state.count >= MAX_FAILED_ATTEMPTS) {
      state.lockedUntil = nowMs + LOCKOUT_DURATION_MS;
    }
    this.failedAttempts.set(email, state);
  }
}
