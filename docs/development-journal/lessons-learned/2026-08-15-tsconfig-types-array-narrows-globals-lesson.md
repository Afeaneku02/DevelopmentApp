# Better You Lesson Learned — `tsconfig.json`'s `types` Array Is an Allowlist, Not a Filter

**Date:** 2026-08-15

## Lesson

Setting `compilerOptions.types` in a `tsconfig.json` switches TypeScript from "include every `@types/*` package found in `node_modules`" (the default) to "include only the packages named here." Any ambient global you still need — including ones another config in the same monorepo gets for free — has to be listed explicitly.

## Context

`packages/config/src/env.ts` (`typeof process !== 'undefined' ? process.env[name] : undefined`) typechecked cleanly under the root `tsconfig.json`, which has no `types` array. When `apps/web` was scaffolded with its own `tsconfig.json` extending the root config, the exact same `env.ts` file failed typecheck from within `apps/web`.

## How We Discovered It

`npm run typecheck -w apps/web` failed with:

```
../../packages/config/src/env.ts(4,24): error TS2591: Cannot find name 'process'. Do you need to install type definitions for node? Try `npm i --save-dev @types/node` ...
```

repeated three times for the same line. `@types/node` was already a root devDependency and had typechecked fine moments earlier via the root `tsconfig.json` — so the suggested fix (install `@types/node`) was already satisfied and clearly not the real problem. Comparing the two configs showed `apps/web/tsconfig.json` had `"types": ["vite/client"]` (added deliberately, to scope Vite's client-side ambient types to the browser app) while the root config had no `types` key at all.

## Example

**Expected:** `apps/web`'s tsconfig, extending the root config, would still see `@types/node`'s ambient `process` global — the package was installed and resolvable.

**Actual:** `apps/web` only saw `vite/client`'s globals; `process` was unresolved.

## Root Explanation

TypeScript's default behavior (no `types` key) is to auto-include every package under `node_modules/@types`. As soon as any config sets `types` explicitly, that default is replaced entirely — not narrowed additively — with exactly the list given. This is a known TypeScript compiler behavior, not something specific to `extends` or to this monorepo layout.

## How It Was Implemented

`apps/web/tsconfig.json`'s `types` array was changed from `["vite/client"]` to `["vite/client", "node"]`. No new dependency was needed since `@types/node` was already present via the root workspace install (`npm install` at the repo root hoists it).

## Why We Recorded This

This will recur the moment another workspace package sets its own `types` array for a good reason (e.g. scoping test-runner globals) and happens to also depend on code that uses a Node or browser ambient global it didn't think to list. It's an easy, silent mistake — the error message suggests installing a package that's already installed, which points a future developer in the wrong direction.

## Potential Future Uses

Any future `apps/*` or `services/*`/`packages/*` `tsconfig.json` that sets its own `types` array — especially once a mobile app (`apps/mobile`, React Native) is added, which will need its own ambient-type scoping distinct from both the browser and Node.

## Reusable Rule

When a `tsconfig.json` sets `compilerOptions.types` explicitly, list every ambient global package that code reachable from that config actually needs — don't assume anything from a parent config's default (unset) behavior carries over.
