# services/progress

Blueprint §10 names Progress as one of Dashboard's formal dependencies. This is a **Goals + Check-ins-only Progress domain**: deterministic consistency scores and trend labels computed purely from `CheckIn` data (via the `CheckInsView` interface, satisfied by the real `CheckInService`), for both a single goal and the user overall.

Deliberately not built: any calendar/cadence-based streak tracking (no defined check-in frequency exists yet to measure against), and any AI-generated interpretation of the numbers - `computeTrend()`'s own comments document the exact (placeholder) heuristic and thresholds used instead.
