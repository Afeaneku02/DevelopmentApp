import { Router } from 'express';
import type { CheckInResponse } from '@better-you/contracts';
import type { AuthService } from '@better-you/auth';
import type { CheckInService } from '@better-you/check-ins';
import type { ActivityService } from '@better-you/activity';
import { requireAuth } from '../middleware/requireAuth';
import { expectString, optionalString } from '../validation';
import { recordActivityBestEffort } from '../recordActivityBestEffort';

export function createCheckInRouter(
  authService: AuthService,
  checkInService: CheckInService,
  activityService: ActivityService
): Router {
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
      await recordActivityBestEffort(activityService, {
        userId: req.user!.id,
        type: 'check_in_recorded',
        data: { goalId: checkIn.goalId, checkInId: checkIn.id, response: checkIn.response },
      });
      res.status(201).json({ checkIn });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
