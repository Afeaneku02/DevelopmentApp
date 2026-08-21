# Better You Lesson Learned — `Intl.supportedValuesOf('timeZone')` Doesn't Include `'UTC'`

**Date:** 2026-08-16

## Lesson

`Intl.supportedValuesOf('timeZone')` looks like the obvious way to validate a timezone string, but its enumeration excludes some identifiers that `Intl` otherwise treats as fully valid - `'UTC'` itself is the clearest example, and it isn't a version-specific quirk: `Intl.DateTimeFormat` and `Intl.supportedValuesOf` simply serve different purposes (constructing a formatter vs. enumerating the IANA zone database), and `'UTC'` is a valid special-cased identifier, not an IANA zone name. Validate a timezone by attempting to *construct* something with it (`new Intl.DateTimeFormat('en-US', { timeZone: value })`, catching the `RangeError` it throws for a real invalid zone), not by checking enumeration membership.

## Context

Building the Profile domain's `validateTimezone()` (Blueprint §5: "validated timezone/locale"), the plan was to use `Intl.supportedValuesOf('timeZone')` - a Node/browser built-in, avoiding any timezone-database dependency - cached in a `Set` and checked with `.has(value)`.

## How We Discovered It

The Profile domain's own default profile uses `timezone: 'UTC'` (a deliberate, sensible default for a user who hasn't set one). The very first test run failed: `validateProfileUpdate` threw `ProfileValidationError: unknown IANA timezone: UTC` on a test that passed `timezone: 'UTC'` as part of a full-update payload - our own chosen default value failed our own validator. A quick check confirmed it directly:

```js
Intl.supportedValuesOf('timeZone').includes('UTC')       // false
Intl.supportedValuesOf('timeZone').includes('Etc/UTC')   // also false
new Intl.DateTimeFormat('en-US', { timeZone: 'UTC' })    // succeeds, resolves to 'UTC'
```

## Example

**Expected:** `'UTC'` is a timezone; a timezone-validation function should accept it.

**Actual:** `supportedValuesOf('timeZone')`-based validation rejected it, while `DateTimeFormat` construction accepted it without complaint.

## Root Explanation

`Intl.supportedValuesOf('timeZone')` returns the canonical IANA time zone database entries this implementation knows about (`America/New_York`, `Europe/London`, ...) - a database enumeration. `'UTC'` isn't an IANA zone name; it's a separate identifier the ECMAScript Internationalization API (ECMA-402) always recognizes as valid input to any timezone-accepting constructor, independent of the IANA database enumeration. Two different validity concepts collapsed into what looked like one check.

## How It Was Implemented

`services/profile/src/profileValidation.ts`'s `validateTimezone()`:

```ts
export function validateTimezone(value: string): string {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return value;
  } catch {
    throw new ProfileValidationError('timezone', `unknown IANA timezone: ${value}`);
  }
}
```

## Why We Recorded This

The `supportedValuesOf('timeZone')` approach reads as obviously correct - it's a real, purpose-built enumeration API, not a hack - and would pass code review without a second look. It also would have silently broken any user who never explicitly sets a timezone (they'd be stuck on a default the validator itself rejects) rather than failing loudly, since the bug only surfaces when that exact value round-trips through validation.

## Potential Future Uses

Any future timezone input validation in this codebase (a real Onboarding profile-setup screen, a settings page) should use the `DateTimeFormat`-construction pattern, not `supportedValuesOf`.

## Reusable Rule

To validate a timezone string with `Intl` built-ins, attempt to construct `new Intl.DateTimeFormat(locale, { timeZone: value })` and catch the `RangeError` - don't check membership in `Intl.supportedValuesOf('timeZone')`, which is an IANA-database enumeration, not a completeness check for every value `Intl` accepts.
