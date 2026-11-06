/** Footer text and emergency number for personal mode, from src/legal and the saved place. */
import { setupStore } from '../../setup';
import { dialable, emergencyFor, footerDisclaimer } from '../onboarding/geo';

export function placeCountry(): string | undefined {
  const s = setupStore.get();
  const a = s?.answers as { countryCode?: string } | undefined;
  return a?.countryCode ?? (s?.plan.country !== 'other' ? s?.plan.country : undefined);
}

export function personalLegal(): { disclaimer: string; emergencyNumber: string; emergencyLabel: string } {
  const e = emergencyFor(placeCountry());
  // The shell's footer makes a tel: link by stripping non-digits, so pass one dialable number
  // ("999 or 112" would become 999112).
  return { disclaimer: footerDisclaimer(), emergencyNumber: dialable(e.number), emergencyLabel: e.label };
}
