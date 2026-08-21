import type { ProgressTrend } from '@better-you/contracts';
import { TREND_LABELS, formatConsistency } from '../constants/progress';

interface ConsistencyMeterProps {
  consistency: number | null;
  trend: ProgressTrend;
}

export default function ConsistencyMeter({ consistency, trend }: ConsistencyMeterProps) {
  const percent = consistency === null ? 0 : Math.round(consistency * 100);

  return (
    <div className="consistency-meter">
      <div className="consistency-meter-header">
        <span className="consistency-meter-value">{formatConsistency(consistency)}</span>
        {trend !== 'not_enough_data' && (
          <span className={`trend-badge trend-${trend}`}>{TREND_LABELS[trend]}</span>
        )}
      </div>
      {consistency !== null && (
        <div className="consistency-bar" role="img" aria-label={`${percent}% consistent`}>
          <div className="consistency-bar-fill" style={{ width: `${percent}%` }} />
        </div>
      )}
    </div>
  );
}
