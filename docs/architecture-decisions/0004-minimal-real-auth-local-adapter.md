# ADR 0004: Minimal Real Auth as a local `AuthProvider` adapter, server-side only

**Status:** Accepted

## Context

Vision §25.8 names Supabase Auth as the MVP-phase identity provider, but building against it requires a live Supabase project (URL + API keys) that this development environment cannot create or obtain credentials for. Shipping an unverified Supabase integration would violate the project's rule against claiming a feature works without actually exercising it. The user chose to build a local, fully real (not stubbed) auth implementation now, behind the same `AuthProvider` adapter interface a managed provider would later implement (Blueprint §2 identity boundary, ADR 0001).

A second, more fundamental constraint emerged while scoping this: Goal Creation Core's domain code was made isomorphic (ADR 0003) so `apps/web` could call it directly in the browser. Auth cannot follow that pattern. Password hashing and session issuance must be controlled server-side - running them in browser-held JavaScript would mean every user's password hash and every issued session token sit in inspectable client memory, and "accounts" would be scoped to a single browser tab instead of representing a real, cross-device identity. This isn't a matter of scope reduction; it's a hard security boundary.

## Decision

- `AuthProvider` is an interface (`createIdentity`, `verifyCredentials`, `issueSession`, `verifySession`, `revokeSession`, `revokeAllSessionsForSubject`, `deleteIdentity`). `LocalAuthProvider` is the only implementation: Node's built-in `crypto.scrypt` for password hashing (no new dependency), random 32-byte session tokens with a 24-hour TTL, all in-memory.
- `AuthService` orchestrates `AuthProvider` + `UserRepository` and implements exactly the seven functions Blueprint §4 names: `signUp`, `signIn`, `signOut`, `refreshSession`, `getCurrentUser`, `requireUser`, `deleteAccount`.
- The `users` table shape (`id`, `authSubject`, `email`, `status`, `createdAt`, `deletedAt`) matches Blueprint §4's core data exactly, with no credential field - credentials live inside whichever `AuthProvider` is active, so this shape doesn't change when a managed provider replaces `LocalAuthProvider`.
- Sign-in failures (wrong password, unknown email, or a locked-out email) all throw the same `InvalidCredentialsError`, per Blueprint §4's "generic error messaging for account discovery risks." Sign-up duplicate-email is a deliberate, narrower exception: it throws a specific `EmailAlreadyInUseError`, matching common practice (Cognito, Supabase, Auth0 all do this) since discovering whether an email is registered by attempting to register it is a much smaller risk than a login-based enumeration oracle.
- A simple in-memory failed-attempt lockout (5 attempts / 15 minutes per email) satisfies Blueprint §4's "rate-limit auth-sensitive actions" at the service level. Real IP/network-level rate limiting is deferred to the future API layer, where request identity actually exists.
- `services/auth` is **not** wired into `apps/web` this milestone, and must not be made isomorphic the way `services/goals` was.

## Consequences

- Email verification and password-reset flows (both named in Blueprint §4's user stories) are not implemented - both require a transactional email provider, which hasn't been chosen, for the same "can't provision an external service from this environment" reason Supabase itself was deferred. `signUp` marks users `active` immediately rather than `pending-verification`.
- `apps/web` still has no real login screens after this milestone. Wiring `GoalService`'s dev-stub `userId` over to `AuthService`'s real `requireUser()` requires an HTTP API layer (Blueprint §4's `/auth/signup`, `/auth/login`, `/me`, etc.) and a session-transport decision (cookies vs. bearer token) that doesn't exist yet - this is now the most immediate remaining gap, more urgent than it was for Goals, since Auth is the last domain blocking most of the rest of the Blueprint's build order.
- When a managed provider (Supabase or Cognito) is eventually chosen, only a new `AuthProvider` implementation needs to be written and swapped in - `AuthService`, `UserRepository`, and every caller of `AuthService` are unaffected, mirroring how `GoalRepository` was designed to be swappable (ADR 0001).
