import { describe, it, expect } from 'vitest';
import { ProfileService, InMemoryProfileRepository } from '@better-you/profile';

describe('Profile domain (integration)', () => {
  it('supports the full get -> update -> get lifecycle with real persistence', async () => {
    const service = new ProfileService(new InMemoryProfileRepository());

    const initial = await service.getProfile('user-1');
    expect(initial.displayName).toBe('');
    expect(initial.preferences.onboardingMode).toBe('guided_middle_ground');

    await service.updateProfile('user-1', {
      displayName: 'Jamie',
      timezone: 'America/New_York',
      preferences: { onboardingMode: 'dive_in' },
    });

    const reloaded = await service.getProfile('user-1');
    expect(reloaded.displayName).toBe('Jamie');
    expect(reloaded.timezone).toBe('America/New_York');
    expect(reloaded.preferences).toEqual({ onboardingMode: 'dive_in', interactionMethod: 'typed' });
  });
});
