import { Router } from 'express';
import type { AuthService } from '@better-you/auth';
import type { RoadmapService } from '@better-you/roadmap';
import type { ActivityService } from '@better-you/activity';
import { requireAuth } from '../middleware/requireAuth';
import { recordActivityBestEffort } from '../recordActivityBestEffort';

// Mounted at /api/v1/roadmaps.
export function createRoadmapRouter(
  authService: AuthService,
  roadmapService: RoadmapService,
  activityService: ActivityService
): Router {
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
      const milestone = roadmap.milestones.find((m) => m.actionSteps.some((s) => s.id === req.params.stepId));
      await recordActivityBestEffort(activityService, {
        userId: req.user!.id,
        type: 'roadmap_step_completed',
        data: {
          goalId: roadmap.goalId,
          roadmapId: roadmap.id,
          // milestone is always found here: completeActionStep() already
          // confirmed the step exists on this roadmap or would have thrown.
          milestoneId: milestone!.id,
          actionStepId: req.params.stepId,
        },
      });
      res.status(200).json({ roadmap });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
