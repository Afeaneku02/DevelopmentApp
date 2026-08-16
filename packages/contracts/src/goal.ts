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

// Only 'active' exists at creation time; the full lifecycle (pause/resume/complete/archive)
// from Blueprint §7 is out of scope for the Goal Creation Core milestone.
export type GoalStatus = 'active';

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

// Product Vision §22.1: minimum 1, maximum 3 active starting goals.
export const MAX_ACTIVE_GOALS = 3;
