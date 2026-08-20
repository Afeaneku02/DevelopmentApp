import { Router } from 'express';
import type { AuthService } from '@better-you/auth';
import type { DashboardService } from '@better-you/dashboard';
import { requireAuth } from '../middleware/requireAuth';

export function createDashboardRouter(authService: AuthService, dashboardService: DashboardService): Router {
  const router = Router();
  router.use(requireAuth(authService));

  router.get('/', async (req, res, next) => {
    try {
      const dashboard = await dashboardService.getDashboard(req.user!.id);
      res.status(200).json({ dashboard });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
