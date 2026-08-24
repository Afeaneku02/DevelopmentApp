import { Router } from 'express';
import type { AuthService } from '@better-you/auth';
import type { RoadmapService } from '@better-you/roadmap';
import { requireAuth } from '../middleware/requireAuth';

// Mounted at /api/v1/goals/:id/roadmap (mergeParams), same pattern as
// routes/goalCheckIns.ts and routes/goalProgress.ts.
export function createGoalRoadmapRouter(authService: AuthService, roadmapService: RoadmapService): Router {
  const router = Router({ mergeParams: true });
  router.use(requireAuth(authService));

  // Returns { roadmap: null } rather than 404 when none exists yet - "no
  // roadmap for this goal" is a normal state, not an error (same reasoning
  // as an empty check-ins list).
  router.get('/', async (req, res, next) => {
    try {
      const { id } = req.params as { id: string };
      const roadmap = await roadmapService.getRoadmapForGoal(req.user!.id, id);
      res.status(200).json({ roadmap });
    } catch (err) {
      next(err);
    }
  });

  router.post('/', async (req, res, next) => {
    try {
      const { id } = req.params as { id: string };
      const roadmap = await roadmapService.generateRoadmap(req.user!.id, id);
      res.status(201).json({ roadmap });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
