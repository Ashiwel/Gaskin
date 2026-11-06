import { DRAFT_NOTE, monthGlossary } from './shared';
import { draftPack } from './late';

/**
 * Setswana for Botswana and South Africa (North West). Machine draft in simple, warm everyday words for mothers with little
 * schooling. Standard Setswana orthography. The English word "fits" is kept where no sure Setswana term was found.
 * Numbers, medicine names (HIV, malaria) and every {placeholder} are kept as in the English.
 * Only the short (.simple) danger lines are drafted; long danger lines, clinical alerts, food, traditional practices and visit findings are left in English.
 *
 * REVIEW FIRST (least sure; native-speaking midwives please check these before anything else):
 * - danger.* keep the English word "fits"; a Setswana term is wanted
 * - danger.* "letshoroma" for fever (also used for malaria)
 * - danger.pregnancy.simple "ngwana a tshikhinyega go le gonnye" for baby moving less
 * - rest.itn "letlowa la monang le le nang le molemo"
 */
const CORE: Record<string, string> = {
  "danger.pregnancy.simple": "Go tswa madi, fits, tlhogo e e botlhoko thata, letshoroma, kgotsa ngwana a tshikhinyega go le gonnye: ya kwa bookelong jaanong.",
  "danger.postpartum.simple": "Go tswa madi a mantsi, fits, letshoroma, kgotsa go hema ka bokete: ya kwa bookelong jaanong.",
  "danger.newborn.simple": "Ga a anye, fits, o hema ka bonako, o a fisa kgotsa o a tsidifala, o robala thata: ya kwa bookelong jaanong.",
  "danger.child.simple": "Ga a kgone go nwa, fits, o robala thata, kgotsa o hema ka bonako: ya kwa kliniking jaanong.",
  "alert.go_now": "Ya kwa bookelong jaanong. O se ka wa ema.",
  "alert.go_today": "Ya kwa kliniking gompieno.",
  "alert.fallback": "Re tshwenyegile ka boitekanelo jwa gago. Ya kwa kliniking gompieno.",
  "alert.child_fever": "{name} o na le letshoroma. {name} o tlhoka go tlhatlhobelwa malaria gompieno. Ya kwa kliniking gompieno.",
  "rest.itn": "Robala ka fa tlase ga letlowa la monang le le nang le molemo bosigo bongwe le bongwe, ngwaga otlhe.",
  "rest.sleep_side.simple": "Robala ka letlhakore, e seng ka mokwatla.",
  "bf.prepare.simple": "Anyisa mo ureng ya ntlha. Mashi a letsele fela dikgwedi di le 6.",
  "bf.more_milk.simple": "Anyisa gantsi, motshegare le bosigo. Go anya thata go tlisa mashi a mantsi.",
  "med.iron_folate.simple": "Nwa pilisi e le nngwe ya madi letsatsi le letsatsi.",
  "med.art.simple": "Nwa melemo ya gago ya HIV letsatsi le letsatsi.",
  "visit.anc_next.date.simple": "Ketelo e e latelang kwa kliniking: {date}.",
  "nutr.water": "Nwa dikopi di ka nna 8 tsa metsi a a phepa letsatsi le letsatsi.",
  "mh.check_in": "O ikutlwa jang? O ka re bolelela fa o hutsafetse kgotsa o tshwenyegile. Thuso e teng.",
};

/** VISIT_TEXT lines; shown once the visits module registers its templates */
const VISITS: Record<string, string> = {
  "vt.next_visit.simple": "Ketelo e e latelang: {date}.",
};

export const tn = draftPack({
  code: 'tn',
  name: "Setswana",
  nativeName: "Setswana",
  note: `${DRAFT_NOTE} Only the short (.simple) danger lines are drafted; long danger lines, clinical alerts, food, traditional practices and visit findings are left in English.`,
  ui: {
    "nav.today": "Gompieno",
    "nav.mothers": "Bommè",
    "nav.messages": "Melaetsa",
    "nav.back": "Boela morago",
    "nav.search": "Batla",
    "cat.danger_signs": "Matshwao a kotsi",
    "cat.medication": "Melemo",
    "cat.nutrition": "Dijo",
    "cat.breastfeeding": "Go anyisa",
    "stage.pregnancy": "Boimana",
    "stage.infant": "Lesea",
    "alert.action.show_mother": "Bontsha mmè",
    "alert.action.why": "Goreng?",
    "dual.show_to_mother": "Bontsha mmè",
    "conf.fallback": "Sekgoa",
    "common.yes": "Ee",
    "common.no": "Nnyaa",
    "common.today": "Gompieno",
    "common.tomorrow": "Ka moso",
    "common.mother": "Mmè",
    "common.baby": "Lesea",
    "common.close": "Tswala",
    "common.english": "Sekgoa",
    "msg.send": "Romela",
  },
  core: CORE,
  visits: VISITS,
  glossary: {
    ...monthGlossary('{d} {m}', ["Ferikgong", "Tlhakole", "Mopitlo", "Moranang", "Motsheganong", "Seetebosigo", "Phukwi", "Phatwe", "Lwetse", "Diphalane", "Ngwanatsele", "Sedimonthole"]),
    'the baby': "ngwana",
    'your baby': "ngwana wa gago",
  },
  source: 'Machine draft by the Gaskin build team, Nov 2026; awaiting review by Setswana-speaking midwives',
});
