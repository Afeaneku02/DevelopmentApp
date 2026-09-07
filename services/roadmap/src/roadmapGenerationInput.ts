import type { Goal, RoadmapGenerationInput } from '@better-you/contracts';

// The one place a full Goal is narrowed down to exactly what any
// RoadmapGenerator (the placeholder today, an external AI provider later -
// see ADR 0023) is allowed to see. This is the sanitization boundary on the
// way IN, symmetric with validateRoadmapDraft()'s validation boundary on the
// way out: "AI proposes, Better You validates and persists" only holds if
// the app also controls exactly what the AI is shown in the first place.
//
// Deliberately excludes:
// - userId - an internal identifier, not needed to describe what the plan
//   is for, and never worth exposing to a provider.
// - id, status, source, suggestedGoalId, createdAt, updatedAt - internal
//   product state with no bearing on generating a relevant plan.
// - description - free-form, optional, open-ended text a user typed; more
//   likely than title to contain personal context beyond what's needed. If
//   a future real AI generator genuinely needs it, that requires a new,
//   deliberate, explicitly-sanitized field here - not widening this
//   function to pass the raw value through.
//
// Only `category` (a closed-set enum) and `title` (required, already
// length-capped by goalValidation's TITLE_MAX_LENGTH) cross this boundary -
// the minimum needed to generate a plan actually about the right thing.
export function buildRoadmapGenerationInput(goal: Goal): RoadmapGenerationInput {
  return {
    goalCategory: goal.category,
    goalTitle: goal.title,
  };
}
