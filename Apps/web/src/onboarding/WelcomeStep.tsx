interface WelcomeStepProps {
  onNext: () => void;
  loading: boolean;
}

export default function WelcomeStep({ onNext, loading }: WelcomeStepProps) {
  return (
    <div className="onboarding-step">
      <h1>Welcome to Better You</h1>
      <p className="subtitle">
        A guided path from where you are to where you want to be. Let's get you set up — it only takes a minute.
      </p>
      <button onClick={onNext} disabled={loading}>
        Get started
      </button>
    </div>
  );
}
