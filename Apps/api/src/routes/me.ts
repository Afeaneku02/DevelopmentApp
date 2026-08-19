import { Router } from 'express';
import type { AuthService } from '@better-you/auth';
import { requireAuth } from '../middleware/requireAuth';
import { extractBearerToken } from '../token';

export function createMeRouter(authService: AuthService): Router {
  const router = Router();
  router.use(requireAuth(authService));

  router.get('/', (req, res) => {
    res.status(200).json({ user: req.user });
  });

  router.delete('/', async (req, res, next) => {
    try {
      // requireAuth already proved this token is present and valid.
      const token = extractBearerToken(req) as string;
      await authService.deleteAccount(token);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
