import { getEnv } from './env';

const DEFAULT_DEV_USER_ID = 'dev-user-local';

// Dev-only stand-in for real Auth (Blueprint §4); must not be used once session-based
// identity exists. Callers pass the resolved id into services explicitly.
export function getStubUserId(): string {
  return getEnv('DEV_USER_ID', DEFAULT_DEV_USER_ID);
}
