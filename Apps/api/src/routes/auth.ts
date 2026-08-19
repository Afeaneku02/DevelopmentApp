import { Router } from 'express';
import { SessionInvalidError, type AuthService } from '@better-you/auth';
import { extractBearerToken } from '../token';
import { expectString } from '../validation';

export function createAuthRouter(authService: AuthService): Router {
  const router = Router();

  router.post('/signup', async (req, res, next) => {
    try {
      const email = expectString(req.body?.email, 'email');
      const password = expectString(req.body?.password, 'password');
      const user = await authService.signUp({ email, password });
      res.status(201).json({ user });
    } catch (err) {
      next(err);
    }
  });

  router.post('/login', async (req, res, next) => {
    try {
      const email = expectString(req.body?.email, 'email');
      const password = expectString(req.body?.password, 'password');
      const result = await authService.signIn({ email, password });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });

  // Always succeeds - revoking an already-invalid/missing token is a no-op,
  // not an error a client needs to handle.
  router.post('/logout', async (req, res, next) => {
    try {
      const token = extractBearerToken(req);
      if (token) {
        await authService.signOut(token);
      }
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  router.post('/refresh', async (req, res, next) => {
    try {
      const token = extractBearerToken(req);
      if (!token) {
        throw new SessionInvalidError();
      }
      const result = await authService.refreshSession(token);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
