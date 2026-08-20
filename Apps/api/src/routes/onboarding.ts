import { Router } from 'express';
import type { AuthService } from '@better-you/auth';
import type { OnboardingService } from '@better-you/onboarding';
import { requireAuth } from '../middleware/requireAuth';
import { expectString } from '../validation';

export function createOnboardingRouter(authService: AuthService, onboardingService: OnboardingService): Router {
  const router = Router();
  router.use(requireAuth(authService));

  router.get('/', async (req, res, next) => {
    try {
      const state = await onboardingService.getState(req.user!.id);
      res.status(200).json({ onboarding: state });
    } catch (err) {
      next(err);
    }
  });

  router.post('/next', async (req, res, next) => {
    try {
      const state = await onboardingService.nextStep(req.user!.id);
      res.status(200).json({ onboarding: state });
    } catch (err) {
      next(err);
    }
  });

  router.post('/first-goal', async (req, res, next) => {
    try {
      const body = req.body ?? {};
      const goalId = expectString(body.goalId, 'goalId');
      const state = await onboardingService.recordFirstGoal(req.user!.id, goalId);
      res.status(200).json({ onboarding: state });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
