import type { RoadmapDraft, RoadmapGenerationInput } from '@better-you/contracts';

// The adapter boundary the external AI project (built and validated in a
// separate project, not this repo) will eventually implement. Its output is
// never trusted directly - RoadmapService always runs it through
// validateRoadmapDraft() before persisting anything, and a generator can
// never touch Goals, Profile, or any other Better You state itself; it only
// returns a draft. Until that project is ready, PlaceholderRoadmapGenerator
// is the only implementation.
export interface RoadmapGenerator {
  generateRoadmap(input: RoadmapGenerationInput): Promise<RoadmapDraft>;
}
