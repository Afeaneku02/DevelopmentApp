# Better You Development Log — 2026-08-23

## Session Overview

Built the Roadmap domain and the adapter boundary the future AI project will plug into. The user is developing and validating Better You's actual AI model in a separate project outside this repository; this session's job was to build the *product* side that AI will eventually feed - a real, persisted Roadmap/Milestone/ActionStep data model, owned and validated by Better You - along with the exact seam a real AI implementation will satisfy later, without building any AI itself. This closes a gap every prior milestone had deliberately left open: Onboarding's terminal step has been named `awaiting_roadmap` since ADR 0010, anticipating exactly this.

## Starting Point

Goals, Auth, Profile, Onboarding, Dashboard, Check-ins, and Progress all existed and worked end to end, but Roadmap did not. Onboarding stopped at `awaiting_roadmap` with nothing behind it; Dashboard's `nextAction` heuristic only ever considered Goals (Blueprint §10 formally lists Roadmap as a Dashboard dependency too). No roadmap content existed anywhere in the app.

## Goal for This Session

Build a real Roadmap domain (data model, validation, persistence, lifecycle) plus a `RoadmapGenerator` adapter interface that any future AI implementation can satisfy, backed for now by a deterministic placeholder generator - and wire enough of onboarding/Dashboard to actually exercise and show it, without implementing or depending on any real AI provider.

## Work Completed

### What Changed

- New contracts in `packages/contracts/src/roadmap.ts`: `Roadmap`, `Milestone`, `ActionStep` (the persisted shapes) and `RoadmapDraft`/`MilestoneDraft`/`ActionStepDraft`/`RoadmapGenerationInput` (the untrusted shape a generator produces before validation).
- A new `services/roadmap` package: `RoadmapService` (generate/get/list/complete-step), `RoadmapRepository` with `InMemoryRoadmapRepository`/`FileRoadmapRepository`, `roadmapValidation.ts`, the `RoadmapGenerator` interface, and `PlaceholderRoadmapGenerator` - the only implementation, deterministic and rule-based, no AI provider or API key.
- `services/dashboard` updated: a new `RoadmapsView` interface, `DashboardService` now depends on it alongside `GoalsView`, and `computeNextAction()` gained a `continue_roadmap` tier between "review a stale goal" and "suggest a new one."
- `apps/api`: new `/api/v1/roadmaps` and `/api/v1/goals/:id/roadmap` routes, `RoadmapService` wired into `createDefaultDependencies()` (file-backed when a `dataDir` is set, same as every other domain), new error-handler cases for the four Roadmap error types.
- `apps/web`: `roadmapApi.ts` client; `OnboardingFlow`'s `handleFirstGoalCreated` now generates a placeholder roadmap for the first goal right after it's recorded; `DashboardScreen` renders the `continue_roadmap` next action with a "Mark step done" button and a per-goal roadmap panel (milestones + action steps, "Mark done" enabled only on the active milestone).

### Why It Changed

Per explicit user direction: Better You's AI is being built and validated elsewhere first. The next MVP milestone here is the product-side dock that AI will plug into, not AI itself - "AI proposes, Better You validates and persists," with Better You owning all structured state and validation.

### How It Works

`RoadmapService.generateRoadmap(userId, goalId)` looks up the goal (ownership-checked), rejects if a roadmap already exists for it, calls the injected `RoadmapGenerator`, and runs the result through `validateRoadmapDraft()` before assigning real ids/status and persisting - the same validation boundary a real HTTP request body gets, applied uniformly whether the generator is today's placeholder or a future real AI model. The first milestone starts `active`, the rest `pending`; `completeActionStep()` cascades deterministically (last step in a milestone completes it and activates the next; last milestone completes the roadmap) rather than exposing a generic status setter, mirroring how Goals only exposes meaningful lifecycle transitions.

## Example Flow

A user finishes onboarding's `first_goal` step by creating "Ship the Better You MVP." `OnboardingFlow` immediately calls `POST /api/v1/goals/:id/roadmap`, which generates a three-milestone placeholder roadmap and persists it. Onboarding advances to `awaiting_roadmap` as before, and the user lands on Dashboard. Dashboard's `nextAction` now reads `continue_roadmap`, pointing at the first pending step ("Write down why this goal matters to you"). Clicking "Mark step done" calls `POST /api/v1/roadmaps/:id/steps/:stepId/complete`; the dashboard refreshes and `nextAction` advances to the next pending step.

## Problems Encountered

**No known issues** - implementation matched the plan on the first pass; the browser verification run below caught two script mistakes (wrong button-text assumptions), not application bugs.

## Decisions Made

Recorded in full in [ADR 0020](../../architecture-decisions/0020-roadmap-domain-and-ai-adapter.md): one roadmap per goal with no regeneration/versioning yet; `completeActionStep()` as the only status-changing action; Dashboard's `NextAction` heuristic ordering (paused > stale > continue-roadmap > add-goal > none); no dedicated Roadmap screen or generation UI outside onboarding at this milestone.

## Files Significantly Changed

- `packages/contracts/src/roadmap.ts` - Roadmap/Milestone/ActionStep contracts and the untrusted draft shapes.
- `services/roadmap/src/roadmapService.ts` - generation, retrieval, and the step-completion cascade.
- `services/roadmap/src/placeholderRoadmapGenerator.ts` - the deterministic stand-in for the future real AI generator.
- `services/dashboard/src/nextAction.ts` - the `continue_roadmap` heuristic tier.
- `apps/api/src/server.ts` - `RoadmapService` wiring (in-memory and file-backed).
- `apps/web/src/screens/DashboardScreen.tsx` - the next-action button and per-goal roadmap panel.
- `apps/web/src/screens/OnboardingFlow.tsx` - roadmap generation right after the first goal is recorded.

## Testing and Validation

**Tested:**
- Full automated suite: 285 vitest tests passing, including new unit tests for `roadmapValidation`, `RoadmapService`, `PlaceholderRoadmapGenerator`, `FileRoadmapRepository`, updated `computeNextAction`/`DashboardService` tests, a domain-level `roadmap.integration.test.ts`, and new full-server HTTP tests in `api.integration.test.ts` for the roadmap routes and the dashboard's `continue_roadmap` next action.
- `tsc --noEmit` clean for the root workspace, `apps/api`, and `apps/web`.
- Real end-to-end browser verification: started the actual `apps/api`/`apps/web` dev servers and drove a real Chromium instance (temporary `--no-save` Playwright install, per the established fallback for this project) through signup → full onboarding → first goal creation → Dashboard showing the `continue_roadmap` next action and the roadmap panel → clicking "Mark step done" → the next action correctly advancing to the following step. Screenshots confirmed the UI rendered as intended in both states.

**Not yet tested:** behavior once a second/third goal (outside onboarding) is created - no UI currently triggers roadmap generation for those, matching this milestone's explicit scope.

## Current State

Roadmap is a real, working, tested domain end to end: generate → validate → persist → display → complete steps → cascade to milestone/roadmap completion, all reachable from a live signup-to-dashboard flow. The `RoadmapGenerator` interface is the one remaining seam for the external AI project to fill in later.

## Known Issues

No known issues identified during this session.

## Next Recommended Step

Per the agreed sequence (recorded in ADR 0020's Context): an activity/event ledger recording structured product events (goal created, check-in recorded, milestone completed, goal paused, etc.) - the clean input stream the external AI project will eventually want, and the next piece of the "build around the AI" groundwork that doesn't require the AI itself to exist yet.

---

## Continued: Code Review Fixes (Same Day)

A review of the Roadmap work above found two real gaps between the stated design and what the code actually enforced. Both are fixed and covered by new tests; ADR 0020 and `services/roadmap/README.md` were updated in place to describe the corrected behavior rather than left describing the pre-fix state.

### Problem 1: `validateRoadmapDraft()` was not actually runtime-safe against untrusted input

**Problem:** The function signature accepted a typed `RoadmapDraft`, and internally `validateText()` called `(value ?? '').trim()` directly. A generator - including a future real AI model, the exact case this validation exists for - returning a malformed field (e.g. `{ title: 123 }`) would hit `.trim()` on a number and throw a raw `TypeError`, surfacing as an unhandled 500 instead of a clean `RoadmapValidationError`.

**Root Cause:** TypeScript's static types describe the *intended* shape, not what a real external system will actually send at runtime. Treating a generator's output as untrusted only in comments, while its type signature still says `RoadmapDraft`, left every nested field access unguarded.

**Solution:** `validateRoadmapDraft()` and its helpers now take `unknown`. Every level (the draft itself, each milestone, each action step, each string field) is checked with explicit runtime type guards (`isRecord()`, `Array.isArray()`, `typeof value === 'string'`) before any property access or string method call. A non-object, wrong-type, or missing field now fails with a `RoadmapValidationError` naming the exact field path, never a raw exception.

**Why the Solution Works:** The validation boundary now matches what it was documented to do - reject any malformed shape from any generator, present or future - rather than only handling the specific shapes the deterministic placeholder happens to produce.

### Problem 2: Roadmap steps could be completed out of milestone order through the API

**Problem:** `completeActionStep()` located a step anywhere in the roadmap by id and completed it, with no check on which milestone it belonged to. The web UI only shows a "Mark done" button for the active milestone's pending steps, but a direct API call (or a future non-placeholder generator/consumer) could complete a step in milestone 2 before milestone 1's steps were done, since nothing prevented it.

**Root Cause:** The cascade logic (complete a milestone when all its steps are done; activate the next one) assumes milestones are completed in order, but nothing in `completeActionStep()` enforced that assumption - it trusted the caller to only ever request the "right" step.

**Solution:** `completeActionStep()` now checks that the step's milestone has `status === 'active'` before proceeding, throwing a new `RoadmapMilestoneNotActiveError` (mapped to HTTP 409 `ROADMAP_MILESTONE_NOT_ACTIVE`) otherwise. This also correctly rejects re-completing a step in an already-`completed` milestone.

**Why the Solution Works:** The lifecycle invariant the cascade logic depends on (milestones complete strictly in order) is now enforced at the one place state actually changes, not just assumed from how the UI happens to be built.

### Testing and Validation

Added: 7 new `roadmapValidation` tests covering non-object drafts/milestones/steps and non-string title/description fields (including the exact `{ title: 123 }` scenario); 2 new `RoadmapService` tests (rejecting a future-milestone step, rejecting re-completion of an already-completed milestone's step); 1 new full-server HTTP test for the `ROADMAP_MILESTONE_NOT_ACTIVE` 409 response. Full suite: 285/285 vitest tests passing; `tsc --noEmit` clean across the root workspace, `apps/api`, and `apps/web`.
