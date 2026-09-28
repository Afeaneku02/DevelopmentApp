import { useState, type FormEvent } from 'react';
import {
  MENTOR_GUIDANCE_MAX_REPLIES,
  MENTOR_GUIDANCE_REPLY_MAX_LENGTH,
  type MentorGuidanceClarification,
  type MentorGuidanceResult,
} from '@better-you/contracts';
import * as mentorGuidanceApi from '../api/mentorGuidanceApi';
import * as roadmapApi from '../api/roadmapApi';
import { ApiError } from '../api/client';

// User-triggered mentor guidance for one goal (ADR 0029). Nothing is
// requested until the user presses the button - the AI service may make a
// billable model call, so this never runs on page load the way the passive,
// rule-based MentorFeedbackPanel does.
//
// Every state is shown honestly: live AI guidance, the AI service's
// rule-based fallback, "not enough information yet", and "unavailable" are
// labeled distinctly rather than all dressed up as the same thing.
//
// Clarification replies: when (and only when) the model itself asked a
// clarifying question (`acceptsReply`), the user can answer it. Each answer
// is sent together with this interaction's earlier question/answer turns, so
// the mentor reads "10 minutes" against the question it actually asked. The
// exchange is bounded - at most MENTOR_GUIDANCE_MAX_REPLIES answers per
// interaction, and never another answer to the exact question just answered.
// An answer only counts once the mentor actually responded: if the AI
// service is unavailable or Better You's API fails, the question stays on
// screen and the answer stays in the field, ready to send again.
//
// All of this lives in this component's state only: "Ask again" starts a
// fresh interaction, and nothing is stored anywhere.
interface MentorGuidancePanelProps {
  token: string;
  goalId: string;
  onPlanChanged: () => Promise<void>;
}

// Plain-language copy for the reason codes a user is most likely to hit.
// Unknown codes fall back to a generic line; the raw code is still shown
// small for troubleshooting.
const UNAVAILABLE_COPY: Record<string, string> = {
  not_configured: "Mentor guidance isn't set up in this environment yet.",
  network_error: "Couldn't reach the mentor service. Try again in a moment.",
  timeout: 'The mentor service took too long to respond. Try again in a moment.',
  mentor_configuration_invalid: "The mentor service isn't fully configured yet.",
};

// The AI project's deterministic gates. None of them can be resolved by a
// reply, so their generic built-in question is not shown as something to
// answer.
const NEEDS_MORE_COPY: Record<string, string> = {
  insufficient_authorized_evidence:
    'Keep checking in on this goal - once there is enough recorded progress, your mentor can suggest a next step.',
  policy_requires_resolution:
    "This kind of goal needs more care than quick automated guidance can give, so your mentor won't suggest actions for it yet.",
  consequential_request:
    "This goal touches on something consequential, so your mentor won't suggest actions for it automatically.",
};

// Why the last answer didn't get through. The answer is kept either way.
type DeliveryError = { kind: 'unavailable'; reasonCode: string | null } | { kind: 'request' };

// Code points, matching the API's (and the AI endpoint's) limit.
function replyLength(text: string): number {
  return [...text.trim()].length;
}

function sameQuestion(a: string | null, b: string | null): boolean {
  return a !== null && b !== null && a.trim().toLowerCase() === b.trim().toLowerCase();
}

export default function MentorGuidancePanel({ token, goalId, onPlanChanged }: MentorGuidancePanelProps) {
  const [loading, setLoading] = useState(false);
  const [requestFailed, setRequestFailed] = useState(false);
  const [result, setResult] = useState<MentorGuidanceResult | null>(null);
  // Per-interaction clarification state (reset by "Get mentor guidance" /
  // "Ask again"). `turns` holds only answers the mentor actually received.
  const [turns, setTurns] = useState<MentorGuidanceClarification[]>([]);
  const [pendingAnswer, setPendingAnswer] = useState<string | null>(null);
  const [deliveryError, setDeliveryError] = useState<DeliveryError | null>(null);
  const [draft, setDraft] = useState('');

  async function startInteraction() {
    setResult(null);
    setTurns([]);
    setPendingAnswer(null);
    setDeliveryError(null);
    setDraft('');
    setRequestFailed(false);
    setLoading(true);
    try {
      const { mentorGuidance } = await mentorGuidanceApi.requestMentorGuidance(token, goalId);
      setResult(mentorGuidance);
    } catch {
      // Better You's own API failed (not the AI service - that comes back as
      // a normal 'unavailable' result).
      setRequestFailed(true);
    } finally {
      setLoading(false);
    }
  }

  async function submitReply(event: FormEvent) {
    event.preventDefault();
    const answer = draft.trim();
    const question = result?.clarifyingQuestion;
    if (!question || answer.length === 0 || replyLength(answer) > MENTOR_GUIDANCE_REPLY_MAX_LENGTH) return;

    const nextTurns = [...turns, { question, answer }];
    setPendingAnswer(answer);
    setDeliveryError(null);
    setLoading(true);
    try {
      const { mentorGuidance } = await mentorGuidanceApi.requestMentorGuidance(token, goalId, nextTurns);
      if (mentorGuidance.status === 'unavailable') {
        // The mentor never saw it: keep the question, the answer, and the
        // turn count exactly as they were, so Send simply retries.
        setDeliveryError({ kind: 'unavailable', reasonCode: mentorGuidance.reasonCode });
      } else {
        setTurns(nextTurns);
        setResult(mentorGuidance);
        setDraft('');
      }
    } catch {
      setDeliveryError({ kind: 'request' });
    } finally {
      setPendingAnswer(null);
      setLoading(false);
    }
  }

  // Loop guards: the server says a reply can matter at all (acceptsReply),
  // this interaction hasn't used up its answers, and the mentor isn't simply
  // repeating the question the user already answered.
  const lastTurn = turns.length > 0 ? turns[turns.length - 1] : null;
  const repeatedQuestion = result !== null && lastTurn !== null && sameQuestion(result.clarifyingQuestion, lastTurn.question);
  const canReply =
    result !== null && result.acceptsReply && turns.length < MENTOR_GUIDANCE_MAX_REPLIES && !repeatedQuestion;
  const stoppedAsking = result !== null && result.acceptsReply && !canReply && turns.length > 0;

  const length = replyLength(draft);
  const tooLong = length > MENTOR_GUIDANCE_REPLY_MAX_LENGTH;
  const started = result !== null || requestFailed || loading;
  const replying = pendingAnswer !== null;

  return (
    <section className="mentor-guidance" aria-live="polite" aria-busy={loading}>
      <button type="button" className="mentor-guidance-button" onClick={startInteraction} disabled={loading}>
        {loading && !replying ? 'Asking your mentor…' : started ? 'Ask again' : 'Get mentor guidance'}
      </button>

      {requestFailed && (
        <p className="mentor-guidance-note mentor-guidance-error">
          Something went wrong requesting guidance. Please try again.
        </p>
      )}

      {turns.length > 0 && (
        <ol className="mentor-guidance-turns" aria-label="This conversation">
          {turns.map((turn, index) => (
            // eslint-disable-next-line react/no-array-index-key
            <li key={index}>
              <p className="mentor-guidance-code">Your mentor asked: {turn.question}</p>
              <p className="mentor-guidance-reply-echo">
                <span className="mentor-guidance-code">You answered:</span> {turn.answer}
              </p>
            </li>
          ))}
        </ol>
      )}

      {result && !(loading && !replying) && <GuidanceResult result={result} token={token} goalId={goalId} onPlanChanged={onPlanChanged} />}

      {result && !loading && stoppedAsking && (
        <p className="mentor-guidance-note">
          {repeatedQuestion
            ? "Your mentor asked the same thing again, so it won't keep asking. Keep checking in and try again later."
            : "That's as far as this conversation goes for now. Keep checking in and try again later."}
        </p>
      )}

      {result && canReply && (
        <form className="mentor-guidance-reply" onSubmit={submitReply}>
          <label htmlFor={`mentor-reply-${goalId}`} className="mentor-guidance-label">
            Your answer
          </label>
          <textarea
            id={`mentor-reply-${goalId}`}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={3}
            disabled={loading}
            aria-describedby={`mentor-reply-help-${goalId}`}
            aria-invalid={tooLong}
          />
          <p id={`mentor-reply-help-${goalId}`} className={`mentor-guidance-code${tooLong ? ' mentor-guidance-error' : ''}`}>
            {length}/{MENTOR_GUIDANCE_REPLY_MAX_LENGTH} characters · Sent to your mentor for this conversation only - not
            saved.
          </p>
          {replying && <p className="mentor-guidance-note">Sending your answer to your mentor…</p>}
          {deliveryError && (
            <p className="mentor-guidance-note mentor-guidance-error" role="alert">
              Your answer wasn&apos;t delivered
              {deliveryError.kind === 'unavailable'
                ? ` - ${(deliveryError.reasonCode && UNAVAILABLE_COPY[deliveryError.reasonCode]) ?? "the mentor service isn't available right now."}`
                : ' - something went wrong on our side.'}{' '}
              It&apos;s kept above; send it again when you&apos;re ready.
            </p>
          )}
          <button type="submit" disabled={loading || length === 0 || tooLong}>
            {replying ? 'Sending…' : deliveryError ? 'Send again' : 'Send answer'}
          </button>
        </form>
      )}
    </section>
  );
}

function GuidanceResult({ result, token, goalId, onPlanChanged }: MentorGuidancePanelProps & { result: MentorGuidanceResult }) {
  if (result.status === 'unavailable') {
    return (
      <div className="mentor-guidance-body">
        <p className="mentor-guidance-note">
          {(result.reasonCode && UNAVAILABLE_COPY[result.reasonCode]) ??
            "Mentor guidance isn't available right now."}
        </p>
        {result.reasonCode && <p className="mentor-guidance-code">Reason: {result.reasonCode}</p>}
      </div>
    );
  }

  if (result.status === 'needs_more_information') {
    const gateCopy = result.reasonCode ? NEEDS_MORE_COPY[result.reasonCode] : undefined;
    return (
      <div className="mentor-guidance-body">
        <p className="mentor-guidance-label">Your mentor needs a little more to go on</p>
        <p className="mentor-guidance-note">{gateCopy ?? result.summary}</p>
        {result.clarifyingQuestion && !gateCopy && (
          <p className="mentor-guidance-question">
            {result.acceptsReply ? 'Your mentor asks: ' : 'Something to think about: '}
            {result.clarifyingQuestion}
          </p>
        )}
      </div>
    );
  }

  const label =
    result.status === 'fallback'
      ? 'Rule-based guidance (the AI mentor was unavailable)'
      : result.source === 'mock'
        ? 'Mentor guidance (test mode - not a live AI response)'
        : 'Mentor guidance (AI-generated, early preview)';

  return (
    <div className="mentor-guidance-body">
      <p className="mentor-guidance-label">{label}</p>
      {result.summary && <p className="mentor-guidance-summary">{result.summary}</p>}
      {result.recommendations.length > 0 && (
        <ul className="mentor-guidance-items">
          {result.recommendations.map((item, index) => (
            // Freshly generated, never stored - there is no stable id, so the
            // index is the correct key (same as MentorFeedbackPanel).
            // eslint-disable-next-line react/no-array-index-key
            <li key={index} className="mentor-guidance-item">
              <p className="mentor-guidance-action">{item.action}</p>
              <p className="mentor-guidance-reason">Why: {item.reason}</p>
              <AddToPlan key={item.action} token={token} goalId={goalId} action={item.action} onPlanChanged={onPlanChanged} />
            </li>
          ))}
        </ul>
      )}
      <p className="mentor-guidance-code">Suggestions are saved only when you choose Add to my plan.</p>
    </div>
  );
}

function AddToPlan({ token, goalId, action, onPlanChanged }: MentorGuidancePanelProps & { action: string }) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (saving || saved) return;
    setSaving(true);
    setError(null);
    try {
      await roadmapApi.addMentorAction(token, goalId, action);
      setSaved(true);
      try { await onPlanChanged(); }
      catch { setError('Saved. Refresh the page to see your updated plan.'); }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save this step. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return <div>
    <button type="button" onClick={save} disabled={saving || saved}>
      {saved ? 'Added to my plan' : saving ? 'Adding…' : 'Add to my plan'}
    </button>
    {error && <p role="alert">{error}</p>}
  </div>;
}
