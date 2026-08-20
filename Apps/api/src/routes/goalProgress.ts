import { Router } from 'express';
import type { AuthService } from '@better-you/auth';
import type { ProgressService } from '@better-you/progress';
import { requireAuth } from '../middleware/requireAuth';

export function createGoalProgressRouter(authService: AuthService, progressService: ProgressService): Router {
  const router = Router({ mergeParams: true });
  router.use(requireAuth(authService));

  router.get('/', async (req, res, next) => {
    try {
      const { id } = req.params as { id: string };
      const progress = await progressService.getGoalProgress(req.user!.id, id);
      res.status(200).json({ progress });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
