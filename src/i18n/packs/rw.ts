import { DRAFT_NOTE, monthGlossary } from './shared';
import { draftPack } from './late';

/**
 * Kinyarwanda for Rwanda (and Kirundi-speaking Burundi may follow much of it, but needs its own review). Machine draft in simple, warm everyday words for mothers with little
 * schooling. Standard Kinyarwanda orthography as used by the Rwanda Biomedical Centre ("ikigo nderabuzima" for health centre, "ibitaro" for hospital).
 * Numbers, medicine names (HIV, malaria) and every {placeholder} are kept as in the English.
 * Long clinical alerts, food lines with {food}, traditional practices and visit findings are left in English.
 *
 * REVIEW FIRST (least sure; native-speaking midwives please check these before anything else):
 * - danger.* "kugagara" for fits
 * - danger.pregnancy "umwana anyeganyega gake" for baby moving less
 * - danger.newborn "igituza kinjira imbere" for chest in-drawing
 * - danger.postpartum "mu myanya ndangagitsina hanuka nabi"
 * - med.art.simple keeps "HIV" (Rwanda services also say "virusi itera SIDA")
 * - visit.anc_next.date.simple "Uzagaruke"
 */
const CORE: Record<string, string> = {
  "danger.pregnancy": "Jya ku bitaro ako kanya niba uva amaraso cyangwa ugagara. Jya ako kanya niba urwaye umutwe cyane cyangwa utabona neza. Jya ako kanya niba ufite umuriro cyangwa ubabara cyane mu nda. Jya ako kanya niba amazi ameneka cyangwa umwana anyeganyega gake.",
  "danger.pregnancy.simple": "Kuva amaraso, kugagara, kubabara umutwe cyane, umuriro, cyangwa umwana anyeganyega gake: jya ku bitaro ubu.",
  "danger.postpartum": "Jya ku bitaro ako kanya niba uva amaraso menshi. Jya ako kanya niba ugagara, urwaye umutwe cyane cyangwa ufite umuriro. Jya ako kanya niba mu myanya ndangagitsina hanuka nabi. Jya ako kanya niba uhumeka nabi cyangwa ukuguru kurababara kandi kwabyimbye.",
  "danger.postpartum.simple": "Kuva amaraso menshi, kugagara, umuriro, cyangwa guhumeka nabi: jya ku bitaro ubu.",
  "danger.newborn": "Jya ku bitaro ubu niba {name} atonka cyangwa agagara. Jya ubu niba {name} ahumeka vuba cyangwa igituza kinjira imbere. Jya ubu niba {name} ashyushye, akonje cyangwa asinzira cyane. Jya ubu niba ibiganza cyangwa ibirenge bisa n’umuhondo.",
  "danger.newborn.simple": "Ntonka, aragagara, ahumeka vuba, arashyushye cyangwa arakonje, asinzira cyane: jya ku bitaro ubu.",
  "danger.child": "Jya ku kigo nderabuzima ubu niba {name} adashobora kunywa cyangwa aruka ibintu byose. Jya ubu niba agagara, asinzira cyane cyangwa ahumeka vuba.",
  "danger.child.simple": "Ntashobora kunywa, aragagara, asinzira cyane, cyangwa ahumeka vuba: jya ku kigo nderabuzima ubu.",
  "alert.go_now": "Jya ku bitaro ubu. Ntutegereze.",
  "alert.go_today": "Jya ku kigo nderabuzima uyu munsi.",
  "alert.fallback": "Duhangayikishijwe n’ubuzima bwawe. Jya ku kigo nderabuzima uyu munsi.",
  "alert.postpartum_haemorrhage": "Kuva amaraso menshi nyuma yo kubyara ni bibi cyane. Jyana n’umuntu ushobora gutanga amaraso. Jya ku bitaro ubu. Ntutegereze.",
  "alert.newborn_danger": "{name} afite ikimenyetso cy’ibyago. Mu nzira, shyushya {name} ku gituza cyawe. Jya ku bitaro ubu. Ntutegereze.",
  "alert.child_fever": "{name} afite umuriro. {name} agomba gupimwa malariya uyu munsi. Jya ku kigo nderabuzima uyu munsi.",
  "rest.itn": "Ryama mu nzitiramibu iteye umuti buri joro, umwaka wose.",
  "rest.sleep_side.simple": "Ryama ku ruhande, si ku mugongo.",
  "baby.warm.simple": "Shyushya {name}. Fata umwana uruhu ku ruhu.",
  "bf.prepare.simple": "Onsa mu isaha ya mbere. Amashereka gusa mu mezi 6.",
  "bf.more_milk.simple": "Onsa kenshi, ku manywa na nijoro. Uko yonka kenshi, ni ko amashereka yiyongera.",
  "med.iron_folate.simple": "Nywa ikinini kimwe cyongera amaraso buri munsi.",
  "med.art.simple": "Nywa imiti yawe ya HIV buri munsi.",
  "visit.anc_next.date.simple": "Uzagaruke ku kigo nderabuzima: {date}.",
  "nutr.water": "Nywa nk’ibikombe 8 by’amazi meza buri munsi.",
  "mh.check_in": "Umeze ute? Ushobora kutubwira niba ubabaye cyangwa uhangayitse. Ubufasha burahari.",
};

/** VISIT_TEXT lines; shown once the visits module registers its templates */
const VISITS: Record<string, string> = {
  "vt.next_visit.simple": "Uzagaruke: {date}.",
};

export const rw = draftPack({
  code: 'rw',
  name: "Kinyarwanda",
  nativeName: "Ikinyarwanda",
  note: `${DRAFT_NOTE} Long clinical alerts, food lines with {food}, traditional practices and visit findings are left in English.`,
  ui: {
    "nav.today": "Uyu munsi",
    "nav.mothers": "Ababyeyi",
    "nav.visits": "Gusura",
    "nav.messages": "Ubutumwa",
    "nav.settings": "Igenamiterere",
    "nav.back": "Subira inyuma",
    "nav.search": "Shakisha",
    "cat.danger_signs": "Ibimenyetso by’ibyago",
    "cat.medication": "Imiti",
    "cat.nutrition": "Imirire",
    "cat.breastfeeding": "Konsa",
    "cat.immunisation": "Inkingo",
    "stage.pregnancy": "Gutwita",
    "stage.postpartum": "Nyuma yo kubyara",
    "stage.infant": "Umwana",
    "alert.level.emergency": "Ibyihutirwa",
    "alert.level.warning": "Iburira",
    "alert.action.call_mother": "Muhamagare",
    "alert.action.show_mother": "Ereka umubyeyi",
    "alert.action.why": "Kubera iki?",
    "plan.done": "Byakozwe",
    "dual.show_to_mother": "Ereka umubyeyi",
    "conf.fallback": "Icyongereza",
    "common.yes": "Yego",
    "common.no": "Oya",
    "common.today": "Uyu munsi",
    "common.mother": "Umubyeyi",
    "common.baby": "Umwana",
    "common.save": "Bika",
    "common.close": "Funga",
    "common.english": "Icyongereza",
    "msg.send": "Ohereza",
  },
  core: CORE,
  visits: VISITS,
  glossary: {
    ...monthGlossary('{d} {m}', ["Mutarama", "Gashyantare", "Werurwe", "Mata", "Gicurasi", "Kamena", "Nyakanga", "Kanama", "Nzeri", "Ukwakira", "Ugushyingo", "Ukuboza"]),
    'the baby': "umwana",
    'your baby': "umwana wawe",
  },
  source: 'Machine draft by the Gaskin build team, Nov 2026; awaiting review by Kinyarwanda-speaking midwives',
});
