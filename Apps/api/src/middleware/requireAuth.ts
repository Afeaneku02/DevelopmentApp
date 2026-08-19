import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { User } from '@better-you/contracts';
import { AuthService, SessionInvalidError } from '@better-you/auth';
import { extractBearerToken } from '../token';

declare module 'express-serve-static-core' {
  interface Request {
    user?: User;
  }
}

export function requireAuth(authService: AuthService): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction) => {
    const token = extractBearerToken(req);
    if (!token) {
      next(new SessionInvalidError());
      return;
    }
    try {
      req.user = await authService.requireUser(token);
      next();
    } catch (err) {
      next(err);
    }
  };
}
