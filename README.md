# Better You

A personal development platform that guides people from where they are to who they want to become. See `Better_You_Product_Vision_and_Requirements(6).docx` for the product vision and `Better_You_MVP_Living_Blueprint_Detailed_Maps.docx` for the domain/build-order blueprint.

## Current status

**Goal Creation Core** milestone: goal data model, validation, suggested/custom goal entry, `createGoal`/`listGoals`, running against a development-only stub user. No real authentication, AI goal refinement, or roadmap generation yet.

## Layout

- `packages/contracts` — shared `Goal` types and constraints
- `packages/config` — environment/config loading, including the dev-only stub user
- `services/goals` — the Goals domain (this milestone)
- `apps/`, `platform/` — reserved for later milestones (see their READMEs)
- `docs/architecture-decisions` — ADRs

## Development

```
npm install
npm test
npm run typecheck
```
