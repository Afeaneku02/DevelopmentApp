# Running Better You locally

This is a **local development** guide only. Nothing here covers a production
deployment (hosting, a real database, a managed auth/email provider, HTTPS,
etc.) - that's a separate, not-yet-started milestone (see
`docs/architecture-decisions/0017-local-release-readiness.md`). Everything
below runs on your own machine, storing data in local JSON files.

For running a shareable, non-production copy in the cloud (Vercel + Render),
see `docs/environments.md` instead.

## Prerequisites

- **Node.js 20.12+** (Node 22.x also works, and is what this project is
  developed against). Required specifically because `apps/api`'s scripts use
  Node's native `--env-file-if-exists` flag to load `.env` - no `dotenv`
  dependency. Check with `node --version`.
- npm (ships with Node).

## 1. Install

From the repo root:

```
npm install
```

This installs the root workspace and both `apps/*` workspaces (`apps/api`,
`apps/web`) in one pass.

## 2. Set up environment files

Two separate `.env` files - one per app, since `apps/api` (Node) and
`apps/web` (Vite, browser-bundled) load environment variables through
different mechanisms.

```
cp .env.example .env
cp Apps/web/.env.example Apps/web/.env
```

Both files ship with working defaults - copying them as-is is enough to run
locally. Open them if you want to change the API port, the data directory,
or run the two apps on non-default ports. See the comments in each file for
what every variable does.

Both `.env` files are gitignored - they're local machine config, never
committed.

## 3. Run the API

```
npm run dev:api
```

Starts `apps/api` on `http://localhost:4000` (override via `API_PORT` in
`.env`), with hot-reload on file changes (`tsx watch`). Leave this running in
its own terminal.

On first startup with no existing data directory, it creates one and starts
empty - this is expected, not an error (see "Where your data lives" below).

## 4. Run the web app

In a second terminal:

```
npm run dev:web
```

Starts `apps/web` (Vite) on `http://localhost:5173`. Open that URL in a
browser. The web app requires `apps/api` to already be running - it has no
standalone/offline mode.

## 5. First run walkthrough

A fresh install has no accounts and no data. Expect to see, in order:

1. The **sign-up screen** (`AuthScreen`) - create an account with an email
   and an 8+ character password.
2. **First-Run Onboarding** - welcome, consent, basic profile info,
   preferences, and creating your first goal. (This is intentionally short
   of a full "onboarding complete" - see ADR 0010. There's no AI-generated
   plan at the end; that's a separate, not-yet-built milestone.)
3. The **Dashboard** - your new home screen after onboarding, showing your
   goal(s) and a suggested next action.
4. From there: **All Goals** (manage/pause/complete/archive, check-in
   history), **Profile** (display name, timezone, locale, preferences), and
   quick check-ins from the Dashboard.

Signing out and back in (or restarting `apps/api`) should return you to
wherever you left off - onboarding resumes mid-flow, and all goals/check-ins/
profile data are still there (see below).

## Where your data lives

Every account, goal, check-in, and profile is written to plain JSON files
under `Apps/api/data/` (one file per domain: `users.json`, `goals.json`,
`check-ins.json`, etc.) - see ADR 0016 for how this works. That directory is
gitignored; it holds real local credentials and data once you sign up.

- **Survives**: stopping and restarting `apps/api` (including a hard kill,
  not just a graceful shutdown - verified as part of ADR 0016 and again for
  this milestone).
- **Does not survive**: your login session. Sessions are deliberately kept
  in-memory only (24-hour TTL) - restarting `apps/api` signs everyone out,
  but their accounts and data are untouched. Signing back in works normally.
- Override the location with `DATA_DIR` in `.env` (relative paths resolve
  against `apps/api`'s own working directory, so the default `./data`
  becomes `Apps/api/data/`).

This is a single-process, whole-file-rewrite-per-mutation design - correct
for one local `apps/api` process, not built for multiple server instances
sharing one data directory (out of scope; nothing in this project runs that
way).

## Resetting your data

To wipe all local accounts/goals/check-ins/etc. and start over:

```
npm run reset-data
```

This deletes the `DATA_DIR` directory (respecting a custom value in `.env`)
and prints what it removed. `apps/api` recreates it automatically on next
startup.

**Stop `apps/api` first.** The file-backed repositories load their data once
at startup and hold it in memory until each write; deleting the directory
out from under a running server and then triggering a write recreates the
directory with just that one change, not a clean slate.

To reset manually instead: stop `apps/api`, then delete `Apps/api/data/`
yourself.

## Verification checklist

Use this after a fresh clone, after pulling changes, or any time you want to
confirm the local setup actually works end to end - not just that it builds.

- [ ] `npm install` completes with no errors.
- [ ] `npm run verify` (typecheck + full test suite) passes clean.
- [ ] `npm run dev:api` starts and logs `Better You API listening on
      http://localhost:4000` (or your configured `API_PORT`) with no errors.
- [ ] `npm run dev:web` starts and `http://localhost:5173` loads the
      sign-up screen with 0 console errors.
- [ ] Sign up with a new account → lands on First-Run Onboarding.
- [ ] Complete onboarding (including creating a first goal) → lands on the
      Dashboard with that goal visible.
- [ ] Record a check-in from the Dashboard → it appears in that goal's
      check-in history on the All Goals screen.
- [ ] **Restart `apps/api`** (stop it, `npm run dev:api` again) → sign back
      in with the same account → the goal and check-in from the steps above
      are both still there. This is the actual point of this milestone -
      confirms durability, not just that the app runs.
- [ ] `npm run reset-data` (with `apps/api` stopped) → restart `apps/api` →
      the same account can no longer sign in (fresh data directory).
- [ ] Toggle your OS's light/dark mode and reload `apps/web` → both Sky and
      Midnight mode render correctly (`prefers-color-scheme`-driven, no
      manual toggle exists yet).

## Troubleshooting

- **Port already in use** (`EADDRINUSE` on 4000 or 5173): a previous
  session's dev server is probably still running. On Windows:
  `netstat -ano | Select-String ':4000'` (or `:5173`) to find the PID,
  then `taskkill //PID <pid> //F`. On macOS/Linux, use
  `lsof -i :4000` (or `:5173`) instead.
- **`apps/web` suddenly can't resolve an import that worked a moment ago**:
  a long-running Vite dev server can drift into a bad state after many hours
  of file changes (seen and diagnosed during earlier development - see the
  2026-08-18 development log). Kill it and run `npm run dev:web` fresh
  before assuming it's a code problem.
- **`.env` changes don't seem to take effect for `apps/api`**: `tsx watch`
  reloads on source-file changes, not `.env` changes - stop and restart
  `npm run dev:api` after editing `.env`.
