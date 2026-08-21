import { describe, expect, it, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import type { Profile } from '@better-you/contracts';
import { FileProfileRepository } from '../fileProfileRepository';

const tempDirs: string[] = [];

function makeTempFilePath(name: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'better-you-profile-'));
  tempDirs.push(dir);
  return path.join(dir, name);
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function makeProfile(overrides: Partial<Profile>): Profile {
  return {
    userId: 'user-1',
    displayName: 'Jamie',
    timezone: 'UTC',
    locale: 'en-US',
    preferences: { onboardingMode: 'guided_middle_ground', interactionMethod: 'typed' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('FileProfileRepository', () => {
  it('survives a simulated restart: a new instance sees a profile created by a previous one', async () => {
    const filePath = makeTempFilePath('profiles.json');
    const before = new FileProfileRepository(filePath);
    await before.create(makeProfile({ userId: 'user-1', displayName: 'Jamie' }));

    const after = new FileProfileRepository(filePath);
    const found = await after.findByUserId('user-1');
    expect(found?.displayName).toBe('Jamie');
  });

  it('persists updates across a restart, keyed by userId', async () => {
    const filePath = makeTempFilePath('profiles.json');
    const before = new FileProfileRepository(filePath);
    await before.create(makeProfile({ userId: 'user-1', displayName: 'Jamie' }));
    await before.update(makeProfile({ userId: 'user-1', displayName: 'Jamie Updated' }));

    const after = new FileProfileRepository(filePath);
    const found = await after.findByUserId('user-1');
    expect(found?.displayName).toBe('Jamie Updated');
  });

  it('starts empty against a data directory that does not exist yet', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'better-you-profile-'));
    tempDirs.push(dir);
    const filePath = path.join(dir, 'nested', 'profiles.json');
    const repo = new FileProfileRepository(filePath);
    expect(await repo.findByUserId('user-1')).toBeNull();
  });
});
