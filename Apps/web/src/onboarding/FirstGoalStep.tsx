import type { Goal } from '@better-you/contracts';
import AddGoalForm from '../components/AddGoalForm';

interface FirstGoalStepProps {
  onGoalCreated: (goal: Goal) => void;
}

export default function FirstGoalStep({ onGoalCreated }: FirstGoalStepProps) {
  return (
    <div className="onboarding-step">
      <h1>Pick your first goal</h1>
      <p className="subtitle">
        Choose an area to focus on and pick a suggested goal, or describe your own. You can add up to two more
        later.
      </p>
      {/* A brand-new account can never already be at the 3-goal cap here. */}
      <AddGoalForm atLimit={false} onCreated={onGoalCreated} />
    </div>
  );
}
