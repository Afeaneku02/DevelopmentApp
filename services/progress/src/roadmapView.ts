import type { Roadmap } from '@better-you/contracts';

// Minimal structural interface for the one thing this domain needs from
// Roadmap - RoadmapService already satisfies this shape (same
// dependency-inversion pattern as CheckInsView).
export interface RoadmapView {
  getRoadmapForGoal(userId: string, goalId: string): Promise<Roadmap | null>;
}
