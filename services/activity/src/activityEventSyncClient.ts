import type { ActivityEvent } from '@better-you/contracts';

// The one seam Better You's activity ledger crosses into the separate
// DevelopmentApp_AI_Models project's `POST /events` (ADR 0027) - the same
// "narrow adapter interface, optional, never a production dependency"
// pattern as RoadmapGenerator (ADR 0020/0024) and MentorFeedbackClient
// (ADR 0026). NoopActivityEventSyncClient is the default; HttpActivityEventSyncClient
// only activates when AI_MODELS_BASE_URL is configured (server.ts) -
// mirroring exactly how those two are wired in.
//
// Like MentorFeedbackClient and unlike RoadmapGenerator, this interface's
// contract is "never throw": a network error, timeout, non-2xx response, or
// anything else going wrong must never propagate out of sync(). Better
// You's own ActivityEventRepository write is the durable, source-of-truth
// record of the event - this call is a best-effort courtesy copy sent
// afterwards, not a second place the event has to succeed. ActivityService
// calls this without awaiting it, precisely so this integration's own
// latency (or a hung AI server) can never delay the product action that
// generated the event - sync() must resolve (or be safely ignorable) on
// its own; it cannot rely on being awaited, or on anything it does taking
// effect before its caller moves on.
//
// sync() is called with the exact ActivityEvent Better You already recorded
// (ids, enums, counts only - see activity.ts) and must never widen what
// crosses this boundary beyond that: no goal/check-in free text, no profile
// data, no AI/chat content.
export interface ActivityEventSyncClient {
  sync(event: ActivityEvent): Promise<void>;
}
