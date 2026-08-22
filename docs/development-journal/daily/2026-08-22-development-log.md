# Better You Development Log — 2026-08-22

## Session Overview

Built **local release readiness**: the user's explicitly-scoped next milestone after durable persistence (ADR 0016) - make the app easy to run locally with durable data, covering an env example, run docs, reset-data instructions, and a verification checklist, deliberately kept local/dev only with no production deployment work.

---

## Starting Point

Every domain through Progress was real, tested, and durable (data survives an `apps/api` restart per ADR 0016), but actually getting a fresh clone running locally still required tribal knowledge: `.env.example` documented one dead variable, nothing loaded `.env` automatically, `apps/web` had no `.env.example` at all, both app-level `README.md`s were stale (one still claimed `apps/web` wasn't wired to the API; the other still described the app as "Goal Creation Core"), and there was no reset mechanism beyond manually finding and deleting a data directory.

---

## Goal for This Session

Make a fresh clone runnable end to end by someone who's never seen the project, without adding any new runtime dependency, and without touching any domain code - env examples for both apps, a single run guide, a real reset script, and a verification checklist that actually exercises durability (not just "the app starts").

---

## Work Completed

### What Changed

- Rewrote the root `.env.example`: `API_PORT`, `API_CORS_ORIGIN`, `DATA_DIR` documented with defaults and what each affects; `DEV_USER_ID` kept but now explicitly labeled legacy/test-only, since Auth replaced the stub user in the actual running app back in the 2026-08-16 session and this was never corrected.
- Added `Apps/web/.env.example` (`VITE_API_BASE_URL`) - didn't exist before, even though `src/api/config.ts` already reads it.
- `Apps/api/package.json`'s `dev`/`start` scripts now load `.env` automatically via Node's native `--env-file-if-exists` flag (`tsx watch --env-file-if-exists=../../.env src/index.ts`) - no `dotenv` dependency added. Verified directly that `tsx` forwards this flag through to Node correctly under both plain execution and `watch` mode.
- New `scripts/reset-data.mjs` + `npm run reset-data`: deletes the `DATA_DIR` directory (respecting a custom value from `.env`), refuses to run on a path that isn't clearly nested inside the repo, reports what it deleted. Built on `node:fs` only.
- New root `RUNNING.md`: prerequisites, install, environment setup, running `apps/api`/`apps/web`, a first-run walkthrough, an explanation of what survives a restart (data) vs. what doesn't (sessions, by design), reset instructions, a literal verification checklist, and a troubleshooting section carrying forward two already-known gotchas (stale long-running Vite dev servers from the 2026-08-18 log; Windows port-killing via `netstat`/`taskkill` from the 2026-08-15 log).
- Updated `README.md` (current domain status instead of the stale "Goal Creation Core" line, a quick-start pointing at `RUNNING.md`, corrected layout section), `Apps/api/README.md`, and `Apps/web/README.md` (both had gone stale relative to the real, current app - fixed the inaccurate claims and pointed to `RUNNING.md` for the full guide).
- Added a `verify` npm script (`typecheck && test`) as the first checklist item, and an `engines.node: ">=20.12.0"` field in the root `package.json` (the actual requirement introduced by the `--env-file-if-exists` flag).
- Recorded ADR 0017.

### Why It Changed

Directly requested, with the scope specified up front by the user: env example, run docs, reset-data instructions, verification checklist, local/dev only.

### How It Works

`apps/api`'s `dev`/`start` scripts pass `--env-file-if-exists=../../.env` to `tsx`, which forwards it to Node - Node loads the file (if present) into `process.env` before the script runs, and `getEnv()` (already isomorphic-safe, from ADR 0003) reads it exactly as if it had been exported manually. `apps/web` needed no equivalent change, since Vite already auto-loads its own app-level `.env` and exposes only `VITE_`-prefixed variables to browser code - only a missing `.env.example` needed fixing there. `reset-data.mjs` resolves `DATA_DIR` the same way `apps/api/src/index.ts` does (relative to `apps/api`'s own working directory, not the repo root) so it deletes the exact directory the running server actually uses, not a guessed path.

---

## Example Flow

A developer clones the repo fresh, runs `npm install`, copies both `.env.example` files to `.env`, starts `apps/api` and `apps/web`, signs up, completes onboarding, creates a goal, and records a check-in. They stop `apps/api` (even a hard kill, not a graceful shutdown), restart it, sign back in, and see the same goal and check-in still there - proving the durability from ADR 0016 actually holds for a real user's local session, not just an automated test. If they want a clean slate, `npm run reset-data` clears it in one command.

---

## Problems Encountered

None - implementation, live verification, and cleanup all went cleanly on the first pass. The one thing checked carefully rather than assumed: whether `tsx` actually forwards `--env-file-if-exists` to Node under both plain execution and `watch` mode (it does, confirmed with a throwaway test env var before touching any real script).

---

## Decisions Made

- **Node's native `--env-file-if-exists`, not a `dotenv` dependency** (ADR 0017) - avoids adding a runtime dependency for something Node 20.12+ already does natively; the project's Node version (22.x) comfortably exceeds the requirement.
- **Two `.env.example` files, not one** - matches the fact that `apps/api` (Node) and `apps/web` (Vite/browser) load environment variables through genuinely different mechanisms; a single shared file would have been misleading about where each variable actually takes effect.
- **A real reset script, not just written instructions** - a `rm -rf`-by-hand instruction is easy to get wrong (wrong path, forgetting to stop the server first); a small, safety-checked script removes that risk with no new dependency.
- **`RUNNING.md` as the single source of truth**, with the root/app-level READMEs pointing to it rather than duplicating its content - avoids the exact kind of staleness this session found and fixed (two READMEs that had quietly drifted out of sync with the real app over many sessions).
- **Explicitly local/dev only, stated directly in `RUNNING.md`'s opening paragraph** - matches the user's own scoping and prevents this milestone from being mistaken for deployment readiness later.
- **`DEV_USER_ID` left in place, not deleted** - still exercised by `tests/integration/goals.integration.test.ts`; removing tested-but-dead code wasn't part of this milestone's scope, so it was relabeled honestly instead.

---

## Files Significantly Changed

- `.env.example` (root) - rewritten with full variable documentation.
- `Apps/web/.env.example` - new.
- `Apps/api/package.json` - `dev`/`start` scripts load `.env`.
- `package.json` (root) - `verify`/`reset-data` scripts, `engines.node`.
- `scripts/reset-data.mjs` - new.
- `RUNNING.md` - new, the primary local-setup guide.
- `README.md`, `Apps/api/README.md`, `Apps/web/README.md` - corrected and pointed at `RUNNING.md`.
- `docs/architecture-decisions/0017-local-release-readiness.md` - new.

---

## Testing and Validation

**Tested:**
- `npm run typecheck`: clean across the whole repo (no domain code changed, but confirmed nothing broke).
- Live, end-to-end verification against a real running `apps/api`: copied `.env.example` → `.env`, started `apps/api` with `npm run dev:api`, confirmed it picked up the env-file flag; signed up a real account and created a real goal via real HTTP requests; hard-killed the process (`taskkill`, not graceful shutdown - mirroring how ADR 0016 itself was verified); restarted `apps/api`; signed back in and confirmed both the account and the goal were still present. Then ran `npm run reset-data` and confirmed the data directory was deleted and correctly reported. All test artifacts (the seeded account, the temporary `.env` files) were cleaned up afterward.

**Not yet tested:** `apps/web`'s `.env.example`/`VITE_API_BASE_URL` loading wasn't separately live-verified this session (no UI/domain code changed - Vite's own `.env`-loading behavior is well-established and unmodified here), and the full `RUNNING.md` verification checklist wasn't walked end to end by a genuinely fresh clone (this session worked from the existing checked-out repo).

---

## Current State

A developer can go from a fresh clone to a running, fully-functional local instance (sign up → onboarding → Dashboard → Goals → check-ins → Profile) using only `RUNNING.md`, with working defaults requiring no manual env-var exporting, and a one-command way to reset local data. Nothing about production deployment was started.

---

## Known Issues

**No known issues identified during this session.**

---

## Next Recommended Step

With local release readiness done, the standing blocker remains the AI Roadmap Engine (unprovisionable model credential). The clearest non-AI-blocked candidates now are: actually provisioning a production deployment target (a genuinely new, larger milestone - hosting, a real database migration off the JSON-file adapters, secrets management, HTTPS - deliberately not started here since it was explicitly out of scope), or continued visual/UX refinement. Worth confirming with the user rather than assuming.
