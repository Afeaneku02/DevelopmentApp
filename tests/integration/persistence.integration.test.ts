import { describe, expect, it, afterEach } from 'vitest';
import request from 'supertest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { createServer, createDefaultDependencies } from '@better-you/api';

// Proves the actual requirement this milestone is about: real app data
// (account, goal, check-in) created against one server instance is still
// there - readable through the real HTTP API - after that server is
// discarded and a brand-new one is built from the same data directory,
// simulating a real process restart. No shared in-memory state between the
// two server instances at all.

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function makeTempDataDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'better-you-restart-'));
  tempDirs.push(dir);
  return dir;
}

describe('Durable local persistence (integration)', () => {
  it('survives a simulated server restart: account, goal, and check-in all remain readable', async () => {
    const dataDir = makeTempDataDir();
    const email = 'jamie@example.com';
    const password = 'correct-horse-battery';

    const serverBeforeRestart = createServer(createDefaultDependencies(dataDir));

    await request(serverBeforeRestart).post('/api/v1/auth/signup').send({ email, password }).expect(201);
    const loginBefore = await request(serverBeforeRestart)
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);
    const tokenBefore = loginBefore.body.token as string;

    const createGoal = await request(serverBeforeRestart)
      .post('/api/v1/goals')
      .set('Authorization', `Bearer ${tokenBefore}`)
      .send({ source: 'custom', category: 'fitness', title: 'Run a marathon' })
      .expect(201);
    const goalId = createGoal.body.goal.id as string;

    await request(serverBeforeRestart)
      .post('/api/v1/check-ins')
      .set('Authorization', `Bearer ${tokenBefore}`)
      .send({ goalId, response: 'yes', note: 'First run done' })
      .expect(201);

    // Nothing here reuses serverBeforeRestart or its in-memory session -
    // this is a fresh server built only from what's on disk in dataDir.
    const serverAfterRestart = createServer(createDefaultDependencies(dataDir));

    // Sessions are deliberately not persisted (ADR 0016) - logging in again
    // proves the credential itself survived the restart.
    const loginAfter = await request(serverAfterRestart)
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);
    const tokenAfter = loginAfter.body.token as string;

    const goals = await request(serverAfterRestart)
      .get('/api/v1/goals')
      .set('Authorization', `Bearer ${tokenAfter}`)
      .expect(200);
    expect(goals.body.goals).toHaveLength(1);
    expect(goals.body.goals[0].title).toBe('Run a marathon');
    expect(goals.body.goals[0].id).toBe(goalId);

    const checkIns = await request(serverAfterRestart)
      .get('/api/v1/check-ins')
      .set('Authorization', `Bearer ${tokenAfter}`)
      .expect(200);
    expect(checkIns.body.checkIns).toHaveLength(1);
    expect(checkIns.body.checkIns[0].response).toBe('yes');
    expect(checkIns.body.checkIns[0].note).toBe('First run done');
  });

  it('a token issued before the restart is rejected after it - sessions are not persisted', async () => {
    const dataDir = makeTempDataDir();
    const email = 'jamie@example.com';
    const password = 'correct-horse-battery';

    const serverBeforeRestart = createServer(createDefaultDependencies(dataDir));
    await request(serverBeforeRestart).post('/api/v1/auth/signup').send({ email, password }).expect(201);
    const loginBefore = await request(serverBeforeRestart)
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);
    const staleToken = loginBefore.body.token as string;

    const serverAfterRestart = createServer(createDefaultDependencies(dataDir));
    const res = await request(serverAfterRestart).get('/api/v1/goals').set('Authorization', `Bearer ${staleToken}`);
    expect(res.status).toBe(401);
  });

  it('tests calling createDefaultDependencies() with no dataDir stay in-memory and isolated (unchanged behavior)', async () => {
    const app = createServer(createDefaultDependencies());
    await request(app).post('/api/v1/auth/signup').send({ email: 'a@example.com', password: 'password-a1' }).expect(201);

    // A second, completely independent no-dataDir instance shares nothing.
    const otherApp = createServer(createDefaultDependencies());
    const res = await request(otherApp)
      .post('/api/v1/auth/login')
      .send({ email: 'a@example.com', password: 'password-a1' });
    expect(res.status).toBe(401);
  });
});
