import { Router } from 'express';
import type { AuthService } from '@better-you/auth';
import type { CheckInService } from '@better-you/check-ins';
import { requireAuth } from '../middleware/requireAuth';

export function createGoalCheckInRouter(authService: AuthService, checkInService: CheckInService): Router {
  const router = Router({ mergeParams: true });
  router.use(requireAuth(authService));

  router.get('/', async (req, res, next) => {
    try {
      const { id } = req.params as { id: string };
      const view = await checkInService.getGoalCheckIns(req.user!.id, id);
      res.status(200).json(view);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
