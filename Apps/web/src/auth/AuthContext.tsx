import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { User } from '@better-you/contracts';
import * as authApi from '../api/authApi';

interface AuthState {
  user: User | null;
  token: string | null;
}

interface AuthContextValue extends AuthState {
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Token lives only in React state - never localStorage/sessionStorage, to limit
// what a script-injection attack could exfiltrate (ADR 0005). This means
// reloading the page always signs the user out again; that's the accepted
// tradeoff for this milestone, not an oversight.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, token: null });

  const signUp = useCallback(async (email: string, password: string) => {
    await authApi.signUp(email, password);
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const session = await authApi.signIn(email, password);
    setState({ user: session.user, token: session.token });
  }, []);

  const signOut = useCallback(async () => {
    setState((current) => {
      if (current.token) {
        authApi.signOut(current.token).catch(() => {
          // Best-effort: the client-side session is cleared either way.
        });
      }
      return { user: null, token: null };
    });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, signUp, signIn, signOut }),
    [state, signUp, signIn, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
