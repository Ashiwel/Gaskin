import { describe, expect, it } from 'vitest';
import { deidentify, setPrivacyDirectory } from '../index';
import { makeMother } from '../../engine/fixtures.test-helpers';

describe('doctor signatures', () => {
  it('scrubs the doctor but leaves generic words such as "hospital" alone', () => {
    setPrivacyDirectory({});
    const m = makeMother({
      medications: [{ name: 'Methyldopa', dose: '250 mg', frequency: 'twice daily', startedAt: '2026-10-01', prescribedBy: 'Dr Adebisi Ogundipe, Registrar (O&G), Lagos Island Maternity Hospital' }] as never,
    });
    const r = deidentify({ text: 'Go to the hospital now. Dr Ogundipe said the Registrar will see you at the Hospital.', mother: m });
    expect(r.text).toContain('Go to the hospital now.');
    expect(r.text).toContain('at the Hospital');
    expect(r.text).not.toContain('Ogundipe');
    expect(r.text).toContain('[DOCTOR]');
  });
});
