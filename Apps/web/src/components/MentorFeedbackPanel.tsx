import type { MentorFeedbackResult } from '@better-you/contracts';

// Read-only display of GET /api/v1/mentor-feedback's result (ADR 0026) - a
// pure function of its prop, same shape as RoadmapPanel: no fetching, no
// local state, no action a user can take here. `mentorFeedback === null`
// means "not loaded yet" and renders nothing, matching how the rest of
// Dashboard waits for its own data rather than showing a placeholder.
//
// Every status the backend can return is shown honestly, in its own words -
// 'needs_more_data' and 'unavailable' are not hidden, retried silently, or
// dressed up as something more definite than they are.
interface MentorFeedbackPanelProps {
  mentorFeedback: MentorFeedbackResult | null;
}

export default function MentorFeedbackPanel({ mentorFeedback }: MentorFeedbackPanelProps) {
  if (!mentorFeedback) {
    return null;
  }

  return (
    <section className="mentor-feedback-panel">
      <p className="mentor-feedback-label">Mentor feedback (early preview)</p>

      {mentorFeedback.status === 'unavailable' && (
        <p className="mentor-feedback-empty">
          Mentor feedback isn&apos;t available right now.
          {mentorFeedback.unavailableReason ? ` (${mentorFeedback.unavailableReason})` : ''}
        </p>
      )}

      {mentorFeedback.status === 'needs_more_data' && (
        <p className="mentor-feedback-empty">
          Not enough recorded activity yet for mentor feedback.
          {mentorFeedback.needsMoreDataReason ? ` ${mentorFeedback.needsMoreDataReason}.` : ''}
        </p>
      )}

      {mentorFeedback.status === 'ready' && mentorFeedback.feedback.length === 0 && (
        <p className="mentor-feedback-empty">Nothing to share yet.</p>
      )}

      {mentorFeedback.status === 'ready' && mentorFeedback.feedback.length > 0 && (
        <ul className="mentor-feedback-items">
          {mentorFeedback.feedback.map((item, index) => (
            // No stable id crosses the wire for a feedback item - it is a
            // freshly computed observation, not a stored record - so index
            // is the correct key here (same reasoning as a derived list
            // with no identity of its own).
            // eslint-disable-next-line react/no-array-index-key
            <li key={index} className="mentor-feedback-item">
              <div className="mentor-feedback-item-header">
                <span className={`badge mentor-feedback-risk mentor-feedback-risk-${item.riskTier}`}>
                  {item.riskTier} risk
                </span>
                <span className="mentor-feedback-confidence">{Math.round(item.confidence * 100)}% confidence</span>
              </div>
              <p className="mentor-feedback-message">{item.message}</p>
              {item.recommendedNextAction && (
                <p className="mentor-feedback-next-action">-&gt; {item.recommendedNextAction}</p>
              )}
              <p className="mentor-feedback-why">Why: {item.why}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
