import { Router } from 'express';
import type { GoalCategory } from '@better-you/contracts';
import type { AuthService } from '@better-you/auth';
import type { GoalService } from '@better-you/goals';
import { requireAuth } from '../middleware/requireAuth';
import { BadRequestError } from '../errors';
import { expectString, optionalString } from '../validation';

export function createGoalRouter(authService: AuthService, goalService: GoalService): Router {
  const router = Router();
  router.use(requireAuth(authService));

  router.get('/', async (req, res, next) => {
    try {
      // requireAuth guarantees req.user is set before this handler runs.
      const goals = await goalService.listGoals(req.user!.id);
      res.status(200).json({ goals });
    } catch (err) {
      next(err);
    }
  });

  router.post('/', async (req, res, next) => {
    try {
      const body = req.body ?? {};
      const userId = req.user!.id;
      const category = expectString(body.category, 'category') as GoalCategory;
      const source = expectString(body.source, 'source');

      if (source === 'suggested') {
        const suggestedGoalId = expectString(body.suggestedGoalId, 'suggestedGoalId');
        const goal = await goalService.createGoal({
          userId,
          source: 'suggested',
          category,
          suggestedGoalId,
          title: optionalString(body.title),
          description: optionalString(body.description),
        });
        res.status(201).json({ goal });
        return;
      }

      if (source === 'custom') {
        const title = expectString(body.title, 'title');
        const goal = await goalService.createGoal({
          userId,
          source: 'custom',
          category,
          title,
          description: optionalString(body.description),
        });
        res.status(201).json({ goal });
        return;
      }

      throw new BadRequestError('source must be "suggested" or "custom"');
    } catch (err) {
      next(err);
    }
  });

  router.get('/:id', async (req, res, next) => {
    try {
      const goal = await goalService.getGoal(req.user!.id, req.params.id);
      res.status(200).json({ goal });
    } catch (err) {
      next(err);
    }
  });

  router.patch('/:id', async (req, res, next) => {
    try {
      const body = req.body ?? {};
      const update: { title?: string; description?: string; category?: GoalCategory } = {};
      if (body.title !== undefined) {
        update.title = expectString(body.title, 'title');
      }
      if (body.description !== undefined) {
        update.description = expectString(body.description, 'description');
      }
      if (body.category !== undefined) {
        update.category = expectString(body.category, 'category') as GoalCategory;
      }
      const goal = await goalService.updateGoal(req.user!.id, req.params.id, update);
      res.status(200).json({ goal });
    } catch (err) {
      next(err);
    }
  });

  router.post('/:id/pause', async (req, res, next) => {
    try {
      const goal = await goalService.pauseGoal(req.user!.id, req.params.id);
      res.status(200).json({ goal });
    } catch (err) {
      next(err);
    }
  });

  router.post('/:id/resume', async (req, res, next) => {
    try {
      const goal = await goalService.resumeGoal(req.user!.id, req.params.id);
      res.status(200).json({ goal });
    } catch (err) {
      next(err);
    }
  });

  router.post('/:id/complete', async (req, res, next) => {
    try {
      const goal = await goalService.completeGoal(req.user!.id, req.params.id);
      res.status(200).json({ goal });
    } catch (err) {
      next(err);
    }
  });

  router.post('/:id/archive', async (req, res, next) => {
    try {
      const goal = await goalService.archiveGoal(req.user!.id, req.params.id);
      res.status(200).json({ goal });
    } catch (err) {
      next(err);
    }
  });

  router.get('/:id/history', async (req, res, next) => {
    try {
      const history = await goalService.getGoalHistory(req.user!.id, req.params.id);
      res.status(200).json({ history });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
