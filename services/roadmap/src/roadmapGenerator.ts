import type { RoadmapDraft, RoadmapGenerationInput } from '@better-you/contracts';

// The AI/provider-facing adapter boundary the external AI project (built
// and validated in a separate project, not this repo - see ADR 0023) will
// eventually implement. Symmetric guarantees on both sides:
// - IN: a generator only ever receives a RoadmapGenerationInput, the
//   deliberately narrow allowlist built by buildRoadmapGenerationInput() -
//   never the full Goal, never Profile data, never any private
//   documentation or other local-only file content. It cannot reach into
//   Better You's own state; the only thing it's handed is this one argument.
// - OUT: its return value is never trusted directly - RoadmapService always
//   runs it through validateRoadmapDraft() before persisting anything, and
//   a generator can never touch Goals, Profile, or any other Better You
//   state itself; it only returns a draft.
// Until the external AI project is ready, PlaceholderRoadmapGenerator is the
// only implementation, and it satisfies this exact same interface - no
// product-side code will need to change when a real one is swapped in.
export interface RoadmapGenerator {
  generateRoadmap(input: RoadmapGenerationInput): Promise<RoadmapDraft>;
}
