import { Router } from 'express';
import type { AuthService } from '@better-you/auth';
import type { ActivityService } from '@better-you/activity';
import { requireAuth } from '../middleware/requireAuth';

// Read-only: nothing (yet) lets a client record an arbitrary event - every
// event is recorded by this project's own route code after a real product
// action succeeds (see routes/goals.ts, routes/checkIns.ts,
// routes/goalRoadmap.ts, routes/roadmap.ts). This is the eventual read
// surface the external AI project will consume (ADR 0021).
export function createActivityRouter(authService: AuthService, activityService: ActivityService): Router {
  const router = Router();
  router.use(requireAuth(authService));

  router.get('/', async (req, res, next) => {
    try {
      const events = await activityService.listEvents(req.user!.id);
      res.status(200).json({ events });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
