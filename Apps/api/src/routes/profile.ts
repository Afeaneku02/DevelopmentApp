import { Router } from 'express';
import type { UpdateProfileInput } from '@better-you/contracts';
import type { AuthService } from '@better-you/auth';
import type { ProfileService } from '@better-you/profile';
import { requireAuth } from '../middleware/requireAuth';
import { BadRequestError } from '../errors';
import { expectString } from '../validation';

function expectPlainObject(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new BadRequestError(`${field} must be an object`);
  }
  return value as Record<string, unknown>;
}

export function createProfileRouter(authService: AuthService, profileService: ProfileService): Router {
  const router = Router();
  router.use(requireAuth(authService));

  router.get('/', async (req, res, next) => {
    try {
      const profile = await profileService.getProfile(req.user!.id);
      res.status(200).json({ profile });
    } catch (err) {
      next(err);
    }
  });

  router.patch('/', async (req, res, next) => {
    try {
      const body = req.body ?? {};
      const update: UpdateProfileInput = {};

      if (body.displayName !== undefined) {
        update.displayName = expectString(body.displayName, 'displayName');
      }
      if (body.timezone !== undefined) {
        update.timezone = expectString(body.timezone, 'timezone');
      }
      if (body.locale !== undefined) {
        update.locale = expectString(body.locale, 'locale');
      }
      if (body.preferences !== undefined) {
        update.preferences = expectPlainObject(body.preferences, 'preferences');
      }

      const profile = await profileService.updateProfile(req.user!.id, update);
      res.status(200).json({ profile });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
