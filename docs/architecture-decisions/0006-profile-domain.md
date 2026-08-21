# ADR 0006: Profile domain - lazy default creation, concrete preference fields

**Status:** Accepted

## Context

Product Vision §5.1's entry sequence puts "create basic profile" immediately after account creation and privacy consent - but `apps/api` had no way to represent a user beyond their `Auth` identity (email, credentials). Blueprint §5 specifies the domain (`profiles` table, `GET/PATCH /profile`, `ProfileService`) but its function list (`getProfile()`, `updateProfile()`, `validatePreferences()`, `buildSafeProfileContext()`) notably omits any `createProfile()`.

## Decision

- **No separate profile-creation step.** `ProfileService.getProfile(userId)` lazily creates a profile with explicit defaults on first access if none exists; `updateProfile()` does the same before applying changes. This directly satisfies Blueprint §5's Definition of Done ("profile loads after sign-in") without needing Onboarding to exist first, and matches the function list's own omission of a create step.
- **Concrete preference fields, not an open JSON blob**, even though Blueprint's core data literally names the column `preferences_json`: `onboardingMode` (`dive_in` | `gradual` | `guided_middle_ground`) and `interactionMethod` (`typed` | `voice` | `blend`) - both taken directly from Vision §5.2/"Decisions Already Made," not invented. An arbitrary untyped blob would make "preferences have explicit defaults" (a named business rule) unenforceable.
- **Defaults**: `onboardingMode: 'guided_middle_ground'` (Vision §5.2 names this the balanced default for most users), `interactionMethod: 'typed'` (the only one actually implemented - defaulting to `voice` or `blend` would claim a capability that doesn't exist yet), `timezone: 'UTC'`, `locale: 'en-US'`, `displayName: ''` (empty is allowed only as the lazy-init default; an explicit `updateProfile` call rejects an empty `displayName`).
- **Timezone/locale validation via `Intl`, not a new dependency**: `Intl.getCanonicalLocales` for locale syntax, and `new Intl.DateTimeFormat(..., { timeZone })` (catching the `RangeError`) for timezone validity - see the lessons-learned entry for why the more obvious `Intl.supportedValuesOf('timeZone')` approach was rejected.
- **`buildSafeProfileContext()` is not implemented.** Blueprint §5 names it as an AI touchpoint, but there is no AI integration to consume it yet and no defined "safe" boundary to implement against - building it now would be speculative, the same reasoning already applied to deferring AI goal refinement (ADR 0002) and email verification (ADR 0004).
- **Wired into `apps/api`** (`GET/PATCH /api/v1/profile`, both behind `requireAuth`) in the same milestone, unlike Auth's separate domain-then-API split - there was no architectural fork here requiring its own decision, just a small mechanical extension of already-existing, already-tested infrastructure.

## Consequences

- `apps/web` has no profile screen yet - intentionally deferred, since a real profile-editing UI is UI/UX design work, not backend domain work, and should go through that process rather than being bolted on as an extension of this backend milestone.
- Cross-user access has no dedicated authorization check beyond what already exists: `GET/PATCH /profile` never take a user id from the request (matching Blueprint's un-parameterized route surface), only ever operating on `req.user.id` from the verified session - so there is no cross-user vector to test against, unlike a hypothetical `/profile/{id}` design.
