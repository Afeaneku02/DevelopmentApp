import type { MentorFeedbackResult } from '@better-you/contracts';
import type { MentorFeedbackClient } from './mentorFeedbackClient';

// Thin pass-through over MentorFeedbackClient. No persistence (explicitly
// out of scope for this milestone - ADR 0026): this service reads nothing
// from and writes nothing to any Better You repository, and never touches
// Goals, Roadmap, Check-ins, Profile, or Activity. It exists as its own
// class, not a bare function, only so routes and tests depend on a stable
// seam the same way every other domain does - so a future decision (e.g.
// briefly caching a result) has somewhere to live without the route
// changing.
export class MentorFeedbackService {
  constructor(private readonly client: MentorFeedbackClient) {}

  async getFeedback(userId: string, contextKey?: string): Promise<MentorFeedbackResult> {
    return this.client.getFeedback(userId, contextKey);
  }
}
