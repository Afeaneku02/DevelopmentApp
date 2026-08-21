# ADR 0003: `apps/web` as an npm workspace; shared domain code kept isomorphic

**Status:** Accepted

## Context

ADR 0002 deliberately avoided npm workspaces and per-package `package.json` files, resolving `@better-you/contracts`, `@better-you/config`, and `@better-you/goals` via TypeScript/Vitest path aliases instead, since none of those packages had independent runtime dependencies yet. Building a minimal dev-preview UI (`apps/web`, a Vite + React app) for Goal Creation Core introduced the first package with real, independent runtime dependencies (React, Vite) that don't belong in the root's dependency list.

Making `apps/web` call `GoalService` directly (no API layer exists yet, per ADR 0002) also meant `services/goals` and its dependency `packages/config` needed to run unchanged in a browser, not just Node. Two Node-only assumptions blocked this: `packages/config/src/env.ts` read `process.env` directly, and `services/goals/src/goalService.ts` imported `randomUUID` from `node:crypto`.

## Decision

- Add `"workspaces": ["apps/*"]` to the root `package.json`. `apps/web` gets its own `package.json` with its own dependencies, installed via a single root `npm install`. `packages/*` and `services/*` are unaffected and still use path aliases, since they still have no independent dependencies of their own — workspaces are adopted only where there's a concrete reason (an app with its own runtime deps), not by default.
- Keep shared domain code (`packages/config`, `services/goals`) isomorphic: `getEnv()` guards `process.env` access behind `typeof process !== 'undefined'`, and `GoalService` uses the global `crypto.randomUUID()` instead of `node:crypto`'s export. Both are available in Node 18.14+/20+ and in browsers.

## Consequences

- `apps/web` imports `@better-you/contracts`, `@better-you/config`, and `@better-you/goals` via Vite `resolve.alias` pointing directly at their `src/index.ts` files — the same alias pattern already used in `vitest.config.ts` — rather than through npm's workspace symlinking, keeping module resolution consistent across the test runner and the app bundler.
- Future domain code should default to avoiding Node-only globals unless there's a specific reason a piece of logic must be server-only (e.g. secrets, privileged database access) — the Goals domain now sets the precedent that domain services are usable from both a future backend and a client directly.
- When a database-backed `GoalRepository` replaces `InMemoryGoalRepository` (still open, per ADR 0001), `apps/web` will need to move from calling `GoalService` in-process to calling it through an API layer, since a browser cannot hold real database credentials — this UI's direct-call wiring is explicitly temporary, not a pattern to keep once persistence is real.
