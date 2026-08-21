# ADR 0007: Profile screen - first designed screen, introduces the token-based design system

**Status:** Accepted

## Context

Every `apps/web` screen so far (`AuthScreen`, `GoalsScreen`) was a bare-bones dev-preview: functional, unstyled beyond one accent color, no relationship to Vision's actual product identity. The Profile screen was the first screen built through the `better-you-visual-designer` skill instead of as another functional placeholder, per the user's own framing of this milestone as "a good next opportunity to actually use the UI/UX and visual-design skills on a real screen."

## Decision

- **Visual direction: calm editorial, Sky Mode.** A reflective, personal screen (setting up who you are) reads differently from an action screen (creating a goal) - generous spacing, a warm off-white/sky-blue palette, a serif display face (`Georgia, "Palatino Linotype", "Book Antiqua", serif` - reliable cross-platform, zero network dependency) paired with the existing system-sans body font.
- **Signature element: a "horizon band."** A single slim gradient strip at the top of the screen with one restrained blurred glow - used once, not repeated per-section, per the visual-designer skill's explicit "do not turn every screen into a road illustration" guidance.
- **Real design tokens introduced** (`apps/web/src/styles.css` `:root` custom properties) for both Sky Mode and Midnight Mode. Midnight Mode is implemented via `prefers-color-scheme: dark` (automatic, follows OS preference) - a manual in-app theme toggle was explicitly not built this milestone, since that's a distinct feature (settings UI + persisted preference), not part of "build the profile screen."
- **`AuthScreen`/`GoalsScreen` got a light token retrofit only**: their hardcoded hex colors were swapped for the new tokens (so the whole app shares one palette and both screens get Midnight Mode for free), but their layouts were not redesigned - a full visual pass on those screens is separate, explicitly-scoped-out work.
- **Control types chosen deliberately, not defaulted to raw text inputs:**
  - Timezone: a native `<select>` populated from `Intl.supportedValuesOf('timeZone')` with `'UTC'` prepended explicitly (that API excludes it - see the `services/profile` lessons-learned entry; the same fix applies client-side).
  - Locale: a curated `<select>` of ~15 common locales, not a free-text field or an exhaustive database (no browser-built-in enumerates "all locales" the way `supportedValuesOf('timeZone')` does for zones) - an "Other" free-text escape hatch was deliberately not added yet, deferred until someone actually needs an uncommon locale.
  - `onboardingMode`/`interactionMethod`: selectable description-cards (reusing the suggested-goal-card interaction pattern already established in `GoalsScreen`), not bare `<select>` dropdowns, since each option carries real Vision-sourced meaning a dropdown label alone wouldn't convey. `guided_middle_ground` is marked "Recommended," matching Vision §5.2's own framing. `voice`/`blend` remain selectable (the preference is real and worth capturing per CLAUDE.md §6's data-model-first principle) but carry an inline note that voice input isn't implemented in this preview yet.

## Consequences

- Simple view-state navigation (`App.tsx`'s `view: 'goals' | 'profile'`) was added rather than a routing library - three screens don't yet justify `react-router-dom`; revisit once URL-addressable routes are actually needed (e.g., a multi-step Onboarding flow).
- `AuthScreen` and `GoalsScreen` still visually read as an earlier-generation dev preview next to `ProfileScreen`'s more considered design - this asymmetry is intentional and temporary, not an oversight.
- No manual theme toggle exists yet; Midnight Mode only activates via OS-level `prefers-color-scheme`. A future settings screen (naturally, Profile's own future expansion) is the right place to add an explicit override.
