import { useEffect, useState } from 'react';
import type { DashboardView } from '@better-you/contracts';
import { useAuth } from '../auth/AuthContext';
import * as dashboardApi from '../api/dashboardApi';
import * as goalsApi from '../api/goalsApi';
import * as profileApi from '../api/profileApi';
import { ApiError } from '../api/client';
import { CATEGORY_LABELS } from '../constants/goalCategories';

interface DashboardScreenProps {
  onOpenGoals: () => void;
  onOpenProfile: () => void;
}

export default function DashboardScreen({ onOpenGoals, onOpenProfile }: DashboardScreenProps) {
  const { token, signOut } = useAuth();
  const [dashboard, setDashboard] = useState<DashboardView | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  async function refresh(currentToken: string) {
    const { dashboard: loaded } = await dashboardApi.getDashboard(currentToken);
    setDashboard(loaded);
  }

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    setLoadError(null);
    Promise.all([refresh(token), profileApi.getProfile(token).then(({ profile }) => setDisplayName(profile.displayName))])
      .catch((err) => {
        setLoadError(err instanceof ApiError ? err.message : 'Could not load your dashboard');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [token]);

  async function handleResume(goalId: string) {
    if (!token) return;
    setActionError(null);
    setActionLoading(true);
    try {
      await goalsApi.resumeGoal(token, goalId);
      await refresh(token);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setActionLoading(false);
    }
  }

  if (loadError) {
    return <p className="error">{loadError}</p>;
  }

  if (loading || !dashboard) {
    return <p className="loading">Loading…</p>;
  }

  const { activeGoals, pausedGoals, completedGoalsCount, nextAction } = dashboard;

  return (
    <div className="page">
      <header>
        <div className="header-row">
          <div>
            <h1>Welcome back{displayName ? `, ${displayName}` : ''}</h1>
            <p className="subtitle">Here&apos;s where things stand. No roadmap or AI guidance yet — just your goals.</p>
          </div>
          <div className="header-actions">
            <button className="profile-nav-button" onClick={onOpenGoals}>
              All Goals
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

      <section className="next-action">
        <p className="next-action-message">{nextAction.message}</p>
        {nextAction.type === 'resume_goal' && nextAction.goalId && (
          <button onClick={() => handleResume(nextAction.goalId as string)} disabled={actionLoading}>
            Resume goal
          </button>
        )}
        {nextAction.type === 'review_goal' && <button onClick={onOpenGoals}>View goals</button>}
        {nextAction.type === 'add_goal' && <button onClick={onOpenGoals}>Add a goal</button>}
        {actionError && <p className="error">{actionError}</p>}
      </section>

      <section className="dashboard-stats">
        <div className="stat-tile">
          <strong>{activeGoals.length}</strong>
          <span>Active</span>
        </div>
        <div className="stat-tile">
          <strong>{pausedGoals.length}</strong>
          <span>Paused</span>
        </div>
        <div className="stat-tile">
          <strong>{completedGoalsCount}</strong>
          <span>Completed</span>
        </div>
      </section>

      {activeGoals.length > 0 && (
        <section className="goals">
          <h2>Active goals</h2>
          <ul>
            {activeGoals.map((goal) => (
              <li key={goal.id}>
                <span className="badge">{CATEGORY_LABELS[goal.category]}</span>
                <strong>{goal.title}</strong>
                {goal.description && <p>{goal.description}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
