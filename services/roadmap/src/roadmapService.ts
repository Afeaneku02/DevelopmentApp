import type { ActionStep, Milestone, Roadmap } from '@better-you/contracts';
import {
  RoadmapAlreadyExistsError,
  RoadmapMilestoneNotActiveError,
  RoadmapNotFoundError,
  RoadmapStepNotFoundError,
  RoadmapValidationError,
} from './errors';
import { validateRoadmapDraft } from './roadmapValidation';
import { buildRoadmapGenerationInput } from './roadmapGenerationInput';
import type { RoadmapRepository } from './roadmapRepository';
import type { RoadmapGenerator } from './roadmapGenerator';
import type { GoalLookup } from './goalLookup';

export class RoadmapService {
  // Serialize writes for a goal in this local, single-process service so
  // accepting a suggestion cannot overwrite a concurrent completion.
  private readonly writes = new Map<string, Promise<unknown>>();

  private async writeForGoal<T>(goalId: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.writes.get(goalId) ?? Promise.resolve();
    const current = previous.catch(() => undefined).then(operation);
    this.writes.set(goalId, current);
    try { return await current; }
    finally { if (this.writes.get(goalId) === current) this.writes.delete(goalId); }
  }
  constructor(
    private readonly repository: RoadmapRepository,
    private readonly goalLookup: GoalLookup,
    private readonly generator: RoadmapGenerator,
    private readonly now: () => Date = () => new Date()
  ) {}

  // One roadmap per goal at MVP scope - no regeneration/versioning yet.
  // Ownership is enforced by goalLookup.getGoal() before the generator ever
  // runs, so a roadmap can never be created against a goal that isn't the
  // caller's.
  async generateRoadmap(userId: string, goalId: string): Promise<Roadmap> {
    return this.writeForGoal(goalId, () => this.generateRoadmapUnlocked(userId, goalId));
  }

  private async generateRoadmapUnlocked(userId: string, goalId: string): Promise<Roadmap> {
    const goal = await this.goalLookup.getGoal(userId, goalId);

    const existing = await this.repository.findByGoalId(goalId);
    if (existing) {
      throw new RoadmapAlreadyExistsError();
    }

    // The generator's output is untrusted, exactly like an HTTP request body
    // - validated here before any of it is turned into persisted state, even
    // though today's generator is our own deterministic code. This is the
    // one place that rule is enforced, so a future real-AI RoadmapGenerator
    // gets the same treatment automatically. Symmetrically, the generator
    // never receives the full Goal - only the sanitized allowlist
    // buildRoadmapGenerationInput() produces (see ADR 0023).
    const draft = validateRoadmapDraft(await this.generator.generateRoadmap(buildRoadmapGenerationInput(goal)));

    const timestamp = this.now().toISOString();
    const milestones: Milestone[] = draft.milestones.map((milestone, index) => ({
      id: crypto.randomUUID(),
      title: milestone.title,
      description: milestone.description ?? '',
      status: index === 0 ? 'active' : 'pending',
      actionSteps: milestone.actionSteps.map((step): ActionStep => ({
        id: crypto.randomUUID(),
        title: step.title,
        description: step.description ?? '',
        status: 'pending',
      })),
    }));

    const roadmap: Roadmap = {
      id: crypto.randomUUID(),
      userId,
      goalId,
      status: 'active',
      milestones,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    return this.repository.create(roadmap);
  }

  // Owner-only, same generic-404 reasoning as GoalService.getGoal().
  async getRoadmap(userId: string, roadmapId: string): Promise<Roadmap> {
    const roadmap = await this.repository.findById(roadmapId);
    if (!roadmap || roadmap.userId !== userId) {
      throw new RoadmapNotFoundError();
    }
    return roadmap;
  }

  // Ownership of the goal itself is checked via goalLookup, independent of
  // whether a roadmap exists yet - so this can't be used to probe whether a
  // goalId is real when it belongs to someone else.
  async getRoadmapForGoal(userId: string, goalId: string): Promise<Roadmap | null> {
    await this.goalLookup.getGoal(userId, goalId);
    return this.repository.findByGoalId(goalId);
  }

  async listRoadmaps(userId: string): Promise<Roadmap[]> {
    return this.repository.listByUser(userId);
  }

  // Deterministic cascade, not a separate "complete milestone"/"complete
  // roadmap" action: completing a milestone's last pending action step
  // completes that milestone and activates the next one; completing the
  // last milestone completes the roadmap. Mirrors how Goals' lifecycle
  // exposes only the transitions that are actually meaningful, rather than a
  // generic status-setter.
  //
  // Only steps in the roadmap's current active milestone can be completed -
  // a step id is a real, addressable value, so without this check a caller
  // could complete a step in a future (pending) milestone before the ones
  // ahead of it, leaving the roadmap in a state the UI never shows and the
  // cascade logic below doesn't anticipate.
  async completeActionStep(userId: string, roadmapId: string, actionStepId: string): Promise<Roadmap> {
    const roadmap = await this.getRoadmap(userId, roadmapId);
    return this.writeForGoal(roadmap.goalId, () => this.completeActionStepUnlocked(userId, roadmapId, actionStepId));
  }

  private async completeActionStepUnlocked(userId: string, roadmapId: string, actionStepId: string): Promise<Roadmap> {
    const roadmap = await this.getRoadmap(userId, roadmapId);

    const milestoneIndex = roadmap.milestones.findIndex((milestone) =>
      milestone.actionSteps.some((step) => step.id === actionStepId)
    );
    if (milestoneIndex === -1) {
      throw new RoadmapStepNotFoundError();
    }
    if (roadmap.milestones[milestoneIndex].status !== 'active') {
      throw new RoadmapMilestoneNotActiveError();
    }

    const milestones = roadmap.milestones.map((milestone) => ({
      ...milestone,
      actionSteps: milestone.actionSteps.map((step) =>
        step.id === actionStepId ? { ...step, status: 'completed' as const } : step
      ),
    }));

    const completedMilestone = milestones[milestoneIndex];
    const allStepsDone = completedMilestone.actionSteps.every((step) => step.status === 'completed');
    if (allStepsDone) {
      completedMilestone.status = 'completed';
      const nextMilestone = milestones[milestoneIndex + 1];
      if (nextMilestone && nextMilestone.status === 'pending') {
        nextMilestone.status = 'active';
      }
    }

    const allMilestonesDone = milestones.every((milestone) => milestone.status === 'completed');

    const updated: Roadmap = {
      ...roadmap,
      milestones,
      status: allMilestonesDone ? 'completed' : roadmap.status,
      updatedAt: this.now().toISOString(),
    };

    return this.repository.update(updated);
  }

  // Explicit user acceptance, never an automatic consequence of AI output.
  async addMentorAction(userId: string, goalId: string, rawAction: unknown): Promise<Roadmap> {
    return this.writeForGoal(goalId, async () => {
      const goal = await this.goalLookup.getGoal(userId, goalId);
      if (goal.status !== 'active') throw new RoadmapValidationError('goalId', 'Only active goals can receive new steps');
      if (typeof rawAction !== 'string' || !rawAction.trim() || [...rawAction.trim()].length > 500) {
        throw new RoadmapValidationError('action', 'Action must contain between 1 and 500 characters');
      }
      const action = rawAction.trim();
      const existing = await this.repository.findByGoalId(goalId);
      if (existing && (existing.userId !== userId || existing.status === 'archived')) {
        throw new RoadmapValidationError('goalId', 'This plan cannot receive new steps');
      }
      // Content-based deduplication survives retries, reloads, and restarts.
      if (existing?.milestones.some((m) => m.actionSteps.some((s) => s.description === action || s.title === action))) {
        return existing;
      }
      const step: ActionStep = {
        id: crypto.randomUUID(),
        title: action.length <= 200 ? action : 'Mentor suggestion',
        description: action.length <= 200 ? '' : action,
        status: 'pending',
      };
      const timestamp = this.now().toISOString();
      const milestones = existing ? existing.milestones.map((m) => ({ ...m, actionSteps: [...m.actionSteps] })) : [];
      const active = milestones.find((m) => m.status === 'active');
      if (active && active.actionSteps.length < 10) {
        active.actionSteps.push(step);
      } else {
        milestones.push({
          id: crypto.randomUUID(), title: 'Mentor suggestions', description: '',
          status: active ? 'pending' : 'active', actionSteps: [step],
        });
      }
      validateRoadmapDraft({ milestones });
      const roadmap: Roadmap = {
        id: existing?.id ?? crypto.randomUUID(), userId, goalId,
        status: 'active', milestones, createdAt: existing?.createdAt ?? timestamp, updatedAt: timestamp,
      };
      return existing ? this.repository.update(roadmap) : this.repository.create(roadmap);
    });
  }
}
