# services/activity

The structured, chronological product-event ledger the external adaptive AI project (built and validated separately - see ADR 0020/0021) will eventually consume as its input signal. `ActivityService.recordEvent()` persists one `ActivityEvent` per real product action (a goal created, paused, resumed, completed, or archived; a check-in recorded; a roadmap generated; a roadmap step completed); `listEvents()` returns a user's events oldest-first.

Every event is minimal and privacy-aware by construction (the `ActivityEvent` discriminated union in `packages/contracts/src/activity.ts` only has fields for ids, enums, and counts): no goal titles/descriptions, no check-in notes, no AI/chat conversation content ever appears in an event's `data`.

Unlike Roadmap's `RoadmapGenerator` boundary, event input here is not treated as untrusted - every event is constructed by this project's own route/service code from data a domain service has already validated (a `Goal`'s `category`, a `CheckIn`'s `response`, ...), not accepted directly from an external caller. Recording currently happens at the API route layer (`apps/api/src/routes/*.ts`), as a best-effort call after the primary action succeeds - a failure to record an event never fails the primary request.
