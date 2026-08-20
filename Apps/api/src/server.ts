import cors from 'cors';
import express, { type Express } from 'express';
import { AuthService, LocalAuthProvider, InMemoryUserRepository } from '@better-you/auth';
import { GoalService, InMemoryGoalRepository, InMemoryGoalHistoryRepository } from '@better-you/goals';
import { ProfileService, InMemoryProfileRepository } from '@better-you/profile';
import { OnboardingService, InMemoryOnboardingRepository } from '@better-you/onboarding';
import { DashboardService } from '@better-you/dashboard';
import { CheckInService, InMemoryCheckInRepository } from '@better-you/check-ins';
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

// Fresh, isolated in-memory state per call - real server startup calls this
// once (see index.ts); tests call it per-test to avoid state bleeding between
// tests (ADR 0001/0004 adapter pattern - same reasoning as GoalRepository).
export function createDefaultDependencies(): ServerDependencies {
  const goalService = new GoalService(new InMemoryGoalRepository(), new InMemoryGoalHistoryRepository());
  const checkInService = new CheckInService(new InMemoryCheckInRepository(), goalService);
  return {
    authService: new AuthService(new LocalAuthProvider(), new InMemoryUserRepository()),
    goalService,
    profileService: new ProfileService(new InMemoryProfileRepository()),
    // goalService satisfies GoalLookup structurally - recordFirstGoal() uses
    // it to verify a claimed goal id is real and owned by the caller.
    onboardingService: new OnboardingService(new InMemoryOnboardingRepository(), goalService),
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
