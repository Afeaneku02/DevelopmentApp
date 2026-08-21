# ADR 0005: Minimal HTTP API layer - Express 5, bearer tokens, versioned routes

**Status:** Accepted

## Context

`services/auth` (ADR 0004) and `services/goals` (ADR 0002) were both real and fully tested, but unreachable from outside a single Node process - `apps/web`'s dev preview could only use `services/goals` because it called it directly in-browser, which ADR 0004 explicitly ruled out for Auth (password hashing and session issuance must stay server-side). Both domains needed an actual HTTP layer before any real client - browser or otherwise - could use them together.

## Decision

- **`apps/api`**, matching the Blueprint §17 repo skeleton exactly: an Express 5 app (native async/await error handling - a rejected promise in a route handler is automatically forwarded to error-handling middleware, no manual wrapper needed) exposing `services/auth` and `services/goals` over HTTP.
- **Versioned routes** (`/api/v1/...`) per Blueprint §2's API conventions: `POST /api/v1/auth/{signup,login,logout,refresh}`, `GET|DELETE /api/v1/me`, `GET|POST /api/v1/goals` - exactly Blueprint §4's auth surface, and the subset of Blueprint §7's goals surface that `GoalService` actually implements (list/create only - no pause/resume/complete/archive/history endpoints, since those functions don't exist in `GoalService` yet).
- **Bearer tokens** (`Authorization: Bearer <token>`), not cookies. This is a real tradeoff, not a clear-cut call: cookies (httpOnly, secure, sameSite) resist XSS token theft better, but need CORS-credentials handling and CSRF protection across `apps/web`'s dev-server origin and the API's origin. Bearer tokens avoid CSRF entirely (a token must be explicitly attached by client JS) at the cost of being readable by any script if stored carelessly. Chosen for a minimal first pass; revisit toward httpOnly cookies before this becomes a production surface with real user data.
- **Consistent error envelope**: `{ error: { code, message, field? } }`. Domain errors (`AuthValidationError`, `GoalValidationError`, `EmailAlreadyInUseError`, `InvalidCredentialsError`, `SessionInvalidError`, `GoalLimitExceededError`) map to specific HTTP statuses (400/401/409); anything unrecognized logs server-side and returns a generic 500 - never leaking internal error details to the client.
- **`createServer(deps?)` takes its `AuthService`/`GoalService` as an optional parameter**, defaulting to fresh in-memory instances. Real startup (`index.ts`) calls it once; tests call it fresh per test, avoiding the cross-test state bleeding a module-level singleton would cause - same reasoning as every other service in this codebase taking its dependencies via constructor rather than importing a global.
- **Client-supplied `userId` is always ignored.** `POST /api/v1/goals` derives the owning user from the verified session (`req.user.id`, set by `requireAuth` middleware), never from the request body - tested explicitly (a request that tries to set `userId` to someone else's id is silently overridden, not rejected, since silently ignoring an extra field is friendlier than erroring on it while still being fully safe).

## Consequences

- `apps/web` is still not wired to this - it's a separate, more involved follow-up: replacing `apps/web/src/goalClient.ts`'s direct in-process `GoalService` calls with `fetch` calls, adding real signup/login screens, and managing the bearer token in client state (in-memory, not `localStorage`, to limit XSS exposure - a decision for that milestone, not this one).
- `GoalService` calls through this API now use the real authenticated user's id, not the `DEV_USER_ID` stub - but only for requests that go through `apps/api`. `apps/web`'s dev preview still uses the stub, since it still calls `GoalService` directly.
- CORS is already configured (`API_CORS_ORIGIN`, defaulting to `apps/web`'s dev origin) even though nothing consumes it cross-origin yet - it's a few lines now versus a debugging session later.
- Email verification is still not required before login (Blueprint §4 lists it as a user story, but it needs an email provider that hasn't been chosen - same constraint noted in ADR 0004) - `signUp` still marks accounts `active` immediately.
