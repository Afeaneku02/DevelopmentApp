# Better You Lesson Learned — Verifying a UI When No Browser Driver Is Available

**Date:** 2026-08-15

## Lesson

Neither of this environment's two normal ways to visually drive a real browser (`chromium-cli`, `claude-in-chrome`) can be assumed available. When both are missing, a temporary, unsaved Playwright install (`npm install --no-save playwright` + `npx playwright install chromium`) is a reliable fallback that still produces real screenshots and a real console-error check — and can be fully removed afterward without leaving any trace in `package.json` or the lockfile.

## Context

Goal Creation Core had no frontend. After building a minimal `apps/web` React UI to make it visible, CLAUDE.md's rule for frontend changes applies: start the dev server and use the feature in a browser before reporting success — typecheck and tests verify correctness, not that the feature actually works for a user.

## How We Discovered It

The `run` skill's documented pattern for browser-driven apps is `chromium-cli`. Running it returned `chromium-cli: command not found` (exit 127). The next fallback attempted was the `claude-in-chrome` skill, which reported that the user had started installing the extension previously but chosen to continue without browser tools for this session, and instructed not to prompt again. With both standard paths unavailable, `npx playwright --version` was tried as a probe — it succeeded (fetching Playwright on demand via npx), but `node -e "require.resolve('playwright')"` confirmed it wasn't an actual project dependency yet.

## Example

**Expected:** `chromium-cli` or `claude-in-chrome` available, per the `run` skill's primary guidance.

**Actual:** Neither available; fell back to `npm install --no-save playwright`, `npx playwright install chromium`, and a hand-written driver script using `chromium.launch({ args: ['--no-sandbox'] })`.

## Root Explanation

`--no-save` tells npm to modify `node_modules` without touching `package.json` or the lockfile, so the install is invisible to the tracked project state and fully reversible with a matching `npm uninstall --no-save playwright`. This makes it safe to reach for as a one-off verification tool even in a project that has deliberately not taken Playwright as a real dependency.

One additional wrinkle: a driver script run from outside the project directory (e.g. the session's scratchpad folder) fails with `ERR_MODULE_NOT_FOUND: Cannot find package 'playwright'`, because Node's ESM resolution walks up from the script's own location looking for `node_modules`, not from the current working directory. The script has to live inside the project tree (it was copied to the repo root, run, then deleted) for `import { chromium } from 'playwright'` to resolve.

## How It Was Implemented

```
npm install --no-save playwright
npx playwright install chromium
# write a .mjs script INSIDE the project tree (not /tmp or a scratchpad dir), e.g.:
#   import { chromium } from 'playwright';
#   const browser = await chromium.launch({ args: ['--no-sandbox'] });
#   const page = await (await browser.newContext()).newPage();
#   page.on('console', (msg) => { if (msg.type() === 'error') { /* collect */ } });
#   await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
#   ... click/fill/screenshot ...
node smoke-test.mjs   # run from inside the project directory
npm uninstall --no-save playwright
rm smoke-test.mjs
```

## Why We Recorded This

This is the kind of tooling gap that's easy to route around by simply skipping the "verify in a browser" step and reporting success from a green build instead — which CLAUDE.md explicitly forbids. Recording the working fallback means the next session doesn't have to rediscover it (or worse, quietly settle for typecheck-only verification) the next time `chromium-cli`/`claude-in-chrome` aren't available.

## Potential Future Uses

Any future frontend work in `apps/web` (or a future `apps/mobile` web view) done in a session without `chromium-cli` or a connected `claude-in-chrome`.

## Reusable Rule

If the project's usual browser driver is unavailable, use a temporary, `--no-save` Playwright install to verify a UI change with real screenshots and a console-error check, and remove it afterward — never substitute a passing build/typecheck for actually having looked at the running feature. Run the driver script from inside the project tree, not a scratchpad directory, or Node's module resolution won't find it.
