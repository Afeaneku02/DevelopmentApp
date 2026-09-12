import { Router } from 'express';
import type { AuthService } from '@better-you/auth';
import type { MentorFeedbackService } from '@better-you/mentor-feedback';
import { requireAuth } from '../middleware/requireAuth';

// Mounted at /api/v1/mentor-feedback. Read-only (ADR 0026): this route only
// ever reads from MentorFeedbackService and returns its result - it cannot
// mutate Goals, Roadmap, Check-ins, Profile, or Activity, and records no
// activity event of its own. A missing/unconfigured/failed AI Models
// integration surfaces as a normal 200 with status: 'unavailable', never a
// 5xx - see MentorFeedbackClient's own contract.
export function createMentorFeedbackRouter(
  authService: AuthService,
  mentorFeedbackService: MentorFeedbackService
): Router {
  const router = Router();
  router.use(requireAuth(authService));

  router.get('/', async (req, res, next) => {
    try {
      const contextKey = typeof req.query.contextKey === 'string' ? req.query.contextKey : undefined;
      const mentorFeedback = await mentorFeedbackService.getFeedback(req.user!.id, contextKey);
      res.status(200).json({ mentorFeedback });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
