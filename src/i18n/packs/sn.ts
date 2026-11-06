import { DRAFT_NOTE, monthGlossary } from './shared';
import { draftPack } from './late';

/**
 * chiShona for Zimbabwe and central Mozambique (Manica). Machine draft in simple, warm everyday words for mothers with little
 * schooling. Standard Shona orthography; the mother is addressed with the respectful plural (endai, inwai).
 * Numbers, medicine names (HIV, malaria) and every {placeholder} are kept as in the English.
 * Only the short (.simple) danger lines are drafted; long danger lines, clinical alerts, food, traditional practices and visit findings are left in English.
 *
 * REVIEW FIRST (least sure; native-speaking midwives please check these before anything else):
 * - danger.* "pfari" for fits
 * - danger.* "kupisa muviri" for fever
 * - danger.pregnancy.simple "mwana kusafamba zvakanyanya" for baby moving less
 * - ui stage.postpartum "Mushure mekusununguka"
 * - ui cat.immunisation "Majekiseni"
 */
const CORE: Record<string, string> = {
  "danger.pregnancy.simple": "Kubuda ropa, pfari, musoro unorwadza zvakanyanya, kupisa muviri, kana mwana kusafamba zvakanyanya: endai kuchipatara izvozvi.",
  "danger.postpartum.simple": "Kubuda ropa rakawanda, pfari, kupisa muviri, kana kufema nekunetseka: endai kuchipatara izvozvi.",
  "danger.newborn.simple": "Haayamwi, pfari, kufema nekukurumidza, kupisa kana kutonhora, kurara zvakanyanya: endai kuchipatara izvozvi.",
  "danger.child.simple": "Haakwanisi kunwa, pfari, kurara zvakanyanya, kana kufema nekukurumidza: endai kukiriniki izvozvi.",
  "alert.go_now": "Endai kuchipatara izvozvi. Musamirira.",
  "alert.go_today": "Endai kukiriniki nhasi.",
  "alert.fallback": "Tinonetseka nehutano hwenyu. Endai kukiriniki nhasi.",
  "alert.newborn_danger": "{name} ane chiratidzo chengozi. Munzira, chengetai {name} achidziya pachipfuva chenyu. Endai kuchipatara izvozvi. Musamirira.",
  "alert.child_fever": "{name} ari kupisa muviri. {name} anoda kuongororwa malaria nhasi. Endai kukiriniki nhasi.",
  "rest.itn": "Rarai mumumbure une mushonga usiku hwese, gore rese.",
  "rest.sleep_side.simple": "Rarai nedivi, kwete nemusana.",
  "bf.prepare.simple": "Yamwisai muawa rekutanga. Mukaka wezamu chete kwemwedzi 6.",
  "bf.more_milk.simple": "Yamwisai kazhinji, masikati neusiku. Kuyamwa kwakawanda kunounza mukaka wakawanda.",
  "med.iron_folate.simple": "Inwai piritsi rimwe reropa zuva rega rega.",
  "med.art.simple": "Inwai mushonga wenyu weHIV zuva rega rega.",
  "visit.anc_next.date.simple": "Kushanya kunotevera kukiriniki: {date}.",
  "nutr.water": "Inwai makapu angangoita 8 emvura yakachena zuva rega rega.",
  "mh.check_in": "Muri kunzwa sei? Munogona kutiudza kana muchisuwa kana kunetseka. Rubatsiro ruripo.",
};

/** VISIT_TEXT lines; shown once the visits module registers its templates */
const VISITS: Record<string, string> = {
  "vt.next_visit.simple": "Kushanya kunotevera: {date}.",
};

export const sn = draftPack({
  code: 'sn',
  name: "chiShona",
  nativeName: "chiShona",
  note: `${DRAFT_NOTE} Only the short (.simple) danger lines are drafted; long danger lines, clinical alerts, food, traditional practices and visit findings are left in English.`,
  ui: {
    "nav.today": "Nhasi",
    "nav.mothers": "Vanaamai",
    "nav.messages": "Mameseji",
    "nav.back": "Dzokera",
    "nav.search": "Tsvaga",
    "cat.danger_signs": "Zviratidzo zvengozi",
    "cat.medication": "Mishonga",
    "cat.nutrition": "Chikafu",
    "cat.breastfeeding": "Kuyamwisa",
    "cat.immunisation": "Majekiseni",
    "stage.pregnancy": "Pamuviri",
    "stage.postpartum": "Mushure mekusununguka",
    "stage.infant": "Mwana",
    "alert.action.show_mother": "Ratidza amai",
    "alert.action.why": "Sei?",
    "dual.show_to_mother": "Ratidza amai",
    "conf.fallback": "Chirungu",
    "common.yes": "Hongu",
    "common.no": "Kwete",
    "common.today": "Nhasi",
    "common.tomorrow": "Mangwana",
    "common.mother": "Amai",
    "common.baby": "Mwana",
    "common.close": "Vhara",
    "common.english": "Chirungu",
    "msg.send": "Tumira",
  },
  core: CORE,
  visits: VISITS,
  glossary: {
    ...monthGlossary('{d} {m}', ["Ndira", "Kukadzi", "Kurume", "Kubvumbi", "Chivabvu", "Chikumi", "Chikunguru", "Nyamavhuvhu", "Gunyana", "Gumiguru", "Mbudzi", "Zvita"]),
    'the baby': "mwana",
    'your baby': "mwana wenyu",
  },
  source: 'Machine draft by the Gaskin build team, Nov 2026; awaiting review by chiShona-speaking midwives',
});
