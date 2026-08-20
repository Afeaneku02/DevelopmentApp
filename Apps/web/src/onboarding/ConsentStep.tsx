import { useState } from 'react';

interface ConsentStepProps {
  onNext: () => void;
  loading: boolean;
}

export default function ConsentStep({ onNext, loading }: ConsentStepProps) {
  const [agreed, setAgreed] = useState(false);

  return (
    <div className="onboarding-step">
      <h1>Before we begin</h1>
      <p className="subtitle">
        Better You stores your profile, preferences, and goals so it can guide you over time. This is an early
        preview: there's no AI processing or roadmap generation yet, and nothing you enter leaves this app's own
        database.
      </p>
      <label className="consent-checkbox">
        <input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} />
        I understand, and I'd like to continue.
      </label>
      <button onClick={onNext} disabled={loading || !agreed}>
        Continue
      </button>
    </div>
  );
}
