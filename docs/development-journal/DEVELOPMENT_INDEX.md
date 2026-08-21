---

name: better-you-development-journal
description: Maintain a detailed, dated development history for the Better You project. Use after meaningful development work, when ending a coding session, when an important discovery is made, when a technical assumption changes, or when a reusable lesson is learned. The journal must be understandable to both technical and non-technical readers without becoming superficial.
-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

# Better You Development Journal

## Purpose

Maintain a durable development history for the **Better You** application.

The journal should explain:

* what was worked on;
* why it was worked on;
* what changed;
* how it works;
* important decisions;
* problems encountered;
* how problems were solved;
* new lessons learned;
* discoveries that may matter later;
* unfinished work;
* recommended next steps.

The journal is intended to preserve project knowledge over months and years.

It should be useful to:

* the project owner;
* future developers;
* technical reviewers;
* non-technical collaborators;
* someone returning to the project after a long absence.

Do not write shallow activity logs.

The goal is **meaningful project memory**.

---

# 1. Journal Locations

Store normal development-session entries in:

`docs/development-journal/daily/`

Store significant reusable technical discoveries in:

`docs/development-journal/lessons-learned/`

Maintain:

`docs/development-journal/DEVELOPMENT_INDEX.md`

as a navigational index of major work and lessons.

Do not store development journal entries inside `.claude/`.

---

# 2. File Naming

Daily development entries should use:

`YYYY-MM-DD-development-log.md`

Example:

`2026-08-15-development-log.md`

If multiple sessions happen on the same day, append to the existing daily file rather than creating duplicate daily files.

Reusable lessons should use descriptive names such as:

`2026-08-15-react-state-persistence-lesson.md`

or:

`2026-08-15-goal-validation-ai-output-lesson.md`

---

# 3. When to Write

Update the journal after meaningful development work.

Examples:

* a feature was implemented;
* an existing feature was significantly changed;
* architecture was changed;
* a bug required meaningful investigation;
* a technical decision was made;
* a new dependency was introduced;
* a database or data-model decision was made;
* a new integration was created;
* important tests were added;
* a development session is ending.

Do not create journal noise for extremely small actions such as:

* fixing one spelling error;
* renaming one obvious local variable;
* adjusting trivial spacing;
* running a command that produced no meaningful new information.

---

# 4. Write Important Discoveries Immediately

Do not wait until the end of the session when something particularly important is discovered.

Create or update a lesson when:

* an assumption proved incorrect;
* undocumented behavior was discovered;
* a difficult bug revealed something important;
* a framework behaved unexpectedly;
* an API had important behavior or limitations;
* a pattern was discovered that will likely be reused;
* a technical approach failed for an instructive reason;
* a new Better You-specific engineering principle was discovered.

A significant lesson should not disappear into a generic daily summary.

---

# 5. Audience

Write so that both of these people can understand the entry:

### Technical reader

A developer should understand enough detail to:

* reproduce the reasoning;
* find the relevant code;
* understand the implementation;
* continue the work.

### Non-technical reader

Someone without deep software expertise should understand:

* what changed;
* what problem was solved;
* why it matters to Better You;
* what the outcome means.

Do not accomplish this by removing technical information.

Instead, **bridge the gap**.

Explain technical concepts in plain language and then provide the technical details.

---

# 6. Avoid Surface-Level Notes

Do not write entries such as:

> Worked on goals today. Added some components and fixed bugs.

That is insufficient.

Instead explain:

* what part of goal creation was implemented;
* what files or systems were affected;
* how data travels through the feature;
* why the implementation was chosen;
* what problem occurred;
* how it was solved;
* what remains.

Someone reading the note months later should recover meaningful context without reconstructing everything from Git history.

---

# 7. Daily Development Entry Format

Use this structure.

# Better You Development Log — YYYY-MM-DD

## Session Overview

Explain in plain language what the development session focused on and why it matters to Better You.

This should give someone enough context to understand the day's work without reading the rest of the file.

---

## Starting Point

Explain what existed before today's work.

Include relevant:

* existing behavior;
* limitations;
* unfinished work;
* assumptions;
* dependencies.

This establishes the before-state.

---

## Goal for This Session

State the intended outcome.

Explain what "done" was expected to mean.

---

## Work Completed

For each meaningful change, describe:

### What Changed

Explain the change.

### Why It Changed

Explain the problem or requirement that caused the change.

### How It Works

Explain the implementation.

When useful, reference:

* files;
* directories;
* functions;
* components;
* services;
* database structures;
* API endpoints.

Use examples when they make the explanation easier to understand.

---

## Example Flow

When useful, provide a concrete example of the feature working.

For example:

> A user selects "Improve My Career."
>
> The frontend creates a draft goal.
>
> The goal service validates the required fields.
>
> The API stores the goal.
>
> The application receives the saved goal ID and sends the user to the next step.

Examples should bridge the gap between technical implementation and user behavior.

Do not include an example when it adds no explanatory value.

---

## Problems Encountered

For meaningful problems explain:

### Problem

What happened?

### Investigation

What evidence was examined?

### Root Cause

What actually caused the problem?

### Solution

How was it fixed?

### Why the Solution Works

Explain why the fix resolves the underlying issue instead of merely hiding the symptom.

---

## Decisions Made

Document meaningful decisions.

For each decision explain:

* the decision;
* available alternatives when relevant;
* why this option was selected;
* tradeoffs;
* whether the decision is temporary or expected to remain long-term.

Do not pretend a decision was permanent if it was simply the fastest MVP choice.

---

## Files Significantly Changed

List meaningful files and explain their role.

Example:

`apps/web/src/features/goals/GoalForm.tsx`

Purpose: Handles the primary goal-entry interface.

Do not list every file touched automatically.

Include files that help someone understand where the work lives.

---

## Testing and Validation

Explain how the work was verified.

Include relevant:

* automated tests;
* manual tests;
* commands;
* scenarios;
* edge cases.

Do not claim something was tested if it was not actually tested.

Clearly distinguish:

**Tested**

from:

**Not yet tested**

---

## Current State

Explain what now works at the end of the session.

This should describe the actual project state, not the intended state.

---

## Known Issues

Record meaningful known problems.

If none are known, say:

**No known issues identified during this session.**

Do not imply that this guarantees there are no bugs.

---

## Next Recommended Step

Explain the most logical next development task and why it should come next.

Avoid producing a huge backlog here.

Focus on the immediate continuation point.

---

# 8. Lessons Learned

When something meaningful was learned during development, include a short reference in the daily log and create a dedicated lesson entry when appropriate.

A lesson must explain more than:

> We learned X.

It must preserve **how the knowledge was acquired**.

---

# 9. Dedicated Lesson Format

Use:

# Better You Lesson Learned — [Topic]

**Date:** YYYY-MM-DD

## Lesson

Clearly state what was learned.

---

## Context

Explain what was being built or investigated when this lesson appeared.

---

## How We Discovered It

This section is mandatory.

Describe the actual path that led to the discovery.

Include relevant:

* original assumption;
* implementation attempted;
* unexpected behavior;
* error message;
* failed test;
* code observation;
* documentation discovery;
* comparison;
* debugging evidence.

Do not rewrite history as if the answer was obvious from the beginning.

Preserve the reasoning trail.

---

## Example

Provide a concrete example when it improves understanding.

Show:

**Expected**

versus:

**Actual**

when appropriate.

---

## Root Explanation

Explain technically why the observed behavior occurs.

For a non-technical concept, add a plain-language analogy when helpful.

Do not substitute an analogy for the technical explanation.

---

## How It Was Implemented

Explain exactly how the discovery affected the Better You implementation.

Reference relevant:

* files;
* components;
* functions;
* configuration;
* commands;
* patterns.

Where appropriate, include a small code example or pseudocode.

---

## Why We Recorded This

Explicitly explain why this knowledge deserves permanent documentation.

Examples:

* likely to appear again;
* easy mistake for another developer to make;
* affects architecture;
* changes how a library should be used;
* applies to multiple Better You features;
* reveals an important limitation;
* creates a useful reusable pattern.

---

## Potential Future Uses

Explain where else this knowledge may apply.

Examples:

* onboarding;
* goal creation;
* progress tracking;
* authentication;
* notifications;
* AI recommendations;
* mobile application;
* analytics;
* testing;
* infrastructure.

Do not invent unrealistic use cases.

---

## Reusable Rule

When appropriate, conclude with a concise rule that future developers can apply.

Example:

> Validate model-generated structured data in application code even when the prompt requires JSON.

This turns an isolated discovery into reusable project knowledge.

---

# 10. DEVELOPMENT_INDEX.md

Maintain an index at:

`docs/development-journal/DEVELOPMENT_INDEX.md`

The index should help a reader find important history without opening every daily file.

Organize it into:

## Development Timeline

Date | Area | Summary | Journal

## Important Lessons

Date | Lesson | Why It Matters | Document

## Major Technical Decisions

Date | Decision | Status | Journal

Update the index when a significant development log or lesson is created.

Do not add trivial entries to the index.

---

# 11. Preserve Historical Accuracy

Journal entries are historical records.

Do not silently rewrite old entries because the implementation later changed.

Instead:

* preserve the original entry;
* add a later entry explaining what changed;
* cross-reference the previous decision when useful.

If an old entry contains a factual mistake that genuinely requires correction, clearly label the correction and date it.

---

# 12. Distinguish Facts From Interpretation

Use clear language.

Prefer:

> Testing showed the API returned a 400 response when `goalType` was missing.

instead of:

> The API doesn't like missing goal types.

For uncertain conclusions, say:

> Current evidence suggests...

Do not present guesses as established project knowledge.

---

# 13. Git Is Not the Journal

Do not treat Git commit history as a replacement for the development journal.

Git explains **what changed in files**.

The journal should preserve:

* why it changed;
* what was learned;
* how decisions were made;
* what problems occurred;
* what comes next.

Do not duplicate raw diffs into the journal.

---

# 14. Keep Entries Useful

Be detailed, but do not create documentation for documentation's sake.

Prefer meaningful explanation over enormous word count.

Include technical depth where necessary.

Use examples where they bridge understanding.

Avoid:

* generic filler;
* repetitive summaries;
* unnecessary restatement;
* speculation presented as fact;
* enormous file dumps;
* raw terminal output unless it directly matters to a lesson.

---

# 15. End-of-Session Behavior

At the end of a meaningful coding session:

1. Inspect the changes made during the session.
2. Review relevant Git diff/status when available.
3. Identify major work completed.
4. Identify problems solved.
5. Identify decisions made.
6. Identify meaningful lessons discovered.
7. Update today's development log.
8. Create dedicated lesson files when warranted.
9. Update `DEVELOPMENT_INDEX.md` when significant entries were added.
10. Record the most logical next step.

Do not rely entirely on conversational memory.

Use the actual repository state when documenting completed work.

---

# 16. Journal Integrity

Never claim:

* a feature is complete when it is not;
* tests passed when they were not run;
* a bug was solved when the result was not verified;
* a decision was made by the user when Claude made the assumption.

Clearly identify unfinished or uncertain work.

The development journal should be trustworthy enough that future development decisions can rely on it.

---

# Index

## Development Timeline

| Date | Area | Summary | Journal |
|---|---|---|---|
| 2026-08-15 | Goals | Implemented Goal Creation Core: project skeleton, `Goal` data model/validation, suggested + custom goal entry, `createGoal`/`listGoals`, dev-stub identity, unit + integration tests | [2026-08-15-development-log.md](daily/2026-08-15-development-log.md) |
| 2026-08-15 | Goals / Web | Built `apps/web` dev-preview UI for Goal Creation Core; made `packages/config` and `services/goals` browser-safe; verified end-to-end with a real (headless) browser | [2026-08-15-development-log.md](daily/2026-08-15-development-log.md) (continued section) |
| 2026-08-16 | Auth | Implemented Minimal Real Auth: `AuthProvider`/`LocalAuthProvider` (scrypt + sessions), `UserRepository`, `AuthService` with all 7 Blueprint functions, failed-login lockout, full unit + integration test coverage. Server-side only; not yet wired to `apps/web` | [2026-08-16-development-log.md](daily/2026-08-16-development-log.md) |
| 2026-08-16 | API | Built `apps/api` (Express 5): versioned `/api/v1/auth/*`, `/me`, `/goals` routes over the real Auth and Goals domains, bearer-token sessions, consistent error envelope, 13 HTTP-level tests, verified live with real `curl` requests. `apps/web` not yet wired to it | [2026-08-16-development-log.md](daily/2026-08-16-development-log.md) (2nd continued section) |
| 2026-08-16 | Web / Profile | Wired `apps/web` to `apps/api` for real (signup/login screens, in-memory bearer token, `GoalService` calls replaced with `fetch`); built the Profile domain (Blueprint §5) and wired it into `apps/api`. Verified live in a real browser and with `curl` | [2026-08-16-development-log.md](daily/2026-08-16-development-log.md) (3rd continued section) |
| 2026-08-16 | Web (design) | Built the Profile screen as the app's first designed (not dev-preview) screen via the visual-designer skill: Sky/Midnight design tokens, horizon-band signature element, description-card preference pickers. Auth/Goals screens lightly retrofitted onto the new tokens | [2026-08-16-development-log.md](daily/2026-08-16-development-log.md) (4th continued section) |
| 2026-08-16 | Web (design) | Brought Auth/Goals screens to full visual parity with Profile: horizon band on Auth only, suggested-goal buttons unified onto `.option-card`, shared shadow token + entrance animation. Verified live across all three screens, both themes | [2026-08-16-development-log.md](daily/2026-08-16-development-log.md) (5th continued section) |
| 2026-08-16 | Goals | Finished the Goals lifecycle: state machine (pause/resume/complete/archive), append-only history, owner-only get/update, wired into `apps/api` and `apps/web` (status badges, actions, inline edit). Fixed a real active-goal-count bug found during live verification | [2026-08-16-development-log.md](daily/2026-08-16-development-log.md) (6th continued section) |
| 2026-08-18 | Onboarding | Built First-Run Onboarding (welcome/consent/profile basics/preferences/first goal), deliberately scoped short of Blueprint §6 (no `completedAt`, no `completeOnboarding()`). Extracted `AddGoalForm` + profile-option constants for reuse. Verified resume actually works, not just doesn't crash | [2026-08-18-development-log.md](daily/2026-08-18-development-log.md) |
| 2026-08-19 | Onboarding | Fixed a Codex-reviewed medium finding: `recordFirstGoal` now validates goal ownership via a `GoalLookup` (real `GoalService`) before recording, rejecting fake/foreign goal ids (verified live: `404 GOAL_NOT_FOUND`). Also fixed 3 missing `.catch()` handlers that could hang the UI on "Loading…" | [2026-08-19-development-log.md](daily/2026-08-19-development-log.md) |
| 2026-08-19 | Dashboard | Built a Goals-only "mentor home" Dashboard (Blueprint §10 scoped down the same way Onboarding was): active/paused/completed summary + a rule-based `nextAction` heuristic (resume-paused > flag-stale > suggest-new > affirm). Replaces Goals as the post-onboarding landing screen; verified live through the full heuristic state progression, both themes | [2026-08-19-development-log.md](daily/2026-08-19-development-log.md) (continued section) |
| 2026-08-19 | Check-ins | Discovered Codex had already designed and merged a full Check-ins domain (PR #4) in parallel with independent scoping; reviewed the actual diff/tests per `AGENTS.md` instead of assuming or rebuilding - confirmed sound (185/185 tests, clean typecheck). Built the genuine remaining gap: a per-goal check-in history view on the Goals screen, consuming an already-existing but previously-unused API endpoint. Verified live, both themes | [2026-08-19-development-log.md](daily/2026-08-19-development-log.md) (2nd continued section) |
| 2026-08-19 | Progress | Built a Goals + Check-ins-only Progress domain: deterministic consistency scoring (yes=1/partly=0.5/no=0, skipped excluded) and an earlier-half/later-half trend heuristic (improving/steady/declining/not_enough_data), both explicitly placeholder-labeled. Surfaced lightly as a Dashboard section and a line in the Goals history panel, not a new screen. Verified live, both themes | [2026-08-19-development-log.md](daily/2026-08-19-development-log.md) (3rd continued section) |
| 2026-08-20 | Dashboard/Goals (design) | Visual hierarchy pass via the visual-designer skill: a global quiet `section h2` treatment, an elevated gradient next-action card, Dashboard's stats+progress merged into one "Overview," a shared `ConsistencyMeter` component (percentage + trend badge + gradient bar) replacing duplicated markup, and a three-tier restructure of the Goals check-in history panel. Presentation-only; verified live, both themes | [2026-08-20-development-log.md](daily/2026-08-20-development-log.md) |
| 2026-08-20 | Process / verification | Code review fixes: removed a trailing-blank-line `git diff --check` failure in `styles.css`, moved uncommitted work off a stale already-merged branch onto new branch `dashboard-goals-ux-polish` from updated `origin/main`. Discovered `docs/` has been gitignored since the first commit (no ADR/journal ever tracked) - reported to the user, left as-is per their direction. Live-verified Profile/Onboarding are unaffected by ADR 0014's global heading rule (CSS specificity already protects them) - no code changes needed | [2026-08-20-development-log.md](daily/2026-08-20-development-log.md) (continued section) |
| 2026-08-20 | Documentation | Wrote ADR 0015, closing the documentation gap ADR 0012/0013 had both flagged: Codex's Check-ins domain never had its own ADR. Purely retroactive - documents the domain as already reviewed and tested, no functional changes | [2026-08-20-development-log.md](daily/2026-08-20-development-log.md) (2nd continued section) |

## Important Lessons

| Date | Lesson | Why It Matters | Document |
|---|---|---|---|
| 2026-08-15 | No browser driver (`chromium-cli`/`claude-in-chrome`) was available; a temporary `--no-save` Playwright install is a safe, reversible fallback for real UI verification | Prevents silently downgrading "verify in a browser" to "trust the build" when the usual tooling is missing | [lesson](lessons-learned/2026-08-15-browser-verification-without-chromium-cli-lesson.md) |
| 2026-08-15 | `tsconfig.json`'s `types` array is an allowlist, not an additive filter — setting it drops every ambient global not explicitly listed | Will recur as more `apps/*`/`services/*` configs set their own `types` (e.g. a future React Native app) | [lesson](lessons-learned/2026-08-15-tsconfig-types-array-narrows-globals-lesson.md) |
| 2026-08-16 | `Intl.supportedValuesOf('timeZone')` doesn't include `'UTC'` even though `Intl.DateTimeFormat` accepts it - validate timezones by construction, not enumeration | Our own default profile value (`timezone: 'UTC'`) failed our own validator; will recur anywhere timezone input is validated | [lesson](lessons-learned/2026-08-16-intl-supportedvaluesof-timezone-excludes-utc-lesson.md) |

## Major Technical Decisions

| Date | Decision | Status | Journal |
|---|---|---|---|
| 2026-08-15 | MVP is evolutionary; provider integrations (repository, identity) sit behind adapters/interfaces, not concrete vendors | Accepted | [ADR 0001](../architecture-decisions/0001-mvp-evolutionary-adapter-based.md) |
| 2026-08-15 | Goal Creation Core milestone scope: creation-only Goals slice against a dev-stub user; Auth, AI refinement, and roadmap generation deferred | Accepted | [ADR 0002](../architecture-decisions/0002-goal-creation-core-milestone.md) |
| 2026-08-15 | `apps/*` adopts npm workspaces (first package with real runtime dependencies); shared domain code (`packages/config`, `services/goals`) kept isomorphic so it runs unchanged in Node and the browser | Accepted | [ADR 0003](../architecture-decisions/0003-web-app-workspace-and-isomorphic-domain-code.md) |
| 2026-08-16 | Minimal Real Auth built as a local `AuthProvider` adapter (not Supabase, unverifiable without live credentials); `services/auth` stays server-side only and is not made isomorphic, unlike Goals | Accepted | [ADR 0004](../architecture-decisions/0004-minimal-real-auth-local-adapter.md) |
| 2026-08-16 | Minimal HTTP API layer: `apps/api` on Express 5, bearer tokens over cookies (revisit before production), versioned routes, consistent error envelope; `apps/web` intentionally not wired yet | Accepted | [ADR 0005](../architecture-decisions/0005-minimal-http-api-layer.md) |
| 2026-08-16 | Profile domain: lazy default-creation (no separate create step, matching Blueprint §5's own function list), concrete Vision-grounded preference fields instead of an open blob, `buildSafeProfileContext()` deferred (no AI consumer yet) | Accepted | [ADR 0006](../architecture-decisions/0006-profile-domain.md) |
| 2026-08-16 | Profile screen introduces the app's design-token system (Sky Mode / Midnight Mode via `prefers-color-scheme`); Auth/Goals screens retrofitted onto the tokens but not redesigned; no routing library added yet | Accepted | [ADR 0007](../architecture-decisions/0007-profile-screen-and-design-tokens.md) |
| 2026-08-16 | Auth/Goals screens brought to visual parity with Profile: horizon band reserved for Auth only (not overused across every screen), suggested-goal buttons unified onto the shared `.option-card` pattern | Accepted | [ADR 0008](../architecture-decisions/0008-auth-goals-visual-parity.md) |
| 2026-08-16 | Goal lifecycle: state machine matches Blueprint §7's action list exactly (no unarchive/reopen); history is a separate append-only store with no update/delete method; status changes only possible through dedicated transition methods, never generic edit | Accepted | [ADR 0009](../architecture-decisions/0009-goal-lifecycle.md) |
| 2026-08-18 | First-Run Onboarding scoped short of Blueprint §6: no `completedAt`, no `completeOnboarding()`, terminal step is `awaiting_roadmap` not "complete"; OnboardingState is a thin progress tracker, not a duplicate data store | Accepted | [ADR 0010](../architecture-decisions/0010-first-run-onboarding.md) |
| 2026-08-19 | Goals-only Dashboard scoped short of Blueprint §10 (no Roadmap/Check-ins/Progress dependencies): `nextAction` is a documented rule-based heuristic, not AI; `completedGoalsCount` counts current status only, not "ever completed"; Dashboard replaces Goals as home | Accepted | [ADR 0011](../architecture-decisions/0011-goals-only-dashboard.md) |
| 2026-08-19 | Goal check-in history is inline on the existing Goals card (not a new screen/route), fetched fresh on every open (not cached across opens - caching was tried and caught in review before pushing), visible for goals of any status (history review is a different concern from check-in creation, which stays active-goal-only) | Accepted | [ADR 0012](../architecture-decisions/0012-goal-check-in-history-view.md) |
| 2026-08-19 | Progress domain depends on Check-ins only (`CheckInsView`, satisfied by the real `CheckInService`, no separate `GoalsView`); consistency and trend math live in one pure, independently-tested module; reflects a goal's full history regardless of current status; surfaced as light additions to Dashboard/Goals, not a new screen | Accepted | [ADR 0013](../architecture-decisions/0013-goals-check-ins-progress.md) |
| 2026-08-20 | Dashboard/Goals visual hierarchy: global quiet `section h2` treatment, next-action elevated as the one loud element per screen, stats+progress merged into one Overview, a shared `ConsistencyMeter` component (no duplicated markup), Goals history panel restructured into three visual tiers | Accepted | [ADR 0014](../architecture-decisions/0014-dashboard-goals-visual-hierarchy.md) |
| 2026-08-20 | Check-ins domain (retroactive): quick-response yes/no/partly/skipped model, active-goal-only creation enforced via a `GoalLookup` structural interface, two read shapes (all-of-user's vs. per-goal-with-summary) - documents Codex's already-merged, already-tested implementation, no functional changes | Accepted | [ADR 0015](../architecture-decisions/0015-check-ins-domain-retroactive.md) |
