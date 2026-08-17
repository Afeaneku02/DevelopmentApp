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
});
