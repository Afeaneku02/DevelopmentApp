# services/roadmap

Product-side Roadmap domain: `Roadmap` → `Milestone` → `ActionStep`, owned by Better You, with real persistence, validation, and status lifecycle - independent of how a roadmap's content is produced.

Roadmap content comes from a `RoadmapGenerator` adapter (`generateRoadmap(input): Promise<RoadmapDraft>`). Two implementations exist:

- `PlaceholderRoadmapGenerator` - deterministic, rule-based, no AI provider or API key. **The default in every case.**
- `HttpRoadmapGenerator` (ADR 0024) - an *optional local integration* that calls the separate `DevelopmentApp_AI_Models` project's `POST /roadmaps/generate` over plain HTTP. Only activates when `AI_MODELS_BASE_URL` is explicitly set (`apps/api/src/server.ts`); with it unset, behavior is unchanged. Every failure (network error, timeout, non-2xx, unparsable body) is normalized into `RoadmapGeneratorUnavailableError` (mapped to HTTP 502) rather than persisting anything partial. Not a production dependency - `DevelopmentApp_AI_Models` is expected to stay localhost/internal alpha without real auth for now.

Whatever a generator returns is treated as untrusted draft data and always passes through `validateRoadmapDraft()` before anything is persisted - "AI proposes, Better You validates and persists." That function takes `unknown`, not a typed `RoadmapDraft`, and checks every field's runtime type explicitly - a malformed field from a real (fallible) generator fails with a clean `RoadmapValidationError`, never a raw `TypeError`.

The boundary is symmetric on the way in, too (ADR 0023): a generator never receives the full `Goal` - `buildRoadmapGenerationInput()` narrows it down to an explicit allowlist (`goalCategory`, `goalTitle` only), excluding `userId`, timestamps, status, source, and - deliberately - the goal's free-text `description`. `roadmapGenerationInput.test.ts` proves this holds at runtime (exact key allowlist, no leaked free text, no reference to private-docs paths), not just that the TypeScript type says so.

One roadmap per goal at this milestone (no regeneration/versioning). `completeActionStep()` is the only status-changing action: it cascades deterministically (last step in a milestone completes the milestone and activates the next one; last milestone completes the roadmap), the same way Goals exposes only meaningful lifecycle transitions rather than a generic status setter. It only accepts steps from the roadmap's current active milestone (`RoadmapMilestoneNotActiveError` otherwise) - milestones must be completed in order even though a step id could otherwise be addressed directly.
