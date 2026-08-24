import { describe, expect, it } from 'vitest';
import type { RoadmapDraft } from '@better-you/contracts';
import { validateRoadmapDraft } from '../roadmapValidation';
import { RoadmapValidationError } from '../errors';

function validDraft(): RoadmapDraft {
  return {
    milestones: [
      {
        title: 'Milestone one',
        description: 'First phase',
        actionSteps: [{ title: 'Step one' }, { title: 'Step two', description: 'Details' }],
      },
    ],
  };
}

describe('validateRoadmapDraft', () => {
  it('accepts and normalizes a well-formed draft', () => {
    const result = validateRoadmapDraft(validDraft());
    expect(result.milestones).toHaveLength(1);
    expect(result.milestones[0].actionSteps).toHaveLength(2);
    expect(result.milestones[0].actionSteps[0].description).toBe('');
  });

  it('rejects a missing milestones array', () => {
    expect(() => validateRoadmapDraft({} as RoadmapDraft)).toThrow(RoadmapValidationError);
    expect(() => validateRoadmapDraft({ milestones: null } as unknown as RoadmapDraft)).toThrow(
      RoadmapValidationError
    );
  });

  it('rejects an empty milestones array', () => {
    expect(() => validateRoadmapDraft({ milestones: [] })).toThrow(RoadmapValidationError);
  });

  it('rejects a milestone with a blank title', () => {
    const draft = validDraft();
    draft.milestones[0].title = '   ';
    expect(() => validateRoadmapDraft(draft)).toThrow(RoadmapValidationError);
  });

  it('rejects a milestone with no action steps', () => {
    const draft = validDraft();
    draft.milestones[0].actionSteps = [];
    expect(() => validateRoadmapDraft(draft)).toThrow(RoadmapValidationError);
  });

  it('rejects an action step with a blank title', () => {
    const draft = validDraft();
    draft.milestones[0].actionSteps[0].title = '';
    expect(() => validateRoadmapDraft(draft)).toThrow(RoadmapValidationError);
  });

  it('rejects a title over the max length', () => {
    const draft = validDraft();
    draft.milestones[0].title = 'x'.repeat(201);
    expect(() => validateRoadmapDraft(draft)).toThrow(RoadmapValidationError);
  });

  it('rejects a non-object draft instead of throwing a raw TypeError', () => {
    expect(() => validateRoadmapDraft(null)).toThrow(RoadmapValidationError);
    expect(() => validateRoadmapDraft('not a draft')).toThrow(RoadmapValidationError);
    expect(() => validateRoadmapDraft(42)).toThrow(RoadmapValidationError);
  });

  it('rejects a non-object milestone instead of throwing a raw TypeError', () => {
    const draft = { milestones: ['not an object'] } as unknown as RoadmapDraft;
    expect(() => validateRoadmapDraft(draft)).toThrow(RoadmapValidationError);
  });

  it('rejects a non-object action step instead of throwing a raw TypeError', () => {
    const draft = validDraft();
    (draft.milestones[0].actionSteps as unknown[])[0] = 5;
    expect(() => validateRoadmapDraft(draft)).toThrow(RoadmapValidationError);
  });

  // The exact scenario a real (untrusted) AI generator could produce: a
  // numeric title. Before this hardening, (value ?? '').trim() threw a raw
  // TypeError here instead of a clean RoadmapValidationError.
  it('rejects a numeric title instead of crashing on .trim()', () => {
    const draft = validDraft();
    (draft.milestones[0] as unknown as { title: number }).title = 123;
    expect(() => validateRoadmapDraft(draft)).toThrow(RoadmapValidationError);
  });

  it('rejects a numeric action step title instead of crashing on .trim()', () => {
    const draft = validDraft();
    (draft.milestones[0].actionSteps[0] as unknown as { title: number }).title = 123;
    expect(() => validateRoadmapDraft(draft)).toThrow(RoadmapValidationError);
  });

  it('rejects a non-string description', () => {
    const draft = validDraft();
    (draft.milestones[0] as unknown as { description: boolean }).description = true;
    expect(() => validateRoadmapDraft(draft)).toThrow(RoadmapValidationError);
  });
});
