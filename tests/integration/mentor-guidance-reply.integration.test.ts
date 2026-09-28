import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createServer, createDefaultDependencies } from '@better-you/api';
import { MentorGuidanceService, HttpMentorGuidanceClient } from '@better-you/mentor-feedback';

// ADR 0029, "Clarification replies": POST /api/v1/mentor-guidance accepts
// optional `clarifications` - this interaction's question/answer turns,
// validated (<= 2 turns, non-blank, <= 500 code points each) after the
// goal-ownership check, forwarded to the AI endpoint for that request only,
// and stored nowhere.

function jsonResponse(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

const Q1 = 'What time of day could you usually walk?';

const CLARIFICATION = {
  status: 'needs_more_information',
  reason_code: null,
  guidance: {
    summary: 'A little more context would help.',
    recommendations: [],
    clarifying_question: Q1,
    needs_more_information: true,
    needs_web: false,
  },
  snapshot_id: 's',
  telemetry: { provider: 'openai', model: 'm', success: true },
};

const GUIDANCE = {
  status: 'openai',
  reason_code: null,
  guidance: {
    summary: 'Short morning walks fit.',
    recommendations: [
      { action: 'Walk 10 minutes before work.', reason: 'You said mornings work.', grounded_in_belief_ids: ['bel_1'] },
    ],
    clarifying_question: null,
    needs_more_information: false,
    needs_web: false,
  },
  snapshot_id: 's',
  telemetry: { provider: 'openai', model: 'm', success: true },
};

function withGuidanceFetch(fetchImpl: ReturnType<typeof vi.fn>): Express {
  const deps = createDefaultDependencies();
  deps.mentorGuidanceService = new MentorGuidanceService(
    deps.goalService,
    new HttpMentorGuidanceClient({ baseUrl: 'http://localhost:9999', fetchImpl })
  );
  return createServer(deps);
}

async function signUp(app: Express, email: string): Promise<string> {
  await request(app).post('/api/v1/auth/signup').send({ email, password: 'first-goal-2026' });
  const login = await request(app).post('/api/v1/auth/login').send({ email, password: 'first-goal-2026' });
  return login.body.token as string;
}

async function createGoal(app: Express, token: string): Promise<string> {
  const res = await request(app)
    .post('/api/v1/goals')
    .set('Authorization', `Bearer ${token}`)
    .send({ category: 'fitness', source: 'custom', title: 'Walk every morning', description: 'PRIVATE-DESC' });
  return res.body.goal.id as string;
}

describe('mentor guidance clarification turns (ADR 0029)', () => {
  it('forwards the question the mentor asked together with the answer, and the next response reflects it', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, CLARIFICATION))
      .mockResolvedValueOnce(jsonResponse(200, GUIDANCE));
    const app = withGuidanceFetch(fetchImpl);
    const token = await signUp(app, 'jamie@example.com');
    const goalId = await createGoal(app, token);

    const first = await request(app).post('/api/v1/mentor-guidance').set('Authorization', `Bearer ${token}`).send({ goalId });
    expect(first.body.mentorGuidance).toMatchObject({ status: 'needs_more_information', acceptsReply: true });

    const second = await request(app)
      .post('/api/v1/mentor-guidance')
      .set('Authorization', `Bearer ${token}`)
      .send({ goalId, clarifications: [{ question: first.body.mentorGuidance.clarifyingQuestion, answer: '  10 minutes ' }] });
    expect(second.status).toBe(200);
    expect(second.body.mentorGuidance).toMatchObject({ status: 'guidance', acceptsReply: false });

    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual({ context_key: 'fitness_scheduling', goal: 'Walk every morning' });
    expect(JSON.parse(fetchImpl.mock.calls[1][1].body)).toEqual({
      context_key: 'fitness_scheduling',
      goal: 'Walk every morning',
      clarifications: [{ question: Q1, answer: '10 minutes' }],
    });
    expect(fetchImpl.mock.calls[1][1].body).not.toContain('PRIVATE-DESC');
  });

  it('forwards two turns in order', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, GUIDANCE));
    const app = withGuidanceFetch(fetchImpl);
    const token = await signUp(app, 'jamie@example.com');
    const goalId = await createGoal(app, token);
    const turns = [
      { question: 'Which activity?', answer: 'Walking' },
      { question: Q1, answer: '10 minutes' },
    ];

    await request(app).post('/api/v1/mentor-guidance').set('Authorization', `Bearer ${token}`).send({ goalId, clarifications: turns });
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body).clarifications).toEqual(turns);
  });

  it.each([
    ['three turns', [1, 2, 3].map(() => ({ question: Q1, answer: 'a' }))],
    ['a blank answer', [{ question: Q1, answer: '   ' }]],
    ['an answer over 500 characters', [{ question: Q1, answer: 'a'.repeat(501) }]],
    ['a missing question', [{ answer: '10 minutes' }]],
    ['a bare string', '10 minutes'],
    ['an empty array', []],
  ])('rejects %s with 400 VALIDATION_ERROR and makes no AI call', async (_label, clarifications) => {
    const fetchImpl = vi.fn();
    const app = withGuidanceFetch(fetchImpl);
    const token = await signUp(app, 'jamie@example.com');
    const goalId = await createGoal(app, token);

    const res = await request(app)
      .post('/api/v1/mentor-guidance')
      .set('Authorization', `Bearer ${token}`)
      .send({ goalId, clarifications });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({ code: 'VALIDATION_ERROR', field: 'clarifications' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('accepts an answer of exactly 500 characters', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, GUIDANCE));
    const app = withGuidanceFetch(fetchImpl);
    const token = await signUp(app, 'jamie@example.com');
    const goalId = await createGoal(app, token);

    const res = await request(app)
      .post('/api/v1/mentor-guidance')
      .set('Authorization', `Bearer ${token}`)
      .send({ goalId, clarifications: [{ question: Q1, answer: 'a'.repeat(500) }] });
    expect(res.status).toBe(200);
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body).clarifications[0].answer).toHaveLength(500);
  });

  it("returns 404 for another user's goal even with turns, without calling the AI project", async () => {
    const fetchImpl = vi.fn();
    const app = withGuidanceFetch(fetchImpl);
    const owner = await signUp(app, 'owner@example.com');
    const goalId = await createGoal(app, owner);
    const other = await signUp(app, 'other@example.com');

    const res = await request(app)
      .post('/api/v1/mentor-guidance')
      .set('Authorization', `Bearer ${other}`)
      .send({ goalId, clarifications: [{ question: Q1, answer: 'Mornings' }] });
    expect(res.status).toBe(404);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('does not record or store the turns anywhere in Better You', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, GUIDANCE));
    const app = withGuidanceFetch(fetchImpl);
    const token = await signUp(app, 'jamie@example.com');
    const goalId = await createGoal(app, token);

    await request(app)
      .post('/api/v1/mentor-guidance')
      .set('Authorization', `Bearer ${token}`)
      .send({ goalId, clarifications: [{ question: 'Q-MARKER?', answer: 'A-MARKER mornings' }] });

    const auth = { Authorization: `Bearer ${token}` };
    const reads = await Promise.all([
      request(app).get('/api/v1/activity').set(auth),
      request(app).get(`/api/v1/goals/${goalId}`).set(auth),
      request(app).get('/api/v1/check-ins').set(auth),
      request(app).get('/api/v1/profile').set(auth),
    ]);
    for (const res of reads) {
      expect(res.status).toBe(200);
      expect(JSON.stringify(res.body)).not.toMatch(/Q-MARKER|A-MARKER/);
    }
  });

  it('turns sent to an unreachable AI service are still a 200 unavailable, not an error', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    const app = withGuidanceFetch(fetchImpl);
    const token = await signUp(app, 'jamie@example.com');
    const goalId = await createGoal(app, token);

    const res = await request(app)
      .post('/api/v1/mentor-guidance')
      .set('Authorization', `Bearer ${token}`)
      .send({ goalId, clarifications: [{ question: Q1, answer: 'Mornings' }] });
    expect(res.status).toBe(200);
    expect(res.body.mentorGuidance).toMatchObject({ status: 'unavailable', reasonCode: 'network_error', acceptsReply: false });
  });
});
