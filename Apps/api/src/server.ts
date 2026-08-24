import * as path from 'node:path';
import cors from 'cors';
import express, { type Express } from 'express';
import {
  AuthService,
  LocalAuthProvider,
  InMemoryUserRepository,
} from '@better-you/auth';
import {
  GoalService,
  InMemoryGoalRepository,
  InMemoryGoalHistoryRepository,
} from '@better-you/goals';
import { ProfileService, InMemoryProfileRepository } from '@better-you/profile';
import { OnboardingService, InMemoryOnboardingRepository } from '@better-you/onboarding';
import { DashboardService } from '@better-you/dashboard';
import { CheckInService, InMemoryCheckInRepository } from '@better-you/check-ins';
import { ProgressService } from '@better-you/progress';
import { RoadmapService, InMemoryRoadmapRepository, PlaceholderRoadmapGenerator } from '@better-you/roadmap';
import { getEnv } from '@better-you/config';
import { FileAuthProvider } from '../../../services/auth/src/fileAuthProvider';
import { FileUserRepository } from '../../../services/auth/src/fileUserRepository';
import { FileGoalRepository } from '../../../services/goals/src/fileGoalRepository';
import { FileGoalHistoryRepository } from '../../../services/goals/src/fileGoalHistoryRepository';
import { FileProfileRepository } from '../../../services/profile/src/fileProfileRepository';
import { FileOnboardingRepository } from '../../../services/onboarding/src/fileOnboardingRepository';
import { FileCheckInRepository } from '../../../services/check-ins/src/fileCheckInRepository';
import { FileRoadmapRepository } from '../../../services/roadmap/src/fileRoadmapRepository';
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
import { createRoadmapRouter } from './routes/roadmap';
import { createGoalRoadmapRouter } from './routes/goalRoadmap';
import { errorHandler } from './middleware/errorHandler';

export interface ServerDependencies {
  authService: AuthService;
  goalService: GoalService;
  profileService: ProfileService;
  onboardingService: OnboardingService;
  dashboardService: DashboardService;
  checkInService: CheckInService;
  progressService: ProgressService;
  roadmapService: RoadmapService;
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
  // goalService satisfies RoadmapService's GoalLookup structurally, same as
  // Check-ins/Onboarding. PlaceholderRoadmapGenerator is the only
  // RoadmapGenerator today (no AI provider/API key) - see ADR 0020.
  const roadmapService = new RoadmapService(
    dataDir ? new FileRoadmapRepository(path.join(dataDir, 'roadmaps.json')) : new InMemoryRoadmapRepository(),
    goalService,
    new PlaceholderRoadmapGenerator()
  );

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
    // goalService/roadmapService also satisfy GoalsView/RoadmapsView
    // structurally - Dashboard is a read model assembled from real
    // Goals+Roadmap data (ADR 0011, extended by ADR 0020).
    dashboardService: new DashboardService(goalService, roadmapService),
    checkInService,
    // checkInService satisfies CheckInsView structurally - Progress is a
    // deterministic read model derived from real Check-in data (ADR 0013).
    progressService: new ProgressService(checkInService),
    roadmapService,
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
  app.use('/api/v1/roadmaps', createRoadmapRouter(deps.authService, deps.roadmapService));
  app.use('/api/v1/goals/:id/roadmap', createGoalRoadmapRouter(deps.authService, deps.roadmapService));

  app.use(errorHandler);

  return app;
}
