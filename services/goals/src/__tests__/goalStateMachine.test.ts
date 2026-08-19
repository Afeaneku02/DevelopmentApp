import { describe, it, expect } from 'vitest';
import { canTransition } from '../goalStateMachine';

describe('canTransition', () => {
  it('allows active to move to paused, completed, or archived', () => {
    expect(canTransition('active', 'paused')).toBe(true);
    expect(canTransition('active', 'completed')).toBe(true);
    expect(canTransition('active', 'archived')).toBe(true);
  });

  it('allows paused to move to active, completed, or archived', () => {
    expect(canTransition('paused', 'active')).toBe(true);
    expect(canTransition('paused', 'completed')).toBe(true);
    expect(canTransition('paused', 'archived')).toBe(true);
  });

  it('allows completed to move only to archived', () => {
    expect(canTransition('completed', 'archived')).toBe(true);
    expect(canTransition('completed', 'active')).toBe(false);
    expect(canTransition('completed', 'paused')).toBe(false);
  });

  it('treats archived as terminal', () => {
    expect(canTransition('archived', 'active')).toBe(false);
    expect(canTransition('archived', 'paused')).toBe(false);
    expect(canTransition('archived', 'completed')).toBe(false);
    expect(canTransition('archived', 'archived')).toBe(false);
  });

  it('rejects a no-op transition to the same status', () => {
    expect(canTransition('active', 'active')).toBe(false);
    expect(canTransition('paused', 'paused')).toBe(false);
  });
});
