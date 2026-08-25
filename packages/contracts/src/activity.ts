import type { GoalCategory, GoalSource } from './goal';
import type { CheckInResponse } from './checkIn';

// The structured, chronological product-event stream the external adaptive
// AI project (built and validated separately - see ADR 0020/0021) will
// eventually consume as its input signal. Deliberately minimal and
// privacy-aware: every event carries only ids, categorical/enum values, and
// counts - never free text a user typed (goal titles/descriptions, check-in
// notes) and never any AI/chat conversation content. Structure over content:
// an event says *what happened*, not the words involved.
export type ActivityEventType =
  | 'goal_created'
  | 'goal_paused'
  | 'goal_resumed'
  | 'goal_completed'
  | 'goal_archived'
  | 'check_in_recorded'
  | 'roadmap_generated'
  | 'roadmap_step_completed';

interface BaseActivityEvent {
  id: string;
  userId: string;
  occurredAt: string;
}

export interface GoalCreatedActivityEvent extends BaseActivityEvent {
  type: 'goal_created';
  data: { goalId: string; category: GoalCategory; source: GoalSource };
}

// Pause/resume/complete/archive all carry the same minimal payload (just
// which goal changed status) - a shared generic keeps the four event shapes
// from being copy-pasted near-duplicates while still giving each its own
// discriminant for a real discriminated union.
interface GoalLifecycleActivityEvent<T extends string> extends BaseActivityEvent {
  type: T;
  data: { goalId: string };
}

export type GoalPausedActivityEvent = GoalLifecycleActivityEvent<'goal_paused'>;
export type GoalResumedActivityEvent = GoalLifecycleActivityEvent<'goal_resumed'>;
export type GoalCompletedActivityEvent = GoalLifecycleActivityEvent<'goal_completed'>;
export type GoalArchivedActivityEvent = GoalLifecycleActivityEvent<'goal_archived'>;

// response (yes/no/partly/skipped) is a bounded enum, safe to record; note
// (free text) is deliberately excluded.
export interface CheckInRecordedActivityEvent extends BaseActivityEvent {
  type: 'check_in_recorded';
  data: { goalId: string; checkInId: string; response: CheckInResponse };
}

export interface RoadmapGeneratedActivityEvent extends BaseActivityEvent {
  type: 'roadmap_generated';
  data: { goalId: string; roadmapId: string; milestoneCount: number };
}

export interface RoadmapStepCompletedActivityEvent extends BaseActivityEvent {
  type: 'roadmap_step_completed';
  data: { goalId: string; roadmapId: string; milestoneId: string; actionStepId: string };
}

export type ActivityEvent =
  | GoalCreatedActivityEvent
  | GoalPausedActivityEvent
  | GoalResumedActivityEvent
  | GoalCompletedActivityEvent
  | GoalArchivedActivityEvent
  | CheckInRecordedActivityEvent
  | RoadmapGeneratedActivityEvent
  | RoadmapStepCompletedActivityEvent;

export type RecordActivityEventInput = Omit<ActivityEvent, 'id' | 'occurredAt'>;
