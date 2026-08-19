import {
  MAX_ACTIVE_GOALS,
  type CreateGoalInput,
  type Goal,
  type GoalEventType,
  type GoalHistoryEvent,
  type GoalStatus,
  type UpdateGoalInput,
} from '@better-you/contracts';
import { GoalLimitExceededError, GoalNotFoundError, InvalidGoalTransitionError } from './errors';
import { validateCreateGoalInput, validateUpdateGoalInput } from './goalValidation';
import { canTransition } from './goalStateMachine';
import type { GoalRepository } from './goalRepository';
import type { GoalHistoryRepository } from './goalHistoryRepository';

export class GoalService {
  constructor(
    private readonly repository: GoalRepository,
    private readonly historyRepository: GoalHistoryRepository,
    private readonly now: () => Date = () => new Date()
  ) {}

  async createGoal(input: CreateGoalInput): Promise<Goal> {
    const { title, description } = validateCreateGoalInput(input);

    const activeCount = await this.repository.countActiveByUser(input.userId);
    if (activeCount >= MAX_ACTIVE_GOALS) {
      throw new GoalLimitExceededError(`A user may have at most ${MAX_ACTIVE_GOALS} active goals at a time`);
    }

    const timestamp = this.now().toISOString();
    const goal: Goal = {
      // globalThis.crypto is available in both Node (18.14+/20+) and browsers,
      // keeping this service usable unchanged from apps/web.
      id: crypto.randomUUID(),
      userId: input.userId,
      title,
      description,
      category: input.category,
      source: input.source,
      ...(input.source === 'suggested' ? { suggestedGoalId: input.suggestedGoalId } : {}),
      status: 'active',
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const saved = await this.repository.create(goal);
    await this.recordEvent(saved, 'created');
    return saved;
  }

  async listGoals(userId: string): Promise<Goal[]> {
    return this.repository.listByUser(userId);
  }

  // Owner-only (Blueprint §7 security rule): throws the same GoalNotFoundError
  // whether the goal doesn't exist or belongs to someone else, so a caller
  // can't use this to enumerate other users' goal ids.
  async getGoal(userId: string, goalId: string): Promise<Goal> {
    const goal = await this.repository.findById(goalId);
    if (!goal || goal.userId !== userId) {
      throw new GoalNotFoundError();
    }
    return goal;
  }

  async updateGoal(userId: string, goalId: string, input: UpdateGoalInput): Promise<Goal> {
    const goal = await this.getGoal(userId, goalId);
    const changes = validateUpdateGoalInput(input);

    const updated: Goal = {
      ...goal,
      ...changes,
      updatedAt: this.now().toISOString(),
    };

    const saved = await this.repository.update(updated);
    await this.recordEvent(saved, 'updated');
    return saved;
  }

  async pauseGoal(userId: string, goalId: string): Promise<Goal> {
    return this.transition(userId, goalId, 'paused', 'paused');
  }

  async resumeGoal(userId: string, goalId: string): Promise<Goal> {
    return this.transition(userId, goalId, 'active', 'resumed');
  }

  async completeGoal(userId: string, goalId: string): Promise<Goal> {
    return this.transition(userId, goalId, 'completed', 'completed');
  }

  async archiveGoal(userId: string, goalId: string): Promise<Goal> {
    return this.transition(userId, goalId, 'archived', 'archived');
  }

  async getGoalHistory(userId: string, goalId: string): Promise<GoalHistoryEvent[]> {
    await this.getGoal(userId, goalId); // ownership check
    return this.historyRepository.listByGoalId(goalId);
  }

  private async transition(
    userId: string,
    goalId: string,
    targetStatus: GoalStatus,
    eventType: GoalEventType
  ): Promise<Goal> {
    const goal = await this.getGoal(userId, goalId);
    if (!canTransition(goal.status, targetStatus)) {
      throw new InvalidGoalTransitionError(goal.status, targetStatus);
    }

    const updated: Goal = {
      ...goal,
      status: targetStatus,
      updatedAt: this.now().toISOString(),
    };

    const saved = await this.repository.update(updated);
    await this.recordEvent(saved, eventType);
    return saved;
  }

  private async recordEvent(goal: Goal, eventType: GoalEventType): Promise<void> {
    await this.historyRepository.record({
      id: crypto.randomUUID(),
      goalId: goal.id,
      eventType,
      snapshot: goal,
      createdAt: this.now().toISOString(),
    });
  }
}
