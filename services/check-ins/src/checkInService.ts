import type {
  CheckIn,
  CheckInResponse,
  CheckInSummary,
  CreateCheckInInput,
  GoalCheckInsView,
} from '@better-you/contracts';
import { CheckInGoalNotActiveError, CheckInValidationError } from './errors';
import type { CheckInRepository } from './checkInRepository';
import type { GoalLookup } from './goalLookup';
import { validateCheckInResponse, validateNote } from './checkInValidation';

function emptyCounts(): Record<CheckInResponse, number> {
  return { yes: 0, no: 0, partly: 0, skipped: 0 };
}

export function summarizeCheckIns(checkIns: CheckIn[]): CheckInSummary {
  const responseCounts = emptyCounts();
  for (const checkIn of checkIns) {
    responseCounts[checkIn.response] += 1;
  }

  return {
    totalCount: checkIns.length,
    responseCounts,
    ...(checkIns[0] ? { mostRecentCheckIn: checkIns[0] } : {}),
  };
}

export class CheckInService {
  constructor(
    private readonly repository: CheckInRepository,
    private readonly goalLookup: GoalLookup,
    private readonly now: () => Date = () => new Date()
  ) {}

  async createCheckIn(input: CreateCheckInInput): Promise<CheckIn> {
    if (!input.userId || input.userId.trim().length === 0) {
      throw new CheckInValidationError('userId', 'userId is required');
    }
    if (!input.goalId || input.goalId.trim().length === 0) {
      throw new CheckInValidationError('goalId', 'goalId is required');
    }

    const goal = await this.goalLookup.getGoal(input.userId, input.goalId);
    if (goal.status !== 'active') {
      throw new CheckInGoalNotActiveError();
    }

    const checkIn: CheckIn = {
      id: crypto.randomUUID(),
      userId: input.userId,
      goalId: input.goalId,
      response: validateCheckInResponse(input.response),
      note: validateNote(input.note),
      createdAt: this.now().toISOString(),
    };

    return this.repository.create(checkIn);
  }

  async listCheckIns(userId: string): Promise<CheckIn[]> {
    return this.repository.listByUser(userId);
  }

  async getGoalCheckIns(userId: string, goalId: string): Promise<GoalCheckInsView> {
    const goal = await this.goalLookup.getGoal(userId, goalId);
    const checkIns = (await this.repository.listByGoalId(goalId)).filter((checkIn) => checkIn.userId === userId);
    return { goal, checkIns, summary: summarizeCheckIns(checkIns) };
  }
}
