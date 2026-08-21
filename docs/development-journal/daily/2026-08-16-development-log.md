# Better You Development Log — 2026-08-16

## Session Overview

Implemented **Minimal Real Auth**: the Auth domain (Blueprint §4), built as a genuinely real, working implementation rather than another dev-stub. This closes the loop the previous session's journal flagged as unresolved — which concrete provider goes behind the `AuthProvider` adapter, given this environment can't provision a live Supabase project. The user chose a local real-auth adapter over an unverifiable Supabase integration.

---

## Starting Point

Goal Creation Core and `apps/web` existed and were fully tested. Identity everywhere was still the `DEV_USER_ID` config stub from `packages/config`. No `services/auth` existed. The previous session ended with an explicit open question - local adapter vs. Supabase - asked via the same clarifying-question mechanism, which the user paused before answering.

---

## Goal for This Session

Resolve the provider question, then build a complete, real `AuthProvider`/`AuthService`/`UserRepository` implementing all seven functions Blueprint §4 names (`signUp`, `signIn`, `signOut`, `refreshSession`, `getCurrentUser`, `requireUser`, `deleteAccount`), with full test coverage - without wiring it into `apps/web` yet, since that requires an API layer this domain doesn't have.

---

## Work Completed

### What Changed

- Added `packages/contracts/src/user.ts`: `User`, `UserStatus`, `SignUpInput`, `SignInInput` - the `User` shape matches Blueprint §4's core data exactly (`id`, `authSubject`, `email`, `status`, `createdAt`, `deletedAt`), with no credential field.
- Added `services/auth`:
  - `passwordHasher.ts` - `hashPassword`/`verifyPassword` using Node's built-in `crypto.scrypt` (no new dependency) with a random salt per password and a timing-safe comparison.
  - `authValidation.ts` - email format validation + normalization, an 8-character minimum password rule.
  - `authProvider.ts` - the `AuthProvider` interface, and `LocalAuthProvider`: in-memory credential storage, 32-byte random session tokens with a 24-hour TTL.
  - `userRepository.ts` - `UserRepository` interface + `InMemoryUserRepository`, same adapter pattern as `GoalRepository`.
  - `authService.ts` - `AuthService`, orchestrating the two above and implementing all seven Blueprint functions, plus a 5-attempts/15-minute failed-login lockout per email.
- Added unit tests for all four modules (`passwordHasher`, `authValidation`, `LocalAuthProvider`, `AuthService`) and one integration test exercising the full signup → signin → requireUser → refresh → signout lifecycle with the real (non-mocked) provider and repository.
- Registered `@better-you/auth` as a path alias in the root `tsconfig.json` and `vitest.config.ts`, matching the existing `@better-you/contracts`/`config`/`goals` pattern.
- Recorded ADR 0004.

### Why It Changed

The user explicitly asked for Minimal Real Auth as the right long-term foundation, since Onboarding, Dashboard, and everything else downstream in the Blueprint formally depends on real identity. Vision §25.8's documented MVP-phase choice (Supabase Auth) can't be exercised or verified without a live project this session can't create, so a local adapter was chosen instead - fully real, fully testable now, and swappable later without touching `AuthService`, mirroring how `GoalRepository` was built.

### How It Works

`AuthService` depends only on the `AuthProvider` interface and `UserRepository` interface - never a concrete vendor. `signUp` validates input, checks email uniqueness via `UserRepository`, asks `AuthProvider` to hash the password and mint an `authSubject`, then creates the app-level `User` record. `signIn` asks `AuthProvider` to verify credentials and, on success, issues a session token; on failure (wrong password, unknown email, or a currently-locked-out email) it always throws the same `InvalidCredentialsError`, so a caller can't distinguish "no such account" from "wrong password." `requireUser` is the protected-call helper other domains will eventually call in place of the dev-stub `getStubUserId()`.

---

## Example Flow

A caller runs `authService.signUp({ email: 'jamie@example.com', password: 'first-goal-2026' })` - `LocalAuthProvider` hashes the password with a random salt and mints a UUID `authSubject`; `AuthService` creates a `User` row linking that `authSubject` to the email, `status: 'active'`. The caller then calls `signIn` with the same credentials, gets back `{ user, token, expiresAt }`, and can pass `token` to `requireUser(token)` on any later call to get the same `User` back - until `signOut(token)` or `refreshSession(token)` (which rotates to a new token and invalidates the old one) changes that.

---

## Problems Encountered

No meaningful implementation problems. One deliberate design tension worth recording: Blueprint §4's security rule ("generic error messaging for account discovery risks") argues for identical error behavior on signup duplicate-email and signin failures, but this implementation intentionally throws a distinct `EmailAlreadyInUseError` on signup while keeping signin's `InvalidCredentialsError` fully generic. This isn't an oversight - it's recorded and reasoned through in ADR 0004 as a narrower, common-practice exception (Cognito, Supabase, and Auth0 all reveal duplicate emails at signup) rather than a missed rule.

---

## Decisions Made

- **Local `AuthProvider` adapter, not Supabase, for this milestone** (ADR 0004, user-confirmed): resolves last session's open question. Temporary by design - swapping in a managed provider later means a new `AuthProvider` implementation, not an `AuthService` rewrite.
- **`services/auth` stays server-side only, not isomorphic** (ADR 0004): unlike `services/goals` (ADR 0003), this domain must never run in the browser - password hashing and session issuance are a hard security boundary, not a scope choice. `apps/web` is intentionally untouched this session.
- **Generic sign-in errors, specific signup errors**: sign-in failures are indistinguishable (`InvalidCredentialsError`) to prevent account enumeration via login attempts; signup duplicate-email is revealed specifically, as an accepted, narrower, common-practice exception.
- **Service-level failed-attempt lockout (5/15min) as a stand-in for real rate limiting**: satisfies Blueprint §4's rate-limiting requirement in a way that's testable without an HTTP layer; real IP-based limiting is deferred to the future API layer, where request identity actually exists.
- **Email verification and password reset are out of scope**: both need a transactional email provider, which hasn't been chosen - the same "can't provision an external service from this environment" constraint that applied to Supabase Auth itself.

---

## Files Significantly Changed

- `services/auth/src/authService.ts` - `AuthService`: all seven Blueprint functions, the lockout logic.
- `services/auth/src/authProvider.ts` - `AuthProvider` interface + `LocalAuthProvider`.
- `services/auth/src/passwordHasher.ts` - scrypt-based hashing/verification.
- `services/auth/src/userRepository.ts` - `UserRepository` interface + `InMemoryUserRepository`.
- `services/auth/src/authValidation.ts` - email/password validation rules.
- `packages/contracts/src/user.ts` - `User`, `SignUpInput`, `SignInInput` types.
- `docs/architecture-decisions/0004-*.md` - this session's decisions and their reasoning.

---

## Testing and Validation

**Tested:**
- `npm test` (Vitest, root): 57/57 passing (37 new Auth tests across 5 files, 20 pre-existing Goals tests unaffected) - password hashing (random salt, correct/incorrect verification, malformed-hash handling), email/password validation, `LocalAuthProvider` (credential verification, session issue/verify/expire/revoke, per-subject session revocation, identity deletion), `AuthService` (signup happy path + duplicate email + invalid input, signin happy path + wrong password + unknown email + lockout after 5 attempts + lockout expiry, full session lifecycle including refresh-token rotation, and account deletion including that the freed email can be re-registered), and one integration test running the real, non-mocked signup → signin → requireUser → refresh → signout flow.
- `npm run typecheck` (root and `apps/web`): both clean.

**Not yet tested:** anything involving a real database, an HTTP API layer, cookies/browser session transport, or an actual login screen - none of these exist yet.

---

## Current State

`services/auth` is a complete, real, tested Auth domain usable from server-side code today. It is not connected to anything yet - not `apps/web`, not `services/goals`. The dev-stub user (`getStubUserId()`) is still what `GoalService` callers use; nothing was changed there this session.

---

## Known Issues

**No known issues identified during this session.**

---

## Next Recommended Step

Two clear options, both flagged in ADR 0004:

1. **Build the minimal HTTP API layer** (Blueprint §4's `/auth/signup`, `/auth/login`, `/auth/logout`, `/auth/refresh`, `GET /me`, `DELETE /me`, plus equivalents for Goals) and a session-transport decision (cookies vs. bearer tokens), so `apps/web` can get real login screens and `GoalService` calls can finally move off the dev-stub user onto `requireUser()`. This is the natural next step now that both domains it would expose are real.
2. Alternatively, continue the domain-first pattern into **Onboarding** or **Profile** before building the API layer, deferring the "make it reachable from a browser" work further.

Given Auth is now the last domain blocking most of the Blueprint's remaining build order, option 1 is the stronger candidate, but - consistent with how the Auth-provider choice was handled - this should be confirmed with the user rather than assumed.

---
---

# Better You Development Log — 2026-08-16 (continued)

## Session Overview

Third session of the day. In between, the user ran `/doctor` (Claude Code's own setup health-check, unrelated to the Better You codebase) - it found the install healthy and already on the latest version, trimmed one generic section out of `CLAUDE.md`, and set auto mode as the persistent default permission mode. No project code changed during that pass; noted here only because it touched `CLAUDE.md`, which every session reads.

The user then confirmed option 1 from the previous entry: build the minimal HTTP API layer. This session did that.

---

## Starting Point

`services/auth` and `services/goals` were both real, fully tested, and completely disconnected from each other and from any client - `apps/web`'s dev preview called `GoalService` directly in-browser (the one domain that pattern was ever safe for, per ADR 0003/0004), and nothing called `AuthService` at all outside its own tests.

---

## Goal for This Session

Build `apps/api`: a real HTTP layer exposing Blueprint §4's Auth surface and the subset of Blueprint §7's Goals surface `GoalService` actually implements, with the session-transport decision (cookies vs. bearer tokens) finally made, full HTTP-level test coverage, and a live run against real `curl` requests - without wiring `apps/web` to it yet.

---

## Work Completed

### What Changed

- Added `apps/api` (Express 5) as a new npm workspace: `src/server.ts` (`createServer(deps?)` factory), `src/index.ts` (real startup), `src/routes/{auth,me,goals}.ts`, `src/middleware/{requireAuth,errorHandler}.ts`, `src/{errors,validation,token}.ts`.
- Routes: `POST /api/v1/auth/{signup,login,logout,refresh}`, `GET|DELETE /api/v1/me`, `GET|POST /api/v1/goals` - all versioned, all behind `requireAuth` except signup/login/logout.
- A consistent JSON error envelope (`{ error: { code, message, field? } }`) mapping every domain error type to an HTTP status, plus malformed-JSON-body handling - never leaking internal error details on unrecognized errors (logged server-side, generic 500 to the client).
- Registered `@better-you/api` as a path alias (root `tsconfig.json`/`vitest.config.ts`), mirroring the existing pattern, so integration tests can import `createServer` directly.
- Added `tests/integration/api.integration.test.ts` (13 tests, using `supertest` against the real Express app instance - no network binding needed) plus a live smoke test: started the actual dev server (`npm run dev:api`) and ran real `curl` requests through the full signup → login → me → create-goal → list-goals → refresh → logout → me(401) flow.
- Recorded ADR 0005.

### Why It Changed

This was the explicit blocker both previous sessions' journals flagged: Auth and Goals were both real but unreachable together from any client. Blueprint §4/§7 already specify the exact route surface; the only genuinely open question was session transport, which ADR 0004 deferred.

### How It Works

`createServer(deps = createDefaultDependencies())` builds an Express app wired to whichever `AuthService`/`GoalService` instances it's given - real startup takes the default (one shared in-memory instance for the process), tests pass a fresh pair per test so state never bleeds between tests, the same reasoning already applied to every repository in this codebase. `requireAuth` is a middleware factory that pulls the bearer token, calls `authService.requireUser(token)`, and attaches `req.user`; every goals route and `/me` route runs behind it. `POST /api/v1/goals` always derives `userId` from `req.user.id`, never from the request body - verified with a test that sends a spoofed `userId` and confirms it's ignored.

---

## Example Flow

`curl -X POST http://localhost:4000/api/v1/auth/signup -d '{"email":"jamie@example.com","password":"first-goal-2026"}'` → `201` with the created user. `POST /api/v1/auth/login` with the same credentials → `200` with `{ user, token, expiresAt }`. `POST /api/v1/goals -H "Authorization: Bearer <token>" -d '{"category":"fitness","source":"suggested","suggestedGoalId":"fitness-shape"}'` → `201` with the saved goal, `userId` set to the authenticated user regardless of what the client sends. `GET /api/v1/goals` with the same token → the saved goal back. All of this was run for real against the live dev server, not just asserted in tests.

---

## Problems Encountered

One minor process note, not a code problem: the first live `curl` smoke-test of `GET /api/v1/me` returned a 404 HTML error page. Investigation showed the test script itself built the URL as `$BASE/../me` (intended as a sibling-path shortcut), which resolved to `/api/me` instead of `/api/v1/me` - a bug in the ad hoc shell test, not in the server. Rewriting the script to build the URL directly (`$BASE/me` from an `/api/v1` base) confirmed `/me` works correctly.

---

## Decisions Made

- **Express 5, not raw `http` or another framework** (ADR 0005): native async/await error handling (no manual `try/catch`-to-`next()` wrapper needed in most cases, though route handlers here still wrap explicitly for clarity) for a handful of routes; avoids hand-rolling routing/JSON parsing.
- **Bearer tokens over cookies** (ADR 0005, resolves ADR 0004's deferred question): simpler CORS/CSRF story for a first pass. Explicitly flagged as revisit-before-production, not a final call - httpOnly cookies would resist XSS token theft better.
- **`apps/web` stays untouched this session**: wiring it to real login (replacing `goalClient.ts`'s direct `GoalService` calls with `fetch`, adding signup/login screens, deciding where the token lives in client state) is a distinct, more involved follow-up - kept separate rather than growing this session's scope.
- **Client-supplied `userId` is silently ignored, not rejected**, on `POST /api/v1/goals` - friendlier than erroring on an extra field while remaining fully safe, since the real value always comes from the verified session.

---

## Files Significantly Changed

- `apps/api/src/server.ts` - `createServer(deps?)`, the route/middleware wiring.
- `apps/api/src/routes/{auth,me,goals}.ts` - the route handlers.
- `apps/api/src/middleware/{requireAuth,errorHandler}.ts` - auth gate and error-envelope mapping.
- `tests/integration/api.integration.test.ts` - the 13 HTTP-level tests.
- `docs/architecture-decisions/0005-*.md` - this session's decisions and reasoning.

---

## Testing and Validation

**Tested:**
- `npm test` (root): 70/70 passing (13 new API tests; 57 pre-existing Auth/Goals tests unaffected) - signup (happy path, duplicate email, missing field, invalid email, malformed JSON body), login (happy path, wrong password, unknown email), `/me` (no token, bad token, valid token), refresh (rotation, old token invalidated), logout (revokes session, succeeds even with no token), account deletion (revokes access, frees email for re-signup), goals (requires auth, suggested + custom creation, spoofed-`userId` ignored, required-field and bad-`source` validation, active-goal-limit enforcement, cross-user list isolation).
- `npm run typecheck` (root, `apps/api`, `apps/web`): all clean.
- Live smoke test against the actual running dev server (`npm run dev:api`) with real `curl` requests, not just `supertest`: signup → login → me → create suggested goal → list goals → refresh → logout → me (confirmed 401 after logout). All correct.

**Not yet tested:** `apps/web` calling this API (not wired yet), a real database, cookie-based sessions, rate limiting at the network/IP level (still just the service-level per-email lockout from ADR 0004).

---

## Current State

`apps/api` is a complete, real, tested HTTP layer over both domains, verified against a live server with real HTTP requests. It was left running (`http://localhost:4000`) at the end of the session, the same way `apps/web`'s dev server was left running in an earlier session. `apps/web` still uses the dev-stub user and calls `GoalService` directly - nothing about it changed this session.

---

## Known Issues

**No known issues identified during this session.**

---

## Next Recommended Step

Wire `apps/web` to `apps/api`: replace `goalClient.ts`'s direct `GoalService`/`InMemoryGoalRepository` calls with `fetch` calls against the new API, add real signup/login screens, and decide where the bearer token lives in client state (in-memory, not `localStorage`, to limit XSS exposure - ADR 0005 flags this but doesn't decide it). This is the step that finally retires `getStubUserId()` from the browser-facing path.

---
---

# Better You Development Log — 2026-08-16 (continued, 3rd)

## Session Overview

Fourth session of the day. First, completed the previous entry's recommended step: wired `apps/web` to `apps/api` for real (signup/login screens, bearer token in React state, `GoalService` calls replaced with `fetch`), verified live in a real browser. Then built the **Profile domain** (Blueprint §5) end-to-end, including wiring it into `apps/api` - the user's explicit next choice over finishing the Goals lifecycle or building full Onboarding.

Also discovered mid-session that this repository now has real git history and a GitHub remote (`origin` → `Afeaneku02/DevelopmentApp`, branch `goal-creation-core`) that wasn't there in earlier sessions - one commit exists, capturing only the original Goal Creation Core state. Everything since (Auth, the API layer, today's `apps/web` rewiring, and Profile) is still uncommitted. Flagged to the user; not committed without being asked.

---

## Starting Point

`apps/api` existed and was fully tested, but `apps/web` still used the `DEV_USER_ID` stub and called `GoalService` directly in-browser - none of the real Auth/API work was reachable from the UI yet.

---

## Goal for This Session

Two goals, done in order: (1) make `apps/web` a real client of `apps/api` - sign up, sign in, create goals, sign out, all over HTTP - and (2) build the Profile domain per Blueprint §5, wired into `apps/api`, following Vision §5.1's entry sequence (account → consent → **profile** → onboarding depth → interaction method).

---

## Work Completed

### What Changed

**apps/web → apps/api wiring:**
- Added `apps/web/src/api/{config,client,authApi,goalsApi}.ts` - a typed `fetch` wrapper (`ApiError` mirrors the API's error envelope) and thin per-domain wrappers.
- Added `apps/web/src/auth/AuthContext.tsx` - session state (`user`, `token`) in React state only, never `localStorage`.
- Added `AuthScreen` (sign up/sign in, toggling mode) and rewrote the old `App.tsx` content into `GoalsScreen` (same UI, now calling `goalsApi` instead of `GoalService` directly), plus a sign-out button showing the real signed-in email.
- Deleted `goalClient.ts` and the `@better-you/config` alias from `apps/web` - the dev-stub user is fully retired from the browser.
- Verified live: real browser (temporary Playwright, `chromium-cli`/`claude-in-chrome` still unavailable) driven through sign-up → sign-in → create a suggested goal → sign out, against the actual running `apps/api` and `apps/web` dev servers. Screenshots confirmed correct rendering at each step; 0 console errors.

**Profile domain:**
- `packages/contracts/src/profile.ts` - `Profile`, `ProfilePreferences` (`onboardingMode`, `interactionMethod`), `UpdateProfileInput`.
- `services/profile` - `ProfileService.getProfile()`/`updateProfile()` (lazy default-creation on first access, no separate create step, matching Blueprint §5's own function list), `ProfileRepository`/`InMemoryProfileRepository`, `profileValidation.ts` (display name, timezone, locale, preferences).
- Wired into `apps/api`: `GET/PATCH /api/v1/profile`, both behind `requireAuth`, plus `ProfileValidationError` added to the error-envelope mapping.
- Fixed a real bug found by the domain's own tests: `Intl.supportedValuesOf('timeZone')` doesn't include `'UTC'` - our own default value failed our own validator. Switched to constructing `Intl.DateTimeFormat` and catching its `RangeError`, which correctly accepts `'UTC'`. Recorded as a lesson.
- Verified live against the running `apps/api` dev server (`tsx watch` picked up the changes automatically): default profile on first `GET`, a `PATCH` with a partial preference update correctly merging rather than replacing, and an invalid-timezone `PATCH` correctly rejected with `400`.
- Recorded ADR 0006.

### Why It Changed

The `apps/web` wiring closed out the arc the last several sessions had been building toward - real, disconnected pieces becoming one working product path. Profile came next because Vision §5.1's entry sequence puts it immediately after account creation, and because it was a small, well-scoped domain with no architectural fork requiring a pause - unlike Auth's provider choice.

### How It Works

`ProfileService.getProfile(userId)` checks `ProfileRepository` and, if nothing exists yet, creates and persists a profile with explicit defaults (`displayName: ''`, `timezone: 'UTC'`, `locale: 'en-US'`, `preferences: { onboardingMode: 'guided_middle_ground', interactionMethod: 'typed' }`) before returning it - so a client can always `GET /profile` right after signing in and get something real back, with no separate "create my profile" step. `updateProfile()` validates only the fields actually provided, and merges `preferences` shallowly so an update to one preference key never clobbers another untouched one.

---

## Example Flow

A newly signed-up user's client calls `GET /api/v1/profile` and gets back the default profile immediately - no error, no null. They then `PATCH /api/v1/profile` with `{ "preferences": { "onboardingMode": "dive_in" } }`; the response shows `onboardingMode: "dive_in"` alongside the still-default `interactionMethod: "typed"`, which was never touched. A later `PATCH` with `{ "timezone": "Not/AZone" }` comes back `400 VALIDATION_ERROR` with `field: "timezone"`.

---

## Problems Encountered

### Problem

`services/profile`'s own test suite failed immediately: `validateProfileUpdate` threw `unknown IANA timezone: UTC` on a payload containing `timezone: 'UTC'` - the exact default value the domain itself chooses.

### Investigation

Confirmed directly in a Node REPL: `Intl.supportedValuesOf('timeZone').includes('UTC')` is `false`, and so is `.includes('Etc/UTC')`, while `new Intl.DateTimeFormat('en-US', { timeZone: 'UTC' })` succeeds without error.

### Root Cause

`Intl.supportedValuesOf('timeZone')` enumerates the IANA time zone database; `'UTC'` is a separately-recognized special identifier under ECMA-402, not an IANA zone name, so it's absent from that enumeration despite being fully valid input to any timezone-accepting `Intl` constructor.

### Solution

Rewrote `validateTimezone()` to construct `new Intl.DateTimeFormat('en-US', { timeZone: value })` inside a `try`/`catch`, treating the `RangeError` a genuinely invalid zone throws as the validation failure, instead of checking `Set` membership against `supportedValuesOf('timeZone')`.

### Why the Solution Works

Construction-based validation asks the same question `Intl` itself answers when actually using a timezone value, rather than relying on a separate enumeration API whose purpose (list known IANA zones) turned out not to match the need (accept everything `Intl` considers valid).

---

## Decisions Made

- **Profile has no `createProfile()` / creation endpoint** (ADR 0006): lazy default-creation on first `getProfile()`/`updateProfile()` call, matching Blueprint §5's own function list, which never names a create step.
- **Concrete, Vision-grounded preference fields, not an open JSON blob** (ADR 0006): `onboardingMode` and `interactionMethod`, both taken directly from Vision §5.2, even though Blueprint's own core-data naming (`preferences_json`) reads as an invitation to leave it untyped. An untyped blob would make "preferences have explicit defaults" unenforceable.
- **`buildSafeProfileContext()` deferred**: Blueprint §5 names it as an AI touchpoint, but there's no AI integration and no defined "safe" boundary to build it against yet - same reasoning as every other AI-adjacent deferral so far (ADR 0002, ADR 0004).
- **Profile wired into `apps/api` in the same milestone**, unlike Auth's domain-then-API split: there was no architectural fork here, just a small extension of infrastructure that already existed and was already tested.
- **Timezone validation via `Intl.DateTimeFormat` construction, not `Intl.supportedValuesOf`**: see Problems Encountered / the dedicated lesson file.

---

## Files Significantly Changed

- `apps/web/src/api/*`, `apps/web/src/auth/AuthContext.tsx`, `apps/web/src/screens/{AuthScreen,GoalsScreen}.tsx` - the real API-wired frontend.
- `services/profile/src/profileService.ts`, `profileValidation.ts`, `profileRepository.ts` - the Profile domain.
- `apps/api/src/routes/profile.ts`, and `server.ts`/`middleware/errorHandler.ts` updated to wire it in.
- `docs/architecture-decisions/0005-*.md`, `0006-*.md`.
- `docs/development-journal/lessons-learned/2026-08-16-intl-supportedvaluesof-timezone-excludes-utc-lesson.md`.

---

## Testing and Validation

**Tested:**
- `npm test` (root): 101/101 passing (18 new Profile tests across 3 files: validation, service, integration; API integration suite grew from 13 to 18 with the new `profile` describe block). `apps/web`/`apps/api`/root typecheck all clean.
- Live browser verification of the `apps/web` ↔ `apps/api` wiring (temporary Playwright): full sign-up → sign-in → create-goal → sign-out flow, 0 console errors, screenshots confirmed.
- Live `curl` verification of the new profile endpoints against the running `apps/api` dev server (auto-reloaded via `tsx watch`): default profile on first access, partial-preference-merge on update, and a rejected invalid timezone.

**Not yet tested:** a profile screen in `apps/web` (doesn't exist), `onboardingCompletedAt` (field exists in the type but nothing sets it yet - there's no Onboarding flow to complete).

---

## Current State

Auth, Goals, Profile, and the API layer exposing all three are real, tested, and (for Auth/Goals) reachable from a real signed-in browser session. Profile is reachable via the API but has no UI yet. The repository has real git history with a GitHub remote, but only one old commit - everything from this and the last two sessions is uncommitted.

---

## Known Issues

- Uncommitted work spans three sessions (Auth, API layer, `apps/web` rewiring, Profile) on top of one old commit. Flagged to the user; awaiting a decision on whether to commit.
- The local branch's upstream tracking looks stale (`based on 'origin/master', but the upstream is gone`) despite `origin/goal-creation-core` existing and presumably being the real target - not investigated further this session since no git operations were requested.

---

## Next Recommended Step

Either: (a) add a profile screen to `apps/web` (now that the backend fully supports it) so a user can actually set their display name/timezone/preferences instead of only ever seeing lazy defaults, or (b) finish the Goals lifecycle (`pause`/`resume`/`complete`/`archive`/history), still deferred since ADR 0002. Separately, and not blocking either: resolve the uncommitted-work situation and the stale upstream-tracking config.

---
---

# Better You Development Log — 2026-08-16 (continued, 4th)

## Session Overview

Fifth session of the day. Built option (a) from the previous entry: a real Profile screen in `apps/web`. Unlike every prior screen, this one went through the `better-you-visual-designer` skill first - it's the first screen in the app that's actually *designed* rather than a functional dev-preview placeholder.

---

## Starting Point

`GET/PATCH /api/v1/profile` existed and was fully tested from the previous session, but nothing in `apps/web` called it - a user could never see or edit their own profile. `AuthScreen` and `GoalsScreen` both used a bare, single-accent-color, unstyled look with no real relationship to Better You's intended product identity.

---

## Goal for This Session

Design and build a real Profile screen: view/edit display name, timezone, locale, and the two preference enums, with clear save feedback and field-level validation-error display - and use this as the occasion to introduce an actual visual design system, since it was flagged last session as worth doing properly rather than extending the dev-preview look again.

---

## Work Completed

### What Changed

- Invoked the `better-you-visual-designer` skill for direction before writing any code (see Decisions Made for the chosen direction).
- Introduced real design tokens in `apps/web/src/styles.css`: CSS custom properties for Sky Mode (light) and Midnight Mode (dark, via `prefers-color-scheme: dark`) - background/surface/text/border colors, a sky-blue accent scale, semantic success/error/warning colors, and two font-family tokens (a Georgia-based serif for display headings, the existing system-sans for body).
- Added `apps/web/src/screens/ProfileScreen.tsx`: sectioned form (Identity / Locale & time / How Better You learns about you / How you'll interact with Better You), a signature "horizon band" gradient element at the top, native `<select>` for timezone (IANA list, with `'UTC'` added back in - see Problems Encountered) and a curated locale list, and description-cards (reusing `GoalsScreen`'s existing suggested-goal-card pattern) for the two preference enums, with `guided_middle_ground` marked "Recommended" per Vision §5.2.
- Added `apps/web/src/api/profileApi.ts` (thin `getProfile`/`updateProfile` wrappers, same pattern as `authApi`/`goalsApi`).
- Added simple view-state navigation (`App.tsx`'s `view: 'goals' | 'profile'`) and a "Profile" button in `GoalsScreen`'s header, next to "Sign out."
- Lightly retrofitted `AuthScreen`/`GoalsScreen`'s hardcoded hex colors onto the new tokens (so the whole app shares one palette and gets Midnight Mode for free) without touching their layout - a full redesign of those screens stays explicitly out of scope.
- Verified live in a real (temporary-Playwright) browser, in **both** Sky and Midnight mode: loaded the default (empty) profile, edited every field, saved successfully, triggered a validation error (empty display name), and navigated back to Goals - all screenshotted and visually reviewed in both themes.
- Recorded ADR 0007.

### Why It Changed

The user's own framing of "build the profile screen" (after I'd flagged it as a chance to actually design something, rather than extend the bare dev-preview pattern a third time) made this the right moment to introduce a real design system rather than defer it further, since every additional bare screen built first would mean more retrofit work later.

### How It Works

`ProfileScreen` loads the current profile via `GET /api/v1/profile` on mount (always succeeds with defaults - Blueprint §5's lazy-creation behavior from last session), populates local form state, and on submit calls `PATCH /api/v1/profile` with the full set of editable fields. A field-level `ApiError` (the API's `{ error: { code, message, field } }` envelope, already built in `apps/web/src/api/client.ts`) is mapped directly under the relevant input; a non-field error (rare, since almost every failure here is a validation error) shows as a general message near the Save button.

---

## Example Flow

A user clicks "Profile" from the Goals screen, sees their display name blank and timezone defaulted to UTC (not an error state - Blueprint §5's intended lazy-default behavior, now visibly correct rather than just tested). They set their name, pick a real timezone from the dropdown, select "Gradual" onboarding and "Voice" interaction (seeing the "not yet available" note under Voice), and save - the screen reflects the saved state and shows "Saved." If they then clear the display name and try to save again, the field itself shows "displayName cannot be empty" directly under the input, sourced from the API's real validation error, not a client-side guess.

---

## Problems Encountered

Reused, client-side, the same `Intl.supportedValuesOf('timeZone')`-excludes-`'UTC'` gap discovered in the previous session's backend work (see that session's lesson file) - the timezone `<select>`'s option list explicitly prepends `'UTC'` rather than relying on the enumeration alone, with a comment pointing back to the lesson. No new investigation needed since the root cause was already understood; this is a second application of an already-recorded lesson, not a new one.

---

## Decisions Made

- **Visual direction: calm editorial, Sky Mode** (ADR 0007) - reflective/personal screens read differently from action screens; generous spacing, warm sky-blue palette, a Georgia-based serif for display headings (reliable, zero network dependency) paired with the existing system-sans body font.
- **Signature element: one restrained "horizon band"** gradient strip, used once at the top of the screen, not repeated - per the visual-designer skill's explicit guidance against overusing a motif.
- **Midnight Mode via `prefers-color-scheme`, no manual toggle UI yet**: real dark-mode support for close to zero extra implementation cost, while deferring the actual settings-screen toggle control as a distinct, separately-scoped feature.
- **Token-based color system introduced app-wide**; `AuthScreen`/`GoalsScreen` retrofitted onto the tokens (not redesigned) so the app reads as one consistent product and gets Midnight Mode for free, without expanding this milestone into a full existing-screen redesign.
- **Deliberate control-type choices, not defaulted to raw text inputs**: timezone as a real `<select>` (not free text a user could mistype), locale as a curated list rather than an exhaustive database or free text, and the two preference enums as description-cards (reusing an existing interaction pattern from `GoalsScreen`) rather than opaque dropdown option labels, since each option carries real Vision-sourced meaning.
- **No routing library added**: three screens doesn't yet justify `react-router-dom`; simple `App.tsx` view-state switching is enough until a multi-step flow (Onboarding) actually needs URL-addressable routes.

---

## Files Significantly Changed

- `apps/web/src/screens/ProfileScreen.tsx` - the new screen.
- `apps/web/src/styles.css` - design tokens (Sky/Midnight), horizon band, option-card, and profile-page styles; light retrofit of existing screens onto the tokens.
- `apps/web/src/api/profileApi.ts` - API client wrapper.
- `apps/web/src/App.tsx`, `apps/web/src/screens/GoalsScreen.tsx` - view-state navigation and the new "Profile" header button.
- `docs/architecture-decisions/0007-*.md`.

---

## Testing and Validation

**Tested:**
- `npm run typecheck -w apps/web`: clean. `npm test` (root): unaffected, still 101/101 (no backend changes this session).
- Live browser verification (temporary Playwright, real Chromium) in both Sky and Midnight mode: sign-up → sign-in → open Profile → default-state screenshot → edit every field and save → screenshot confirming "Saved." and the merged state → clear display name and re-save → screenshot confirming the field-level validation error renders correctly → navigate back to Goals → screenshot confirming the retrofitted `GoalsScreen` header (including the new "Profile" button) renders correctly in both themes. All screenshots visually reviewed, not just asserted programmatically.

**Not yet tested:** a manual theme-toggle control (doesn't exist), the "Other" locale free-text escape hatch (doesn't exist yet), a real user actually using this repeatedly across sessions (no persistence beyond the in-memory backend).

---

## Current State

`apps/web` now has three screens - Auth, Goals, Profile - all reachable, all backed by the real API, all working correctly in both Sky and Midnight mode. Profile is the first screen with real, considered visual design rather than a functional placeholder; Auth and Goals share its color tokens but not its layout polish.

---

## Known Issues

- `AuthScreen`/`GoalsScreen` are visually a generation behind `ProfileScreen` now - intentional per ADR 0007, but worth eventually revisiting so the app doesn't read as two different products stitched together.
- The uncommitted-work situation and stale upstream-tracking config from prior sessions remain unresolved - still not acted on without being asked.

---

## Next Recommended Step

Either: (a) bring `AuthScreen`/`GoalsScreen` up to the same visual standard as `ProfileScreen` (closing the "two different products" gap), or (b) finish the Goals lifecycle (`pause`/`resume`/`complete`/`archive`/history), still deferred since ADR 0002. Separately: the uncommitted-work/git-config situation is now four sessions deep and probably worth resolving soon regardless of which feature work comes next.

---
---

# Better You Development Log — 2026-08-16 (continued, 5th)

## Session Overview

Sixth session of the day. Two things happened. First, the user clarified the uncommitted-work situation flagged across the last several entries: they and Codex had already committed and pushed the Auth/API/web-integration work themselves (commit `774e6cf`, branch `auth-api-web-integration`, pushed to `origin`) - confirmed by a read-only `git fetch`/`status`/`log` check. The user asked to stop tracking git/commit state as a concern going forward and just focus on implementation; that preference is now saved to memory rather than repeated in these entries. Second, did option (a) from the previous entry: brought `AuthScreen` and `GoalsScreen` up to the same visual standard as `ProfileScreen`, closing the gap ADR 0007 explicitly flagged.

---

## Starting Point

`ProfileScreen` had real design tokens, a horizon-band signature element, and an `.option-card` pattern (ADR 0007). `AuthScreen`/`GoalsScreen` had only been retrofitted onto the color tokens - same bare layout as the original dev-preview.

---

## Goal for This Session

Apply the established design system to `AuthScreen` and `GoalsScreen` without changing their behavior, verify nothing broke via a full live browser walkthrough (sign up → sign in → create a suggested goal → create a custom goal → open Profile) in both Sky and Midnight mode, then move on to the Goals lifecycle next.

---

## Work Completed

### What Changed

- Invoked `better-you-visual-designer` again for direction specific to these two screens (see Decisions Made).
- `apps/web/src/styles.css`: added a `--shadow-card` token (redefined per theme, since flat shadows barely read on dark backgrounds), a `fadeInUp` keyframe, gave `.goals li` real depth (shadow + entrance animation) and `.option-card` a hover-lift + shadow, removed the now-redundant `.suggested`/`.suggested button` rules entirely, added `.category-detail h3` and `.auth-page .horizon-band` sizing rules.
- `AuthScreen.tsx`: added the horizon-band element at the top of the page - the only other screen besides Profile to use it, deliberately (see Decisions Made).
- `GoalsScreen.tsx`: suggested-goal buttons now render as `.option-card`s (identical markup pattern to `ProfileScreen`'s preference pickers) instead of the old bespoke `.suggested` list markup.
- Verified live in a real browser (temporary Playwright), both Sky and Midnight mode, across all three screens in one continuous flow: Auth → sign up → sign in → Goals (empty) → pick Fitness → suggested-goal cards → create one → create a custom one → open Profile. 0 console errors in both themes; every screenshot visually reviewed.
- Caught and correctly diagnosed a false alarm: a screenshot taken immediately after adding a second goal showed it faded/washed-out. A follow-up screenshot with an extra 600ms wait showed it fully settled and normal - the first screenshot had simply caught the new 250ms entrance animation mid-flight, not a rendering bug. Recorded in ADR 0008 as a note for future browser-verification scripts on this screen.
- Recorded ADR 0008.

### Why It Changed

The user asked for visual parity to come before the Goals lifecycle work, closing the gap ADR 0007 had explicitly flagged as the natural next thing to fix, so the app stops reading as two different products stitched together.

### How It Works

`.option-card` and `.goals li` both draw from the same `--shadow-card` token and share hover/selection treatment, so a user recognizes "pick one of these" as the same pattern whether they're choosing a suggested goal or a preference. The horizon band's CSS (`margin: 0 -1.25rem ...` extending edge-to-edge within a padded container) worked identically inside `.auth-page`'s narrower container as it did in `.profile-page`, since both use the same `1.25rem` side padding - no new CSS needed beyond a size override for the taller auth variant.

---

## Example Flow

A new user's very first screen (`AuthScreen`) now opens with the same horizon-band moment `ProfileScreen` uses - establishing the "where I am → where I want to be" visual language before they've even created an account. Once signed in, picking a category and browsing suggested goals now feels identical (same card shape, same hover behavior, same shadow) to later picking a preference on the Profile screen - one visual language across the whole app instead of the original screen visually announcing itself as a placeholder.

---

## Problems Encountered

No real problems - the "faded goal card" false alarm (see What Changed) was investigated and resolved by confirming it was a screenshot-timing artifact, not application behavior, without needing a code change.

---

## Decisions Made

- **Horizon band on `AuthScreen` only, not `GoalsScreen`** (ADR 0008): reserved for the genuine first-impression/threshold screen; giving it to a repeatedly-visited working screen too would dilute it from signature to wallpaper, per the visual-designer skill's explicit anti-overuse guidance.
- **Unify `GoalsScreen`'s suggested-goal buttons onto `.option-card`**, deleting the near-duplicate `.suggested` CSS - same interaction pattern, now genuinely the same component treatment, not just visually similar.
- **No new "everything in a card" wrapper pattern.** Matched what `ProfileScreen` actually does (only individual selectable items are elevated; sections themselves sit on the plain page background) rather than inventing a heavier pattern.
- **One motion moment added**: new-goal entrance animation, matching the visual-designer skill's own example of meaningful, worthwhile motion - not motion for its own sake.
- **Git/commit state is no longer tracked as an open item in these entries** (see Session Overview) - per the user's explicit instruction, now saved to memory.

---

## Files Significantly Changed

- `apps/web/src/styles.css` - shared shadow/animation tokens, `.option-card` unification, `.suggested` rules removed.
- `apps/web/src/screens/AuthScreen.tsx` - horizon band added.
- `apps/web/src/screens/GoalsScreen.tsx` - suggested-goal markup unified onto `.option-card`.
- `docs/architecture-decisions/0008-*.md`.

---

## Testing and Validation

**Tested:**
- `npm run typecheck -w apps/web`: clean. `npm test` (root): unaffected, 101/101 (no backend changes).
- Live browser verification (temporary Playwright, real Chromium), both Sky and Midnight mode, full continuous flow across all three screens: 0 console errors, every screenshot visually reviewed. One follow-up screenshot specifically to confirm the entrance-animation false alarm wasn't a real defect.

**Not yet tested:** nothing new architecturally - this was a visual-only change to already-tested, already-wired screens.

---

## Current State

All three `apps/web` screens (Auth, Goals, Profile) now share one consistent design language - tokens, card treatment, typography, and one deliberate use of the signature horizon motif. The app no longer reads as mismatched screens from different eras.

---

## Known Issues

**No known issues identified during this session.**

---

## Next Recommended Step

Finish the Goals lifecycle (`pause`/`resume`/`complete`/`archive`/history), deferred since ADR 0002 - the user's stated next task after visual parity.

---
---

# Better You Development Log — 2026-08-16 (continued, 6th)

## Session Overview

Seventh session of the day, and likely the last of this run: finished the Goals lifecycle - the last explicitly-deferred piece of the Goals domain from ADR 0002 (`pause`/`resume`/`complete`/`archive`, editing, and history), end to end: domain logic, API routes, and `apps/web` UI, verified live.

---

## Starting Point

`GoalService` only supported `createGoal`/`listGoals`; `GoalStatus` was a single-value type (`'active'`). No state machine, no history, no way to edit a goal or change its status once created, in the domain, the API, or the UI.

---

## Goal for This Session

Implement the full lifecycle per Blueprint §7: an enforced status state machine, an append-only history log, `getGoal`/`updateGoal` with owner-only access, all four transition actions, wire it all into `apps/api`, then update `apps/web`'s `GoalsScreen` with status badges, action buttons, and inline editing - verified live in a real browser.

---

## Work Completed

### What Changed

- `packages/contracts/src/goal.ts`: `GoalStatus` expanded to `'active' | 'paused' | 'completed' | 'archived'`; added `UpdateGoalInput`, `GoalEventType`, `GoalHistoryEvent`.
- `services/goals`: new `goalStateMachine.ts` (`canTransition`), new `goalHistoryRepository.ts` (`GoalHistoryRepository`/`InMemoryGoalHistoryRepository`), `goalRepository.ts` gained `findById`/`update`, `goalValidation.ts` gained `validateUpdateGoalInput`, `errors.ts` gained `GoalNotFoundError`/`InvalidGoalTransitionError`. `GoalService` gained `getGoal`, `updateGoal`, `pauseGoal`, `resumeGoal`, `completeGoal`, `archiveGoal`, `getGoalHistory`, and now takes a `GoalHistoryRepository` + optional injectable clock in its constructor (updated every construction site: `apps/api/src/server.ts`, both `tests/integration` files, the domain's own unit tests).
- `apps/api`: `GET/PATCH /api/v1/goals/:id`, `POST /api/v1/goals/:id/{pause,resume,complete,archive}`, `GET /api/v1/goals/:id/history` - all owner-scoped via `requireAuth` + `getGoal`'s ownership check. `errorHandler.ts` gained `GoalNotFoundError` → 404 and `InvalidGoalTransitionError` → 409.
- `apps/web`: `goalsApi.ts` gained the matching client wrappers; `GoalsScreen.tsx` now shows a status badge per goal, status-appropriate action buttons (derived from the same transition rules as the backend, so the UI never offers an action the API would reject), an inline edit form (title/description/category), and fixed a real bug - the active-goal count and 3-goal-limit check were counting *all* goals regardless of status, not just active ones.
- `styles.css`: `.status-badge` (four color variants), `.goal-actions`, `.goal-edit-form`, `.is-archived` (muted opacity for archived cards) - all built from tokens already established, no new design-system work needed.
- Verified live in a real browser (temporary Playwright): created two goals, paused one, edited its title while paused, resumed it, completed it, archived it, then created two more goals to hit the 3-active-goal limit while a 4th (archived) goal was also present - confirming the limit correctly counted only the 3 active ones. 0 console errors, every screenshot visually reviewed.
- Recorded ADR 0009.

### Why It Changed

This was the explicit next task after visual parity, and the last piece of Blueprint §7 still marked deferred - closing it out means the Goals domain is now complete end to end rather than creation-only.

### How It Works

`GoalService.transition()` is a single private helper all four public transition methods (`pauseGoal`, etc.) call through: it re-fetches the goal with an ownership check, asks `canTransition(currentStatus, targetStatus)`, and only then persists the new status and records a history event - so the state machine can't be bypassed no matter which public method is called. `updateGoal()` deliberately has no `status` field in its input type at all, so status changes are only ever possible through the dedicated transition methods, not a generic edit.

---

## Example Flow

A user pauses "Get in better shape," edits its title to "Get in great shape" while it's paused, resumes it, completes it, and archives it - six history events in order (`created`, `paused`, `updated`, `resumed`, `completed`, `archived`) are recorded, fully queryable via `GET /api/v1/goals/:id/history`, even though nothing in the UI shows that history yet. Meanwhile the "Active goals (X/3)" counter on the main screen only ever reflects goals still in `active` status - completing or archiving a goal immediately frees a slot for a new one.

---

## Problems Encountered

No implementation problems. The active-goal-count bug (see What Changed) was a genuine defect caught during UI verification, not during backend testing - the backend's own `countActiveByUser` was correct from the start, but `apps/web` had independently (and incorrectly) reimplemented "how many goals count toward the limit" using `goals.length` instead of filtering by status. It only became visibly wrong once a real browser session actually had a completed/archived goal sitting alongside active ones - exactly the kind of thing backend unit tests alone wouldn't have caught, since they don't exercise the frontend's separate count logic.

---

## Decisions Made

- **State machine matches Blueprint §7's action list exactly** (ADR 0009): no "unarchive"/"reopen" transition exists because Blueprint never names one; `archived` is terminal, `completed` can only move to `archived`.
- **History is a separate, append-only store** with no update/delete method - immutability is structural, not just a convention.
- **`GoalNotFoundError` covers both "doesn't exist" and "not yours"** - same enumeration-avoidance reasoning as Auth's generic sign-in error.
- **Status changes are only possible through the dedicated transition methods**, never through `updateGoal`'s generic edit - `UpdateGoalInput` has no `status` field at all.
- **No history UI this session** - Blueprint §7 itself marks "history view" as `later`, distinct from goal list/editor/status actions, which are not deferred.
- **No new visual-design work** - the new UI elements (badges, action buttons, edit form) all reuse the token/pattern system from ADR 0007/0008 rather than inventing anything.

---

## Files Significantly Changed

- `services/goals/src/goalService.ts` - all seven new/changed methods, the shared `transition()` helper.
- `services/goals/src/goalStateMachine.ts`, `goalHistoryRepository.ts` - new.
- `apps/api/src/routes/goals.ts` - six new routes.
- `apps/web/src/screens/GoalsScreen.tsx` - status badges, actions, inline edit, the count-bug fix.
- `apps/web/src/styles.css` - status-badge/goal-actions/edit-form styles.
- `docs/architecture-decisions/0009-*.md`.

---

## Testing and Validation

**Tested:**
- `npm test` (root): 132/132 passing (25 `GoalService` unit tests including a full lifecycle-transition matrix, 5 new `goalStateMachine` unit tests, 1 new backend lifecycle integration test, 6 new API-level lifecycle integration tests - ownership denial, 404s, invalid-transition 409s, the full pause→resume→complete→archive→history walk, and the paused-goal-doesn't-count-toward-the-limit case). `npm run typecheck` clean across root, `apps/api`, `apps/web`.
- Live browser verification (temporary Playwright, real Chromium): full lifecycle walk through the actual UI - create, pause, edit, resume, complete, archive, then hit the 3-active-goal limit with an archived goal also present. 0 console errors, every screenshot visually reviewed.

**Not yet tested:** a history view in `apps/web` (doesn't exist - deferred per Blueprint §7 itself), Midnight-mode screenshots of the new status badges/actions specifically (verified in Sky mode only this session; the underlying tokens are shared with already-Midnight-tested components, so risk is low, but not directly confirmed).

---

## Current State

The Goals domain is now complete end to end per Blueprint §7, except for the history UI (explicitly deferred) and AI-assisted goal clarification (explicitly out of MVP scope per ADR 0002). A user can create, edit, pause, resume, complete, and archive goals, all through a real UI backed by a real API, with full audit history recorded server-side.

---

## Known Issues

- New status-badge/goal-action UI wasn't specifically screenshotted in Midnight Mode this session (see Testing and Validation) - low risk given shared tokens, but worth a quick visual check next time that part of the UI is touched.

---

## Next Recommended Step

With Auth, Goals (including full lifecycle), Profile, and the API layer all complete, the next domain per the Blueprint's build order is either **Onboarding** (Blueprint §6 - the actual guided first-run flow, still only implicitly covered by "sign up then go straight to an empty goals list") or **AI Roadmap Engine** (Blueprint §8, explicitly lower-priority per CLAUDE.md until the core goal-to-guidance workflow is solid). Onboarding is the stronger candidate given CLAUDE.md's own stated priority order, but - consistent with how every other domain choice has been handled - this should be confirmed with the user rather than assumed.
