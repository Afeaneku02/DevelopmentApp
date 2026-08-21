# Better You Development Log — 2026-08-18

## Session Overview

Built **First-Run Onboarding**: a new domain, wired into `apps/api` and a full `apps/web` guided flow, deliberately scoped short of MVP Blueprint §6's full "Onboarding" domain (which ends in AI-generated "Create Plan," not buildable yet). The scoping discipline here came directly from the user, who pushed back on any framing that could misrepresent this as "onboarding complete."

---

## Starting Point

Auth, Profile, Goals (full lifecycle), and the API layer were all real and complete. Signing up dropped a user straight into an empty Goals screen - no welcome, no consent, no profile setup, nothing matching Vision §5.1's entry sequence. No Onboarding domain existed at all.

---

## Goal for This Session

Asked "what's next," recommended Onboarding over the AI Roadmap Engine (the latter blocked by the same "can't provision a real API key" constraint that deferred Supabase Auth). The user agreed with the direction and one specific concern: don't let this get called "onboarding complete" when Blueprint §6 requires Create Plan as the final step. Build a First-Run Onboarding flow - welcome, consent, profile basics, preferences, first goal, resumable - honestly scoped at every layer, not just in prose.

---

## Work Completed

### What Changed

- `packages/contracts/src/onboarding.ts`: `ONBOARDING_STEPS` (`welcome → consent → profile_basics → preferences → first_goal → awaiting_roadmap`), `OnboardingState` - deliberately no `completedAt` field.
- `services/onboarding`: `OnboardingService` (`getState`, `nextStep`, `recordFirstGoal` - no `completeOnboarding()`), `OnboardingRepository`/`InMemoryOnboardingRepository`, errors (`OnboardingValidationError`, `OnboardingAtFinalStepError`). `nextStep()` blocks leaving `first_goal` until a goal is actually recorded.
- `apps/api`: `GET /api/v1/onboarding`, `POST /api/v1/onboarding/next`, `POST /api/v1/onboarding/first-goal`, all behind `requireAuth`. Error handler gained the two new error mappings (400/409).
- `apps/web`: extracted `AddGoalForm` out of `GoalsScreen` into a shared component (`components/AddGoalForm.tsx`) so onboarding's first-goal step and the main Goals screen use the exact same goal-creation experience, not two that could drift apart. Extracted the locale/timezone/preference option lists out of `ProfileScreen` into `constants/profileOptions.ts` for the same reason, since the new `ProfileBasicsStep`/`PreferencesStep` needed them too.
- New `apps/web/src/onboarding/` step components (`WelcomeStep`, `ConsentStep`, `ProfileBasicsStep`, `PreferencesStep`, `FirstGoalStep`) and `screens/OnboardingFlow.tsx` orchestrating them against the real `currentStep` value.
- `App.tsx` now gates on onboarding state: any signed-in user whose `currentStep !== 'awaiting_roadmap'` sees the onboarding flow instead of the main app, regardless of how they arrived.
- Verified live (temporary Playwright, both Sky and Midnight mode): full walk from signup through Welcome → Consent (confirmed the Continue button stays disabled until the checkbox is checked) → Profile Basics → Preferences → First Goal → landing on the real Goals screen with that goal present. Separately verified **resuming is real**: signed up, advanced to `profile_basics`, closed the session, signed back in from a fresh browser context, confirmed the app landed directly back on `profile_basics` rather than restarting at `welcome`.
- Recorded ADR 0010.

### Why It Changed

This was the explicit next step after finishing the Goals lifecycle, chosen over the AI Roadmap Engine specifically because Onboarding was newly buildable (Auth + Profile now both exist) while the Roadmap Engine has the same unprovisionable-credential blocker that deferred Supabase Auth.

### How It Works

`OnboardingService.nextStep()` is the only way `currentStep` ever advances, and it has exactly one business rule beyond simple sequencing: leaving `first_goal` requires `firstGoalId` to already be set, so a client can't skip straight to `awaiting_roadmap` without actually creating a goal. `App.tsx` fetches onboarding state once a user is signed in and renders `OnboardingFlow` instead of the main app for as long as `currentStep` isn't `awaiting_roadmap` - since this check runs on every app load (not just right after signup), a user who closes the app mid-flow and comes back later lands exactly where they left off, driven by the server's own persisted state rather than any client-side flag.

---

## Example Flow

A brand-new user signs up, sees "Welcome to Better You" with a horizon-band header (the same signature element `AuthScreen` uses - deliberately reused here since onboarding is one bounded first-run journey, the same category as Auth, not a repeatedly-visited screen like `GoalsScreen`), works through consent, sets their display name and timezone, picks "Dive in" and "Voice" as preferences (with a note that voice isn't actually available yet), creates their first goal via the exact same `AddGoalForm` the main Goals screen uses, and lands on the real Goals screen with that goal already present. If they'd closed the app after the consent step and come back a day later, they'd resume at "A little about you," not start over.

---

## Problems Encountered

### Problem

Mid-verification, `apps/web`'s dev server started returning 500 errors for the newly-added files (`OnboardingFlow.tsx`, and even the already-existing, just-edited `GoalsScreen.tsx`), with Vite reporting `Failed to resolve import "@better-you/contracts"` - an alias that has worked correctly for every other file all along.

### Investigation

Checked `vite.config.ts` - the alias was correctly defined, unchanged. Fetched the failing module directly (`curl .../OnboardingFlow.tsx`) and got Vite's own detailed error page, confirming the failure was real, not a Playwright artifact. Noted the dev server process (port 5173) was the same one running since the very first `apps/web` session, many hours and dozens of file edits earlier.

### Root Cause

A long-running Vite dev server's internal module graph / resolution state had drifted into a bad state after absorbing an unusually large amount of file churn across a single process lifetime - not a configuration or code defect. Confirmed by killing that process and starting a completely fresh one: the exact same request that had 500'd moments before returned 200 immediately.

### Solution

`taskkill` the stale process (PID unchanged since the very first session), restart `npm run dev:web` fresh.

### Why the Solution Works

A fresh Vite process rebuilds its module graph and resolution cache from scratch, so any accumulated bad state from hours of HMR cycles and file additions is gone. The alias config itself was never wrong.

---

## Decisions Made

- **"First-Run Onboarding," never "Onboarding" bare** - the naming carries the scoping honesty as much as the code does.
- **No `completedAt` field, no `completeOnboarding()` function** - Blueprint §6 names both, but neither is built, because building them now would claim a completion this milestone doesn't deliver. The terminal step value (`awaiting_roadmap`) says what actually happened instead.
- **`OnboardingState` stays a thin progress tracker** - real data lives in Profile/Goals, onboarding only tracks position and a first-goal reference.
- **Shared `AddGoalForm` and profile-option constants**, extracted from `GoalsScreen`/`ProfileScreen` rather than duplicated into the new onboarding steps - onboarding and the main app now can't drift into two different goal-creation or preference-picking experiences.
- **The horizon band is used throughout onboarding, unlike `GoalsScreen`** - a deliberate extension of ADR 0008's reasoning (bounded first-run journey = same category as Auth), not a contradiction of it.
- **A long-running dev server is itself a plausible root cause worth checking early** when imports mysteriously fail to resolve on a project that's been running for many hours - recorded directly in ADR 0010 rather than a separate lessons-learned file, since the fix was simple and specific to this project's session-longevity pattern rather than a generalizable technical gotcha.

---

## Files Significantly Changed

- `services/onboarding/src/onboardingService.ts`, `onboardingRepository.ts`, `errors.ts` - the domain.
- `apps/api/src/routes/onboarding.ts`, `server.ts`, `middleware/errorHandler.ts` - wiring.
- `apps/web/src/screens/OnboardingFlow.tsx`, `apps/web/src/onboarding/*.tsx` - the guided flow.
- `apps/web/src/components/AddGoalForm.tsx`, `apps/web/src/constants/{goalCategories,profileOptions}.ts` - extractions that both the main app and onboarding now share.
- `apps/web/src/App.tsx` - the onboarding-state gate.
- `docs/architecture-decisions/0010-*.md`.

---

## Testing and Validation

**Tested:**
- `npm test` (root): 144/144 passing (8 new: `OnboardingService` unit tests covering sequencing, the first-goal gate, terminal-step rejection, and user isolation; 1 new backend integration test; API-level integration tests for auth-required, step advancement, the blocked-then-unblocked first-goal transition, and cross-user isolation).
- `npm run typecheck`: clean across root, `apps/api`, `apps/web` (one real type error caught and fixed along the way - `Array.prototype.filter`'s inferred type predicate meant a narrowed step array couldn't accept the full `OnboardingStep` union in `.indexOf()`; fixed by computing the step index off the unfiltered `ONBOARDING_STEPS` array instead).
- Live browser verification (temporary Playwright, real Chromium, both Sky and Midnight mode): the complete guided flow end to end, the consent checkbox actually gating the Continue button, landing correctly on the real Goals screen with the first goal present, and - as a separate, deliberate check - that resuming after closing and reopening the session actually returns to the correct step rather than merely not crashing.

**Not yet tested:** the AI Roadmap Engine / "Create Plan" step (doesn't exist, by design), a manual theme-toggle interacting with onboarding specifically (Midnight Mode verified via OS-level `prefers-color-scheme` only, consistent with every other screen so far).

---

## Current State

A new user's actual first-run experience now matches Vision §5.1's entry sequence for the first time - welcome, consent, profile basics, preferences, first goal - landing them on the real Goals screen with something already in it, rather than an empty list. Everything from Auth through this Onboarding flow is real, tested, and verified live.

---

## Known Issues

**No known issues identified during this session.**

---

## Next Recommended Step

With Auth, Goals, Profile, the API layer, and now First-Run Onboarding all complete, the two clearest remaining candidates are: (a) the **AI Roadmap Engine**, still blocked on provisioning a real model-provider credential the same way Supabase Auth was blocked - would need that decision resolved first; or (b) bringing `AuthScreen`/`GoalsScreen` fully current with whatever refinements the onboarding work's shared components suggest, and/or a **Dashboard** domain (Blueprint's next domain after Goals in the build order, and the natural "home" screen once a user has an active goal, a roadmap, and progress to show - though a real Dashboard mostly needs the Roadmap Engine to be worth building). Given the model-provider blocker is common to both AI-dependent paths, the more clearly buildable next step is Dashboard-adjacent work or continued visual/UX refinement - worth confirming with the user rather than assuming, as always.
