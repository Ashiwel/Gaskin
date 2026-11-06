import { DRAFT_NOTE, monthGlossary } from './shared';
import { draftPack } from './late';

/**
 * Luganda for Uganda (Central region). Machine draft in simple, warm everyday words for mothers with little
 * schooling. Standard Luganda orthography. The English word "fits" is kept where no sure Luganda term was found.
 * Numbers, medicine names (HIV, malaria) and every {placeholder} are kept as in the English.
 * Status is partial: only the short danger lines, two "go now/today" lines and a few common lines are drafted. Everything else is left in English until a Luganda-speaking midwife team writes it.
 *
 * REVIEW FIRST (least sure; native-speaking midwives please check these before anything else):
 * - Every line: this pack has the least confidence of the set and needs a full native review
 * - danger.* keep the English word "fits"
 * - danger.pregnancy.simple "omwana okutambula katono" for baby moving less
 * - rest.itn "akatimba k’ensiri"
 */
const CORE: Record<string, string> = {
  "danger.pregnancy.simple": "Okuvaamu omusaayi, fits, omutwe okuluma ennyo, omusujja, oba omwana okutambula katono: genda mu ddwaliro kaakano.",
  "danger.postpartum.simple": "Okuvaamu omusaayi mungi, fits, omusujja, oba okussa obubi: genda mu ddwaliro kaakano.",
  "danger.newborn.simple": "Tayonka, fits, assa mangu, ayokya oba anyogoga, yeebaka nnyo: genda mu ddwaliro kaakano.",
  "danger.child.simple": "Tasobola kunywa, fits, yeebaka nnyo, oba assa mangu: genda mu ddwaliro kaakano.",
  "alert.go_now": "Genda mu ddwaliro kaakano. Tolinda.",
  "alert.go_today": "Genda mu ddwaliro leero.",
  "rest.itn": "Weebake mu katimba k’ensiri ak’eddagala buli kiro, omwaka gwonna.",
  "med.art.simple": "Mira eddagala lyo erya HIV buli lunaku.",
};

/** VISIT_TEXT lines; shown once the visits module registers its templates */
const VISITS: Record<string, string> = {

};

export const lg = draftPack({
  code: 'lg',
  name: "Luganda",
  nativeName: "Luganda",
  note: `${DRAFT_NOTE} Status is partial: only the short danger lines, two "go now/today" lines and a few common lines are drafted. Everything else is left in English until a Luganda-speaking midwife team writes it.`,
  status: 'partial',
  ui: {
    "nav.today": "Leero",
    "nav.mothers": "Bamaama",
    "nav.messages": "Obubaka",
    "nav.back": "Ddayo",
    "nav.search": "Noonya",
    "cat.medication": "Eddagala",
    "stage.infant": "Omwana",
    "alert.action.why": "Lwaki?",
    "conf.fallback": "Olungereza",
    "common.yes": "Yee",
    "common.no": "Nedda",
    "common.today": "Leero",
    "common.tomorrow": "Enkya",
    "common.mother": "Maama",
    "common.baby": "Omwana",
    "common.english": "Olungereza",
  },
  core: CORE,
  visits: VISITS,
  glossary: {
    ...monthGlossary('{d} {m}', ["Janwaliyo", "Febwaliyo", "Marisi", "Apuli", "Maayi", "Juuni", "Julaayi", "Agusito", "Sebuttemba", "Okitobba", "Novemba", "Desemba"]),
    'the baby': "omwana",
    'your baby': "omwana wo",
  },
  source: 'Machine draft by the Gaskin build team, Nov 2026; awaiting review by Luganda-speaking midwives',
});
