# Better You Development Log — 2026-08-20

## Session Overview

Asked "what's next" following the previous session's Progress domain work. Presented the remaining non-AI-blocked candidates (a visual/UX polish pass, or writing the still-missing Check-ins ADR) with a recommendation for the polish pass, since Dashboard and Goals had grown several features (next-action, stats, progress, check-in history) without ever being composed as a whole screen. The user agreed, invoking the `better-you-visual-designer` skill for direction before implementing.

---

## Starting Point

Every domain from Auth through Progress was real, tested, and wired together (ADR 0013). Dashboard and Goals had each accumulated multiple sections across separate milestones - each internally consistent with the Sky/Midnight token system, but never stepped back and composed together. Both screens read as plain, evenly-weighted vertical stacks with no hierarchy distinguishing the one thing to act on from supporting detail.

---

## Goal for This Session

Give Dashboard and Goals real visual hierarchy without introducing a new aesthetic, a new dependency, or any functional change - extend the existing token system rather than replace it, and verify nothing broke via the same live-browser, both-themes discipline every prior milestone used.

---

## Work Completed

### What Changed

- Added a global `section h2` rule (`apps/web/src/styles.css`): small, uppercase, `--color-text-secondary`. Previously `<h2>` had no dedicated rule at all and fell back to the browser default (bold, ~1.5em), which competed visually with `<h1>` on every screen - demoting every section heading to the same quiet weight is what let one element per screen actually read as primary.
- `.next-action` (Dashboard's next-action card) got a two-tone gradient background (`--color-horizon-start → --color-sky-100`, echoing `.horizon-band`'s stops as a flat fill rather than its literal banded motif, which ADR 0008 reserves for Auth/Onboarding), a small "NEXT" label, and the shared `--shadow-card` token - it's now the one visually loud element on Dashboard.
- Merged Dashboard's separate stats and progress sections into one "Overview" (`.dashboard-overview`/`.overview-tiles`) - both were "at a glance" numeric reads that didn't need separate headings; the progress tile sits in the same row as the three stat tiles, just wider.
- Built `ConsistencyMeter` (`apps/web/src/components/ConsistencyMeter.tsx`) - a shared component replacing markup that had been duplicated ad hoc between `DashboardScreen` and `GoalsScreen` in the previous session. Renders the consistency percentage, the trend badge, and a new thin gradient bar (`--color-sky-300 → --color-sky-600`) - the one new visual idea introduced, reused identically everywhere Progress appears.
- Restructured the Goals history panel into three visual tiers: `ConsistencyMeter` at the top, per-response counts as small colored count badges (reusing the same tokens `.response-badge` already established) instead of one run-on sentence, then the entry timeline below.
- Removed now-orphaned CSS (`.progress-summary`/`.goal-progress-line`) left over from the previous session's ad hoc markup, now superseded by `ConsistencyMeter`.
- Recorded ADR 0014.

### Why It Changed

Directly requested via the `better-you-visual-designer` skill after the user picked "visual/UX polish pass" from the presented options. No Blueprint/Vision section was cited for this decision - it's a design-quality pass, not a new feature - so the skill's own design-direction framework (visual direction, signature element, theme treatment) is what guided the specific choices instead.

### How It Works

The hierarchy comes almost entirely from one change: giving every section heading the same quiet, uniform treatment frees up exactly one element per screen (the next-action card) to be visually elevated instead of competing with four or five equally-weighted headers. `ConsistencyMeter` is a pure presentational component with no data-fetching of its own - both screens already fetch `GoalProgress`/`OverallProgress` (from the previous session's work) and just pass `consistency`/`trend` in as props, so no new API calls were introduced by this pass.

---

## Problems Encountered

None - this was a presentation-only pass with no data flow changes, and typecheck/tests passed on the first run after implementation.

---

## Decisions Made

- **`section h2` is a global rule, not scoped to Dashboard/Goals** - applies to every screen using `<section><h2>` (Profile, Onboarding included), since the visual-designer skill's own theme-consistency rule means a heading shouldn't look different by accident depending on which screen it's on.
- **The next-action card's gradient reuses `.horizon-band`'s existing color stops, not new ones** - keeps the "echo, don't repeat" relationship ADR 0008 established (horizon band itself stays reserved for Auth/Onboarding; Dashboard gets a flatter, quieter gradient built from the same tokens).
- **One shared `ConsistencyMeter` component instead of continuing to duplicate the markup** - the visual-designer skill explicitly warns against visual code duplication; this was also the natural point to introduce the bar, since duplicated markup would have meant implementing it twice.
- **No new dependency, no new dark-mode-specific CSS** - the bar's gradient and every other new rule compose from existing tokens, so Midnight Mode renders correctly through the existing token overrides with zero additional rules.

---

## Files Significantly Changed

- `apps/web/src/components/ConsistencyMeter.tsx` - new shared component.
- `apps/web/src/screens/DashboardScreen.tsx` - Overview section merge, elevated next-action, `ConsistencyMeter` usage.
- `apps/web/src/screens/GoalsScreen.tsx` - history panel three-tier restructure, `ConsistencyMeter` usage, count badges.
- `apps/web/src/styles.css` - global `section h2`, `.next-action` elevation, `.overview-tiles`/`.progress-tile`, `.consistency-meter`/`.consistency-bar`, `.check-in-count-badges`/`.count-badge`, removed orphaned `.progress-summary`/`.goal-progress-line`.
- `docs/architecture-decisions/0014-dashboard-goals-visual-hierarchy.md` - new.

---

## Testing and Validation

**Tested:**
- `npm run typecheck`: clean across the whole repo.
- `npx vitest run`: 210/210 passing, unchanged from the previous session - no domain logic was touched.
- Live browser verification (temporary Playwright, real Chromium, both Sky and Midnight mode): seeded a user, a goal, and four check-ins (no, no, yes, yes - the same trend-verification data used in the Progress session) through the real API and real onboarding fast-forward, then confirmed Dashboard's Overview strip and the Goals history panel both rendered the new hierarchy correctly in both themes. 0 console errors in either theme.

**Not yet tested:** Profile and Onboarding screens weren't specifically re-verified live after the global `section h2` rule change, since neither screen's layout depends on heading weight the way Dashboard/Goals now do - low risk, but not directly confirmed with a screenshot.

---

## Current State

Dashboard and Goals now read as composed screens with real visual hierarchy - one elevated focal element each, a quiet uniform tier for section labels, and a shared, recognizable "consistency meter" wherever Progress data appears - rather than a stack of independently-styled features. No functional behavior changed.

---

## Known Issues

- Unchanged from the previous session: Codex's original Check-ins domain still has no ADR of its own.

---

## Next Recommended Step

The AI Roadmap Engine remains blocked on the same unprovisionable-model-credential constraint. With the visual pass done, the two remaining non-AI-blocked items are: writing the missing Check-ins ADR (quick, low-risk documentation task), or a similar light design pass on Profile/Onboarding now that the global `section h2` change touches them too, even though neither was specifically re-verified live this session. Worth confirming with the user rather than assuming.

---
---

# Better You Development Log — 2026-08-20 (continued)

## Session Overview

Second session of the day: a code review of the visual hierarchy pass (ADR 0014) surfaced one file-hygiene issue and one process issue, both fixed; then closed the "not yet tested" gap that session's own journal entry had flagged by live-verifying Profile and Onboarding, which turned out to need no code changes at all.

---

## Starting Point

ADR 0014's visual hierarchy pass was implemented and locally verified, but still sitting as uncommitted changes on `progress-check-in-insights` - a branch that, unknown until this session, had already been merged into `origin/main` (as PR #6, "Add check-in progress insights") partway through the previous session.

---

## Work Completed

### What Changed

- **Fixed a trailing blank line in `styles.css`** that `git diff --check` flagged: the previous session's removal of the dead `.progress-summary`/`.goal-progress-line` rule had left a stray blank line at end-of-file. Removed it; confirmed `git diff --check` passes clean.
- **Moved the uncommitted visual-hierarchy changes to a new branch, `dashboard-goals-ux-polish`, from an updated `origin/main`**, replacing continued work on the stale `progress-check-in-insights` branch. Confirmed via `git diff progress-check-in-insights origin/main --stat` that the two were content-identical (the merge added no diff) before switching, so the move carried every uncommitted change over with zero conflicts. Re-ran `npm run typecheck` and the full suite (210/210) on the new branch to confirm.
- **Discovered `docs/` has been in `.gitignore` since the repository's very first commit** (`git ls-files docs/` returns zero files) - every ADR and every journal entry across the whole project, including this one, has never been tracked by git. Reported this to the user rather than silently changing `.gitignore` or force-adding anything, since it's a repo-wide decision, not this session's call to make unilaterally. Per the user's direction, left `docs/` ignored for now and continued writing entries locally as before.
- **Live-verified Profile and Onboarding** in both Sky and Midnight mode against the concern the previous session's journal had explicitly flagged as untested: whether the new global `section h2` rule (added for Dashboard/Goals) would affect Profile's existing section headings. Reading the CSS first showed it wouldn't - `.profile-section h2` (Profile's own rule from ADR 0007: serif display font, `--color-sky-700`, larger size) is more specific than the generic `section h2` rule, so it already wins on specificity without any additional override needed. The live check (a full onboarding walkthrough through Preferences - the only onboarding step using `<h2>`, and it reuses `.profile-section` - then through to Profile itself) confirmed exactly that: identical, unaffected rendering in both themes, 0 console errors. No code changes were needed.

### Why It Changed

The two fixes were direct code-review findings. The Profile/Onboarding check was the previous session's own flagged gap, closed out for completeness rather than left open indefinitely.

### How It Works

CSS specificity resolved this automatically: `.profile-section h2` (one class + one element) outranks `section h2` (two elements) regardless of source order, so Profile/Onboarding's pre-existing heading style silently wins wherever it's already applied - the ADR 0014 global rule only takes effect on the bare `<section><h2>` pairs that had no more specific rule of their own (Dashboard and Goals), which was the intended scope all along.

---

## Problems Encountered

- The live-verification script's first attempt reused the same signed-up user across both the light and dark theme passes, so the second iteration (dark) landed the user directly on Dashboard instead of at onboarding's welcome step, since that user had already completed onboarding during the light pass. Fixed by generating a fresh user per color scheme.
- The script's first attempt at reaching Profile also tried `page.reload()` after finishing onboarding via the API, which logged the user out (the session token lives only in React state, never `localStorage`, by design). Fixed by signing in again fresh rather than reloading.

---

## Decisions Made

- **`docs/` stays gitignored for now** - an explicit user decision, not a default; noted here so a future session doesn't need to rediscover it from scratch.
- **No ADR for the Profile/Onboarding check** - no architectural decision was made; this was verification of an existing one (ADR 0007's heading style), so it belongs in the journal, not a new ADR entry.

---

## Files Significantly Changed

- `apps/web/src/styles.css` - removed a trailing blank line at EOF.
- No other files changed this session; the Profile/Onboarding check required no code changes.

---

## Testing and Validation

**Tested:**
- `git diff --check` on `styles.css`: passes clean.
- `npm run typecheck` and `npx vitest run` on the new `dashboard-goals-ux-polish` branch: clean, 210/210 passing.
- Live browser verification (temporary Playwright, real Chromium, both Sky and Midnight mode): full onboarding walkthrough (welcome → consent → profile basics → preferences → API-completed first-goal step) through to Profile, confirming both screens' heading styles are unaffected by ADR 0014's global rule. 0 console errors in either theme.

**Not yet tested:** nothing new architecturally introduced this session.

---

## Current State

The visual hierarchy pass (ADR 0014) is fully verified across every screen it could plausibly have affected - Dashboard, Goals, Profile, and Onboarding - with no regressions found. Work now lives on `dashboard-goals-ux-polish`, branched from current `origin/main`, ready to continue or open a PR from.

---

## Known Issues

- Unchanged: Codex's original Check-ins domain still has no ADR of its own.
- `docs/` remains untracked by git (see Decisions Made above) - a standing, user-confirmed state, not an oversight to fix unprompted.

---

## Next Recommended Step

The AI Roadmap Engine remains blocked on the same unprovisionable-model-credential constraint. The one remaining non-AI-blocked, non-git-process item is writing the missing Check-ins ADR. Worth confirming with the user rather than assuming.

---
---

# Better You Development Log — 2026-08-20 (2nd continued)

## Session Overview

Third session of the day: closed the last remaining item from the list, writing ADR 0015 to document Codex's already-merged Check-ins domain, which ADR 0012 and ADR 0013 had both flagged as a known documentation gap rather than silently backfilling at the time.

---

## Work Completed

Wrote `docs/architecture-decisions/0015-check-ins-domain-retroactive.md`, documenting the domain exactly as it was reviewed earlier (the quick-response `yes`/`no`/`partly`/`skipped` model, active-goal-only creation enforced via a `GoalLookup` structural interface satisfied by the real `GoalService`, the two read shapes `listCheckIns`/`getGoalCheckIns`, the in-memory repository, and the API surface) - no functional changes, purely a retroactive record explicitly labeled as such in its own Context section.

### Why It Changed

Directly requested, closing out the last item on the standing "what's next" list.

---

## Decisions Made

- **Numbered sequentially (0015) rather than inserted earlier in the sequence** - ADRs are numbered by when they're written, not by when the underlying work happened, consistent with the "preserve historical accuracy" journal convention. Its own Context section makes the retroactive nature explicit so a future reader isn't misled into thinking it predates ADR 0012/0013, which it doesn't chronologically but does depend on for context.

---

## Files Significantly Changed

- `docs/architecture-decisions/0015-check-ins-domain-retroactive.md` - new.

---

## Current State

Every domain in the project - Auth, Profile, Goals, Onboarding, Dashboard, Check-ins, Progress - now has its own ADR. The documentation gap flagged since the Check-ins discovery session is closed.

---

## Known Issues

- `docs/` remains untracked by git, per the user's standing decision from the previous session.

---

## Next Recommended Step

The AI Roadmap Engine remains blocked on the same unprovisionable-model-credential constraint. With no other non-AI-blocked development items outstanding, the next real step is either checking whether a usable model credential has become available, or asking the user what they'd like to focus on next.

---
---

# Better You Development Log — 2026-08-20 (3rd continued)

## Session Overview

Fourth session of the day: the user picked the next milestone directly - "durable local persistence... Keep it adapter-based, do not rewrite domains, and preserve the existing service interfaces... stop losing app data on server restart using a simple testable local persistence layer." Every domain's data had lived only in `InMemory*Repository` instances since the project began; this closes that gap by adding a file-backed adapter alongside each one, at exactly the extension point ADR 0001 was designed for.

---

## Starting Point

Auth, Profile, Goals, Onboarding, Dashboard, Check-ins, and Progress were all real and fully wired, but every domain's actual data existed only in process memory - a server restart (or crash) silently discarded every account, goal, check-in, and profile that had ever been created.

---

## Goal for This Session

Add durable persistence without touching any domain service, route, or contract - only new adapters satisfying the repository interfaces that already existed, wired in as an alternative to the `InMemory*` implementations already used everywhere. Keep it simple (no new dependency, no database engine) and testable (a "restart" needs to be provably simulated, not just asserted).

---

## Work Completed

### What Changed

- Before writing any code, spawned a fork to inventory every repository interface (`GoalRepository`, `GoalHistoryRepository`, `UserRepository`, `ProfileRepository`, `OnboardingRepository`, `CheckInRepository`) and its exact `InMemory*` semantics - sort order, null-handling, reference-vs-copy behavior, id generation - so every new implementation would match exactly rather than approximately.
- New `packages/persistence` package: `readJsonArray()` (missing file → `[]`, not an error) and `writeJsonArrayAtomic()` (write to a temp file, then rename over the target, so a crash mid-write can't corrupt a data file) - Node builtins only, no new dependency.
- Six new `File*Repository` classes (`FileGoalRepository`, `FileGoalHistoryRepository`, `FileUserRepository`, `FileProfileRepository`, `FileOnboardingRepository`, `FileCheckInRepository`), one per existing interface, added alongside - not replacing - each `InMemory*` counterpart. Each loads its dataset once at construction and persists the full dataset after every mutation, preserving each domain's exact existing semantics (including two genuine cross-domain inconsistencies - Goals/Goal History sort oldest-first, Check-ins sorts newest-first - deliberately kept as-is rather than "fixed" as part of this change).
- **A real gap found mid-implementation**: `UserRepository` only holds the public `users` record - the actual password hash and session tokens live inside `LocalAuthProvider`'s own in-memory maps, behind the separate `AuthProvider` interface (ADR 0004). Persisting only `UserRepository` would have left accounts existing after a restart with no way to log back into them - worse than not persisting anything. Added `FileAuthProvider`, persisting identities (email + password hash); sessions stay in-memory only, a deliberate, explicitly-stated scoping decision (short-lived, 24h TTL - re-authenticating after a restart is normal, not lost data).
- `apps/api/src/server.ts`'s `createDefaultDependencies()` now takes an optional `dataDir` parameter - omitted (every existing test call site) means unchanged in-memory behavior; provided (real server startup only) means every repository is file-backed, rooted in that directory. `apps/api/src/index.ts` sources it from a new `DATA_DIR` env var (default `./data`), the same `getEnv()` pattern already used for `API_PORT`.
- Added `Apps/api/data/` to `.gitignore` - it now holds real credentials and user data.
- Fixed a pre-existing gap noticed along the way: `vitest.config.ts`'s `include` pattern only covered `services/**` and `tests/**`, silently excluding `packages/**` - the new `packages/persistence` unit tests weren't running until this was corrected.
- Recorded ADR 0016.

### Why It Changed

Directly requested, with the scope (adapter-based, no domain rewrites, simple, testable) specified by the user up front.

### How It Works

`createDefaultDependencies(dataDir?)` branches per repository: `dataDir ? new File*Repository(path.join(dataDir, '<name>.json')) : new InMemory*Repository()`. Every domain service (`GoalService`, `AuthService`, `ProfileService`, `OnboardingService`, `CheckInService`) is constructed exactly as before - it receives whichever repository implementation it's handed and has no idea which one it got, which is the entire point of the adapter pattern this project has used since ADR 0001.

---

## Problems Encountered

None during implementation - typecheck and the full suite passed on the first run after each new file was added. The `vitest.config.ts` include-pattern gap (above) was caught immediately by noticing the total test count hadn't moved after adding the first new test file, not by a failure.

---

## Decisions Made

- **Surveyed every repository interface via a fork before writing any implementation code** - matching semantics exactly (sort order, null vs. throw, copy vs. reference) mattered more here than in most changes, since a `File*Repository` that behaved subtly differently from its `InMemory*` counterpart would be a correctness bug hiding behind a passing-looking test suite.
- **`FileAuthProvider` persists identities but deliberately not sessions** - the same honesty-in-scoping pattern used throughout this project (Onboarding's missing `completedAt`, Dashboard's non-AI `nextAction`): stated explicitly in code and in the ADR, not a silent gap.
- **Optional `dataDir` parameter, not a second exported factory function** - keeps `createDefaultDependencies()` as the single source of truth for "what does a dependency set look like," with presence/absence of one argument being the only thing that changes, rather than two parallel functions that could drift apart.
- **One JSON file per domain, whole-file rewrite per mutation** - simple and correct at this project's current data volumes; explicitly not claimed to scale indefinitely (a real database remains the eventual answer ADR 0001 already left open).

---

## Files Significantly Changed

- `packages/persistence/src/jsonFileStore.ts`, `index.ts`, `README.md`, `__tests__/jsonFileStore.test.ts` - new package.
- `services/goals/src/fileGoalRepository.ts`, `fileGoalHistoryRepository.ts` + tests; `services/auth/src/fileUserRepository.ts`, `fileAuthProvider.ts` + tests; `services/profile/src/fileProfileRepository.ts` + tests; `services/onboarding/src/fileOnboardingRepository.ts` + tests; `services/check-ins/src/fileCheckInRepository.ts` + tests - six new adapters, each domain's own `index.ts` updated to export it.
- `apps/api/src/server.ts` - optional `dataDir` parameter, branches per repository.
- `apps/api/src/index.ts` - sources `DATA_DIR` from env.
- `tests/integration/persistence.integration.test.ts` - new, full-server restart simulation.
- `tsconfig.json`, `apps/api/tsconfig.json`, `vitest.config.ts` - `@better-you/persistence` alias; `vitest.config.ts`'s `include` also fixed to cover `packages/**`.
- `.gitignore` - `Apps/api/data/`.
- `docs/architecture-decisions/0016-file-backed-durable-persistence.md` - new.

---

## Testing and Validation

**Tested:**
- `npm run typecheck`: clean across the whole repo.
- `npx vitest run`: 238/238 passing (28 new: 7 `jsonFileStore` unit tests, 3-3-3-2-3-3 "simulated restart" tests across the six `File*Repository` domains, 3 `FileAuthProvider` tests, 3 full-server restart-simulation integration tests).
- **Live verification against a real, separately-started process** (beyond the automated suite, since this milestone is specifically about surviving a real restart, not just an in-process object swap): ran the actual `tsx src/index.ts` entrypoint with a real `DATA_DIR`, seeded an account/goal/check-in via real `curl` requests, confirmed the JSON files existed on disk with the right contents, hard-killed the process via `taskkill` (not a graceful shutdown), started a brand-new process against the same directory, and confirmed via `curl` that logging in and reading back the goal and check-in both worked identically to before the kill. Cleaned up the temp data directory and process afterward.

**Not yet tested:** behavior under concurrent writes from multiple server processes sharing one data directory - out of scope, since the Node server is single-process/single-threaded and nothing in this project runs multiple API instances against the same directory.

---

## Current State

Every domain's data now survives a real server restart, verified both by an automated integration test and by an actual process kill-and-restart against a real running server. No domain service, route, or contract changed to make this true.

---

## Known Issues

- `docs/` remains untracked by git, per the user's standing decision from an earlier session (unrelated to this milestone).

---

## Next Recommended Step

The AI Roadmap Engine remains blocked on the same unprovisionable-model-credential constraint. With durable persistence now in place, every non-AI-blocked foundational piece named across this project's history is built. Worth confirming with the user what matters most next, rather than assuming.
