import { describe, it, expect, beforeEach } from 'vitest';
import { ProfileService } from '../profileService';
import { InMemoryProfileRepository } from '../profileRepository';
import { ProfileValidationError } from '../errors';

describe('ProfileService', () => {
  let service: ProfileService;

  beforeEach(() => {
    service = new ProfileService(new InMemoryProfileRepository());
  });

  it('lazily creates a default profile on first access', async () => {
    const profile = await service.getProfile('user-1');
    expect(profile.userId).toBe('user-1');
    expect(profile.displayName).toBe('');
    expect(profile.timezone).toBe('UTC');
    expect(profile.locale).toBe('en-US');
    expect(profile.preferences).toEqual({ onboardingMode: 'guided_middle_ground', interactionMethod: 'typed' });
  });

  it('returns the same persisted profile on subsequent calls', async () => {
    const first = await service.getProfile('user-1');
    const second = await service.getProfile('user-1');
    expect(second).toEqual(first);
  });

  it('updates only the provided fields, preserving the rest', async () => {
    await service.getProfile('user-1');
    const updated = await service.updateProfile('user-1', { displayName: 'Jamie' });
    expect(updated.displayName).toBe('Jamie');
    expect(updated.timezone).toBe('UTC');
    expect(updated.locale).toBe('en-US');
  });

  it('merges partial preference updates instead of replacing them', async () => {
    await service.updateProfile('user-1', { preferences: { onboardingMode: 'dive_in' } });
    const updated = await service.updateProfile('user-1', { preferences: { interactionMethod: 'voice' } });
    expect(updated.preferences).toEqual({ onboardingMode: 'dive_in', interactionMethod: 'voice' });
  });

  it('lazily creates a profile and applies the update in one call', async () => {
    const updated = await service.updateProfile('user-1', { displayName: 'Jamie' });
    expect(updated.displayName).toBe('Jamie');
  });

  it('rejects an invalid update', async () => {
    await expect(service.updateProfile('user-1', { timezone: 'Not/AZone' })).rejects.toThrow(ProfileValidationError);
  });

  it('keeps profiles isolated between users', async () => {
    await service.updateProfile('user-1', { displayName: 'Jamie' });
    const other = await service.getProfile('user-2');
    expect(other.displayName).toBe('');
  });

  it('advances updatedAt on update', async () => {
    const original = await service.getProfile('user-1');
    await new Promise((resolve) => setTimeout(resolve, 5));
    const updated = await service.updateProfile('user-1', { displayName: 'Jamie' });
    expect(new Date(updated.updatedAt).getTime()).toBeGreaterThan(new Date(original.updatedAt).getTime());
  });
});
