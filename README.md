# Better You

A personal development platform that guides people from where they are to who they want to become. See `Better_You_Product_Vision_and_Requirements(6).docx` for the product vision and `Better_You_MVP_Living_Blueprint_Detailed_Maps.docx` for the domain/build-order blueprint.

## Current status

Every domain through **Progress** is real, tested, and wired together with durable local persistence: Auth, Profile, Goals (full lifecycle), First-Run Onboarding, a Goals-only Dashboard, Check-ins, and Progress. See `docs/development-journal/DEVELOPMENT_INDEX.md` for the full build history and `docs/architecture-decisions/` for why each piece is scoped the way it is.

Not yet built: the AI Roadmap Engine and anything downstream of it (blocked on provisioning a real model-provider credential), and any production deployment - this is local-dev-only for now (see `RUNNING.md`).

## Run it locally

See **[RUNNING.md](RUNNING.md)** for the full setup guide: environment files, running `apps/api`/`apps/web`, where your data lives, how to reset it, and a verification checklist. Quick version:

```
npm install
cp .env.example .env
cp Apps/web/.env.example Apps/web/.env
npm run dev:api    # terminal 1
npm run dev:web    # terminal 2
```

## Layout

- `packages/contracts` — shared domain types
- `packages/config` — environment/config loading
- `packages/persistence` — shared file-backed persistence primitives (ADR 0016)
- `services/*` — one domain per directory (`auth`, `goals`, `profile`, `onboarding`, `dashboard`, `check-ins`, `progress`), each behind adapter interfaces (ADR 0001)
- `Apps/api` — the HTTP API (Express 5)
- `Apps/web` — the React/Vite web client
- `platform` — reserved for later infrastructure (db migrations, jobs, etc.), not yet needed
- `docs/architecture-decisions` — ADRs
- `docs/development-journal` — dated development history

## Development

```
npm install
npm run verify   # typecheck + full test suite
```
