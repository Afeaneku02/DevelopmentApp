import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { GOAL_CATEGORIES, MAX_ACTIVE_GOALS, type Goal, type GoalCategory, type GoalStatus } from '@better-you/contracts';
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

const STATUS_LABELS: Record<GoalStatus, string> = {
  active: 'Active',
  paused: 'Paused',
  completed: 'Completed',
  archived: 'Archived',
};

// Display-only ordering (Blueprint §7's "only active goals appear in active
// dashboard" is a future Dashboard-domain concern; this just keeps the most
// relevant goals near the top of this one list).
const STATUS_ORDER: Record<GoalStatus, number> = { active: 0, paused: 1, completed: 2, archived: 3 };

type Action = 'pause' | 'resume' | 'complete' | 'archive';

const ACTIONS_BY_STATUS: Record<GoalStatus, { action: Action; label: string }[]> = {
  active: [
    { action: 'pause', label: 'Pause' },
    { action: 'complete', label: 'Complete' },
    { action: 'archive', label: 'Archive' },
  ],
  paused: [
    { action: 'resume', label: 'Resume' },
    { action: 'complete', label: 'Complete' },
    { action: 'archive', label: 'Archive' },
  ],
  completed: [{ action: 'archive', label: 'Archive' }],
  archived: [],
};

const ACTION_FN: Record<Action, typeof goalsApi.pauseGoal> = {
  pause: goalsApi.pauseGoal,
  resume: goalsApi.resumeGoal,
  complete: goalsApi.completeGoal,
  archive: goalsApi.archiveGoal,
};

interface GoalsScreenProps {
  onOpenProfile: () => void;
}

export default function GoalsScreen({ onOpenProfile }: GoalsScreenProps) {
  const { user, token, signOut } = useAuth();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [category, setCategory] = useState<GoalCategory | null>(null);
  const [customTitle, setCustomTitle] = useState('');
  const [customDescription, setCustomDescription] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [actionError, setActionError] = useState<string | null>(null);
  const [actionGoalId, setActionGoalId] = useState<string | null>(null);

  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCategory, setEditCategory] = useState<GoalCategory>('career');

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

  const activeCount = goals.filter((goal) => goal.status === 'active').length;
  const atLimit = activeCount >= MAX_ACTIVE_GOALS;
  const sortedGoals = [...goals].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);

  async function createSuggested(suggestedGoalId: string) {
    if (!category || !token) return;
    setCreateError(null);
    setCreating(true);
    try {
      await goalsApi.createGoal(token, { source: 'suggested', category, suggestedGoalId });
      await refreshGoals(token);
      setCategory(null);
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setCreating(false);
    }
  }

  async function createCustom(event: FormEvent) {
    event.preventDefault();
    if (!category || !token) return;
    setCreateError(null);
    setCreating(true);
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
      setCreateError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setCreating(false);
    }
  }

  async function runAction(goalId: string, action: Action) {
    if (!token) return;
    setActionError(null);
    setActionGoalId(goalId);
    try {
      await ACTION_FN[action](token, goalId);
      await refreshGoals(token);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setActionGoalId(null);
    }
  }

  function startEdit(goal: Goal) {
    setEditingGoalId(goal.id);
    setEditTitle(goal.title);
    setEditDescription(goal.description);
    setEditCategory(goal.category);
    setActionError(null);
  }

  async function saveEdit(event: FormEvent, goalId: string) {
    event.preventDefault();
    if (!token) return;
    setActionError(null);
    setActionGoalId(goalId);
    try {
      await goalsApi.updateGoal(token, goalId, {
        title: editTitle,
        description: editDescription || undefined,
        category: editCategory,
      });
      await refreshGoals(token);
      setEditingGoalId(null);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setActionGoalId(null);
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
          <div className="header-actions">
            <button className="profile-nav-button" onClick={onOpenProfile}>
              Profile
            </button>
            <button className="signout-button" onClick={() => signOut()}>
              Sign out
            </button>
          </div>
        </div>
      </header>

      <section className="goals">
        <h2>
          Active goals ({activeCount}/{MAX_ACTIVE_GOALS})
        </h2>
        {goals.length === 0 ? (
          <p className="empty">No goals yet. Pick a category below to add one.</p>
        ) : (
          <ul>
            {sortedGoals.map((goal) => {
              const isBusy = actionGoalId === goal.id;
              const isEditing = editingGoalId === goal.id;

              return (
                <li key={goal.id} className={goal.status === 'archived' ? 'is-archived' : ''}>
                  {isEditing ? (
                    <form onSubmit={(event) => saveEdit(event, goal.id)} className="goal-edit-form">
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(event) => setEditTitle(event.target.value)}
                        required
                      />
                      <textarea
                        value={editDescription}
                        onChange={(event) => setEditDescription(event.target.value)}
                        placeholder="Optional details"
                      />
                      <select
                        value={editCategory}
                        onChange={(event) => setEditCategory(event.target.value as GoalCategory)}
                      >
                        {GOAL_CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>
                            {CATEGORY_LABELS[cat]}
                          </option>
                        ))}
                      </select>
                      <div className="goal-actions">
                        <button type="submit" disabled={isBusy}>
                          Save
                        </button>
                        <button type="button" disabled={isBusy} onClick={() => setEditingGoalId(null)}>
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <span className="badge">{CATEGORY_LABELS[goal.category]}</span>
                      <span className={`status-badge status-${goal.status}`}>{STATUS_LABELS[goal.status]}</span>
                      <strong>{goal.title}</strong>
                      {goal.description && <p>{goal.description}</p>}
                      <span className="source">{goal.source === 'suggested' ? 'Suggested' : 'Custom'}</span>

                      <div className="goal-actions">
                        {goal.status !== 'archived' && (
                          <button type="button" disabled={isBusy} onClick={() => startEdit(goal)}>
                            Edit
                          </button>
                        )}
                        {ACTIONS_BY_STATUS[goal.status].map(({ action, label }) => (
                          <button
                            type="button"
                            key={action}
                            disabled={isBusy}
                            onClick={() => runAction(goal.id, action)}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {actionError && <p className="error">{actionError}</p>}
      </section>

      <section className="create">
        <h2>Add a goal</h2>
        {atLimit ? (
          <p className="limit">
            You've reached the {MAX_ACTIVE_GOALS}-active-goal limit (Product Vision §22.1). Complete, archive, or
            pause a goal to make room for another.
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
          </>
        )}
        {createError && <p className="error">{createError}</p>}
      </section>
    </div>
  );
}
