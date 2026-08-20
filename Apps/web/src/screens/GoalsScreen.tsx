import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { GOAL_CATEGORIES, MAX_ACTIVE_GOALS, type Goal, type GoalCategory, type GoalStatus } from '@better-you/contracts';
import { useAuth } from '../auth/AuthContext';
import * as goalsApi from '../api/goalsApi';
import { ApiError } from '../api/client';
import { CATEGORY_LABELS } from '../constants/goalCategories';
import AddGoalForm from '../components/AddGoalForm';

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
  onOpenDashboard: () => void;
  onOpenProfile: () => void;
}

export default function GoalsScreen({ onOpenDashboard, onOpenProfile }: GoalsScreenProps) {
  const { user, token, signOut } = useAuth();
  const [goals, setGoals] = useState<Goal[]>([]);

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

  async function handleGoalCreated() {
    if (token) await refreshGoals(token);
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
            <button className="profile-nav-button" onClick={onOpenDashboard}>
              Home
            </button>
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
        <AddGoalForm atLimit={atLimit} onCreated={handleGoalCreated} />
      </section>
    </div>
  );
}
