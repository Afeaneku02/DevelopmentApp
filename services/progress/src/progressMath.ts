import type { CheckIn, CheckInResponse, ProgressSummary, ProgressTrend } from '@better-you/contracts';

// Placeholder heuristics, not Vision/Blueprint-specified numbers - same
// status as Dashboard's 7-day staleness threshold (ADR 0011). Easy to revise
// once a real signal (e.g. a defined check-in cadence) exists.
const MIN_SCORABLE_CHECK_INS_FOR_TREND = 4;
const TREND_THRESHOLD = 0.15;

function emptyCounts(): Record<CheckInResponse, number> {
  return { yes: 0, no: 0, partly: 0, skipped: 0 };
}

// yes=1, partly=0.5, no=0. skipped scores null (excluded from both the
// numerator and denominator) - it represents no attempt either way, not a
// negative result.
function scoreFor(response: CheckInResponse): number | null {
  if (response === 'yes') return 1;
  if (response === 'partly') return 0.5;
  if (response === 'no') return 0;
  return null;
}

export function computeConsistency(checkIns: CheckIn[]): number | null {
  const scores = checkIns
    .map((checkIn) => scoreFor(checkIn.response))
    .filter((score): score is number => score !== null);
  if (scores.length === 0) return null;
  return scores.reduce((sum, score) => sum + score, 0) / scores.length;
}

// Splits scorable check-ins (oldest-first) in half and compares the
// consistency of the earlier half to the later half. Requires a minimum
// count before claiming a trend at all, since two or three check-ins don't
// meaningfully establish a direction.
export function computeTrend(checkIns: CheckIn[]): ProgressTrend {
  const scorable = checkIns.filter((checkIn) => checkIn.response !== 'skipped');
  if (scorable.length < MIN_SCORABLE_CHECK_INS_FOR_TREND) return 'not_enough_data';

  const oldestFirst = [...scorable].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const mid = Math.floor(oldestFirst.length / 2);
  const earlierAvg = computeConsistency(oldestFirst.slice(0, mid))!;
  const laterAvg = computeConsistency(oldestFirst.slice(mid))!;
  const delta = laterAvg - earlierAvg;

  if (delta > TREND_THRESHOLD) return 'improving';
  if (delta < -TREND_THRESHOLD) return 'declining';
  return 'steady';
}

export function summarizeProgress(checkIns: CheckIn[]): ProgressSummary {
  const responseCounts = emptyCounts();
  for (const checkIn of checkIns) {
    responseCounts[checkIn.response] += 1;
  }

  return {
    totalCheckIns: checkIns.length,
    responseCounts,
    consistency: computeConsistency(checkIns),
    trend: computeTrend(checkIns),
  };
}
