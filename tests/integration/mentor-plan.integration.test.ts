import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createServer } from '@better-you/api';

describe('accepting a mentor action into a plan', () => {
  it('requires auth, enforces ownership and validation, deduplicates, and supports completion', async () => {
    const app = createServer();
    async function signup(email: string) {
      await request(app).post('/api/v1/auth/signup').send({ email, password: 'mentor-plan-2026' });
      const login = await request(app).post('/api/v1/auth/login').send({ email, password: 'mentor-plan-2026' });
      return { Authorization: `Bearer ${login.body.token}` };
    }
    const owner = await signup('owner@example.com');
    const other = await signup('other@example.com');
    const goal = await request(app).post('/api/v1/goals').set(owner).send({ category: 'fitness', source: 'custom', title: 'Walk' });
    const path = `/api/v1/goals/${goal.body.goal.id}/roadmap/mentor-actions`;
    expect((await request(app).post(path).send({ action: 'Walk' })).status).toBe(401);
    expect((await request(app).post(path).set(other).send({ action: 'Walk' })).status).toBe(404);
    for (const action of ['', null, 5, 'x'.repeat(501)]) {
      expect((await request(app).post(path).set(owner).send({ action })).status).toBe(400);
    }
    const save = () => request(app).post(path).set(owner).send({ action: 'Walk for ten minutes', status: 'completed', userId: 'spoofed' });
    const [first, duplicate] = await Promise.all([save(), save()]);
    expect(first.status).toBe(200);
    expect(duplicate.body.roadmap).toEqual(first.body.roadmap);
    const roadmap = first.body.roadmap;
    const step = roadmap.milestones[0].actionSteps[0];
    expect(step.status).toBe('pending');
    expect(roadmap.userId).not.toBe('spoofed');
    const done = await request(app).post(`/api/v1/roadmaps/${roadmap.id}/steps/${step.id}/complete`).set(owner);
    expect(done.body.roadmap.status).toBe('completed');
    const extended = await request(app).post(path).set(owner).send({ action: 'Walk again next week' });
    expect(extended.body.roadmap.status).toBe('active');
    expect(extended.body.roadmap.milestones[0].status).toBe('completed');
    expect(extended.body.roadmap.milestones[1].status).toBe('active');
    const progress = await request(app).get(`/api/v1/goals/${goal.body.goal.id}/progress`).set(owner);
    expect(progress.body.progress.roadmap.totalActionSteps).toBe(2);
    expect(progress.body.progress.roadmap.completedActionSteps).toBe(1);
  });
});
