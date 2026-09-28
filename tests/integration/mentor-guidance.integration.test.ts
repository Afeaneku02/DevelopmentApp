import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createServer, createDefaultDependencies } from '@better-you/api';
import { MentorGuidanceService, HttpMentorGuidanceClient } from '@better-you/mentor-feedback';

// ADR 0029: POST /api/v1/mentor-guidance - user-triggered, authenticated,
// always scoped to the caller's own user id and own goal. Every AI-side
// failure is a 200 with status 'unavailable', never a 5xx.

function jsonResponse(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

function withGuidanceFetch(fetchImpl: ReturnType<typeof vi.fn>): Express {
  const deps = createDefaultDependencies();
  deps.mentorGuidanceService = new MentorGuidanceService(
    deps.goalService,
    new HttpMentorGuidanceClient({ baseUrl: 'http://localhost:9999', fetchImpl })
  );
  return createServer(deps);
}

async function signUp(app: Express, email: string): Promise<{ token: string; userId: string }> {
  await request(app).post('/api/v1/auth/signup').send({ email, password: 'first-goal-2026' });
  const login = await request(app).post('/api/v1/auth/login').send({ email, password: 'first-goal-2026' });
  const token = login.body.token as string;
  const me = await request(app).get('/api/v1/me').set('Authorization', `Bearer ${token}`);
  return { token, userId: me.body.user.id as string };
}

async function createGoal(app: Express, token: string, body: Record<string, unknown>): Promise<string> {
  const res = await request(app).post('/api/v1/goals').set('Authorization', `Bearer ${token}`).send(body);
  expect(res.status).toBe(201);
  return res.body.goal.id as string;
}

const OPENAI_BODY = {
  status: 'openai',
  reason_code: null,
  guidance: {
    summary: 'Your check-ins show a steady routine.',
    recommendations: [
      {
        action: 'Add one short walk on Saturday.',
        reason: 'You have completed most scheduled check-ins.',
        grounded_in_belief_ids: ['bel_x_checkin_consistency'],
      },
    ],
    clarifying_question: null,
    needs_more_information: false,
    needs_web: false,
  },
  snapshot_id: 'snap',
  telemetry: { provider: 'openai', model: 'm', success: true },
};

describe('mentor guidance (ADR 0029)', () => {
  let app: Express;

  beforeEach(() => {
    app = createServer();
  });

  it('requires auth', async () => {
    const res = await request(app).post('/api/v1/mentor-guidance').send({ goalId: 'x' });
    expect(res.status).toBe(401);
  });

  it('rejects a missing goalId with 400', async () => {
    const { token } = await signUp(app, 'jamie@example.com');
    const res = await request(app).post('/api/v1/mentor-guidance').set('Authorization', `Bearer ${token}`).send({});
    expect(res.status).toBe(400);
  });

  it('returns 200 unavailable/not_configured when AI_MODELS_BASE_URL is unset', async () => {
    const { token } = await signUp(app, 'jamie@example.com');
    const goalId = await createGoal(app, token, { category: 'fitness', source: 'custom', title: 'Walk daily' });

    const res = await request(app)
      .post('/api/v1/mentor-guidance')
      .set('Authorization', `Bearer ${token}`)
      .send({ goalId });
    expect(res.status).toBe(200);
    expect(res.body.mentorGuidance).toMatchObject({ status: 'unavailable', reasonCode: 'not_configured' });
  });

  it("calls the AI project for the authenticated user's own id with only the sanitized goal input", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, OPENAI_BODY));
    const customApp = withGuidanceFetch(fetchImpl);
    const { token, userId } = await signUp(customApp, 'jamie@example.com');
    const goalId = await createGoal(customApp, token, {
      category: 'fitness',
      source: 'custom',
      title: 'Walk every morning',
      description: 'PRIVATE-DESCRIPTION my cardiologist appointment',
    });
    await request(customApp)
      .post('/api/v1/check-ins')
      .set('Authorization', `Bearer ${token}`)
      .send({ goalId, response: 'yes', note: 'PRIVATE-NOTE felt anxious today' });
    await request(customApp)
      .patch('/api/v1/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ displayName: 'PRIVATE-NAME Jamie Q' });

    const res = await request(customApp)
      .post('/api/v1/mentor-guidance')
      .set('Authorization', `Bearer ${token}`)
      // A spoofed userId in the body must be ignored.
      .send({ goalId, userId: 'someone-else' });

    expect(res.status).toBe(200);
    expect(res.body.mentorGuidance).toEqual({
      status: 'guidance',
      source: 'openai',
      summary: 'Your check-ins show a steady routine.',
      recommendations: [
        {
          action: 'Add one short walk on Saturday.',
          reason: 'You have completed most scheduled check-ins.',
          groundedInBeliefIds: ['bel_x_checkin_consistency'],
        },
      ],
      clarifyingQuestion: null,
      reasonCode: null,
      acceptsReply: false,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(`http://localhost:9999/users/${encodeURIComponent(userId)}/mentor-guidance`);
    expect(JSON.parse(init.body)).toEqual({ context_key: 'fitness_scheduling', goal: 'Walk every morning' });
    const outgoing = `${url} ${init.body}`;
    for (const secret of ['PRIVATE-DESCRIPTION', 'PRIVATE-NOTE', 'PRIVATE-NAME', 'someone-else', 'jamie@example.com']) {
      expect(outgoing).not.toContain(secret);
    }
  });

  it("returns 404 for another user's goal without calling the AI project", async () => {
    const fetchImpl = vi.fn();
    const customApp = withGuidanceFetch(fetchImpl);
    const owner = await signUp(customApp, 'owner@example.com');
    const goalId = await createGoal(customApp, owner.token, { category: 'career', source: 'custom', title: 'Lead' });
    const other = await signUp(customApp, 'other@example.com');

    const res = await request(customApp)
      .post('/api/v1/mentor-guidance')
      .set('Authorization', `Bearer ${other.token}`)
      .send({ goalId });
    expect(res.status).toBe(404);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([
    ['unreachable AI service', () => Promise.reject(new Error('ECONNREFUSED')), 'network_error'],
    [
      'AI service without OpenAI configuration (503)',
      () => Promise.resolve(jsonResponse(503, { detail: 'mentor_configuration_invalid' })),
      'mentor_configuration_invalid',
    ],
    ['AI service 500', () => Promise.resolve(jsonResponse(500, { detail: 'Internal Server Error' })), 'http_500'],
    ['malformed AI response', () => Promise.resolve(jsonResponse(200, { status: 'openai' })), 'unexpected_response'],
  ])('%s -> 200 unavailable, and the rest of the app keeps working', async (_label, impl, reasonCode) => {
    const fetchImpl = vi.fn().mockImplementation(impl);
    const customApp = withGuidanceFetch(fetchImpl);
    const { token } = await signUp(customApp, 'jamie@example.com');
    const goalId = await createGoal(customApp, token, { category: 'fitness', source: 'custom', title: 'Walk' });

    const res = await request(customApp)
      .post('/api/v1/mentor-guidance')
      .set('Authorization', `Bearer ${token}`)
      .send({ goalId });
    expect(res.status).toBe(200);
    expect(res.body.mentorGuidance).toMatchObject({ status: 'unavailable', reasonCode, recommendations: [] });

    const checkIn = await request(customApp)
      .post('/api/v1/check-ins')
      .set('Authorization', `Bearer ${token}`)
      .send({ goalId, response: 'yes' });
    expect(checkIn.status).toBe(201);
  });

  it('is read-only: records no activity event and changes no goal', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, OPENAI_BODY));
    const customApp = withGuidanceFetch(fetchImpl);
    const { token } = await signUp(customApp, 'jamie@example.com');
    const goalId = await createGoal(customApp, token, { category: 'fitness', source: 'custom', title: 'Walk' });
    const before = await request(customApp).get('/api/v1/activity').set('Authorization', `Bearer ${token}`);
    const goalBefore = await request(customApp).get(`/api/v1/goals/${goalId}`).set('Authorization', `Bearer ${token}`);

    await request(customApp).post('/api/v1/mentor-guidance').set('Authorization', `Bearer ${token}`).send({ goalId });

    const after = await request(customApp).get('/api/v1/activity').set('Authorization', `Bearer ${token}`);
    const goalAfter = await request(customApp).get(`/api/v1/goals/${goalId}`).set('Authorization', `Bearer ${token}`);
    expect(after.body.events).toEqual(before.body.events);
    expect(goalAfter.body).toEqual(goalBefore.body);
  });

  it('leaves the existing rule-based mentor-feedback route unchanged', async () => {
    const { token } = await signUp(app, 'jamie@example.com');
    const res = await request(app).get('/api/v1/mentor-feedback').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.mentorFeedback.status).toBe('unavailable');
  });
});
