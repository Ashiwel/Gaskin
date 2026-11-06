import { DRAFT_NOTE } from './shared';
import { draftPack } from './late';

/**
 * Gĩkũyũ for Kenya (Central). Machine draft in simple, warm everyday words for mothers with little
 * schooling. Standard Gĩkũyũ orthography with ĩ and ũ.
 * Numbers, medicine names (HIV, malaria) and every {placeholder} are kept as in the English.
 * Status is partial: no danger-sign line is drafted, because none could be written with enough confidence. Mother lines fall back to English (Kiswahili is the usual second choice in Central Kenya); only a few worker UI words are drafted.
 *
 * REVIEW FIRST (least sure; native-speaking midwives please check these before anything else):
 * - alert.go_today "Thiĩ thibitarĩ ũmũthĩ" (uses "thibitarĩ" for clinic)
 * - Everything else is still English and needs a Gĩkũyũ-speaking midwife team
 */
const CORE: Record<string, string> = {
  "alert.go_today": "Thiĩ thibitarĩ ũmũthĩ.",
};

/** VISIT_TEXT lines; shown once the visits module registers its templates */
const VISITS: Record<string, string> = {

};

export const ki = draftPack({
  code: 'ki',
  name: "Gĩkũyũ",
  nativeName: "Gĩkũyũ",
  note: `${DRAFT_NOTE} Status is partial: no danger-sign line is drafted, because none could be written with enough confidence. Mother lines fall back to English (Kiswahili is the usual second choice in Central Kenya); only a few worker UI words are drafted.`,
  status: 'partial',
  ui: {
    "nav.today": "Ũmũthĩ",
    "common.yes": "Ĩĩ",
    "common.no": "Aca",
    "common.today": "Ũmũthĩ",
    "common.tomorrow": "Rũciũ",
    "common.baby": "Kaana",
    "conf.fallback": "Gĩthũngũ",
    "common.english": "Gĩthũngũ",
  },
  core: CORE,
  visits: VISITS,
  glossary: {
    'the baby': "kaana",
    'your baby': "kaana gaku",
  },
  source: 'Machine draft by the Gaskin build team, Nov 2026; awaiting review by Gĩkũyũ-speaking midwives',
});
