import type { Channel, ChannelCost, Citation, CountryCode, CountryProfile, LanguageCode } from '../types';
import { CITATIONS } from '../clinical/citations';

/** The simulated "today" for the demo (pitch recording, 9 Nov 2026). */
export const DEMO_START_CLOCK = '2026-11-09T09:00:00.000Z';

export const LANGUAGE_NAMES: Record<LanguageCode, string> = {
  en: 'English',
  pcm: 'Nigerian Pidgin',
  ha: 'Hausa',
  yo: 'Yorùbá',
  ig: 'Igbo',
  sw: 'Kiswahili',
  tw: 'Twi',
  bin: 'Edo (Bini)',
  urh: 'Urhobo',
  ar: 'Arabic (Shuwa)',
  dag: 'Dagbani',
  luo: 'Dholuo',
  ee: 'Ewe',
  ff: 'Fulfulde',
};

/**
 * Exchange rates used for USD conversion (local currency per US$1).
 * NG: official NFEM rate, 3 Sep 2026 (as used in channels_regulation.md).
 * KE: CBK indicative rate ~129.2; consistent with kenya.md (KES 0.52 ≈ USD 0.004).
 * GH: Bank of Ghana Summary of Economic and Financial Data, Sep 2026 (GH¢11.55/$).
 * Re-check before any real cost model.
 */
export const FX_PER_USD: Record<CountryCode, number> = { NG: 1329.12, KE: 129.2, GH: 11.55 };

const src = {
  ngFx: { id: 'fx-ng-nfem-2026', label: 'NFEM official rate ₦1,329.12/$ (AllAfrica, 3 Sep 2026)', url: 'https://allafrica.com/stories/202609030266.html' },
  ngSms: { id: 'ng-sms-sentdm-2025', label: 'Nigeria SMS pricing after Feb 2025 tariff review (sent.dm): MTN bulk ₦1.95–2.15/SMS; market ₦2.20–6.00', url: 'https://www.sent.dm/resources/sms-pricing/nigeria-sms-pricing' },
  ngWa: { id: 'ng-wa-chatmaxima-2026', label: 'WhatsApp Business API Nigeria rates (ChatMaxima, eff. 1 Oct 2026): utility $0.0067; service $0.0067 after 1,000 free', url: 'https://chatmaxima.com/whatsapp-api-pricing/nigeria/' },
  ngVoice: { id: 'ng-voice-at', label: "Africa's Talking voice pricing Nigeria: outbound ₦15/min (pre-2025 tariff page)", url: 'https://help.africastalking.com/en/articles/6054867-voice-pricing-nigeria' },
  ngPrint: { id: 'ng-print-viscorner-2025', label: 'Cost of printing services in Nigeria (VisCorner, Sep 2025): ₦10–20/page B&W, ₦50–100 colour', url: 'https://viscorner.com/costs/cost-of-printing-services-in-nigeria-everything-you-need-to-know' },
  keSms: { id: 'ke-sms-sentdm-2025', label: 'Kenya SMS pricing (sent.dm, Oct 2025): Safaricom bulk KES 1.06 (25k–125k) to 0.11', url: 'https://www.sent.dm/en/resources/sms-pricing/kenya-sms-pricing' },
  keWa: { id: 'ke-wa-techweez-2026', label: 'WhatsApp Business pricing from Oct 2026 (Techweez): service ≈ KES 0.52 after 1,000 free', url: 'https://techweez.com/2026/09/28/whatsapp-business-pricing-october-2026/' },
  keWaUtil: { id: 'wa-bsg-2026', label: 'WhatsApp API pricing 2026 (BSG): Rest of Africa utility "typically under $0.01"', url: 'https://bsg.world/blog/guides/whatsapp-api-pricing-in-2026-what-it-costs-how-to-optimize' },
  keVoice: { id: 'ke-voice-at', label: "Africa's Talking voice pricing Kenya: regular outgoing KES 2.50/min", url: 'https://help.africastalking.com/en/articles/6049200-voice-pricing-kenya' },
  ghFx: { id: 'fx-gh-bog-2026', label: 'Bank of Ghana, Sep 2026: GH¢11.55/$ (via MyJoyOnline)', url: 'https://www.myjoyonline.com/cedi-depreciates-by-9-5-in-nine-months-of-2026-bog/' },
  ghSms: { id: 'gh-sms-sentdm-2025', label: 'Ghana SMS pricing (sent.dm, May 2025): local ≈ GHS 0.05; API $0.015–0.032', url: 'https://www.sent.dm/resources/ghana-sms-pricing' },
  ghWa: { id: 'gh-wa-meta', label: 'Meta WhatsApp pricing: Ghana in "Rest of Africa" region, per-message billing', url: 'https://developers.facebook.com/docs/whatsapp/pricing' },
} satisfies Record<string, Citation>;

function cost(country: CountryCode, channel: Channel, unitCostLocal: number, unit: string, source: Citation | undefined, notes?: string, usdOverride?: number): ChannelCost {
  const usd = usdOverride ?? unitCostLocal / FX_PER_USD[country];
  return { channel, unitCostLocal: round(unitCostLocal, 4), unitCostUSD: round(usd, 5), unit, notes, source };
}

function round(n: number, dp: number): number {
  const f = Math.pow(10, dp);
  return Math.round(n * f) / f;
}

function c(...ids: string[]): Citation[] {
  return ids.map((id) => CITATIONS[id]).filter((x): x is Citation => !!x);
}

/** Order matters for WhatsApp: the utility template entry comes first and is the default unit. */
export const COUNTRIES: Record<CountryCode, CountryProfile> = {
  NG: {
    code: 'NG',
    name: 'Nigeria',
    currency: 'NGN',
    currencySymbol: '₦',
    languages: ['en', 'ha', 'yo', 'ig', 'pcm', 'bin', 'urh', 'ar', 'ff'],
    regions: ['Lagos', 'Kano', 'Kaduna', 'Enugu', 'Oyo', 'Bauchi', 'Rivers', 'Edo', 'Delta', 'Borno'],
    workerRoles: ['Midwife', 'Nurse', 'CHEW', 'JCHEW', 'CHIPS agent', 'Medical officer', 'Obstetrician'],
    guidelineSources: [
      ...c('who-anc-2016', 'who-pnc-2022', 'ng-mip-2018', 'ng-nphcda-immunisation', 'ng-standing-orders-2015', 'ng-chx-strategy', 'ng-bhcpf-2020', 'ng-mamii'),
    ],
    emergencyLine: '112 (national emergency); Lagos: 767 or 112',
    channelCosts: [
      cost('NG', 'sms', 2.15, 'SMS segment (160 GSM-7 characters)', src.ngSms, 'MTN 30-day bulk bundle, 500–2,000 messages. Retail is ₦6; BulkSMSNigeria standard route ₦6.49 + VAT. Bulk sending 8am–8pm only.'),
      cost('NG', 'whatsapp', 0.0067 * FX_PER_USD.NG, 'WhatsApp utility template (delivered)', src.ngWa, 'Meta bills in USD. Yournotify/Dubawa cite ~$0.0101; conflicting sources. Utility templates inside an open 24-hour window may be free (Oct 2026 change unconfirmed).', 0.0067),
      cost('NG', 'whatsapp', 0.0067 * FX_PER_USD.NG, 'WhatsApp service message (reply in 24-hour window)', src.ngWa, 'Reported chargeable after first 1,000 free per number per month from 1 Oct 2026; Meta page still says free. Treat as upper bound.', 0.0067),
      cost('NG', 'email', 0, 'email', undefined, 'Negligible marginal cost (free tier of a transactional email service). Few rural mothers use email.'),
      cost('NG', 'voice', 15, 'minute of outbound voice / IVR', src.ngVoice, 'Page predates the 2025 tariff review; MTN retail ₦13.8/min.'),
      cost('NG', 'print', 20, 'printed A4 page (black and white)', src.ngPrint, 'Business-centre rate ₦10–20 B&W; colour ₦50–100. Handed over by the health worker.'),
    ],
  },
  KE: {
    code: 'KE',
    name: 'Kenya',
    currency: 'KES',
    currencySymbol: 'KSh',
    languages: ['sw', 'en', 'luo'],
    regions: ['Nairobi', 'Kisumu', 'Kilifi', 'Turkana'],
    workerRoles: ['Community Health Promoter (CHP)', 'Nurse-midwife', 'Clinical officer', 'Medical officer', 'Obstetrician'],
    guidelineSources: [...c('who-anc-2016', 'who-pnc-2022', 'ke-kepi', 'ke-linda-jamii', 'ke-kdhs-2022')],
    emergencyLine: '999 or 112',
    channelCosts: [
      cost('KE', 'sms', 1.06, 'SMS segment (160 GSM-7 characters)', src.keSms, 'Safaricom bulk, VAT-inclusive, 25k–125k tier (pilot volume). Falls to KES 0.42 at 1m+. Airtel/Telkom via aggregators KES 0.6–0.8.'),
      cost('KE', 'whatsapp', 0.0067 * FX_PER_USD.KE, 'WhatsApp utility template (delivered)', src.keWaUtil, 'Rest of Africa utility rate not retrieved from Meta; "typically under $0.01". $0.0067 assumed (same as Nigeria card). In-window utility now billable from first message (Oct 2026).', 0.0067),
      cost('KE', 'whatsapp', 0.52, 'WhatsApp service message (reply in 24-hour window)', src.keWa, 'Chargeable since 1 Oct 2026 after 1,000 free per number per month (≈ USD 0.004).'),
      cost('KE', 'email', 0, 'email', undefined, 'Negligible marginal cost.'),
      cost('KE', 'voice', 2.5, 'minute of outbound voice / IVR', src.keVoice, "Africa's Talking regular outgoing (Safaricom and Airtel). Undated page."),
      cost('KE', 'print', 10, 'printed A4 page (black and white)', undefined, 'Assumption, not sourced: typical cyber-café B&W rate. Verify locally.'),
    ],
  },
  GH: {
    code: 'GH',
    name: 'Ghana',
    currency: 'GHS',
    currencySymbol: 'GH₵',
    languages: ['en', 'tw', 'dag', 'ee'],
    regions: ['Greater Accra', 'Ashanti', 'Northern', 'Upper East'],
    workerRoles: ['Community Health Officer (CHO)', 'Community health nurse', 'Midwife', 'Medical officer', 'Obstetrician'],
    guidelineSources: [...c('who-anc-2016', 'who-pnc-2022', 'gh-ghs-immunisation', 'gh-mch-record-book', 'gh-free-maternal-care', 'gh-gdhs-2022')],
    emergencyLine: '112; National Ambulance Service 193',
    channelCosts: [
      cost('GH', 'sms', 0.05, 'SMS segment (160 GSM-7 characters)', src.ghSms, 'Local consumer rate ≈ GHS 0.05; API providers $0.015–0.032 (Plivo $0.0152). Local aggregator (Arkesel, Hubtel, mNotify) rates not retrieved.'),
      cost('GH', 'whatsapp', 0.0067 * FX_PER_USD.GH, 'WhatsApp utility template (delivered)', src.ghWa, 'Rest of Africa rate card not retrieved; $0.0067 assumed. Utility is ~1/8 of marketing.', 0.0067),
      cost('GH', 'whatsapp', 0.004 * FX_PER_USD.GH, 'WhatsApp service message (reply in 24-hour window)', src.keWa, 'Assumes the Oct 2026 Rest of Africa service charge reported for Kenya (≈ $0.004) after 1,000 free.', 0.004),
      cost('GH', 'email', 0, 'email', undefined, 'Negligible marginal cost.'),
      cost('GH', 'voice', 0.3, 'minute of outbound voice / IVR', undefined, 'Assumption, not sourced. Voice/IVR in Dagbani, Gurene, Twi needed in the north (literacy 33–48%).'),
      cost('GH', 'print', 0.5, 'printed A4 page (black and white)', undefined, 'Assumption, not sourced. The paper MCH Record Book is the de facto record; print slots in beside it.'),
    ],
  },
};

/** Exchange-rate sources, for an "about the numbers" panel. */
export const FX_SOURCES: Record<CountryCode, Citation> = {
  NG: src.ngFx,
  KE: { id: 'fx-ke-cbk', label: 'Central Bank of Kenya indicative rate ≈ KES 129.2/$ (Eastleigh Voice)', url: 'https://eastleighvoice.co.ke/cbk/193791/kenyan-shilling-holds-steady-at-129-against-the-dollar-for-a-year' },
  GH: src.ghFx,
};
