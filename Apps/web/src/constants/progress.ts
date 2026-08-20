import type { ProgressTrend } from '@better-you/contracts';

export const TREND_LABELS: Record<ProgressTrend, string> = {
  improving: 'Improving',
  steady: 'Steady',
  declining: 'Declining',
  not_enough_data: 'Not enough data yet',
};

export function formatConsistency(consistency: number | null): string {
  if (consistency === null) return 'No check-ins yet';
  return `${Math.round(consistency * 100)}% consistent`;
}
