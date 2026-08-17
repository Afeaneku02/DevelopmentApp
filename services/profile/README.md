# services/profile

The User Profile domain (MVP Blueprint §5): the canonical user record - display name, timezone, locale, and preferences - separate from `services/auth`'s identity/credential concerns.

Blueprint §5 names no `createProfile()` function, only `getProfile()`/`updateProfile()`. This implementation follows that: a profile is lazily created with explicit defaults on first access (`getProfile` or `updateProfile`), so there's no separate creation step or endpoint - matching "profile loads after sign-in" from the Definition of Done without needing Onboarding to exist first.

`buildSafeProfileContext()` (Blueprint §5's AI touchpoint - summarizing profile/preferences into safe AI context) is not implemented yet - there's no AI integration to consume it, and building it without a defined "safe" boundary and a real caller would be speculative.
