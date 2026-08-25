import type { ActivityEvent } from '@better-you/contracts';
import { apiFetch } from './client';

export function listEvents(token: string): Promise<{ events: ActivityEvent[] }> {
  return apiFetch('/api/v1/activity', { token });
}
