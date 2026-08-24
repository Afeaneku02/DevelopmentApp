import type { RoadmapDraft } from '@better-you/contracts';
import { RoadmapValidationError } from './errors';

export const TITLE_MAX_LENGTH = 200;
export const DESCRIPTION_MAX_LENGTH = 1000;
export const MIN_MILESTONES = 1;
export const MAX_MILESTONES = 10;
export const MAX_ACTION_STEPS_PER_MILESTONE = 10;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

// Every RoadmapGenerator implementation - the deterministic placeholder
// today, a real external AI project later - is treated as an untrusted
// boundary at the type level too, not just in comments: the input is
// `unknown`, so a malformed field (e.g. a number where a title string was
// expected) fails with a RoadmapValidationError instead of throwing a raw
// TypeError (and a 500) deeper in .trim()/.map(). This is the enforcement
// point for "AI proposes, Better You validates and persists."
export function validateRoadmapDraft(draft: unknown): RoadmapDraft {
  if (!isRecord(draft) || !Array.isArray(draft.milestones)) {
    throw new RoadmapValidationError('milestones', 'roadmap draft must include a milestones array');
  }
  if (draft.milestones.length < MIN_MILESTONES || draft.milestones.length > MAX_MILESTONES) {
    throw new RoadmapValidationError(
      'milestones',
      `roadmap must include between ${MIN_MILESTONES} and ${MAX_MILESTONES} milestones`
    );
  }

  return {
    milestones: draft.milestones.map((milestone, index) => validateMilestoneDraft(milestone, index)),
  };
}

function validateMilestoneDraft(milestone: unknown, index: number): RoadmapDraft['milestones'][number] {
  const field = `milestones[${index}]`;
  if (!isRecord(milestone)) {
    throw new RoadmapValidationError(field, `${field} must be an object`);
  }

  const title = validateText(`${field}.title`, milestone.title, TITLE_MAX_LENGTH, true);
  const description = validateText(`${field}.description`, milestone.description, DESCRIPTION_MAX_LENGTH, false);

  if (!Array.isArray(milestone.actionSteps) || milestone.actionSteps.length === 0) {
    throw new RoadmapValidationError(`${field}.actionSteps`, 'each milestone must include at least one action step');
  }
  if (milestone.actionSteps.length > MAX_ACTION_STEPS_PER_MILESTONE) {
    throw new RoadmapValidationError(
      `${field}.actionSteps`,
      `each milestone may include at most ${MAX_ACTION_STEPS_PER_MILESTONE} action steps`
    );
  }

  return {
    title,
    description,
    actionSteps: milestone.actionSteps.map((step, stepIndex) => validateActionStepDraft(step, index, stepIndex)),
  };
}

function validateActionStepDraft(
  step: unknown,
  milestoneIndex: number,
  stepIndex: number
): RoadmapDraft['milestones'][number]['actionSteps'][number] {
  const field = `milestones[${milestoneIndex}].actionSteps[${stepIndex}]`;
  if (!isRecord(step)) {
    throw new RoadmapValidationError(field, `${field} must be an object`);
  }

  return {
    title: validateText(`${field}.title`, step.title, TITLE_MAX_LENGTH, true),
    description: validateText(`${field}.description`, step.description, DESCRIPTION_MAX_LENGTH, false),
  };
}

// value comes straight from an untrusted draft, so its type is never assumed
// - only `undefined` (field omitted) and `string` are accepted; anything
// else (number, boolean, object, array, null) is rejected explicitly rather
// than coerced or handed to .trim().
function validateText(field: string, value: unknown, maxLength: number, required: boolean): string {
  if (value === undefined) {
    if (required) {
      throw new RoadmapValidationError(field, `${field} is required`);
    }
    return '';
  }
  if (typeof value !== 'string') {
    throw new RoadmapValidationError(field, `${field} must be a string`);
  }

  const trimmed = value.trim();
  if (required && trimmed.length === 0) {
    throw new RoadmapValidationError(field, `${field} is required`);
  }
  if (trimmed.length > maxLength) {
    throw new RoadmapValidationError(field, `${field} must be ${maxLength} characters or fewer`);
  }
  return trimmed;
}
