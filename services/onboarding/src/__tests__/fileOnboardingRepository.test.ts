import { describe, expect, it, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import type { OnboardingState } from '@better-you/contracts';
import { FileOnboardingRepository } from '../fileOnboardingRepository';

const tempDirs: string[] = [];

function makeTempFilePath(name: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'better-you-onboarding-'));
  tempDirs.push(dir);
  return path.join(dir, name);
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function makeState(overrides: Partial<OnboardingState>): OnboardingState {
  return {
    userId: 'user-1',
    currentStep: 'welcome',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('FileOnboardingRepository', () => {
  it('survives a simulated restart, letting a user resume mid-flow instead of restarting', async () => {
    const filePath = makeTempFilePath('onboarding.json');
    const before = new FileOnboardingRepository(filePath);
    await before.create(makeState({ userId: 'user-1', currentStep: 'welcome' }));
    await before.update(makeState({ userId: 'user-1', currentStep: 'profile_basics' }));

    const after = new FileOnboardingRepository(filePath);
    const found = await after.findByUserId('user-1');
    expect(found?.currentStep).toBe('profile_basics');
  });

  it('starts empty against a data directory that does not exist yet', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'better-you-onboarding-'));
    tempDirs.push(dir);
    const filePath = path.join(dir, 'nested', 'onboarding.json');
    const repo = new FileOnboardingRepository(filePath);
    expect(await repo.findByUserId('user-1')).toBeNull();
  });
});
