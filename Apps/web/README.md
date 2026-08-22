# apps/web

The React UI for Better You: sign-up/sign-in, First-Run Onboarding, Dashboard, Goals (full lifecycle + check-in history), Profile, and quick check-ins - all talking to `apps/api` over real HTTP (see `src/api/`). Nothing is called in-process - the earlier direct-`GoalService`-in-the-browser approach (ADR 0003) only ever applied to Goals, and was retired once a real API existed (ADR 0005).

The bearer token lives only in React state (`src/auth/AuthContext.tsx`) - never `localStorage` - so reloading the page signs you out again (your account and data are unaffected; sign back in). That's a deliberate tradeoff, not a bug.

Auth/Goals/Profile/Dashboard/Onboarding all have real, designed screens (Sky/Midnight design tokens - see ADR 0007/0008/0014); this is not a bare dev-preview anymore.

## Run

Needs `apps/api` running first (`npm run dev:api` from the repo root, defaults to `http://localhost:4000`). See the repo-root `RUNNING.md` for the full local setup, environment, and verification guide. Quick version:

```
npm install
cp .env.example .env   # from apps/web
npm run dev:web        # from the repo root
```

Vite loads `apps/web/.env` automatically; override `VITE_API_BASE_URL` in it if `apps/api` isn't running on the default port.
