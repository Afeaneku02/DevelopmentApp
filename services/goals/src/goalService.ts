import { MAX_ACTIVE_GOALS, type CreateGoalInput, type Goal } from '@better-you/contracts';
import { GoalLimitExceededError } from './errors';
import { validateCreateGoalInput } from './goalValidation';
import type { GoalRepository } from './goalRepository';

export class GoalService {
  constructor(private readonly repository: GoalRepository) {}

  async createGoal(input: CreateGoalInput): Promise<Goal> {
    const { title, description } = validateCreateGoalInput(input);

    const activeCount = await this.repository.countActiveByUser(input.userId);
    if (activeCount >= MAX_ACTIVE_GOALS) {
      throw new GoalLimitExceededError(`A user may have at most ${MAX_ACTIVE_GOALS} active goals at a time`);
    }

    const now = new Date().toISOString();
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
      createdAt: now,
      updatedAt: now,
    };

    return this.repository.create(goal);
  }

  async listGoals(userId: string): Promise<Goal[]> {
    return this.repository.listByUser(userId);
  }
}
