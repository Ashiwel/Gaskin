/**
 * Plain-words legal text for people using Gaskin for themselves. Translatable: every line is a key in
 * LEGAL_TEXT (register with registerTemplates('legal', LEGAL_TEXT)); placeholders: {number} the
 * emergency number, {place} the nearest facility.
 *
 * The terms-and-privacy summary describes the demo as built: records stay on the device unless she
 * chooses to share or back them up; AI is off unless switched on, and prompts are de-identified first.
 * It is a summary for the demo, not legal advice, and a deployment needs its own reviewed terms under
 * the NDPA 2023 (Nigeria), the Kenya Data Protection Act 2019 or the Ghana Data Protection Act 2012.
 */
export const LEGAL_TEXT: Record<string, string> = {
  // ---------- Disclaimer ----------
  'legal.disclaimer.title': 'Before you start',
  'legal.disclaimer.not_doctor': 'Gaskin is not a doctor. It does not replace a nurse, midwife or doctor.',
  'legal.disclaimer.emergency': 'In an emergency, go to the nearest hospital now. Or call {number}.',
  'legal.disclaimer.general': 'Your plan is general advice for women like you. It cannot see or examine you.',
  'legal.disclaimer.with_worker': 'Use Gaskin together with a health worker. Show them your plan at each visit.',
  'legal.disclaimer.danger': 'If something feels wrong, do not wait for the app. Go to a clinic.',

  // ---------- Terms and privacy (demo) ----------
  'legal.terms.title': 'Terms and privacy',
  'legal.terms.free': 'Gaskin is free and open source. It is a demonstration, not a medical service.',
  'legal.terms.device': 'What you enter stays on this phone or computer. We do not see it.',
  'legal.terms.share': 'Your record leaves this device only if you send, back up or share it.',
  'legal.terms.ai': 'Smart help is off unless you switch it on. Names and places are removed first.',
  'legal.terms.delete': 'You can delete your record at any time in Settings.',
  'legal.terms.shared_phone': 'On a shared phone, lock Gaskin with a PIN.',
  'legal.terms.no_warranty': 'Gaskin gives no promise that the advice fits you. Check with a health worker.',

  // ---------- Consent for personal use ----------
  'legal.consent.title': 'Your agreement',
  'legal.consent.understand': 'I understand Gaskin is not a doctor and gives general advice.',
  'legal.consent.emergency': 'I know to go to a hospital or call {number} in an emergency.',
  'legal.consent.store': 'I agree that Gaskin keeps my health notes on this device.',
  'legal.consent.ai': 'I choose whether to use smart help. I can change this later.',
  'legal.consent.age': 'I am 18 or older, or a parent or guardian is helping me.',
  'legal.consent.agree': 'I agree',
  'legal.consent.not_now': 'Not now',
};

export const DISCLAIMER_KEYS = ['legal.disclaimer.not_doctor', 'legal.disclaimer.emergency', 'legal.disclaimer.general', 'legal.disclaimer.with_worker', 'legal.disclaimer.danger'];
export const TERMS_KEYS = ['legal.terms.free', 'legal.terms.device', 'legal.terms.share', 'legal.terms.ai', 'legal.terms.delete', 'legal.terms.shared_phone', 'legal.terms.no_warranty'];
export const CONSENT_KEYS = ['legal.consent.understand', 'legal.consent.emergency', 'legal.consent.store', 'legal.consent.ai', 'legal.consent.age'];

/** What a personal-use consent records. Store with the record; show again when CONSENT_VERSION changes. */
export interface PersonalConsent {
  version: string;
  agreedAt: string;
  understandsNotDoctor: boolean;
  knowsEmergency: boolean;
  storeOnDevice: boolean;
  aiAllowed: boolean;
  adultOrGuardian: boolean;
}

export const CONSENT_VERSION = '2026-11-05';

export function renderLegal(key: string, params: Record<string, string | number> = {}): string {
  const t = LEGAL_TEXT[key];
  if (t === undefined) throw new Error(`Missing LEGAL_TEXT template: ${key}`);
  return t.replace(/\{(\w+)\}/g, (_, k: string) => (params[k] !== undefined ? String(params[k]) : `{${k}}`));
}

/** Valid only when every required box is ticked and the version is current. */
export function consentValid(c: PersonalConsent | undefined | null): boolean {
  return !!c && c.version === CONSENT_VERSION && c.understandsNotDoctor && c.knowsEmergency && c.storeOnDevice && c.adultOrGuardian;
}
