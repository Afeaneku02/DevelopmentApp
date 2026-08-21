import * as path from 'node:path';
import cors from 'cors';
import express, { type Express } from 'express';
import {
  AuthService,
  LocalAuthProvider,
  FileAuthProvider,
  InMemoryUserRepository,
  FileUserRepository,
} from '@better-you/auth';
import {
  GoalService,
  InMemoryGoalRepository,
  InMemoryGoalHistoryRepository,
  FileGoalRepository,
  FileGoalHistoryRepository,
} from '@better-you/goals';
import { ProfileService, InMemoryProfileRepository, FileProfileRepository } from '@better-you/profile';
import { OnboardingService, InMemoryOnboardingRepository, FileOnboardingRepository } from '@better-you/onboarding';
import { DashboardService } from '@better-you/dashboard';
import { CheckInService, InMemoryCheckInRepository, FileCheckInRepository } from '@better-you/check-ins';
import { ProgressService } from '@better-you/progress';
import { getEnv } from '@better-you/config';
import { createAuthRouter } from './routes/auth';
import { createMeRouter } from './routes/me';
import { createGoalRouter } from './routes/goals';
import { createProfileRouter } from './routes/profile';
import { createOnboardingRouter } from './routes/onboarding';
import { createDashboardRouter } from './routes/dashboard';
import { createCheckInRouter } from './routes/checkIns';
import { createGoalCheckInRouter } from './routes/goalCheckIns';
import { createProgressRouter } from './routes/progress';
import { createGoalProgressRouter } from './routes/goalProgress';
import { errorHandler } from './middleware/errorHandler';

export interface ServerDependencies {
  authService: AuthService;
  goalService: GoalService;
  profileService: ProfileService;
  onboardingService: OnboardingService;
  dashboardService: DashboardService;
  checkInService: CheckInService;
  progressService: ProgressService;
}

// No dataDir (the default - every existing test call site) means fresh,
// isolated in-memory state per call, exactly as before ADR 0016 - real
// server startup (index.ts) is the only caller that passes a dataDir, so
// only it gets durable file-backed storage. Tests stay fast and isolated;
// no test needed to change (ADR 0001/0004 adapter pattern - same reasoning
// as every other repository swap in this project).
export function createDefaultDependencies(dataDir?: string): ServerDependencies {
  const goalService = dataDir
    ? new GoalService(
        new FileGoalRepository(path.join(dataDir, 'goals.json')),
        new FileGoalHistoryRepository(path.join(dataDir, 'goal-history.json'))
      )
    : new GoalService(new InMemoryGoalRepository(), new InMemoryGoalHistoryRepository());
  const checkInService = dataDir
    ? new CheckInService(new FileCheckInRepository(path.join(dataDir, 'check-ins.json')), goalService)
    : new CheckInService(new InMemoryCheckInRepository(), goalService);

  return {
    authService: new AuthService(
      dataDir ? new FileAuthProvider(path.join(dataDir, 'auth-identities.json')) : new LocalAuthProvider(),
      dataDir ? new FileUserRepository(path.join(dataDir, 'users.json')) : new InMemoryUserRepository()
    ),
    goalService,
    profileService: new ProfileService(
      dataDir ? new FileProfileRepository(path.join(dataDir, 'profiles.json')) : new InMemoryProfileRepository()
    ),
    // goalService satisfies GoalLookup structurally - recordFirstGoal() uses
    // it to verify a claimed goal id is real and owned by the caller.
    onboardingService: new OnboardingService(
      dataDir
        ? new FileOnboardingRepository(path.join(dataDir, 'onboarding.json'))
        : new InMemoryOnboardingRepository(),
      goalService
    ),
    // goalService also satisfies GoalsView structurally - Dashboard is a
    // read model assembled from real Goals data (ADR 0011).
    dashboardService: new DashboardService(goalService),
    checkInService,
    // checkInService satisfies CheckInsView structurally - Progress is a
    // deterministic read model derived from real Check-in data (ADR 0013).
    progressService: new ProgressService(checkInService),
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
  app.use('/api/v1/profile', createProfileRouter(deps.authService, deps.profileService));
  app.use('/api/v1/onboarding', createOnboardingRouter(deps.authService, deps.onboardingService));
  app.use('/api/v1/dashboard', createDashboardRouter(deps.authService, deps.dashboardService));
  app.use('/api/v1/check-ins', createCheckInRouter(deps.authService, deps.checkInService));
  app.use('/api/v1/goals/:id/check-ins', createGoalCheckInRouter(deps.authService, deps.checkInService));
  app.use('/api/v1/progress', createProgressRouter(deps.authService, deps.progressService));
  app.use('/api/v1/goals/:id/progress', createGoalProgressRouter(deps.authService, deps.progressService));

  app.use(errorHandler);

  return app;
}
