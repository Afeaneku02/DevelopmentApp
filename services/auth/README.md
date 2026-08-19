# services/auth

The Auth domain (MVP Blueprint §4), scoped to Minimal Real Auth: `AuthProvider` interface + a `LocalAuthProvider` implementation (scrypt password hashing, signed in-memory sessions), a `UserRepository`, and `AuthService` with all seven blueprint functions (`signUp`, `signIn`, `signOut`, `refreshSession`, `getCurrentUser`, `requireUser`, `deleteAccount`).

**Server-side only.** Unlike `services/goals`, this domain is not usable from `apps/web` yet and should not be made isomorphic — password hashing and session issuance must never run in the browser (see ADR 0004). Wiring this up to a UI requires an HTTP API layer, which doesn't exist yet.

Email verification and password-reset flows are not implemented - both need a transactional email provider, which hasn't been chosen (same "can't provision external service" constraint noted for the Supabase-vs-local decision in ADR 0004).
