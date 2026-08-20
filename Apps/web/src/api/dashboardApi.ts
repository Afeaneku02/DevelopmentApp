import type { DashboardView } from '@better-you/contracts';
import { apiFetch } from './client';

export function getDashboard(token: string): Promise<{ dashboard: DashboardView }> {
  return apiFetch('/api/v1/dashboard', { token });
}
