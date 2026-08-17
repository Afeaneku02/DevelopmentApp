import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { GOAL_CATEGORIES, MAX_ACTIVE_GOALS, type Goal, type GoalCategory } from '@better-you/contracts';
import { getSuggestedGoalsByCategory } from '@better-you/goals';
import { useAuth } from '../auth/AuthContext';
import * as goalsApi from '../api/goalsApi';
import { ApiError } from '../api/client';

const CATEGORY_LABELS: Record<GoalCategory, string> = {
  career: 'Career',
  fitness: 'Fitness',
  finances: 'Finances',
  education: 'Education',
  personal_development: 'Personal Development',
};

export default function GoalsScreen() {
  const { user, token, signOut } = useAuth();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [category, setCategory] = useState<GoalCategory | null>(null);
  const [customTitle, setCustomTitle] = useState('');
  const [customDescription, setCustomDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function refreshGoals(currentToken: string) {
    const res = await goalsApi.listGoals(currentToken);
    setGoals(res.goals);
  }

  useEffect(() => {
    if (token) {
      refreshGoals(token);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const atLimit = goals.length >= MAX_ACTIVE_GOALS;

  async function createSuggested(suggestedGoalId: string) {
    if (!category || !token) return;
    setError(null);
    setLoading(true);
    try {
      await goalsApi.createGoal(token, { source: 'suggested', category, suggestedGoalId });
      await refreshGoals(token);
      setCategory(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  async function createCustom(event: FormEvent) {
    event.preventDefault();
    if (!category || !token) return;
    setError(null);
    setLoading(true);
    try {
      await goalsApi.createGoal(token, {
        source: 'custom',
        category,
        title: customTitle,
        description: customDescription || undefined,
      });
      setCustomTitle('');
      setCustomDescription('');
      await refreshGoals(token);
      setCategory(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <header>
        <div className="header-row">
          <div>
            <h1>Better You — Goals</h1>
            <p className="subtitle">
              Signed in as <code>{user?.email}</code>. Goal Creation Core only — no roadmap or AI yet.
            </p>
          </div>
          <button className="signout-button" onClick={() => signOut()}>
            Sign out
          </button>
        </div>
      </header>

      <section className="goals">
        <h2>
          Your goals ({goals.length}/{MAX_ACTIVE_GOALS})
        </h2>
        {goals.length === 0 ? (
          <p className="empty">No goals yet. Pick a category below to add one.</p>
        ) : (
          <ul>
            {goals.map((goal) => (
              <li key={goal.id}>
                <span className="badge">{CATEGORY_LABELS[goal.category]}</span>
                <strong>{goal.title}</strong>
                {goal.description && <p>{goal.description}</p>}
                <span className="source">{goal.source === 'suggested' ? 'Suggested' : 'Custom'}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="create">
        <h2>Add a goal</h2>
        {atLimit ? (
          <p className="limit">
            You've reached the {MAX_ACTIVE_GOALS}-active-goal limit (Product Vision §22.1). Completing or removing
            a goal isn't built yet, so this is as far as this preview goes.
          </p>
        ) : (
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
                <ul className="suggested">
                  {getSuggestedGoalsByCategory(category).map((suggestion) => (
                    <li key={suggestion.id}>
                      <button disabled={loading} onClick={() => createSuggested(suggestion.id)}>
                        <strong>{suggestion.title}</strong>
                        <span>{suggestion.description}</span>
                      </button>
                    </li>
                  ))}
                </ul>

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
                  <button type="submit" disabled={loading}>
                    Save custom goal
                  </button>
                </form>
              </div>
            )}
          </>
        )}
        {error && <p className="error">{error}</p>}
      </section>
    </div>
  );
}
