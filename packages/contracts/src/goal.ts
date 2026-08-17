// Product Vision §6.1, §12: three to five broad growth categories at MVP.
export type GoalCategory =
  | 'career'
  | 'fitness'
  | 'finances'
  | 'education'
  | 'personal_development';

export const GOAL_CATEGORIES: readonly GoalCategory[] = [
  'career',
  'fitness',
  'finances',
  'education',
  'personal_development',
];

export type GoalSource = 'suggested' | 'custom';

// Blueprint §7 full lifecycle: active -> paused/completed/archived,
// paused -> active/completed/archived, completed -> archived, archived is terminal.
// See services/goals/src/goalStateMachine.ts for the enforced transition table.
export type GoalStatus = 'active' | 'paused' | 'completed' | 'archived';

export interface Goal {
  id: string;
  userId: string;
  title: string;
  description: string;
  category: GoalCategory;
  source: GoalSource;
  suggestedGoalId?: string;
  status: GoalStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSuggestedGoalInput {
  userId: string;
  source: 'suggested';
  category: GoalCategory;
  suggestedGoalId: string;
  /** Optional personalization of the suggested goal's default text (Vision §22.2). */
  title?: string;
  description?: string;
}

export interface CreateCustomGoalInput {
  userId: string;
  source: 'custom';
  category: GoalCategory;
  title: string;
  description?: string;
}

export type CreateGoalInput = CreateSuggestedGoalInput | CreateCustomGoalInput;

// Blueprint §7: "Edit goal" - status changes go through the dedicated
// pause/resume/complete/archive actions instead, not a generic status field here.
export interface UpdateGoalInput {
  title?: string;
  description?: string;
  category?: GoalCategory;
}

// Product Vision §22.1: minimum 1, maximum 3 active starting goals.
export const MAX_ACTIVE_GOALS = 3;

// Blueprint §7 core data: goal_history(id, goal_id, event_type, snapshot_json, created_at).
export type GoalEventType = 'created' | 'updated' | 'paused' | 'resumed' | 'completed' | 'archived';

export interface GoalHistoryEvent {
  id: string;
  goalId: string;
  eventType: GoalEventType;
  snapshot: Goal;
  createdAt: string;
}
