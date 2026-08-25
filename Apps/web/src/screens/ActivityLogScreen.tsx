import { useEffect, useState } from 'react';
import type { ActivityEvent } from '@better-you/contracts';
import { useAuth } from '../auth/AuthContext';
import * as activityApi from '../api/activityApi';
import { ApiError } from '../api/client';

interface ActivityLogScreenProps {
  onBack: () => void;
}

// Internal/dev-only debug view (ADR 0021 continued) - not part of the
// mentor experience. Its only purpose is letting a developer eyeball
// whether the activity ledger is populating correctly while testing the
// app; the real intended reader remains the external AI project via
// GET /api/v1/activity directly. Deliberately unstyled beyond the app's
// existing base classes - no design pass, since this isn't a user-facing
// feature (CLAUDE.md §3: don't build more than the requirement needs).
export default function ActivityLogScreen({ onBack }: ActivityLogScreenProps) {
  const { token } = useAuth();
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    activityApi
      .listEvents(token)
      .then(({ events: loaded }) => setEvents(loaded))
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : 'Could not load the activity log');
      })
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="page">
      <header>
        <div className="header-row">
          <div>
            <h1>Activity Log (dev)</h1>
            <p className="subtitle">
              Internal debug view of the structured product-event ledger - not part of the app experience.
            </p>
          </div>
          <div className="header-actions">
            <button className="profile-nav-button" onClick={onBack}>
              Back
            </button>
          </div>
        </div>
      </header>

      {error && <p className="error">{error}</p>}

      {loading ? (
        <p className="loading">Loading…</p>
      ) : events.length === 0 ? (
        <p className="empty">No activity recorded yet.</p>
      ) : (
        <table className="activity-log-table">
          <thead>
            <tr>
              <th>Occurred at</th>
              <th>Type</th>
              <th>Data</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr key={event.id}>
                <td>{new Date(event.occurredAt).toLocaleString()}</td>
                <td>{event.type}</td>
                <td>
                  <code>{JSON.stringify(event.data)}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
