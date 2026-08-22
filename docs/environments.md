# Environments

Where Better You runs, today and planned. See `RUNNING.md` for the actual
step-by-step local setup - this document is about the environments
themselves: what each one is for, how it's hosted, and what's honestly not
solved yet in each.

| Environment | Status | Hosting | Persistence | Who it's for |
|---|---|---|---|---|
| **Local** | Built (ADR 0016/0017) | Your machine | File-backed JSON, durable across restarts | You, developing |
| **Cloud dev/preview** | Deployment-ready docs + a real code fix (ADR 0018, ADR 0019) - not yet deployed | Web → Vercel, API → Render | File-backed JSON on a Render disk - **requires a paid Render plan**, see below | You + collaborators, sharing a link without anyone running a laptop |
| **Beta/shared testing** | Not started | Same split, likely | Needs a real hosted database adapter first (ADR 0001 already anticipates this) | A wider group testing real usage over time |

Nothing below is production. There's no production environment defined yet -
that's a distinct, larger milestone (real database migration, secrets
management, monitoring, a production auth/email provider) explicitly out of
scope here, same as ADR 0017 scoped local release readiness to dev-only.

---

## 1. Local

Covered fully in `RUNNING.md`. One process per app, both on your own
machine, data in `Apps/api/data/`.

## 2. Cloud dev/preview (Vercel + Render)

**This is MVP/dev-preview hosting, not production.** It exists so a
collaborator can open a real shareable URL without you running anything
locally - not a claim that Better You is ready for production traffic,
real user data at scale, or unattended operation. See "What is still not
production-ready" below for the full list of what that would still need.

**Purpose**: a shareable URL a collaborator can open without you running
anything locally. Not meant to carry data anyone needs to keep long-term -
see the persistence warning below.

**Hosting split**:
- `apps/web` (the React/Vite frontend) → **Vercel**. Static build output,
  Vercel's own CDN/hosting - no server process to manage.
- `apps/api` (the Express backend) → **Render**, as a Web Service. Needs a
  real, always-running Node process (Express, in-memory session state,
  file-backed data) - not something a static host or a serverless function
  platform fits without real rework, so this stays a conventional
  long-running server host.

### Render (apps/api) setup

Render deploys from this git repo directly. Recommended service settings:

| Setting | Value | Why |
|---|---|---|
| Root Directory | `.` (repo root) | Keeps the exact same `npm install` / module-resolution behavior already proven locally (`npm run dev:api` from the root). Setting Root Directory to `Apps/api` alone risks losing hoisted workspace dependencies (`@types/node` is only declared at the root, relied on via hoisting - fine for `tsc`, but worth avoiding the ambiguity entirely). |
| Build Command | `npm install` | Same install every local session already runs. No compile step yet - `apps/api` runs directly via `tsx` (see Start Command), matching CLAUDE.md's "don't add infrastructure ahead of need" - a real TS→JS build step is a production-readiness concern, not a preview one. |
| Start Command | `npm run start -w apps/api` | Runs `tsx --env-file-if-exists=../../.env src/index.ts` (ADR 0017) - the `.env` load is a no-op on Render since env vars come from Render's dashboard instead, not a file. |
| Environment | Node | - |

**Environment variables to set in Render's dashboard** (not in a committed
file - see "No secrets" below):

| Variable | Value | Notes |
|---|---|---|
| `PORT` | Leave unset - Render sets and injects this automatically. | `apps/api/src/index.ts` now reads `PORT` first and always binds to it when present (`getEnv('PORT', getEnv('API_PORT', '4000'))` - fixed as part of this milestone, see below), so whatever port Render assigns is what the server actually listens on. Nothing to set here. |
| `API_PORT` | Not needed on Render | Still the local-dev override (`.env.example`) - only takes effect when `PORT` isn't set, which is never true on Render. Harmless to leave set or unset. |
| `API_CORS_ORIGIN` | `https://<your-vercel-url>` | Must be the **exact** deployed web origin, no trailing slash. See the CORS/preview-URL caveat below. |
| `DATA_DIR` | `/var/data` (or wherever you mount the persistent disk - see below) | If unset, defaults to `./data` relative to `apps/api`'s working directory, which lands on Render's **ephemeral** local disk unless you've attached a persistent disk at that exact mount path. |

### Vercel (apps/web) setup

| Setting | Value | Why |
|---|---|---|
| Root Directory | `Apps/web` | Vercel's monorepo support detects the root `package.json`'s `workspaces` field automatically (confirmed against current Vercel docs); `apps/web/package.json` also declares every dependency it directly needs (React, Vite, the plugin, TypeScript), so the build doesn't depend on workspace hoisting behavior either way. |
| Build Command | `npm run build` (Vercel auto-detects Vite; leave as default unless it doesn't) | Runs `vite build`. |
| Output Directory | `dist` | Vite's default. |
| Install Command | default | No override needed per the Root Directory reasoning above. |

**Environment variable to set in Vercel's dashboard**:

| Variable | Value | Notes |
|---|---|---|
| `VITE_API_BASE_URL` | `https://<your-render-api-url>` | Read by `apps/web/src/api/config.ts`. Must be set at build time (Vite bakes `import.meta.env.VITE_*` into the built bundle) - changing it later requires a rebuild/redeploy, not just an env var update. |

**Caveat not yet resolved**: Vercel's own "Preview Deployments" feature
(a fresh URL per branch/PR) would break `API_CORS_ORIGIN`, since Render's
CORS config here only accepts one static origin
(`apps/api/src/server.ts`'s `cors({ origin: getEnv('API_CORS_ORIGIN', ...) })`).
For now, treat this as **one stable Vercel production deployment** pointed
at **one stable Render service**, not per-branch preview URLs. Supporting
Vercel's per-PR previews for real would need `API_CORS_ORIGIN` to accept a
list or a pattern - a small, real code change, deliberately not made as
part of this planning-only milestone.

### The persistence problem - the one thing this milestone does not solve

Verified directly against Render's current docs while writing this:

- **Render web services have an ephemeral filesystem by default.** Anything
  written to disk (our JSON data files) is lost on every redeploy, restart,
  or free-tier spin-down.
- **Free web services cannot attach a persistent disk at all** - disks
  require a paid service. They also spin down after 15 minutes of
  inactivity and take about a minute to wake back up on the next request -
  which also matters for "shareable": a collaborator opening a cold link
  waits roughly a minute before anything loads.
- **The minimum paid tier that supports a disk is Render's Starter plan
  ($7/month for the always-on web service), plus the disk itself
  ($0.25/GB/month).**

So there are exactly two honest options for this environment, and this
milestone deliberately does neither yet:

1. **Pay for Render Starter + a small disk, mount it at the path `DATA_DIR`
   points to.** Zero code changes - the existing `File*Repository` adapters
   (ADR 0016) already work against any real filesystem path. This gets you
   a shareable environment where data (accounts, goals, check-ins) actually
   survives redeploys, at the cost of ~$7-8/month.
2. **Stay on Render's free tier and accept that data resets** on every
   redeploy/restart/spin-down cycle. Fine for "look at the latest UI," not
   fine for "leave test data for a collaborator to look at later."

**Recommendation, not yet acted on**: option 1 (paid Starter + disk) if this
environment needs to hold real shared state between visits; option 2 if it's
purely a disposable "see the latest build" link. Either way, **a real hosted
database adapter is still the right next step before any serious beta** -
this environment either pays for a disk as a stopgap or accepts resets,
neither of which is a good foundation for actual beta testers relying on
their data sticking around.

## 3. Beta/shared testing

Not started. Formally depends on a hosted database adapter (a new
`*Repository` implementation behind the same interfaces every domain
already uses - ADR 0001's adapter pattern was built exactly for this),
which itself depends on picking a real database and hosting for it -
genuinely open, not decided here. Likely reuses the same Vercel/Render
split for compute, with the database as the new piece.

---

## No secrets in this repo

Every environment variable table above documents *names*, not values to
commit. Real Render/Vercel values (CORS origins, API base URLs, and any
future database credentials) belong in each platform's own dashboard/secret
store, never in a committed file - the same rule `RUNNING.md` and ADR 0017
already established for local `.env` files.

## Deployment readiness checklist

Use this before treating the cloud dev/preview environment as usable, and
re-check it after any change to env vars, CORS, or the Render/Vercel
project settings.

- [ ] `npm run verify` (typecheck + full test suite) passes locally before
      deploying.
- [ ] Render service is set up per the table above. `PORT` is left unset in
      Render's dashboard (Render injects it, and `apps/api` now binds to it
      automatically - verified locally by simulating Render's `PORT` env var
      against a real running server, see ADR 0019).
- [ ] Render's `API_CORS_ORIGIN` exactly matches the live Vercel URL
      (scheme + host, no trailing slash, no stray preview-URL mismatch).
- [ ] A conscious decision has been made about `DATA_DIR`/persistent disk
      (paid disk vs. accepted resets - see above) - not left as an
      accidental default.
- [ ] Vercel's `VITE_API_BASE_URL` is set and a **fresh deploy/rebuild** has
      happened since it was last changed (build-time-baked, not runtime).
- [ ] Opening the live Vercel URL in a fresh/incognito browser: sign-up
      screen loads with 0 console errors, and a real `fetch` to the Render
      API succeeds (no CORS error in the console - the most common first
      failure mode here).
- [ ] Full walkthrough on the live URLs: sign up → onboarding → Dashboard →
      create a goal → check in → confirmed working against the real
      deployed API, not just locally.
- [ ] If persistence matters for this deploy: redeploy the Render service
      and confirm the account/goal from the step above still exists
      afterward (this is the real test of whether the disk decision above
      actually took effect).
- [ ] Nothing in `git log`/the deployed dashboards contains a real secret,
      API key, or credential committed to the repo.

## What is still not production-ready

Carried forward and expanded from ADR 0017's own list, now specific to
cloud hosting:

- **No real database** - still JSON files, now additionally constrained by
  whichever persistence decision was made above (paid disk vs. resets).
- **Sessions are in-memory only** (ADR 0004/0016) - every Render restart or
  redeploy signs everyone out, same as local, but far more frequent in a
  hosted environment (free-tier spin-down, routine redeploys).
- **No compiled build for `apps/api`** - runs directly via `tsx` in every
  environment including this one; fine for dev/preview, a real production
  environment would want a compiled `dist/` and a smaller runtime image.
- **Single static CORS origin only** - breaks Vercel's per-PR preview URLs
  (see above); only one stable deployment pair is supported right now.
- **No monitoring, alerting, or error tracking** - not set up anywhere yet.
- **No custom domain, HTTPS is whatever Vercel/Render provide by default**
  (both give you HTTPS automatically on their own subdomains - that part is
  actually fine for a preview, just noting it's their default, not a
  deliberate choice made here).
- **No CI gate before deploy** - Render/Vercel's own auto-deploy-on-push (if
  enabled) would ship a red build straight to the shared URL; `npm run
  verify` staying a manual pre-deploy step, not an enforced check, is a
  known gap.
