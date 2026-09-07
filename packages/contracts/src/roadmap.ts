import type { GoalCategory } from './goal';

// Blueprint's future AI-generated "Create Plan" step (§6) fills this domain
// in eventually; for now every Roadmap comes from a deterministic
// placeholder generator (services/roadmap/src/placeholderRoadmapGenerator.ts)
// behind the RoadmapGenerator adapter interface, so the real AI project can
// later implement that same interface without any product-side changes.
export type RoadmapStatus = 'active' | 'completed' | 'archived';
export type MilestoneStatus = 'pending' | 'active' | 'completed';
export type ActionStepStatus = 'pending' | 'completed';

export interface ActionStep {
  id: string;
  title: string;
  description: string;
  status: ActionStepStatus;
}

export interface Milestone {
  id: string;
  title: string;
  description: string;
  status: MilestoneStatus;
  actionSteps: ActionStep[];
}

export interface Roadmap {
  id: string;
  userId: string;
  goalId: string;
  status: RoadmapStatus;
  milestones: Milestone[];
  createdAt: string;
  updatedAt: string;
}

// Untrusted shape a RoadmapGenerator returns - no ids/status yet, since those
// are assigned by RoadmapService only after validateRoadmapDraft() accepts
// it (services/roadmap/src/roadmapValidation.ts). A future real-AI
// implementation of RoadmapGenerator produces exactly this same shape; it
// never gets to hand the app a fully-formed Roadmap directly.
export interface ActionStepDraft {
  title: string;
  description?: string;
}

export interface MilestoneDraft {
  title: string;
  description?: string;
  actionSteps: ActionStepDraft[];
}

export interface RoadmapDraft {
  milestones: MilestoneDraft[];
}

// What any RoadmapGenerator (placeholder today, an external AI provider
// later - see ADR 0023) is allowed to receive. This is a deliberate
// allowlist, not the Goal object itself: only a bounded, already-validated
// title and a closed-set category enum cross this boundary. It never
// includes userId, timestamps, status, source, or the goal's free-text
// description - see services/roadmap/src/roadmapGenerationInput.ts for the
// one function that builds this from a real Goal, and its tests for proof
// nothing else can leak through. No Profile/preferences/history either,
// since nothing currently consumes them.
export interface RoadmapGenerationInput {
  goalCategory: GoalCategory;
  goalTitle: string;
}
