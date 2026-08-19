import type { User } from '@better-you/contracts';
import { apiFetch } from './client';

export interface AuthSession {
  user: User;
  token: string;
  expiresAt: string;
}

// Does not log the user in - matches AuthService's design (Blueprint §4 lists
// signUp and signIn as separate steps). Call signIn afterward.
export function signUp(email: string, password: string): Promise<{ user: User }> {
  return apiFetch('/api/v1/auth/signup', { method: 'POST', body: { email, password } });
}

export function signIn(email: string, password: string): Promise<AuthSession> {
  return apiFetch('/api/v1/auth/login', { method: 'POST', body: { email, password } });
}

export function signOut(token: string): Promise<void> {
  return apiFetch('/api/v1/auth/logout', { method: 'POST', token });
}

export function getMe(token: string): Promise<{ user: User }> {
  return apiFetch('/api/v1/me', { token });
}

export function deleteAccount(token: string): Promise<void> {
  return apiFetch('/api/v1/me', { method: 'DELETE', token });
}
