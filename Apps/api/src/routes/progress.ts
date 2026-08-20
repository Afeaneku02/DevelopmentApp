import { Router } from 'express';
import type { AuthService } from '@better-you/auth';
import type { ProgressService } from '@better-you/progress';
import { requireAuth } from '../middleware/requireAuth';

export function createProgressRouter(authService: AuthService, progressService: ProgressService): Router {
  const router = Router();
  router.use(requireAuth(authService));

  router.get('/', async (req, res, next) => {
    try {
      const progress = await progressService.getOverallProgress(req.user!.id);
      res.status(200).json({ progress });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
