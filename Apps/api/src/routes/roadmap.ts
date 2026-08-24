import { Router } from 'express';
import type { AuthService } from '@better-you/auth';
import type { RoadmapService } from '@better-you/roadmap';
import { requireAuth } from '../middleware/requireAuth';

// Mounted at /api/v1/roadmaps.
export function createRoadmapRouter(authService: AuthService, roadmapService: RoadmapService): Router {
  const router = Router();
  router.use(requireAuth(authService));

  router.get('/', async (req, res, next) => {
    try {
      const roadmaps = await roadmapService.listRoadmaps(req.user!.id);
      res.status(200).json({ roadmaps });
    } catch (err) {
      next(err);
    }
  });

  router.get('/:id', async (req, res, next) => {
    try {
      const roadmap = await roadmapService.getRoadmap(req.user!.id, req.params.id);
      res.status(200).json({ roadmap });
    } catch (err) {
      next(err);
    }
  });

  router.post('/:id/steps/:stepId/complete', async (req, res, next) => {
    try {
      const roadmap = await roadmapService.completeActionStep(req.user!.id, req.params.id, req.params.stepId);
      res.status(200).json({ roadmap });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
