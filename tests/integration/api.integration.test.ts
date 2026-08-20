import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createServer } from '@better-you/api';

describe('Better You API (integration)', () => {
  let app: Express;

  beforeEach(() => {
    app = createServer();
  });

  it('GET /health returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  describe('auth', () => {
    it('signs up, rejecting duplicate emails and malformed input', async () => {
      const signUp = await request(app)
        .post('/api/v1/auth/signup')
        .send({ email: 'jamie@example.com', password: 'first-goal-2026' });
      expect(signUp.status).toBe(201);
      expect(signUp.body.user.email).toBe('jamie@example.com');
      expect(signUp.body.user.status).toBe('active');

      const duplicate = await request(app)
        .post('/api/v1/auth/signup')
        .send({ email: 'jamie@example.com', password: 'another-secret' });
      expect(duplicate.status).toBe(409);
      expect(duplicate.body.error.code).toBe('EMAIL_IN_USE');

      const missingField = await request(app).post('/api/v1/auth/signup').send({ email: 'x@example.com' });
      expect(missingField.status).toBe(400);
      expect(missingField.body.error.code).toBe('BAD_REQUEST');

      const invalidEmail = await request(app)
        .post('/api/v1/auth/signup')
        .send({ email: 'not-an-email', password: 'first-goal-2026' });
      expect(invalidEmail.status).toBe(400);
      expect(invalidEmail.body.error.code).toBe('VALIDATION_ERROR');
      expect(invalidEmail.body.error.field).toBe('email');
    });

    it('rejects malformed JSON bodies with 400', async () => {
      const res = await request(app)
        .post('/api/v1/auth/signup')
        .set('Content-Type', 'application/json')
        .send('{not valid json');
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('BAD_REQUEST');
    });

    it('logs in with correct credentials and rejects wrong ones generically', async () => {
      await request(app).post('/api/v1/auth/signup').send({ email: 'jamie@example.com', password: 'first-goal-2026' });

      const login = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'jamie@example.com', password: 'first-goal-2026' });
      expect(login.status).toBe(200);
      expect(login.body.token).toBeTruthy();
      expect(login.body.user.email).toBe('jamie@example.com');

      const wrongPassword = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'jamie@example.com', password: 'wrong' });
      expect(wrongPassword.status).toBe(401);
      expect(wrongPassword.body.error.code).toBe('UNAUTHORIZED');

      const unknownEmail = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'nobody@example.com', password: 'whatever1' });
      expect(unknownEmail.status).toBe(401);
      expect(unknownEmail.body.error.code).toBe('UNAUTHORIZED');
    });

    async function signUpAndLogIn(email: string, password: string): Promise<string> {
      await request(app).post('/api/v1/auth/signup').send({ email, password });
      const login = await request(app).post('/api/v1/auth/login').send({ email, password });
      return login.body.token as string;
    }

    it('GET /api/v1/me requires a valid token', async () => {
      const noToken = await request(app).get('/api/v1/me');
      expect(noToken.status).toBe(401);

      const badToken = await request(app).get('/api/v1/me').set('Authorization', 'Bearer bogus');
      expect(badToken.status).toBe(401);

      const token = await signUpAndLogIn('jamie@example.com', 'first-goal-2026');
      const ok = await request(app).get('/api/v1/me').set('Authorization', `Bearer ${token}`);
      expect(ok.status).toBe(200);
      expect(ok.body.user.email).toBe('jamie@example.com');
    });

    it('rotates the session on refresh and invalidates the old token', async () => {
      const token = await signUpAndLogIn('jamie@example.com', 'first-goal-2026');

      const refreshed = await request(app).post('/api/v1/auth/refresh').set('Authorization', `Bearer ${token}`);
      expect(refreshed.status).toBe(200);
      expect(refreshed.body.token).not.toBe(token);

      const oldTokenNowInvalid = await request(app).get('/api/v1/me').set('Authorization', `Bearer ${token}`);
      expect(oldTokenNowInvalid.status).toBe(401);

      const newTokenWorks = await request(app)
        .get('/api/v1/me')
        .set('Authorization', `Bearer ${refreshed.body.token}`);
      expect(newTokenWorks.status).toBe(200);
    });

    it('logout revokes the session; logout without a token still succeeds', async () => {
      const token = await signUpAndLogIn('jamie@example.com', 'first-goal-2026');

      const logout = await request(app).post('/api/v1/auth/logout').set('Authorization', `Bearer ${token}`);
      expect(logout.status).toBe(204);

      const afterLogout = await request(app).get('/api/v1/me').set('Authorization', `Bearer ${token}`);
      expect(afterLogout.status).toBe(401);

      const logoutNoToken = await request(app).post('/api/v1/auth/logout');
      expect(logoutNoToken.status).toBe(204);
    });

    it('DELETE /api/v1/me deletes the account and frees the email for re-signup', async () => {
      const token = await signUpAndLogIn('jamie@example.com', 'first-goal-2026');

      const del = await request(app).delete('/api/v1/me').set('Authorization', `Bearer ${token}`);
      expect(del.status).toBe(204);

      const afterDelete = await request(app).get('/api/v1/me').set('Authorization', `Bearer ${token}`);
      expect(afterDelete.status).toBe(401);

      const resignup = await request(app)
        .post('/api/v1/auth/signup')
        .send({ email: 'jamie@example.com', password: 'a-new-secret' });
      expect(resignup.status).toBe(201);
    });
  });

  describe('goals', () => {
    async function signUpAndLogIn(email: string, password: string): Promise<string> {
      await request(app).post('/api/v1/auth/signup').send({ email, password });
      const login = await request(app).post('/api/v1/auth/login').send({ email, password });
      return login.body.token as string;
    }

    it('requires auth', async () => {
      const list = await request(app).get('/api/v1/goals');
      expect(list.status).toBe(401);

      const create = await request(app).post('/api/v1/goals').send({ category: 'fitness', source: 'custom', title: 'x' });
      expect(create.status).toBe(401);
    });

    it('creates a suggested goal, ignoring any client-supplied userId', async () => {
      const token = await signUpAndLogIn('jamie@example.com', 'first-goal-2026');

      const res = await request(app)
        .post('/api/v1/goals')
        .set('Authorization', `Bearer ${token}`)
        .send({ category: 'fitness', source: 'suggested', suggestedGoalId: 'fitness-shape', userId: 'someone-else' });

      expect(res.status).toBe(201);
      expect(res.body.goal.title).toBe('Get in better shape');
      expect(res.body.goal.userId).not.toBe('someone-else');
    });

    it('creates a custom goal and validates required fields', async () => {
      const token = await signUpAndLogIn('jamie@example.com', 'first-goal-2026');

      const ok = await request(app)
        .post('/api/v1/goals')
        .set('Authorization', `Bearer ${token}`)
        .send({ category: 'career', source: 'custom', title: 'Ship the MVP' });
      expect(ok.status).toBe(201);
      expect(ok.body.goal.source).toBe('custom');

      const missingTitle = await request(app)
        .post('/api/v1/goals')
        .set('Authorization', `Bearer ${token}`)
        .send({ category: 'career', source: 'custom' });
      expect(missingTitle.status).toBe(400);

      const badSource = await request(app)
        .post('/api/v1/goals')
        .set('Authorization', `Bearer ${token}`)
        .send({ category: 'career', source: 'not-a-source' });
      expect(badSource.status).toBe(400);
      expect(badSource.body.error.code).toBe('BAD_REQUEST');
    });

    it('enforces the active-goal limit', async () => {
      const token = await signUpAndLogIn('jamie@example.com', 'first-goal-2026');
      for (const title of ['A', 'B', 'C']) {
        const res = await request(app)
          .post('/api/v1/goals')
          .set('Authorization', `Bearer ${token}`)
          .send({ category: 'career', source: 'custom', title });
        expect(res.status).toBe(201);
      }
      const fourth = await request(app)
        .post('/api/v1/goals')
        .set('Authorization', `Bearer ${token}`)
        .send({ category: 'career', source: 'custom', title: 'D' });
      expect(fourth.status).toBe(409);
      expect(fourth.body.error.code).toBe('GOAL_LIMIT_EXCEEDED');
    });

    it('only lists the authenticated user\'s own goals', async () => {
      const tokenA = await signUpAndLogIn('a@example.com', 'password-a1');
      const tokenB = await signUpAndLogIn('b@example.com', 'password-b1');

      await request(app)
        .post('/api/v1/goals')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ category: 'career', source: 'custom', title: 'A goal' });
      await request(app)
        .post('/api/v1/goals')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ category: 'career', source: 'custom', title: 'B goal' });

      const listA = await request(app).get('/api/v1/goals').set('Authorization', `Bearer ${tokenA}`);
      expect(listA.body.goals).toHaveLength(1);
      expect(listA.body.goals[0].title).toBe('A goal');
    });
  });

  describe('goal lifecycle', () => {
    async function signUpAndLogIn(email: string, password: string): Promise<string> {
      await request(app).post('/api/v1/auth/signup').send({ email, password });
      const login = await request(app).post('/api/v1/auth/login').send({ email, password });
      return login.body.token as string;
    }

    async function createGoal(token: string, title = 'Run a marathon'): Promise<string> {
      const res = await request(app)
        .post('/api/v1/goals')
        .set('Authorization', `Bearer ${token}`)
        .send({ category: 'fitness', source: 'custom', title });
      return res.body.goal.id as string;
    }

    it('GET /api/v1/goals/:id returns the goal, 404s for an unknown id', async () => {
      const token = await signUpAndLogIn('jamie@example.com', 'first-goal-2026');
      const goalId = await createGoal(token);

      const found = await request(app).get(`/api/v1/goals/${goalId}`).set('Authorization', `Bearer ${token}`);
      expect(found.status).toBe(200);
      expect(found.body.goal.id).toBe(goalId);

      const missing = await request(app)
        .get('/api/v1/goals/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${token}`);
      expect(missing.status).toBe(404);
      expect(missing.body.error.code).toBe('GOAL_NOT_FOUND');
    });

    it('a goal cannot be read or transitioned by a different user', async () => {
      const tokenA = await signUpAndLogIn('a@example.com', 'password-a1');
      const tokenB = await signUpAndLogIn('b@example.com', 'password-b1');
      const goalId = await createGoal(tokenA);

      const read = await request(app).get(`/api/v1/goals/${goalId}`).set('Authorization', `Bearer ${tokenB}`);
      expect(read.status).toBe(404);

      const pause = await request(app)
        .post(`/api/v1/goals/${goalId}/pause`)
        .set('Authorization', `Bearer ${tokenB}`);
      expect(pause.status).toBe(404);
    });

    it('PATCH /api/v1/goals/:id edits the goal and rejects invalid input', async () => {
      const token = await signUpAndLogIn('jamie@example.com', 'first-goal-2026');
      const goalId = await createGoal(token);

      const ok = await request(app)
        .patch(`/api/v1/goals/${goalId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Run a faster marathon' });
      expect(ok.status).toBe(200);
      expect(ok.body.goal.title).toBe('Run a faster marathon');

      const bad = await request(app)
        .patch(`/api/v1/goals/${goalId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: '' });
      expect(bad.status).toBe(400);
      expect(bad.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('walks the full pause -> resume -> complete -> archive lifecycle', async () => {
      const token = await signUpAndLogIn('jamie@example.com', 'first-goal-2026');
      const goalId = await createGoal(token);

      const paused = await request(app)
        .post(`/api/v1/goals/${goalId}/pause`)
        .set('Authorization', `Bearer ${token}`);
      expect(paused.status).toBe(200);
      expect(paused.body.goal.status).toBe('paused');

      const resumed = await request(app)
        .post(`/api/v1/goals/${goalId}/resume`)
        .set('Authorization', `Bearer ${token}`);
      expect(resumed.body.goal.status).toBe('active');

      const completed = await request(app)
        .post(`/api/v1/goals/${goalId}/complete`)
        .set('Authorization', `Bearer ${token}`);
      expect(completed.body.goal.status).toBe('completed');

      const archived = await request(app)
        .post(`/api/v1/goals/${goalId}/archive`)
        .set('Authorization', `Bearer ${token}`);
      expect(archived.body.goal.status).toBe('archived');

      const history = await request(app)
        .get(`/api/v1/goals/${goalId}/history`)
        .set('Authorization', `Bearer ${token}`);
      expect(history.status).toBe(200);
      expect(history.body.history.map((e: { eventType: string }) => e.eventType)).toEqual([
        'created',
        'paused',
        'resumed',
        'completed',
        'archived',
      ]);
    });

    it('rejects an invalid transition with 409', async () => {
      const token = await signUpAndLogIn('jamie@example.com', 'first-goal-2026');
      const goalId = await createGoal(token);

      // Can't resume a goal that's already active.
      const res = await request(app)
        .post(`/api/v1/goals/${goalId}/resume`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('INVALID_GOAL_TRANSITION');
    });

    it('a paused goal does not count toward the active-goal limit', async () => {
      const token = await signUpAndLogIn('jamie@example.com', 'first-goal-2026');
      const a = await createGoal(token, 'A');
      await createGoal(token, 'B');
      await createGoal(token, 'C');

      await request(app).post(`/api/v1/goals/${a}/pause`).set('Authorization', `Bearer ${token}`);

      const fourth = await request(app)
        .post('/api/v1/goals')
        .set('Authorization', `Bearer ${token}`)
        .send({ category: 'career', source: 'custom', title: 'D' });
      expect(fourth.status).toBe(201);
    });
  });

  describe('profile', () => {
    async function signUpAndLogIn(email: string, password: string): Promise<string> {
      await request(app).post('/api/v1/auth/signup').send({ email, password });
      const login = await request(app).post('/api/v1/auth/login').send({ email, password });
      return login.body.token as string;
    }

    it('requires auth', async () => {
      const get = await request(app).get('/api/v1/profile');
      expect(get.status).toBe(401);

      const patch = await request(app).patch('/api/v1/profile').send({ displayName: 'Jamie' });
      expect(patch.status).toBe(401);
    });

    it('returns a default profile on first access', async () => {
      const token = await signUpAndLogIn('jamie@example.com', 'first-goal-2026');

      const res = await request(app).get('/api/v1/profile').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.profile.displayName).toBe('');
      expect(res.body.profile.timezone).toBe('UTC');
      expect(res.body.profile.preferences).toEqual({
        onboardingMode: 'guided_middle_ground',
        interactionMethod: 'typed',
      });
    });

    it('updates fields and merges partial preference updates', async () => {
      const token = await signUpAndLogIn('jamie@example.com', 'first-goal-2026');

      const first = await request(app)
        .patch('/api/v1/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ displayName: 'Jamie', preferences: { onboardingMode: 'dive_in' } });
      expect(first.status).toBe(200);
      expect(first.body.profile.displayName).toBe('Jamie');
      expect(first.body.profile.preferences).toEqual({ onboardingMode: 'dive_in', interactionMethod: 'typed' });

      const second = await request(app)
        .patch('/api/v1/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ preferences: { interactionMethod: 'voice' } });
      expect(second.status).toBe(200);
      expect(second.body.profile.displayName).toBe('Jamie');
      expect(second.body.profile.preferences).toEqual({ onboardingMode: 'dive_in', interactionMethod: 'voice' });
    });

    it('rejects an invalid timezone', async () => {
      const token = await signUpAndLogIn('jamie@example.com', 'first-goal-2026');

      const res = await request(app)
        .patch('/api/v1/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ timezone: 'Not/AZone' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.field).toBe('timezone');
    });

    it('keeps profiles isolated between users', async () => {
      const tokenA = await signUpAndLogIn('a@example.com', 'password-a1');
      const tokenB = await signUpAndLogIn('b@example.com', 'password-b1');

      await request(app)
        .patch('/api/v1/profile')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ displayName: 'A' });

      const profileB = await request(app).get('/api/v1/profile').set('Authorization', `Bearer ${tokenB}`);
      expect(profileB.body.profile.displayName).toBe('');
    });
  });

  describe('onboarding', () => {
    async function signUpAndLogIn(email: string, password: string): Promise<string> {
      await request(app).post('/api/v1/auth/signup').send({ email, password });
      const login = await request(app).post('/api/v1/auth/login').send({ email, password });
      return login.body.token as string;
    }

    it('requires auth', async () => {
      const res = await request(app).get('/api/v1/onboarding');
      expect(res.status).toBe(401);
    });

    it('starts at welcome and advances step by step', async () => {
      const token = await signUpAndLogIn('jamie@example.com', 'first-goal-2026');

      const initial = await request(app).get('/api/v1/onboarding').set('Authorization', `Bearer ${token}`);
      expect(initial.status).toBe(200);
      expect(initial.body.onboarding.currentStep).toBe('welcome');

      const afterOne = await request(app).post('/api/v1/onboarding/next').set('Authorization', `Bearer ${token}`);
      expect(afterOne.body.onboarding.currentStep).toBe('consent');
    });

    it('blocks leaving first_goal until a first goal is recorded, then reaches awaiting_roadmap', async () => {
      const token = await signUpAndLogIn('jamie@example.com', 'first-goal-2026');

      for (let i = 0; i < 4; i++) {
        await request(app).post('/api/v1/onboarding/next').set('Authorization', `Bearer ${token}`);
      }
      const atFirstGoal = await request(app)
        .get('/api/v1/onboarding')
        .set('Authorization', `Bearer ${token}`);
      expect(atFirstGoal.body.onboarding.currentStep).toBe('first_goal');

      const blocked = await request(app).post('/api/v1/onboarding/next').set('Authorization', `Bearer ${token}`);
      expect(blocked.status).toBe(400);
      expect(blocked.body.error.code).toBe('ONBOARDING_VALIDATION_ERROR');

      const goal = await request(app)
        .post('/api/v1/goals')
        .set('Authorization', `Bearer ${token}`)
        .send({ category: 'career', source: 'custom', title: 'Ship the MVP' });

      await request(app)
        .post('/api/v1/onboarding/first-goal')
        .set('Authorization', `Bearer ${token}`)
        .send({ goalId: goal.body.goal.id });

      const final = await request(app).post('/api/v1/onboarding/next').set('Authorization', `Bearer ${token}`);
      expect(final.status).toBe(200);
      expect(final.body.onboarding.currentStep).toBe('awaiting_roadmap');

      const stuck = await request(app).post('/api/v1/onboarding/next').set('Authorization', `Bearer ${token}`);
      expect(stuck.status).toBe(409);
      expect(stuck.body.error.code).toBe('ONBOARDING_AT_FINAL_STEP');
    });

    it('keeps onboarding state isolated between users', async () => {
      const tokenA = await signUpAndLogIn('a@example.com', 'password-a1');
      const tokenB = await signUpAndLogIn('b@example.com', 'password-b1');

      await request(app).post('/api/v1/onboarding/next').set('Authorization', `Bearer ${tokenA}`);

      const stateB = await request(app).get('/api/v1/onboarding').set('Authorization', `Bearer ${tokenB}`);
      expect(stateB.body.onboarding.currentStep).toBe('welcome');
    });

    it('rejects a fake goalId on POST /onboarding/first-goal', async () => {
      const token = await signUpAndLogIn('jamie@example.com', 'first-goal-2026');

      const res = await request(app)
        .post('/api/v1/onboarding/first-goal')
        .set('Authorization', `Bearer ${token}`)
        .send({ goalId: 'not-a-real-goal-id' });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('GOAL_NOT_FOUND');
    });

    it('rejects a real goalId that belongs to a different user', async () => {
      const tokenA = await signUpAndLogIn('a@example.com', 'password-a1');
      const tokenB = await signUpAndLogIn('b@example.com', 'password-b1');

      const goalA = await request(app)
        .post('/api/v1/goals')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ category: 'career', source: 'custom', title: "A's goal" });

      const res = await request(app)
        .post('/api/v1/onboarding/first-goal')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ goalId: goalA.body.goal.id });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('GOAL_NOT_FOUND');
    });

    it('accepts a real goalId owned by the caller', async () => {
      const token = await signUpAndLogIn('jamie@example.com', 'first-goal-2026');

      const goal = await request(app)
        .post('/api/v1/goals')
        .set('Authorization', `Bearer ${token}`)
        .send({ category: 'career', source: 'custom', title: 'Ship the MVP' });

      const res = await request(app)
        .post('/api/v1/onboarding/first-goal')
        .set('Authorization', `Bearer ${token}`)
        .send({ goalId: goal.body.goal.id });

      expect(res.status).toBe(200);
      expect(res.body.onboarding.firstGoalId).toBe(goal.body.goal.id);
    });
  });

  describe('dashboard', () => {
    async function signUpAndLogIn(email: string, password: string): Promise<string> {
      await request(app).post('/api/v1/auth/signup').send({ email, password });
      const login = await request(app).post('/api/v1/auth/login').send({ email, password });
      return login.body.token as string;
    }

    it('requires auth', async () => {
      const res = await request(app).get('/api/v1/dashboard');
      expect(res.status).toBe(401);
    });

    it('returns empty, intentional state for a brand-new user, suggesting add_goal', async () => {
      const token = await signUpAndLogIn('jamie@example.com', 'first-goal-2026');

      const res = await request(app).get('/api/v1/dashboard').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.dashboard.activeGoals).toEqual([]);
      expect(res.body.dashboard.totalGoalsCount).toBe(0);
      expect(res.body.dashboard.nextAction.type).toBe('add_goal');
    });

    it('reflects real goal state and prioritizes resuming a paused goal', async () => {
      const token = await signUpAndLogIn('jamie@example.com', 'first-goal-2026');

      const goal = await request(app)
        .post('/api/v1/goals')
        .set('Authorization', `Bearer ${token}`)
        .send({ category: 'fitness', source: 'custom', title: 'Run a marathon' });

      await request(app).post(`/api/v1/goals/${goal.body.goal.id}/pause`).set('Authorization', `Bearer ${token}`);

      const res = await request(app).get('/api/v1/dashboard').set('Authorization', `Bearer ${token}`);
      expect(res.body.dashboard.activeGoals).toEqual([]);
      expect(res.body.dashboard.pausedGoals).toHaveLength(1);
      expect(res.body.dashboard.nextAction.type).toBe('resume_goal');
      expect(res.body.dashboard.nextAction.goalId).toBe(goal.body.goal.id);
    });

    it('keeps dashboards isolated between users', async () => {
      const tokenA = await signUpAndLogIn('a@example.com', 'password-a1');
      const tokenB = await signUpAndLogIn('b@example.com', 'password-b1');

      await request(app)
        .post('/api/v1/goals')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ category: 'career', source: 'custom', title: "A's goal" });

      const dashboardB = await request(app).get('/api/v1/dashboard').set('Authorization', `Bearer ${tokenB}`);
      expect(dashboardB.body.dashboard.activeGoals).toEqual([]);
    });
  });
});
