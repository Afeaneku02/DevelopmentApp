import type { Roadmap } from '@better-you/contracts';

// Shared between DashboardScreen (active goals only) and GoalsScreen (every
// goal), so the "placeholder, not AI-generated" labeling and milestone/step
// rendering never drift into two slightly different views (CLAUDE.md §5:
// avoid duplicate logic) - same reasoning as AddGoalForm.
interface RoadmapPanelProps {
  roadmap: Roadmap;
  onCompleteStep: (roadmapId: string, actionStepId: string) => void;
  busy: boolean;
}

export default function RoadmapPanel({ roadmap, onCompleteStep, busy }: RoadmapPanelProps) {
  return (
    <div className="roadmap-panel">
      <p className="roadmap-panel-label">Roadmap (placeholder, not AI-generated)</p>
      {roadmap.milestones.map((milestone) => (
        <div key={milestone.id} className={`roadmap-milestone roadmap-milestone-${milestone.status}`}>
          <strong>{milestone.title}</strong>
          <ul className="roadmap-actionsteps">
            {milestone.actionSteps.map((step) => (
              <li key={step.id} className={`roadmap-actionstep roadmap-actionstep-${step.status}`}>
                <span>{step.title}</span>
                {step.status === 'pending' && milestone.status !== 'pending' && (
                  <button type="button" disabled={busy} onClick={() => onCompleteStep(roadmap.id, step.id)}>
                    Mark done
                  </button>
                )}
                {step.status === 'completed' && <span className="roadmap-actionstep-check">✓</span>}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
