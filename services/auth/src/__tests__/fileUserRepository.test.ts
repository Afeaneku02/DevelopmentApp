import { describe, expect, it, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import type { User } from '@better-you/contracts';
import { FileUserRepository } from '../fileUserRepository';

const tempDirs: string[] = [];

function makeTempFilePath(name: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'better-you-auth-'));
  tempDirs.push(dir);
  return path.join(dir, name);
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function makeUser(overrides: Partial<User>): User {
  return {
    id: 'user-1',
    authSubject: 'auth-1',
    email: 'jamie@example.com',
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('FileUserRepository', () => {
  it('survives a simulated restart: a new instance sees users created by a previous one', async () => {
    const filePath = makeTempFilePath('users.json');
    const before = new FileUserRepository(filePath);
    await before.create(makeUser({ id: 'user-1', email: 'jamie@example.com' }));

    const after = new FileUserRepository(filePath);
    const found = await after.findByEmail('jamie@example.com');
    expect(found?.id).toBe('user-1');
  });

  it('persists markDeleted, freeing the email for reuse after a restart', async () => {
    const filePath = makeTempFilePath('users.json');
    const before = new FileUserRepository(filePath);
    await before.create(makeUser({ id: 'user-1', email: 'jamie@example.com' }));
    await before.markDeleted('user-1', '2026-01-02T00:00:00.000Z');

    const after = new FileUserRepository(filePath);
    expect(await after.findByEmail('jamie@example.com')).toBeNull();
    const byId = await after.findById('user-1');
    expect(byId?.status).toBe('deleted');
    expect(byId?.deletedAt).toBe('2026-01-02T00:00:00.000Z');
  });

  it('starts empty against a data directory that does not exist yet', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'better-you-auth-'));
    tempDirs.push(dir);
    const filePath = path.join(dir, 'nested', 'users.json');
    const repo = new FileUserRepository(filePath);
    expect(await repo.findByEmail('nobody@example.com')).toBeNull();
  });
});
