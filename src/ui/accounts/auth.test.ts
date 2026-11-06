import { describe, expect, it } from 'vitest';
import { createSeedState } from '../../data';
import { DEMO_PIN, currentProfile, listProfiles, lockNow, pinProblem, seedDemoProfiles, unlockStatus, verifyPin, whenReady } from './auth';

describe('accounts adapter over src/auth', () => {
  it('uses a demo PIN that src/auth accepts', () => {
    expect(pinProblem(DEMO_PIN)).toBeNull();
  });

  it('a persona adds demo profiles for her facility and signs her in', async () => {
    await whenReady();
    const seed = createSeedState();
    await seedDemoProfiles(seed.workers, seed.mothers, 'w-ng-bisola');
    expect(currentProfile()?.id).toBe('w-ng-bisola');
    expect(currentProfile()?.isSupervisor).toBe(false);
    const ids = listProfiles().map((p) => p.id);
    expect(ids).toContain('w-ng-kemi');
    expect(ids).toContain('w-ng-bankole');
  }, 60_000);

  it('locks, counts wrong PINs, and unlocks with the right one', async () => {
    lockNow();
    await new Promise((r) => setTimeout(r, 20));
    expect(currentProfile()).toBeNull();
    const bad = await verifyPin('w-ng-bisola', '9713');
    expect(bad.ok).toBe(false);
    expect(bad.message).toMatch(/4 tries left/);
    expect(unlockStatus('w-ng-bisola').attemptsLeft).toBe(4);
    const good = await verifyPin('w-ng-bisola', DEMO_PIN);
    expect(good.ok).toBe(true);
    expect(currentProfile()?.id).toBe('w-ng-bisola');
  }, 60_000);
});
