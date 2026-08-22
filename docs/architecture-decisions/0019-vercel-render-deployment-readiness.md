# ADR 0019: Vercel/Render deployment readiness

**Status:** Accepted

## Context

ADR 0018 planned a Vercel (web) + Render (API) cloud dev/preview environment but deliberately made no code changes and verified nothing against a live deployment. The user confirmed Vercel + Render as the actual MVP hosting choice and asked for a follow-up milestone, `vercel-render-deployment-readiness`, to close the one real gap a planning-only pass couldn't: `apps/api` didn't actually work correctly on Render as written, because Render injects its own `PORT` environment variable and the app only read `API_PORT`. Everything else in the request - documenting Vercel/Render env vars, stating this is MVP/dev-preview hosting rather than production, and documenting the persistence choice - was a refinement of ADR 0018's existing `docs/environments.md`, not new ground.

## Decision

- **`apps/api/src/index.ts` now resolves its port as `getEnv('PORT', getEnv('API_PORT', '4000'))`.** `PORT` (Render's injected variable) wins whenever present; `API_PORT` remains the local-dev override, used only when `PORT` is unset - which is always true locally and never true on Render. This removes the manual "set both `PORT` and `API_PORT` to the same value" workaround ADR 0018 had documented as the mitigation, since the code now does the right thing automatically. No other code changed - `getEnv()` itself (`packages/config`) was reused as-is, no new function or dependency.
- **Verified directly against a real running server, not just reasoned about**: started `apps/api` four ways - no port env vars (→ 4000, the existing default), `API_PORT=5555` alone (→ 5555), `PORT=6000` alone simulating Render (→ 6000), and both set together (→ 6000, confirming `PORT` wins) - each confirmed with a real HTTP request against the actual bound port and a failed request against the port that should *not* be listening. `npm run verify` (typecheck + full suite, 238/238) passed unchanged, since no domain code or route was touched.
- **`docs/environments.md` updated to match**: the Render env var table no longer tells the user to set `PORT` manually (it's now correctly automatic), the deployment-readiness checklist's port-related item was rewritten to reflect the fix, and `.env.example`'s `API_PORT` comment now states the precedence explicitly.
- **An explicit "this is MVP/dev-preview hosting, not production" statement added directly inside the Cloud dev/preview section itself** (not only in the document's opening paragraph, where it already lived from ADR 0018) - the user asked for this to be stated clearly, so it's now stated in the one section someone deploying would actually be reading.
- **The persistence choice is documented, still not made.** ADR 0018's existing two-option framing (pay for a Render Starter plan + persistent disk vs. accept data resets between redeploys) is carried forward unchanged in `docs/environments.md` - this milestone's job was to document the choice clearly, not to pick one. The long-term direction - a hosted database adapter before serious beta testing - is restated as the next milestone, not started here.
- **No other Vercel/Render-specific facts were re-verified** - the Render Root Directory/Build/Start command reasoning, the Vercel monorepo build settings, and the CORS single-origin limitation from ADR 0018 were reviewed for continued accuracy but not independently re-checked against the platforms' docs again this session, since nothing about this repo's structure changed that would invalidate them.

## Consequences

- `apps/api` now works correctly on Render's actual runtime behavior (bind to `PORT`) without requiring a human to remember to mirror two environment variables - the single most likely first-deploy failure mode from ADR 0018's plan is now fixed at the code level instead of documented as a manual step to get right.
- Still not deployed. This milestone fixes and documents what a real Vercel/Render deployment needs; it doesn't perform one. The deployment-readiness checklist in `docs/environments.md` remains the way to confirm the real thing once the user actually deploys.
- The persistence decision (pay for a Render disk vs. accept resets) remains open, by design - it's the user's recurring-cost call to make, not a default this milestone should have picked silently, consistent with ADR 0018's own reasoning.
