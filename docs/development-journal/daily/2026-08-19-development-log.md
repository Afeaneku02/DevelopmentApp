# Better You Development Log — 2026-08-19

## Session Overview

Addressed a Codex code review of the First-Run Onboarding milestone (ADR 0010): one medium-severity finding (missing goal-ownership validation in `recordFirstGoal`) and one low-severity finding (missing `.catch()` handlers leaving parts of the UI stuck on "Loading…" forever on failure). Both fixed, tested, and verified live.

---

## Starting Point

First-Run Onboarding was complete and verified live as of the previous session, but had not yet been reviewed by Codex. The review flagged that `POST /api/v1/onboarding/first-goal` would accept any `goalId` string - a fake one, or one belonging to a different user - without checking it existed or was owned by the caller.

---

## Goal for This Session

Fix the ownership-validation gap the way the review recommended - via `GoalService.getGoal(userId, goalId)` - and fix the missing error handling on three initial data-loading calls, without breaking the legitimate onboarding flow that already worked.

---

## Work Completed

### What Changed

- Added `services/onboarding/src/goalLookup.ts`: a minimal `GoalLookup` interface (`getGoal(userId, goalId): Promise<unknown>`), satisfied structurally by `GoalService` without `services/onboarding` taking a dependency on all of `@better-you/goals`.
- `OnboardingService`'s constructor now takes a `GoalLookup`; `recordFirstGoal()` calls it before persisting `firstGoalId`, letting whatever it throws (the real `GoalNotFoundError` from `GoalService`, already mapped to 404 by the existing error handler) propagate unchanged - no new error type, no route-layer change needed.
- `apps/api/src/server.ts` wires the real `goalService` in as the `GoalLookup` when constructing `OnboardingService`.
- Updated every `OnboardingService` construction site: added a `FakeGoalLookup` test double (unit tests, where isolating `OnboardingService` is the point) and switched the integration test to a **real** `GoalService` (matching this codebase's no-mocks-in-integration-tests convention) - created real goals, then verified both a fake id and a real-but-foreign-owned id get rejected.
- Added three new API-level integration tests: fake `goalId` → 404, another user's real `goalId` → 404, the caller's own real `goalId` → 200.
- Fixed the three missing-`.catch()` sites (`App.tsx`'s onboarding-state fetch, `ProfileBasicsStep`, `PreferencesStep`): each now sets a `loadError` state and renders it instead of hanging on "Loading…" indefinitely if the initial fetch fails.
- Verified live: `curl`'d a fabricated `goalId` against the real running API and got `404 GOAL_NOT_FOUND`; then ran the full legitimate onboarding flow through a real browser afterward to confirm the fix didn't break the working path (0 console errors).
- Recorded the fix as an addendum to ADR 0010 rather than a new ADR, since it's a correction to that milestone, not a new architectural decision.

### Why It Changed

Codex's review was correct: `apps/web` always passes a real, just-created goal id, so the gap was invisible through the app itself, but the API endpoint didn't enforce that - and since onboarding state gates step advancement, an unvalidated `goalId` could have let a client claim credit for a goal it doesn't own, or a goal that doesn't exist at all.

### How It Works

`recordFirstGoal(userId, goalId)` now does exactly one extra thing before its previous behavior: `await this.goalLookup.getGoal(userId, goalId)`. If that resolves, the goal is real and owned by `userId` (that's `GoalService.getGoal`'s own existing contract - same `GoalNotFoundError` for "doesn't exist" and "not yours," so no new enumeration surface is introduced); if it rejects, `recordFirstGoal` rejects too, before ever touching `OnboardingRepository`.

---

## Problems Encountered

None beyond the finding itself - no new problems surfaced while implementing or verifying the fix.

---

## Decisions Made

- **Validate in the domain service, not the route.** `OnboardingService.recordFirstGoal` owns the check, not `apps/api/src/routes/onboarding.ts` - consistent with how `GoalService` itself validates ownership internally rather than trusting callers, and means the guarantee holds for any future caller of `OnboardingService`, not just this one HTTP route.
- **A minimal structural `GoalLookup` interface, not a direct `GoalService` type dependency** - keeps `services/onboarding` depending on the one method it needs rather than the whole Goals domain surface, matching the dependency-inversion pattern already used for every other cross-boundary dependency in this codebase (`GoalRepository`, `ProfileRepository`, `AuthProvider`).
- **Real `GoalService` in the integration test, a fake only in the unit test** - matches the established split in this codebase between isolated unit tests (fakes acceptable) and integration tests (real, non-mocked components proving the actual wiring works).
- **Loading-error fix scoped to exactly what was flagged** - a `loadError` state and an inline error message, no retry mechanism or broader loading-state redesign, matching the review's own "low, less of a blocker" framing.

---

## Files Significantly Changed

- `services/onboarding/src/goalLookup.ts` - new.
- `services/onboarding/src/onboardingService.ts` - the validation call.
- `apps/api/src/server.ts` - wires real `goalService` as `GoalLookup`.
- `services/onboarding/src/__tests__/onboardingService.test.ts`, `tests/integration/onboarding.integration.test.ts`, `tests/integration/api.integration.test.ts` - new/updated tests.
- `apps/web/src/App.tsx`, `apps/web/src/onboarding/{ProfileBasicsStep,PreferencesStep}.tsx` - `.catch()` handling.
- `docs/architecture-decisions/0010-first-run-onboarding.md` - addendum.

---

## Testing and Validation

**Tested:**
- `npm test` (root): 152/152 passing (10 new: 3 ownership-rejection unit tests + 2 updated existing ones needing a registered fake goal, 2 new integration tests against a real `GoalService`, 3 new API-level integration tests). `npm run typecheck` clean across root, `apps/api`, `apps/web`.
- Live verification: `curl` against the real running API with a fabricated `goalId` returned `404 GOAL_NOT_FOUND`. A full real-browser run of the legitimate onboarding flow (signup through landing on the Goals screen with a real first goal) afterward confirmed 0 console errors and no regression.

**Not yet tested:** nothing new architecturally introduced this session beyond the fix itself.

---

## Current State

First-Run Onboarding's `recordFirstGoal` endpoint now correctly rejects fake or foreign goal ids, verified both by automated tests and live against the real API. The three previously-silent loading-failure paths now surface an error instead of hanging indefinitely.

---

## Known Issues

**No known issues identified during this session.**

---

## Next Recommended Step

Unchanged from the previous session's conclusion: the AI Roadmap Engine is blocked on the same unprovisionable-model-credential constraint that deferred Supabase Auth, so the clearer next candidates remain a Dashboard domain or further visual/UX refinement on `AuthScreen`/`GoalsScreen` - worth confirming with the user before picking one.

---
---

# Better You Development Log — 2026-08-19 (continued)

## Session Overview

Second session of the day: the user picked one of the two candidates named above - "the dashboard mentor home... instead of just dropping into the goals list" - directly invoking CLAUDE.md's product framing. Same honesty pattern applied without being asked this time: Blueprint §10's Dashboard formally depends on Goals, Roadmap, Check-ins, and Progress, and only Goals exists, so this is a **Goals-only Dashboard**, scoped and named accordingly from the start.

---

## Starting Point

Auth, Profile, Goals (full lifecycle), the API layer, and First-Run Onboarding were all complete. After onboarding, users landed directly on the Goals screen - a working list, but no summary, no guidance, nothing "mentor" about the first thing you see.

---

## Goal for This Session

Build a Dashboard that's genuinely useful from data that actually exists (Goals only): a summary of where things stand, and a deterministic "next action" heuristic - not AI, clearly labeled as such - that prioritizes addressing a stalled goal before ever suggesting a new one. Make it the new post-onboarding home; keep the existing Goals screen as "All Goals."

---

## Work Completed

### What Changed

- `packages/contracts/src/dashboard.ts`: `NextAction`/`NextActionType`, `DashboardView` - with a doc comment explicitly distinguishing the heuristic `NextAction` from Blueprint §10's separately-described AI "coach summary," which is not built.
- `services/dashboard`: `GoalsView` (a minimal structural interface, satisfied by the real `GoalService`, mirroring `GoalLookup` from `services/onboarding`), `computeNextAction()` (a standalone, independently-testable pure function implementing the resume-paused → flag-stale → suggest-new → affirm priority order), `DashboardService.getDashboard()` assembling everything with an injectable clock.
- `apps/api`: `GET /api/v1/dashboard`, behind `requireAuth`, wired with the real `goalService` as `GoalsView`.
- `apps/web`: new `DashboardScreen.tsx` - personalized greeting (using the real Profile display name), a prominent next-action card with one real inline action (a "Resume goal" button for the `resume_goal` case, calling the actual resume endpoint), three stat tiles (active/paused/completed), and an active-goals summary list. `App.tsx`'s view state now defaults to `'dashboard'` post-onboarding instead of `'goals'`; `GoalsScreen` gained a "Home" nav button; `ProfileScreen`'s back-link now returns to Dashboard.
- Verified live (temporary Playwright, both Sky and Midnight mode): walked the full state progression - no goals → one active goal (`nextAction`: "room for 2 more") → paused it via All Goals → back on Dashboard (`nextAction`: "resume it, or archive it") → clicked the dashboard's own inline "Resume goal" button → back to "room for 2 more" - confirming both the heuristic transitions and the inline action actually work against the real API, not just render correctly. 0 console errors throughout. Also confirmed Profile's back-link now lands on Dashboard, not the old Goals screen.
- Recorded ADR 0011.

### Why It Changed

Directly requested, with the scoping discipline now applied proactively rather than needing to be prompted a third time - the same "name it for what it actually is, don't fake the missing dependencies" pattern from ADR 0010, now internalized rather than re-taught.

### How It Works

`computeNextAction(activeGoals, pausedGoals, now)` is a pure function with no dependencies beyond the two goal lists and a clock - fully unit-testable in isolation across every branch (paused-present, stale-active, room-for-more, at-cap, brand-new-user) without needing a real service or repository. `DashboardService.getDashboard()` just does the one real read (`goalsView.listGoals(userId)`), splits it three ways by status, and calls that pure function - matching Blueprint §10's own "dashboard is a read model... never invents progress" business rule literally: every field is either a direct filter of real Goals data or a small, fully-tested derivation of it.

---

## Example Flow

Jamie finishes onboarding and lands on "Welcome back, Jamie" instead of a bare goal list. With one active goal and room for more, the dashboard suggests adding another. Jamie instead goes to All Goals and pauses their only goal - back on Dashboard, the message changes to a direct, actionable nudge: `"Get in better shape" is paused — resume it, or archive it if it's no longer a priority`, with a "Resume goal" button right there. Clicking it resumes the goal and the dashboard updates immediately, without a page navigation.

---

## Problems Encountered

None - implementation, tests, and live verification all went cleanly on the first pass.

---

## Decisions Made

- **Goals-only Dashboard, named and scoped as such from the outset** (ADR 0011) - the same honesty discipline from ADR 0010, applied without the user needing to raise it again.
- **`nextAction` priority: paused goals before stale goals before suggesting new ones** - deliberately encodes Vision §1/§20's "consistency over adding more" philosophy into the one piece of actual guidance logic this milestone has, rather than a generic "always suggest adding" default.
- **The 7-day staleness threshold is explicitly labeled a placeholder heuristic**, not a Vision-specified number (unlike `MAX_ACTIVE_GOALS`) - easy to find and revise once a real signal exists.
- **`completedGoalsCount` counts current status only**, not "ever completed via history" - a documented simplification, not a silent one; proper historical tracking is explicitly left to a future Progress domain rather than improvised here.
- **Dashboard replaces Goals as home; Goals becomes "All Goals"** - not a parallel or redundant view, a clear hierarchy (summary/guidance first, full management view one click away).
- **Only one real inline action (resume) on the dashboard itself** - `add_goal`/`review_goal` navigate to All Goals rather than duplicating the goal-creation form on a second screen.

---

## Files Significantly Changed

- `services/dashboard/src/dashboardService.ts`, `nextAction.ts`, `goalsView.ts` - the domain.
- `apps/api/src/routes/dashboard.ts`, `server.ts` - wiring.
- `apps/web/src/screens/DashboardScreen.tsx` - the new home screen.
- `apps/web/src/App.tsx`, `screens/GoalsScreen.tsx`, `screens/ProfileScreen.tsx` - navigation changes (Dashboard as default, "Home" button, back-link retarget).
- `docs/architecture-decisions/0011-*.md`.

---

## Testing and Validation

**Tested:**
- `npm test` (root): 170/170 passing (14 new: 7 `computeNextAction` unit tests covering every heuristic branch, 5 `DashboardService` unit tests with a fake `GoalsView`, 2 integration tests against a real `GoalService`; plus 4 new API-level integration tests - auth-required, empty-state, paused-goal-prioritization, cross-user isolation). `npm run typecheck` clean across root, `apps/api`, `apps/web`.
- Live browser verification (temporary Playwright, real Chromium, both Sky and Midnight mode): the full state progression described in "Example Flow" above, plus confirming Profile's back-link change. 0 console errors.

**Not yet tested:** the `review_goal` (stale-goal) branch in a live browser specifically (would require manipulating a goal's `updatedAt` past the 7-day threshold, which the unit tests already cover directly - not repeated as a live check since the underlying data path is identical to the already-verified `resume_goal` case).

---

## Current State

A new user's actual journey is now: sign up → First-Run Onboarding → a real mentor-shaped Dashboard home showing what matters and what to do next → "All Goals" for full management → Profile. Every domain from Auth through Dashboard is real, tested, and verified live.

---

## Known Issues

**No known issues identified during this session.**

---

## Next Recommended Step

The AI Roadmap Engine remains blocked on the same unprovisionable-model-credential constraint noted for Supabase Auth. With Dashboard now done, the clearest remaining non-AI-blocked candidates are: further visual/UX refinement (Dashboard/Goals/Profile could still use another pass now that the full navigation shape exists), or beginning to think through what a minimal Check-ins domain could honestly look like without Progress/Roadmap existing yet, similar to how Dashboard was scoped down to what Goals alone could support. Worth confirming with the user rather than assuming, as always.

---
---

# Better You Development Log — 2026-08-19 (continued)

## Session Overview

Third session of the day. Started scoping the Check-ins domain named as the next candidate above - but before writing any code, config files already referenced `@better-you/check-ins`. Investigation (`git log`, `git show --stat`) revealed Codex had already designed and merged a full Check-ins implementation via GitHub PR #4 ("Add quick response check-ins", `d8787f7`), essentially in parallel with this session's own planning. Per `AGENTS.md`'s multi-agent rule, the response was to review the actual diff rather than assume it was correct, and rather than build a second, possibly-conflicting implementation.

---

## Starting Point

Auth, Profile, Goals, Onboarding, and Dashboard were complete. The user had approved scoping a minimal Check-ins domain. Mid-scoping, `tsconfig.json`/`vitest.config.ts` were found to already contain a `@better-you/check-ins` alias that hadn't been added this session.

---

## Goal for This Session

Determine what Codex's already-merged Check-ins implementation actually contains, verify it against the repo's own test suite and typecheck, compare it against Vision/Blueprint grounding and the independently-drafted scope, report the discovery honestly to the user, then build whatever genuine next increment remained.

---

## Work Completed

### What Changed

- Read every file in Codex's Check-ins implementation (`packages/contracts/src/checkIn.ts`, `services/check-ins/src/*`, `apps/api/src/routes/{checkIns,goalCheckIns}.ts`, `apps/web/src/api/checkInsApi.ts`, the `DashboardScreen.tsx` integration, both test files) rather than assuming correctness.
- Ran `npm run typecheck` (clean) and the full suite (`npx vitest run`: 185/185 passing across 21 files, including the check-ins unit and integration tests) to confirm the merged state actually works, not just reads plausibly.
- Confirmed the current branch (`goal-check-in-history-ui`) had no work-in-progress beyond `main` (`git diff main` empty) - just a freshly-created branch, not a second parallel effort.
- Reported the discovery to the user: Codex's implementation matched the independently-drafted scope closely (same `yes`/`no`/`partly`/`skipped` model, same active-goal-only restriction, same ownership-via-`GoalLookup` pattern as Onboarding/Dashboard), was fully tested, and was already integrated into `DashboardScreen` (one-tap check-in buttons per active goal, "Last check-in: X" status line). No conflict, nothing to redo.
- Identified the actual gap: the API's `GET /api/v1/goals/:id/check-ins` already returns a goal's full check-in history (`GoalCheckInsView` - the goal, every check-in, and a computed summary), but the UI only ever consumed `summary.mostRecentCheckIn`. The full history was unused - and the branch name independently pointed at the same gap.
- User confirmed: build the check-in history UI. Added it to `GoalsScreen.tsx` as an inline expandable panel per goal card (a "History" toggle button alongside the existing Edit/Pause/Complete/Archive actions), fetched lazily and cached per goal, available on goals of any status (not just active - a paused/completed/archived goal can still have real historical check-ins). Added matching CSS reusing the existing semantic color tokens (success/warning/error/neutral) for response color-coding, consistent with how `.status-badge` already uses those same tokens.
- Verified live (temporary Playwright, both Sky and Midnight mode): seeded a real user through signup, fast-forwarded onboarding via the real onboarding API (not the UI, to keep the script focused on the feature under test), created a goal and two check-ins (one with a note) via the real API, then drove the actual browser UI to open All Goals, expand history, and confirm correct newest-first ordering, correct summary counts ("2 check-ins — Yes 1, Partly 1, No 0, Skipped 0"), correct response color-coding, and the note text rendering - then collapsed it again. 0 console errors in either theme.
- Recorded ADR 0012.

### Why It Changed

Directly requested ("scope a minimal Check-ins domain", then "what next" after the domain turned out to already exist, then explicit approval to build the history UI specifically). The near-miss of building a duplicate Check-ins implementation was caught before any code was written, by treating the config-file discovery as a signal to investigate rather than proceeding on the original plan.

### How It Works

`GoalsScreen`'s `toggleHistory(goalId)` toggles an `expandedGoalId` state and, on first expand only, fetches `checkInsApi.listGoalCheckIns(token, goalId)` and caches the result in `historyByGoal`. Collapsing and re-expanding reads from the cache rather than re-fetching. The panel renders the summary line and then each check-in (response badge, timestamp, optional note) in the order the API already returns them (newest first, per `InMemoryCheckInRepository.sortNewestFirst`).

---

## Problems Encountered

- The live-verification script initially failed because a freshly-signed-up user lands on the Onboarding flow, not Dashboard/Goals - `App.tsx` gates on `onboarding.currentStep !== 'awaiting_roadmap'`. Fixed by fast-forwarding onboarding through its own real API (`POST /api/v1/onboarding/next` four times, then `POST /api/v1/onboarding/first-goal`, then one more `next`) before loading the browser, rather than scripting the onboarding UI step-by-step.
- The script also initially called a nonexistent `/api/v1/auth/signin` endpoint (guessed rather than checked) - the real route is `/api/v1/auth/login`. Fixed after a quick `curl` check of the actual route.
- **Caught in review before pushing**: the first version of `toggleHistory` skipped re-fetching if a goal's history was already cached in `historyByGoal` (`if (historyByGoal[goalId] || !token) return`). That meant opening a goal's history, closing it, recording a new check-in for that goal from the Dashboard, then reopening the same goal's history in the same app session would show stale pre-check-in data - directly undermining what a "history" view is for. Fixed by removing the cache-skip so every open re-fetches; re-verified live with a script that opens history (empty), records a check-in out-of-band via the API, and reopens history in the same session (no page reload) to confirm the new check-in appears immediately.

---

## Decisions Made

- **Reviewed Codex's Check-ins implementation before writing any competing code**, per `AGENTS.md` - inspected every file, ran the real test suite, and confirmed it against the independently-drafted scope, rather than assuming a from-scratch build was still needed just because that was the plan going in.
- **No changes made to Codex's Check-ins implementation** - it matched the intended scope, typechecked, and passed its own tests as-is, so nothing warranted a fix-pass the way Onboarding's ownership gap did.
- **Check-in history is inline on the existing Goals card, not a new screen or route** - matches this codebase's pattern of extending existing surfaces (Dashboard's inline resume button, Profile's option-cards) rather than multiplying navigation for something that's fundamentally "more detail about a thing already on screen."
- **History is visible for goals of any status**, not gated to active-only like check-in *creation* is - the two are different concerns (can you record one now vs. can you review what happened before).
- **No retroactive ADR written for Codex's underlying Check-ins domain** - it was reviewed and verified, not authored here, so backfilling an ADR for another agent's already-merged work wasn't done unilaterally; the gap is noted honestly in ADR 0012 instead.

---

## Files Significantly Changed

- `apps/web/src/screens/GoalsScreen.tsx` - history toggle state, fetch/cache logic, expandable panel.
- `apps/web/src/styles.css` - `.check-in-history`, `.check-in-entries`, `.response-badge` (+ per-response modifiers).
- `docs/architecture-decisions/0012-goal-check-in-history-view.md` - new.

**Reviewed but not modified** (Codex's already-merged work): `packages/contracts/src/checkIn.ts`, `services/check-ins/src/*`, `apps/api/src/routes/{checkIns,goalCheckIns}.ts`, `apps/api/src/server.ts` (check-ins wiring), `apps/web/src/api/checkInsApi.ts`, `apps/web/src/screens/DashboardScreen.tsx` (check-in buttons).

---

## Testing and Validation

**Tested:**
- `npm run typecheck`: clean across the whole repo both before touching any code (confirming Codex's merged state was sound) and after the history-UI change.
- `npx vitest run`: 185/185 passing both times - the history UI added no new automated tests of its own (it's a thin, already-tested-endpoint consumer with no new domain logic), matching this codebase's convention of reserving unit/integration tests for real business logic rather than UI wiring.
- Live browser verification (temporary Playwright, real Chromium, both Sky and Midnight mode): full seed-through-UI walkthrough described above. 0 console errors.

**Not yet tested:** the empty-history state ("No check-ins recorded for this goal yet.") wasn't exercised live - it's a straightforward conditional render already covered by the same code path as the populated case, not repeated as a separate live check.

---

## Current State

Check-ins - creation (Dashboard, one-tap yes/no/partly/skipped) and full history (Goals, expandable per-card panel) - are both real, tested, and verified live. Every domain from Auth through Check-ins is now built on real data with no mocked or faked pieces.

---

## Known Issues

- Codex's Check-ins domain (`services/check-ins` and its routes) has no ADR of its own - a real documentation gap, noted honestly rather than silently backfilled, since authoring an ADR for another agent's design decisions wasn't this session's call to make unilaterally.

---

## Next Recommended Step

The AI Roadmap Engine remains blocked on the same unprovisionable-model-credential constraint noted in prior sessions. With Check-ins (creation + history) now done, remaining non-AI-blocked candidates are largely the same as before: further visual/UX refinement across the app, or a Progress domain (aggregating check-in consistency over time into something more than per-goal counts) - which would itself need the same honest-scoping treatment Dashboard and Check-ins both got, since Blueprint's Progress domain likely assumes Roadmap exists too. Worth confirming with the user rather than assuming.

---
---

# Better You Development Log — 2026-08-19 (3rd continued)

## Session Overview

Fourth session of the day. Asked "what is next to do" - presented the three non-AI-blocked candidates from the previous session's closing note (Progress domain, further visual/UX polish, or checking whether an AI credential had become available) with a recommendation for Progress, since it's the most direct continuation of what Check-ins just built. The user picked Progress, explicitly scoping it themselves: "around Goals + Check-ins only. No AI Roadmap dependency yet. Build deterministic progress summaries/trends from check-in data, then surface them lightly in Dashboard/Goals."

---

## Starting Point

Auth, Profile, Goals, Onboarding, Dashboard, and Check-ins (creation + history, ADR 0012) were all complete. Dashboard's own ADR 0011 had named Progress as an unbuilt dependency from the start.

---

## Goal for This Session

Build a Progress domain that computes real, deterministic consistency scores and trend labels from existing Check-in data - no invented calendar/streak logic, no AI - and surface it as a light addition to the two screens that already exist, not a new screen of its own.

---

## Work Completed

### What Changed

- `packages/contracts/src/progress.ts`: `ProgressTrend` (`'improving' | 'steady' | 'declining' | 'not_enough_data'`), `ProgressSummary`, `GoalProgress`, `OverallProgress`.
- `services/progress`: `progressMath.ts` (pure, independently-tested functions - `computeConsistency()`: yes=1/partly=0.5/no=0 averaged, skipped excluded from both numerator and denominator, null with no scorable check-ins; `computeTrend()`: splits scorable check-ins oldest-first at the midpoint and compares the two halves' consistency past a threshold, `not_enough_data` below a minimum count - both threshold and minimum explicitly labeled placeholder heuristics, same status as Dashboard's 7-day staleness number), `CheckInsView` (a minimal structural interface - `listCheckIns`/`getGoalCheckIns` - satisfied directly by the real `CheckInService` with no adapter code needed), `ProgressService.getOverallProgress()`/`getGoalProgress()`.
- `apps/api`: `GET /api/v1/progress` (overall) and `GET /api/v1/goals/:id/progress` (per-goal), both behind `requireAuth`, wired with the real `checkInService` as `CheckInsView`. No new error types or `errorHandler.ts` changes - per-goal ownership/existence validation comes for free from `CheckInService.getGoalCheckIns`'s existing `GoalLookup` check, so a fake or foreign `goalId` already produces the same `404 GOAL_NOT_FOUND` the check-ins domain does.
- `apps/web`: `api/progressApi.ts`, a small `constants/progress.ts` (trend labels + a `formatConsistency()` helper shared by both screens). `DashboardScreen` gained a "Progress" section (consistency % + trend badge) shown once the user has at least one check-in, fetched alongside the existing dashboard load and re-fetched whenever a check-in is recorded from the dashboard itself. `GoalsScreen`'s existing per-goal history panel (ADR 0012) gained one line (consistency % + trend badge) above the check-in list, fetched alongside history on every open - built with the correct always-refetch behavior from the start this time, rather than repeating the caching mistake caught in the previous session's review.
- Recorded ADR 0013.

### Why It Changed

Directly requested, with the scope defined by the user themselves rather than proposed and approved as in prior sessions - "Goals + Check-ins only," "deterministic," "trends," "surfaced lightly," all specified up front.

### How It Works

`ProgressService` has exactly one dependency (`CheckInsView`), satisfied structurally by the real `CheckInService` without any new wiring beyond passing it into the constructor - `getOverallProgress()` calls `listCheckIns(userId)` and aggregates across every goal; `getGoalProgress()` calls `getGoalCheckIns(userId, goalId)` and aggregates just that goal's check-ins, inheriting the ownership check for free. Both paths hand the resulting `CheckIn[]` to the same pure `summarizeProgress()` function, so the math is defined exactly once regardless of which endpoint is asking.

---

## Example Flow

Jamie has been meditating on and off - two "no" check-ins early on, then two "yes" check-ins more recently. The Dashboard's new Progress section reads "50% consistent across 4 check-ins — Improving." Opening that same goal's history on the Goals screen shows the identical line above the four individual entries, because both are backed by the same `ProgressService.getGoalProgress()` call.

---

## Problems Encountered

None - the caching mistake from the previous session's Check-ins-history review was fresh enough to actively avoid this time: both new progress fetches (Dashboard's check-in handler, Goals' history toggle) were written to always re-fetch on the action that could make the data stale, rather than needing a follow-up fix.

---

## Decisions Made

- **`ProgressService` depends on `CheckInsView` only** - no separate `GoalsView` dependency, since every field Progress needs (which goal, what response, when) is already present on `CheckIn` itself; adding an unused dependency would have been exactly the kind of premature architecture CLAUDE.md's development-approach rules warn against.
- **Progress reflects a goal's full history regardless of current status** - a paused/completed/archived goal's past check-ins remain valid effort history, consistent with how the Check-ins history view (ADR 0012) already treats non-active goals.
- **Consistency and trend math live in one pure, independently-tested module (`progressMath.ts`)**, not inline in `ProgressService` - matches the `nextAction.ts` precedent from Dashboard (ADR 0011), and means the placeholder heuristic thresholds are the one place to revise later without touching the service, routes, or UI.
- **No trend charts, streaks, or AI interpretation** - factual counts and one deterministic label only, matching the user's own "deterministic" framing and the "not AI" precedent every prior domain in this project has followed.
- **Surfaced as additions to existing screens, not a new Progress screen** - a small Dashboard section and one line in the Goals history panel, matching the user's own "surface them lightly" instruction.

---

## Files Significantly Changed

- `packages/contracts/src/progress.ts` - new.
- `services/progress/src/{progressMath,checkInsView,progressService,index}.ts`, `__tests__/{progressMath,progressService}.test.ts`, `README.md` - new domain.
- `apps/api/src/routes/{progress,goalProgress}.ts`, `server.ts` - wiring.
- `apps/web/src/api/progressApi.ts`, `constants/progress.ts` - new.
- `apps/web/src/screens/DashboardScreen.tsx`, `screens/GoalsScreen.tsx`, `styles.css` - light surfacing in both screens.
- `tests/integration/progress.integration.test.ts`, `tests/integration/api.integration.test.ts` (new `progress` describe block) - new tests.
- `docs/architecture-decisions/0013-goals-check-ins-progress.md` - new.

---

## Testing and Validation

**Tested:**
- `npm run typecheck`: clean across the whole repo.
- `npx vitest run`: 210/210 passing (25 new: 12 `progressMath` unit tests covering consistency scoring, trend detection in both directions, the not-enough-data floor, and order-independence; 4 `ProgressService` unit tests with a fake `CheckInsView`; 3 service-level integration tests against real `GoalService`/`CheckInService`; 6 new API-level integration tests - auth-required, zeroed-for-new-user, real aggregation, per-goal scoping, cross-user rejection, cross-user isolation).
- Live browser verification (temporary Playwright, real Chromium, both Sky and Midnight mode): seeded a user, a goal, and four check-ins (no, no, yes, yes - deliberately ordered to produce an `improving` trend) through the real API and real onboarding fast-forward, then confirmed both the Dashboard progress section and the Goals history progress line showed "50% consistent — Improving" correctly. 0 console errors in either theme.

**Not yet tested:** the `declining` and `steady` trend labels in a live browser specifically - covered directly by `progressMath.test.ts`'s unit tests (which exercise both branches, plus order-independence), not repeated live since the underlying data path is identical to the already-verified `improving` case.

---

## Current State

Every domain from Auth through Progress is real, tested, and verified live: a user can sign up, complete onboarding, manage goals through their full lifecycle, record quick-response check-ins, review a goal's full check-in history, and see a deterministic, factual read on their own consistency and trend - both on the Dashboard and inline with a goal's history - with no AI, no mocked data, and no faked dependencies anywhere in the chain.

---

## Known Issues

- Same as the previous session: Codex's Check-ins domain still has no ADR of its own.

---

## Next Recommended Step

The AI Roadmap Engine remains blocked on the same unprovisionable-model-credential constraint. With Progress now built on top of Check-ins, the goal→guidance chain CLAUDE.md's mentor framing calls for is essentially complete short of AI: Goals → Check-ins → Progress. Remaining non-AI-blocked candidates are a visual/UX polish pass (Dashboard/Goals/Profile have grown several new sections since their last design pass) or closing the Check-ins ADR documentation gap noted above. Worth confirming with the user rather than assuming.
