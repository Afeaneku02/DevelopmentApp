import { describe, it, expect } from 'vitest';
import type { CheckIn, CheckInResponse } from '@better-you/contracts';
import { computeConsistency, computeTrend, summarizeProgress } from '../progressMath';

let counter = 0;
function makeCheckIn(response: CheckInResponse, createdAt: string): CheckIn {
  counter += 1;
  return {
    id: `check-in-${counter}`,
    userId: 'user-1',
    goalId: 'goal-1',
    response,
    note: '',
    createdAt,
  };
}

describe('computeConsistency', () => {
  it('returns null for no check-ins', () => {
    expect(computeConsistency([])).toBeNull();
  });

  it('returns null when every check-in is skipped', () => {
    const checkIns = [makeCheckIn('skipped', '2026-01-01T00:00:00.000Z')];
    expect(computeConsistency(checkIns)).toBeNull();
  });

  it('scores yes as 1 and no as 0', () => {
    const checkIns = [makeCheckIn('yes', '2026-01-01T00:00:00.000Z'), makeCheckIn('no', '2026-01-02T00:00:00.000Z')];
    expect(computeConsistency(checkIns)).toBe(0.5);
  });

  it('scores partly as 0.5 and excludes skipped from the average', () => {
    const checkIns = [
      makeCheckIn('yes', '2026-01-01T00:00:00.000Z'),
      makeCheckIn('partly', '2026-01-02T00:00:00.000Z'),
      makeCheckIn('skipped', '2026-01-03T00:00:00.000Z'),
    ];
    expect(computeConsistency(checkIns)).toBe(0.75);
  });
});

describe('computeTrend', () => {
  it('returns not_enough_data below the minimum scorable check-in count', () => {
    const checkIns = [
      makeCheckIn('yes', '2026-01-01T00:00:00.000Z'),
      makeCheckIn('yes', '2026-01-02T00:00:00.000Z'),
      makeCheckIn('yes', '2026-01-03T00:00:00.000Z'),
    ];
    expect(computeTrend(checkIns)).toBe('not_enough_data');
  });

  it('excludes skipped check-ins from the minimum-count threshold', () => {
    const checkIns = [
      makeCheckIn('yes', '2026-01-01T00:00:00.000Z'),
      makeCheckIn('yes', '2026-01-02T00:00:00.000Z'),
      makeCheckIn('skipped', '2026-01-03T00:00:00.000Z'),
      makeCheckIn('skipped', '2026-01-04T00:00:00.000Z'),
    ];
    expect(computeTrend(checkIns)).toBe('not_enough_data');
  });

  it('detects an improving trend from an earlier-worse, later-better split', () => {
    const checkIns = [
      makeCheckIn('no', '2026-01-01T00:00:00.000Z'),
      makeCheckIn('no', '2026-01-02T00:00:00.000Z'),
      makeCheckIn('yes', '2026-01-03T00:00:00.000Z'),
      makeCheckIn('yes', '2026-01-04T00:00:00.000Z'),
    ];
    expect(computeTrend(checkIns)).toBe('improving');
  });

  it('detects a declining trend from an earlier-better, later-worse split', () => {
    const checkIns = [
      makeCheckIn('yes', '2026-01-01T00:00:00.000Z'),
      makeCheckIn('yes', '2026-01-02T00:00:00.000Z'),
      makeCheckIn('no', '2026-01-03T00:00:00.000Z'),
      makeCheckIn('no', '2026-01-04T00:00:00.000Z'),
    ];
    expect(computeTrend(checkIns)).toBe('declining');
  });

  it('reports steady when consistency barely changes', () => {
    const checkIns = [
      makeCheckIn('yes', '2026-01-01T00:00:00.000Z'),
      makeCheckIn('no', '2026-01-02T00:00:00.000Z'),
      makeCheckIn('yes', '2026-01-03T00:00:00.000Z'),
      makeCheckIn('no', '2026-01-04T00:00:00.000Z'),
    ];
    expect(computeTrend(checkIns)).toBe('steady');
  });

  it('is order-independent - unsorted input yields the same trend as sorted input', () => {
    const sorted = [
      makeCheckIn('no', '2026-01-01T00:00:00.000Z'),
      makeCheckIn('no', '2026-01-02T00:00:00.000Z'),
      makeCheckIn('yes', '2026-01-03T00:00:00.000Z'),
      makeCheckIn('yes', '2026-01-04T00:00:00.000Z'),
    ];
    const shuffled = [sorted[2], sorted[0], sorted[3], sorted[1]];
    expect(computeTrend(shuffled)).toBe(computeTrend(sorted));
  });
});

describe('summarizeProgress', () => {
  it('returns zero counts, null consistency, and not_enough_data for no check-ins', () => {
    expect(summarizeProgress([])).toEqual({
      totalCheckIns: 0,
      responseCounts: { yes: 0, no: 0, partly: 0, skipped: 0 },
      consistency: null,
      trend: 'not_enough_data',
    });
  });

  it('combines counts, consistency, and trend for a real set of check-ins', () => {
    const checkIns = [
      makeCheckIn('yes', '2026-01-01T00:00:00.000Z'),
      makeCheckIn('partly', '2026-01-02T00:00:00.000Z'),
      makeCheckIn('no', '2026-01-03T00:00:00.000Z'),
      makeCheckIn('skipped', '2026-01-04T00:00:00.000Z'),
    ];
    const summary = summarizeProgress(checkIns);
    expect(summary.totalCheckIns).toBe(4);
    expect(summary.responseCounts).toEqual({ yes: 1, partly: 1, no: 1, skipped: 1 });
    expect(summary.consistency).toBeCloseTo(0.5, 5);
  });
});
