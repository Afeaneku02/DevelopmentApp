// Thrown when a generator's output (untrusted, even the deterministic
// placeholder) fails validateRoadmapDraft() - the field path pinpoints where
// in the draft the shape was wrong (e.g. "milestones[0].actionSteps").
export class RoadmapValidationError extends Error {
  constructor(
    public readonly field: string,
    message: string
  ) {
    super(message);
    this.name = 'RoadmapValidationError';
  }
}

// Thrown both when a roadmap truly doesn't exist and when it exists but
// belongs to a different user - same generic response either way, so a
// caller can't use it to enumerate other users' roadmap ids (same reasoning
// as Goals' GoalNotFoundError).
export class RoadmapNotFoundError extends Error {
  constructor() {
    super('Roadmap not found');
    this.name = 'RoadmapNotFoundError';
  }
}

export class RoadmapAlreadyExistsError extends Error {
  constructor() {
    super('A roadmap already exists for this goal');
    this.name = 'RoadmapAlreadyExistsError';
  }
}

export class RoadmapStepNotFoundError extends Error {
  constructor() {
    super('Action step not found on this roadmap');
    this.name = 'RoadmapStepNotFoundError';
  }
}

// Thrown when a step exists but belongs to a milestone that isn't the
// roadmap's current active one - a future (pending) milestone the user
// hasn't reached yet, or a past (completed) one whose steps are already
// done. Keeps completion strictly in milestone order even though a caller
// could otherwise address any step directly by id.
export class RoadmapMilestoneNotActiveError extends Error {
  constructor() {
    super("This action step is not part of the roadmap's current active milestone");
    this.name = 'RoadmapMilestoneNotActiveError';
  }
}

// Thrown by any network-based RoadmapGenerator (HttpRoadmapGenerator today -
// see ADR 0024) when it cannot produce a draft at all: a network error, a
// request timeout, a non-2xx response, or a response body that isn't valid
// JSON. Distinct from RoadmapValidationError, which is for a response that
// DID come back but whose roadmap shape was wrong - this is for not getting
// a usable response in the first place. RoadmapService never catches
// generator errors, so this propagates straight to the caller and nothing
// is ever persisted: the repository is never touched before this point.
export class RoadmapGeneratorUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RoadmapGeneratorUnavailableError';
  }
}
