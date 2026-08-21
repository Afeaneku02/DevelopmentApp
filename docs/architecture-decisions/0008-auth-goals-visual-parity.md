# ADR 0008: Bring AuthScreen/GoalsScreen to visual parity with ProfileScreen

**Status:** Accepted

## Context

ADR 0007 introduced a real design system while building `ProfileScreen`, but explicitly deferred applying it to `AuthScreen`/`GoalsScreen` beyond a light color-token retrofit, leaving the app looking like "two different products stitched together." The user asked for this closed out before moving to the next feature (finishing the Goals lifecycle).

## Decision

- **The horizon-band signature element goes on `AuthScreen` only, not `GoalsScreen` too.** Auth is a genuine first-impression/threshold moment - the horizon motif's "where I am → where I want to be" meaning fits signing up specifically. Giving the same band to `GoalsScreen`, a screen visited repeatedly for routine work, would dilute it from a signature into wallpaper, against the visual-designer skill's explicit guidance against overusing a motif.
- **`GoalsScreen`'s suggested-goal buttons now use the same `.option-card`/`.option-cards` classes as `ProfileScreen`'s preference pickers**, removing the near-duplicate `.suggested`/`.suggested button` CSS entirely. Both are the same interaction (choose one from a described option) and now look and behave identically - hover-lift, shadow, selected state.
- **A shared `--shadow-card` token** gives `.goals li` and `.option-card` real depth (soft shadow) instead of flat bordered boxes, consistent between light and dark themes (recomputed per-theme since shadows barely read against dark backgrounds without more contrast).
- **One small motion moment**: new goal list items fade/slide in (`fadeInUp`, 250ms) when added - matching the visual-designer skill's "saving a goal" example of meaningful motion worth prioritizing. Respects `prefers-reduced-motion` via the existing global rule.
- **No new "wrap everything in a card" pattern was introduced.** `ProfileScreen` itself doesn't wrap whole sections in cards - only individual selectable items (`option-card`) are elevated. `GoalsScreen`'s "Add a goal" section and `AuthScreen`'s form stay on the plain page background, matching that established pattern rather than inventing a new one.

## Consequences

- All three screens now read as one consistent product: shared tokens, shared card/shadow treatment, shared serif-heading typography, one restrained use of the horizon motif rather than three.
- A screenshot taken immediately after a goal is created can catch the entrance animation mid-flight and look like a rendering bug (a card appearing faded) - confirmed via a follow-up screenshot after the animation settles that this is expected, not an actual defect. Worth remembering when writing future browser-verification scripts for this screen: wait past 250ms after a list update before asserting on visual state.
