import cors from 'cors';
import express, { type Express } from 'express';
import { AuthService, LocalAuthProvider, InMemoryUserRepository } from '@better-you/auth';
import { GoalService, InMemoryGoalRepository } from '@better-you/goals';
import { getEnv } from '@better-you/config';
import { createAuthRouter } from './routes/auth';
import { createMeRouter } from './routes/me';
import { createGoalRouter } from './routes/goals';
import { errorHandler } from './middleware/errorHandler';

export interface ServerDependencies {
  authService: AuthService;
  goalService: GoalService;
}

// Fresh, isolated in-memory state per call - real server startup calls this
// once (see index.ts); tests call it per-test to avoid state bleeding between
// tests (ADR 0001/0004 adapter pattern - same reasoning as GoalRepository).
export function createDefaultDependencies(): ServerDependencies {
  return {
    authService: new AuthService(new LocalAuthProvider(), new InMemoryUserRepository()),
    goalService: new GoalService(new InMemoryGoalRepository()),
  };
}

export function createServer(deps: ServerDependencies = createDefaultDependencies()): Express {
  const app = express();

  app.use(cors({ origin: getEnv('API_CORS_ORIGIN', 'http://localhost:5173') }));
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  app.use('/api/v1/auth', createAuthRouter(deps.authService));
  app.use('/api/v1/me', createMeRouter(deps.authService));
  app.use('/api/v1/goals', createGoalRouter(deps.authService, deps.goalService));

  app.use(errorHandler);

  return app;
}
