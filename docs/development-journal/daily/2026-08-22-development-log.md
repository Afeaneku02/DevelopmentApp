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

---
---

# Better You Development Log — 2026-08-22 (continued)

## Session Overview

Second session of the day: cloud dev/preview planning (ADR 0018), explicitly scoped as planning/readiness, not a working deployment. The user had already used Vercel (web) and Render (API) for a prior deploy attempt, which changed the shape of the work from "which platform" to "how do we use the platforms already chosen, correctly and honestly" - including verifying Render's actual persistent-disk and port-binding requirements against its current docs rather than assuming from memory, since those facts directly determine whether the plan is honest or not.

---

## Starting Point

Local release readiness (ADR 0017) was done - a fresh clone could run end to end locally with durable data. Nothing about running Better You anywhere else existed yet.

---

## Goal for This Session

Produce `docs/environments.md` defining local/cloud-dev-preview/beta-shared-testing, document the exact Render and Vercel configuration this repo needs (build/start commands, env vars per side), be explicit about what's not solved (chiefly: JSON-file persistence needs a paid Render disk to survive redeploys), and add a deployment-readiness checklist - without writing any deployment config files or making code changes.

---

## Work Completed

### What Changed

- New `docs/environments.md`: an environments overview table, a full local section (pointing to `RUNNING.md`), a detailed cloud dev/preview section (Render service settings, Vercel project settings, both env-var tables), a persistence-problem section with real current numbers, a not-started beta/shared-testing section, a "no secrets" reminder, a deployment-readiness checklist, and a "what's still not production-ready" list.
- Verified two load-bearing claims against Render's/Vercel's actual current documentation (via web search) rather than relying on possibly-stale memory, since this doc's whole point is not to overstate what's solved:
  - Render free web services cannot attach a persistent disk at all (paid-only - Starter plan, $7/month, plus $0.25/GB/month for the disk), and spin down after 15 minutes idle.
  - Render injects its own `PORT` env var (default `10000`) that the server must bind to; `apps/api` reads `API_PORT`, not `PORT` - a real, easy-to-miss mismatch, resolved by setting both to the same explicit value in Render's dashboard (Render does allow overriding its own `PORT` value per-service, confirmed from current docs) rather than a code change.
- Identified and documented (not fixed) a real limitation found while reasoning through the actual `apps/api` CORS code: `cors({ origin: getEnv('API_CORS_ORIGIN', ...) })` only accepts one static origin, which is incompatible with Vercel's per-PR Preview Deployments (a fresh URL per branch) - scoped this environment to one stable Vercel deployment paired with one stable Render service, not per-branch previews.
- Reasoned through why the recommended Render Root Directory is the repo root (not `Apps/api` alone) by tracing the actual dependency/hoisting situation: `Apps/api/package.json` doesn't declare `@types/node` itself and currently gets it via root-level workspace hoisting; installing standalone inside `Apps/api` would lose that. Separately confirmed `Apps/web/package.json` *is* fully self-sufficient (declares React/Vite/TypeScript itself), so its Vercel config is lower-risk either way.
- Added a one-line pointer from `RUNNING.md` to `docs/environments.md`.
- Recorded ADR 0018.

### Why It Changed

Directly requested, with the scope narrowed mid-conversation once the user reported they'd already chosen Vercel + Render - at that point, planning "which platform" would have been redundant, and the genuinely open question became getting this repo's specific Render/Vercel configuration right (including the persistence and port-binding gotchas that aren't obvious from either platform's quickstart docs).

### How It Works

`docs/environments.md`'s Render table gives `apps/api` the same Root Directory/Build Command/Start Command shape that already works locally (`npm run start -w apps/api` from the repo root), so nothing about module resolution or dependency hoisting changes between local and Render - the only real difference is where env vars come from (Render's dashboard vs. a local `.env` file, both read through the same `getEnv()`/`--env-file-if-exists` mechanism from ADR 0017). The persistence section doesn't recommend a specific path forward; it lays out the real cost/tradeoff (pay ~$7-8/month for a disk vs. accept data resets) and defers the decision to the user, consistent with treating this as planning, not a finished deployment.

---

## Problems Encountered

None in the sense of a bug - the "investigation" this session was almost entirely about not trusting assumptions: checking Render's actual current disk/port-binding behavior via web search rather than asserting it from memory, since an inaccurate persistence claim in this specific document would be worse than no document at all.

---

## Decisions Made

- **Hosting split (Vercel for web, Render for API) treated as already decided**, not re-opened - it was the user's own prior choice from real hands-on use, not something this session needed to re-litigate.
- **One `docs/environments.md` covering all three environments**, not split into per-environment files - mirrors `RUNNING.md`'s single-guide shape, and the environments are short enough individually that splitting them would fragment more than it'd clarify.
- **Render Root Directory = repo root, not `Apps/api`** - de-risks a real (if subtle) dependency-hoisting mismatch rather than assuming a standalone install would behave identically.
- **The persistence tradeoff is presented, not resolved** - a recurring-cost decision (paid Render disk) is the kind of call this project's own pattern (e.g. the Auth-provider fork in ADR 0004) treats as the user's to make, not an assumption to bake into a plan.
- **No deployment config files, no CORS code change, no compiled build step added** - this milestone is documentation only, matching the user's explicit "planning, not pretending deployment is solved" framing; every one of those is named as a real next step instead of being built speculatively.

---

## Files Significantly Changed

- `docs/environments.md` - new, the primary deliverable.
- `docs/architecture-decisions/0018-cloud-dev-preview-planning.md` - new.
- `RUNNING.md` - one-line pointer added to `docs/environments.md`.

---

## Testing and Validation

**Tested:** N/A in the usual sense - no code changed this session. The closest equivalent: two factual claims central to the document (Render's persistent-disk/free-tier behavior, Render's `PORT` env var requirement) were checked against Render's own current documentation via live web search rather than left as unverified assertions from memory.

**Not yet tested:** none of the Render/Vercel-specific configuration in `docs/environments.md` has been exercised against a real deployment in this session - no account access was available. The document's own deployment-readiness checklist exists specifically to close that gap once the user actually deploys.

---

## Current State

`docs/environments.md` and ADR 0018 give a concrete, fact-checked plan for standing up a shareable Vercel + Render preview of Better You, including the two real gotchas (persistent-disk cost, `PORT` vs. `API_PORT`) that would otherwise surface as confusing deploy failures. Nothing has actually been deployed; no code changed.

---

## Known Issues

- The CORS-origin-list limitation (breaks Vercel per-PR previews) is documented but not fixed.
- None of today's Render/Vercel-specific guidance has been verified against a live deployment - flagged explicitly in both `docs/environments.md` and ADR 0018, not silently assumed correct.

---

## Next Recommended Step

Per the user's own framing: a hosted database adapter is the right next step before any serious beta testing, since the current JSON-file persistence either costs a recurring fee (Render disk) or resets on every redeploy - neither is a solid foundation for real beta testers. Before that, though, actually deploying to Vercel/Render and walking `docs/environments.md`'s checklist against the real, live URLs would validate (or correct) everything documented today - worth doing that first, since a plan that hasn't touched the real platform yet is still a plan, not a working preview.

---
---

# Better You Development Log — 2026-08-22 (3rd continued)

## Session Overview

Third session of the day: `vercel-render-deployment-readiness` (ADR 0019), a direct follow-up to the cloud dev/preview planning from the previous session. The user had confirmed Vercel + Render as the actual MVP hosting choice and asked for the one real gap in ADR 0018's plan to be closed at the code level, not just documented as a manual step: `apps/api` didn't actually work correctly on Render as written, because Render injects its own `PORT` variable and the app only read `API_PORT`.

---

## Starting Point

`docs/environments.md` and ADR 0018 documented a Vercel/Render deployment plan, including the `PORT`/`API_PORT` mismatch as a gotcha requiring a human to manually set both env vars to the same value in Render's dashboard. Nothing had been deployed or code-changed yet.

---

## Goal for This Session

Fix `apps/api`'s startup so it binds to Render's injected `PORT` automatically while `API_PORT` keeps working for local dev, verify that fix against a real running server (not just reasoning about it), review and tighten `docs/environments.md`/ADR 0018 for accuracy given the fix, and make the "MVP/dev-preview, not production" framing and the persistence choice more explicit per the user's request - without deploying anything or picking the persistence tradeoff on the user's behalf.

---

## Work Completed

### What Changed

- `apps/api/src/index.ts`: the port resolution changed from `Number(getEnv('API_PORT', '4000'))` to `Number(getEnv('PORT', getEnv('API_PORT', '4000')))` - `PORT` wins whenever set (Render's case), `API_PORT` is the fallback (local dev's case), `4000` is the final default. No changes to `packages/config`'s `getEnv()` itself - reused as-is.
- Verified live against a real running server, four scenarios in a row (starting/killing the actual process each time, confirming via real HTTP requests against the ports that should and shouldn't be listening): neither var set → 4000; `API_PORT=5555` alone → 5555; `PORT=6000` alone (simulating Render) → 6000; both set together → 6000 (`PORT` wins, `API_PORT` ignored). Caught and cleaned up one stray leftover `node.exe` process from an earlier session's testing that was still bound to port 4000 and briefly made scenario 2's verification look wrong before it was identified and killed.
- `npm run verify` (typecheck + full suite): 238/238 passing, unchanged - no domain/route code touched.
- Updated `docs/environments.md`: the Render env var table no longer instructs setting `PORT` manually (rewritten to explain it's now automatic); the deployment-readiness checklist's port item rewritten to match; the Cloud dev/preview section gained an explicit "this is MVP/dev-preview hosting, not production" statement inside the section itself, not only in the document's opening paragraph; the environments-overview table's status column updated to reflect the code fix.
- Updated `.env.example`'s `API_PORT` comment to state the `PORT`-wins precedence explicitly.
- Recorded ADR 0019 (a new ADR, not an addendum to ADR 0018 - this is a distinct, user-named milestone with its own real code change, not a correction folded into the same one).

### Why It Changed

Directly requested, with the specific fix named up front: "Update API startup so Render's PORT env var works, while keeping API_PORT for local." The rest of the scope (Vercel/Render env var docs, MVP-not-production framing, persistence choice) was explicitly a review/tightening pass on ADR 0018's existing `docs/environments.md`, not new decisions.

### How It Works

`getEnv('PORT', getEnv('API_PORT', '4000'))` evaluates the inner call first, producing either the real `API_PORT` value or `'4000'` - that result becomes the *fallback* for the outer `getEnv('PORT', ...)` call, which returns the real `PORT` value if one is set, or the computed fallback otherwise. This gives exactly the right precedence (`PORT` > `API_PORT` > `4000`) using the existing `getEnv()` function unchanged, rather than writing new branching logic.

---

## Example Flow

On Render, the platform sets `PORT=10000` (or whatever it assigns) automatically; `apps/api` binds to it without anyone needing to set anything Render-specific beyond `API_CORS_ORIGIN` and `DATA_DIR`. Locally, `PORT` is never set, so `API_PORT` (from `.env`, defaulting to `4000`) governs exactly as before - the fix is additive, not a behavior change for local dev.

---

## Problems Encountered

### Problem

Scenario 2 of the live port-precedence verification (`API_PORT=5555`, no `PORT`) showed a real HTTP response on port 4000 as well as 5555, when port 4000 should have been unreachable (that server instance was bound to 5555 only).

### Investigation

`netstat -ano` showed a process still listening on port 4000 that hadn't been part of the current test run.

### Root Cause

A leftover `node.exe` process from earlier verification work in this same session was still running and bound to port 4000 - not a bug in the port-precedence fix itself, a stale process from prior testing.

### Solution

Identified the PID via `netstat`, confirmed it was a `node.exe` process via `tasklist`, and killed it with `taskkill`. Re-ran the scenario cleanly afterward and confirmed the expected result (port 5555 responds, port 4000 does not).

### Why the Solution Works

Killing the stale process removed the confounding listener; the actual code change was never in question once the test environment was clean - re-verified with all four scenarios run cleanly in sequence afterward.

---

## Decisions Made

- **`PORT` takes precedence over `API_PORT`, not the reverse** - matches how Render (and similar hosts) actually operate: they own the port assignment, and an app that ignores it fails to receive traffic. `API_PORT` staying meaningful only in `PORT`'s absence keeps local dev's existing behavior completely unchanged.
- **A new ADR (0019), not an addendum to ADR 0018** - this is a distinct, user-named milestone (`vercel-render-deployment-readiness`) with its own real code change, not a post-review correction to the same milestone (the pattern an addendum is for, per ADR 0010's precedent).
- **The persistence choice is documented more clearly but still not decided** - matches the user's explicit ask ("clearly document the persistence choice") as distinct from "make the persistence choice," which remains the user's call.
- **No other Render/Vercel facts re-verified against live docs this session** - only the one thing that changed (the port fix) needed re-checking; the rest of ADR 0018's research was reviewed for continued relevance, not redone.

---

## Files Significantly Changed

- `Apps/api/src/index.ts` - the port-resolution fix.
- `docs/environments.md` - Render `PORT`/`API_PORT` table, checklist, and MVP-not-production statement updated.
- `.env.example` - `API_PORT` comment updated.
- `docs/architecture-decisions/0019-vercel-render-deployment-readiness.md` - new.

---

## Testing and Validation

**Tested:**
- `npm run typecheck`: clean.
- `npx vitest run`: 238/238 passing, unchanged.
- Live verification against a real running `apps/api` process, four port-precedence scenarios in sequence, each confirmed via real HTTP requests (including confirming a port that should *not* be listening actually refuses the connection, not just that the expected port responds).

**Not yet tested:** nothing about this fix has been verified against an actual Render deployment (no account access this session) - the fix is grounded in Render's documented `PORT`-injection behavior (verified in the previous session) and a faithful local simulation of it, not a live Render deploy.

---

## Current State

`apps/api` now binds to whatever port Render assigns automatically, closing the single most likely first-deploy failure mode identified during cloud dev/preview planning. `docs/environments.md` and `.env.example` reflect the fix. Nothing has been deployed; the persistence choice (paid Render disk vs. accepted resets) remains open.

---

## Known Issues

- Unchanged from the previous session: the CORS-single-origin limitation (breaks Vercel per-PR previews) is documented but not fixed; nothing has been verified against a live Vercel/Render deployment.

---

## Next Recommended Step

Actually deploying to Vercel/Render and walking `docs/environments.md`'s deployment-readiness checklist against the real, live URLs - this would validate the port fix and every other documented setting against the real platforms for the first time. After that, per the user's own stated direction, a hosted database adapter before any serious beta testing.
