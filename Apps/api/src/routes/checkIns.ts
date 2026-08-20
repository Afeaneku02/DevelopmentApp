import { Router } from 'express';
import type { CheckInResponse } from '@better-you/contracts';
import type { AuthService } from '@better-you/auth';
import type { CheckInService } from '@better-you/check-ins';
import { requireAuth } from '../middleware/requireAuth';
import { expectString, optionalString } from '../validation';

export function createCheckInRouter(authService: AuthService, checkInService: CheckInService): Router {
  const router = Router();
  router.use(requireAuth(authService));

  router.get('/', async (req, res, next) => {
    try {
      const checkIns = await checkInService.listCheckIns(req.user!.id);
      res.status(200).json({ checkIns });
    } catch (err) {
      next(err);
    }
  });

  router.post('/', async (req, res, next) => {
    try {
      const body = req.body ?? {};
      const checkIn = await checkInService.createCheckIn({
        userId: req.user!.id,
        goalId: expectString(body.goalId, 'goalId'),
        response: expectString(body.response, 'response') as CheckInResponse,
        note: optionalString(body.note),
      });
      res.status(201).json({ checkIn });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
