import { useState } from 'react';
import type { FormEvent } from 'react';
import { GOAL_CATEGORIES, MAX_ACTIVE_GOALS, type Goal, type GoalCategory } from '@better-you/contracts';
import { getSuggestedGoalsByCategory } from '@better-you/goals';
import { useAuth } from '../auth/AuthContext';
import * as goalsApi from '../api/goalsApi';
import { ApiError } from '../api/client';
import { CATEGORY_LABELS } from '../constants/goalCategories';

// Shared between GoalsScreen's "Add a goal" section and the Onboarding
// first-goal step, so the two never drift into two slightly different goal
// creation experiences (CLAUDE.md §5: avoid duplicate logic).
interface AddGoalFormProps {
  atLimit: boolean;
  onCreated: (goal: Goal) => void;
}

export default function AddGoalForm({ atLimit, onCreated }: AddGoalFormProps) {
  const { token } = useAuth();
  const [category, setCategory] = useState<GoalCategory | null>(null);
  const [customTitle, setCustomTitle] = useState('');
  const [customDescription, setCustomDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  async function createSuggested(suggestedGoalId: string) {
    if (!category || !token) return;
    setError(null);
    setCreating(true);
    try {
      const { goal } = await goalsApi.createGoal(token, { source: 'suggested', category, suggestedGoalId });
      setCategory(null);
      onCreated(goal);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setCreating(false);
    }
  }

  async function createCustom(event: FormEvent) {
    event.preventDefault();
    if (!category || !token) return;
    setError(null);
    setCreating(true);
    try {
      const { goal } = await goalsApi.createGoal(token, {
        source: 'custom',
        category,
        title: customTitle,
        description: customDescription || undefined,
      });
      setCustomTitle('');
      setCustomDescription('');
      setCategory(null);
      onCreated(goal);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setCreating(false);
    }
  }

  if (atLimit) {
    return (
      <p className="limit">
        You've reached the {MAX_ACTIVE_GOALS}-active-goal limit (Product Vision §22.1). Complete, archive, or pause
        a goal to make room for another.
      </p>
    );
  }

  return (
    <>
      <div className="categories">
        {GOAL_CATEGORIES.map((cat) => (
          <button key={cat} className={cat === category ? 'selected' : ''} onClick={() => setCategory(cat)}>
            {CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      {category && (
        <div className="category-detail">
          <h3>{CATEGORY_LABELS[category]} — suggested goals</h3>
          <div className="option-cards option-cards-spaced">
            {getSuggestedGoalsByCategory(category).map((suggestion) => (
              <button
                type="button"
                key={suggestion.id}
                className="option-card"
                disabled={creating}
                onClick={() => createSuggested(suggestion.id)}
              >
                <span className="option-card-title">{suggestion.title}</span>
                <span className="option-card-description">{suggestion.description}</span>
              </button>
            ))}
          </div>

          <h3>Or describe your own</h3>
          <form onSubmit={createCustom}>
            <input
              type="text"
              placeholder="e.g. Run a 5k by summer"
              value={customTitle}
              onChange={(event) => setCustomTitle(event.target.value)}
              required
            />
            <textarea
              placeholder="Optional details"
              value={customDescription}
              onChange={(event) => setCustomDescription(event.target.value)}
            />
            <button type="submit" disabled={creating}>
              Save custom goal
            </button>
          </form>
        </div>
      )}

      {error && <p className="error">{error}</p>}
    </>
  );
}
