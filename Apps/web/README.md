# apps/web (dev preview)

A minimal React UI for sign-up/sign-in and Goal Creation Core, talking to `apps/api` over real HTTP (see `src/api/`). Nothing is called in-process anymore - the earlier direct-`GoalService`-in-the-browser approach (ADR 0003) only ever applied to Goals, and is now retired now that a real API exists (ADR 0005).

The bearer token lives only in React state (`src/auth/AuthContext.tsx`) - never `localStorage` - so reloading the page signs you out again. That's an accepted tradeoff for this milestone, not a bug.

This is still a developer-facing preview, not a designed product screen. Real onboarding/goal screens (Product Vision §15.1, §22) should go through the UI/UX and visual-design passes once Onboarding exists.

## Run

Needs `apps/api` running first (`npm run dev:api` from the repo root, defaults to `http://localhost:4000`).

```
npm install
npm run dev:web
```

Override the API's URL with `VITE_API_BASE_URL` if it's not running on the default port.
