import { describe, expect, it } from 'vitest';
import { authenticate, createUser, login, normalisePhone, validPin } from '../src/auth';
import { FAC_A, testDb } from './helpers';

const cfg = { tokenDays: 1, pinMaxAttempts: 3, pinLockMinutes: 15, defaultCountry: 'NG' as const };

describe('phone + PIN accounts', () => {
  it('normalises Nigerian, Kenyan and Ghanaian numbers', () => {
    expect(normalisePhone('0803 111 2222', 'NG')).toBe('+2348031112222');
    expect(normalisePhone('0712 345 678', 'KE')).toBe('+254712345678');
    expect(normalisePhone('024 123 4567', 'GH')).toBe('+233241234567');
    expect(normalisePhone('+234 803 111 2222')).toBe('+2348031112222');
  });

  it('refuses easy PINs', () => {
    for (const p of ['1234', '0000', '123', '987654', 'abcd']) expect(validPin(p)).toBe(false);
    expect(validPin('482916')).toBe(true);
  });

  it('locks the account after repeated wrong PINs, and stores only a hash of the token', async () => {
    const db = await testDb();
    await createUser(db, { phone: '08035550000', pin: '482916', name: 'A', role: 'worker', facilityIds: [FAC_A] });
    for (let i = 0; i < 2; i++) expect(await login(db, cfg, '08035550000', '111222')).toMatchObject({ ok: false, reason: 'invalid' });
    expect(await login(db, cfg, '08035550000', '111222')).toMatchObject({ ok: false, reason: 'locked' });
    // Even the right PIN is refused while locked
    expect(await login(db, cfg, '08035550000', '482916')).toMatchObject({ ok: false, reason: 'locked' });
    await db.run('UPDATE users SET locked_until = NULL');
    const ok = await login(db, cfg, '08035550000', '482916');
    expect(ok.ok).toBe(true);
    if (!ok.ok) return;
    const stored = await db.all<{ token_hash: string }>('SELECT token_hash FROM sessions');
    expect(stored[0].token_hash).not.toBe(ok.token);
    expect((await authenticate(db, ok.token))?.facilityIds).toEqual([FAC_A]);
    expect(await authenticate(db, 'forged')).toBeNull();
  });
});
