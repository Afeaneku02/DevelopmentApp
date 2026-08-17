import type { Profile, UpdateProfileInput } from '@better-you/contracts';
import { apiFetch } from './client';

export function getProfile(token: string): Promise<{ profile: Profile }> {
  return apiFetch('/api/v1/profile', { token });
}

export function updateProfile(token: string, input: UpdateProfileInput): Promise<{ profile: Profile }> {
  return apiFetch('/api/v1/profile', { method: 'PATCH', token, body: input });
}
