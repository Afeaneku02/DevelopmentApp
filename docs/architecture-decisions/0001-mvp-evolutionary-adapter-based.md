# ADR 0001: MVP is evolutionary, provider integrations are adapter-based

**Status:** Accepted

## Context

MVP Blueprint §1 ("MVP architecture principle") and §19 (Day-One Checklist) both state the MVP should be built as the first layer of the real product, not disposable code, and that vendor-specific integrations (auth, AI, notifications, storage, database) should sit behind adapters so they can be replaced without rewriting product/domain logic.

## Decision

Every domain service depends on interfaces it owns (e.g. a `GoalRepository` interface), not directly on a specific vendor or storage technology. Concrete implementations (in-memory, and later a real database, real auth provider, etc.) are swapped in at the boundary without changing the domain service's code or tests.

## Consequences

- `services/goals` depends on `GoalRepository` (interface); `InMemoryGoalRepository` is the only implementation for now.
- When a database is chosen (Product Vision §19.3/§25.2 leave this open), a new `GoalRepository` implementation is added and wired in - `GoalService` does not change.
- The same pattern applies to identity: `GoalService` takes `userId` as a plain parameter rather than reading it from a global session, so a real Auth layer (Blueprint §4) can replace the dev stub user without touching the Goals domain.
