import type { GoalCategory } from '@better-you/contracts';

export interface SuggestedGoal {
  id: string;
  category: GoalCategory;
  title: string;
  description: string;
}

// Product Vision §6.1, §22.2: generic starting goals per category for users who don't
// know what to enter yet. Content, not business logic - expect this to move to a
// managed content source later.
export const SUGGESTED_GOALS: readonly SuggestedGoal[] = [
  {
    id: 'career-advance',
    category: 'career',
    title: 'Advance in my current career',
    description: 'Grow your skills, responsibility, or standing in your current job or field.',
  },
  {
    id: 'career-new-path',
    category: 'career',
    title: 'Find a new job or career path',
    description: 'Explore and move toward a role or field that fits you better.',
  },
  {
    id: 'fitness-shape',
    category: 'fitness',
    title: 'Get in better shape',
    description: 'Build strength, endurance, or overall physical health.',
  },
  {
    id: 'fitness-routine',
    category: 'fitness',
    title: 'Build a consistent exercise routine',
    description: 'Establish a sustainable habit of regular physical activity.',
  },
  {
    id: 'finances-income',
    category: 'finances',
    title: 'Earn additional income',
    description: 'Grow your earnings through a raise, side income, or new opportunity.',
  },
  {
    id: 'finances-savings',
    category: 'finances',
    title: 'Build savings and reduce debt',
    description: 'Strengthen your financial foundation and reduce financial stress.',
  },
  {
    id: 'education-skill',
    category: 'education',
    title: 'Develop a new skill',
    description: 'Learn something new that supports your goals or interests.',
  },
  {
    id: 'education-certification',
    category: 'education',
    title: 'Complete a course or certification',
    description: 'Finish a structured learning program toward a credential.',
  },
  {
    id: 'personal-habits',
    category: 'personal_development',
    title: 'Build better daily habits',
    description: 'Create small, consistent routines that improve your day-to-day life.',
  },
  {
    id: 'personal-confidence',
    category: 'personal_development',
    title: 'Improve confidence and discipline',
    description: 'Strengthen your consistency and belief in your ability to follow through.',
  },
];

export function getSuggestedGoalsByCategory(category: GoalCategory): SuggestedGoal[] {
  return SUGGESTED_GOALS.filter((goal) => goal.category === category);
}

export function findSuggestedGoal(id: string): SuggestedGoal | undefined {
  return SUGGESTED_GOALS.find((goal) => goal.id === id);
}
