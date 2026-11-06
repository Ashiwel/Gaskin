import { DRAFT_NOTE, monthGlossary } from './shared';
import { draftPack } from './late';

/**
 * Chichewa (Nyanja) for Malawi, eastern Zambia and Mozambique (Tete, Niassa). Machine draft in simple, warm everyday words for mothers with little
 * schooling. Standard Malawian Chichewa; the mother is addressed with the polite plural (pitani, imwani).
 * Numbers, medicine names (HIV, malaria) and every {placeholder} are kept as in the English.
 * Only the short (.simple) danger lines are drafted; long danger lines, clinical alerts, food, traditional practices and visit findings are left in English.
 *
 * REVIEW FIRST (least sure; native-speaking midwives please check these before anything else):
 * - danger.* "kugwedezeka thupi" for fits
 * - danger.* "kutentha thupi" for fever ("malungo" is kept for malaria)
 * - danger.pregnancy.simple "mwana kusayenda kwambiri" for baby moving less
 * - alert.newborn_danger "gwirani {name} pachifuwa panu kuti asazizire"
 * - rest.itn "neti ya udzudzu yothiridwa mankhwala"
 */
const CORE: Record<string, string> = {
  "danger.pregnancy.simple": "Kutuluka magazi, kugwedezeka thupi, mutu kupweteka kwambiri, kutentha thupi, kapena mwana kusayenda kwambiri: pitani kuchipatala tsopano.",
  "danger.postpartum.simple": "Kutuluka magazi ambiri, kugwedezeka thupi, kutentha thupi, kapena kupuma movutikira: pitani kuchipatala tsopano.",
  "danger.newborn.simple": "Sakuyamwa, kugwedezeka thupi, kupuma mofulumira, kutentha kapena kuzizira, kugona kwambiri: pitani kuchipatala tsopano.",
  "danger.child.simple": "Sangathe kumwa, kugwedezeka thupi, kugona kwambiri, kapena kupuma mofulumira: pitani kuchipatala tsopano.",
  "alert.go_now": "Pitani kuchipatala tsopano. Musadikire.",
  "alert.go_today": "Pitani kuchipatala lero.",
  "alert.fallback": "Tikudandaula za thanzi lanu. Pitani kuchipatala lero.",
  "alert.newborn_danger": "{name} ali ndi chizindikiro cha ngozi. Panjira, gwirani {name} pachifuwa panu kuti asazizire. Pitani kuchipatala tsopano. Musadikire.",
  "alert.child_fever": "{name} akutentha thupi. {name} akufunika kuyezedwa malungo lero. Pitani kuchipatala lero.",
  "rest.itn": "Gonani mu neti ya udzudzu yothiridwa mankhwala usiku uliwonse, chaka chonse.",
  "rest.sleep_side.simple": "Gonani chammbali, osati chagada.",
  "baby.warm.simple": "Sungani {name} wofunda. Gwirani mwana khungu ndi khungu.",
  "bf.prepare.simple": "Yamwitsani mu ola loyamba. Mkaka wa m’mawere wokha kwa miyezi 6.",
  "bf.more_milk.simple": "Yamwitsani pafupipafupi, usana ndi usiku. Mwana akayamwa kwambiri, mkaka umachuluka.",
  "med.iron_folate.simple": "Imwani piritsi limodzi lowonjezera magazi tsiku lililonse.",
  "med.art.simple": "Imwani mankhwala anu a HIV tsiku lililonse.",
  "visit.anc_next.date.simple": "Ulendo wotsatira ku chipatala: {date}.",
  "nutr.water": "Imwani pafupifupi makapu 8 a madzi aukhondo tsiku lililonse.",
  "mh.check_in": "Mukumva bwanji? Mungatiuze ngati muli ndi chisoni kapena nkhawa. Thandizo lilipo.",
};

/** VISIT_TEXT lines; shown once the visits module registers its templates */
const VISITS: Record<string, string> = {
  "vt.next_visit.simple": "Ulendo wotsatira: {date}.",
};

export const ny = draftPack({
  code: 'ny',
  name: "Chichewa (Nyanja)",
  nativeName: "Chicheŵa",
  note: `${DRAFT_NOTE} Only the short (.simple) danger lines are drafted; long danger lines, clinical alerts, food, traditional practices and visit findings are left in English.`,
  ui: {
    "nav.today": "Lero",
    "nav.mothers": "Amayi",
    "nav.messages": "Mauthenga",
    "nav.back": "Bwererani",
    "nav.search": "Sakani",
    "cat.danger_signs": "Zizindikiro za ngozi",
    "cat.medication": "Mankhwala",
    "cat.nutrition": "Chakudya",
    "cat.breastfeeding": "Kuyamwitsa",
    "cat.immunisation": "Katemera",
    "stage.pregnancy": "Pathupi",
    "stage.postpartum": "Pambuyo pobereka",
    "stage.infant": "Mwana",
    "alert.level.emergency": "Zadzidzidzi",
    "alert.action.show_mother": "Onetsani mayi",
    "alert.action.why": "Chifukwa chiyani?",
    "dual.show_to_mother": "Onetsani mayi",
    "conf.fallback": "Chingerezi",
    "common.yes": "Inde",
    "common.no": "Ayi",
    "common.today": "Lero",
    "common.tomorrow": "Mawa",
    "common.mother": "Mayi",
    "common.baby": "Mwana",
    "common.close": "Tsekani",
    "common.english": "Chingerezi",
    "msg.send": "Tumizani",
  },
  core: CORE,
  visits: VISITS,
  glossary: {
    ...monthGlossary('{d} {m}', ["Januwale", "Febuluwale", "Malichi", "Epulo", "Meyi", "Juni", "Julayi", "Ogasiti", "Seputembala", "Okutobala", "Novembala", "Disembala"]),
    'the baby': "mwana",
    'your baby': "mwana wanu",
  },
  source: 'Machine draft by the Gaskin build team, Nov 2026; awaiting review by Chichewa (Nyanja)-speaking midwives',
});
