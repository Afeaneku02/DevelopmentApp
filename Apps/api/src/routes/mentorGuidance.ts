import { Router } from 'express';
import type { AuthService } from '@better-you/auth';
import type { MentorGuidanceService } from '@better-you/mentor-feedback';
import { requireAuth } from '../middleware/requireAuth';
import { expectString } from '../validation';

// Mounted at /api/v1/mentor-guidance (ADR 0029). User-triggered: the web app
// only calls this when the user presses "Get mentor guidance". The AI
// project is always asked about the authenticated caller's own id - never a
// user id from the request - and only about a goal the caller owns
// (GoalService.getGoal() 404s otherwise). An unconfigured/failed AI service
// is a normal 200 with status 'unavailable', not a 5xx; that's the state the
// UI displays. Records no activity event: asking for guidance is not a
// product action in the activity ledger's sense (same reasoning as
// GET /api/v1/mentor-feedback, ADR 0026).
export function createMentorGuidanceRouter(
  authService: AuthService,
  mentorGuidanceService: MentorGuidanceService
): Router {
  const router = Router();
  router.use(requireAuth(authService));

  router.post('/', async (req, res, next) => {
    try {
      const goalId = expectString(req.body?.goalId, 'goalId');
      // Optional clarification turns (ADR 0029). Their content rules (<= 2
      // turns, non-blank, <= 500 characters each) are enforced by
      // MentorGuidanceService, after the ownership check.
      const mentorGuidance = await mentorGuidanceService.getGuidance(
        req.user!.id,
        goalId,
        req.body?.clarifications
      );
      res.status(200).json({ mentorGuidance });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
