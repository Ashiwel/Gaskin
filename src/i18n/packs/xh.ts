import { DRAFT_NOTE, monthGlossary } from './shared';
import { draftPack } from './late';

/**
 * isiXhosa for South Africa (Eastern and Western Cape). Machine draft in simple, warm everyday words for mothers with little
 * schooling. Standard isiXhosa orthography; the mother is addressed in the singular. Names are written without noun-class prefixes.
 * Numbers, medicine names (HIV, malaria) and every {placeholder} are kept as in the English.
 * Long clinical alerts, food lines with {food}, traditional practices and visit findings are left in English.
 *
 * REVIEW FIRST (least sure; native-speaking midwives please check these before anything else):
 * - danger.* "ukuxhuzula" for fits
 * - danger.newborn "akancanci" (does not suckle) and "isifuba singena ngaphakathi" for chest in-drawing
 * - danger.postpartum "kwilungu langasese" for private part
 * - vt.refer_now "e-{place}" locative before a place name
 * - ui cat.immunisation "Izitofu"
 */
const CORE: Record<string, string> = {
  "danger.pregnancy": "Yiya esibhedlele ngoko nangoko ukuba uyopha okanye uyaxhuzula. Yiya ngoko nangoko ukuba intloko ibuhlungu kakhulu okanye amehlo akaboni kakuhle. Yiya ngoko nangoko ukuba unefiva okanye isisu sibuhlungu kakhulu. Yiya ngoko nangoko ukuba kuvuza amanzi okanye umntwana eshukuma kancinci.",
  "danger.pregnancy.simple": "Ukopha, ukuxhuzula, intloko ebuhlungu kakhulu, ifiva, okanye umntwana eshukuma kancinci: yiya esibhedlele ngoku.",
  "danger.postpartum": "Yiya esibhedlele ngoko nangoko ukuba uyopha kakhulu. Yiya ngoko nangoko ukuba uyaxhuzula, intloko ibuhlungu kakhulu okanye unefiva. Yiya ngoko nangoko ukuba kukho ivumba elibi kwilungu langasese. Yiya ngoko nangoko ukuba uphefumla nzima okanye umlenze ubuhlungu kwaye udumbile.",
  "danger.postpartum.simple": "Ukopha kakhulu, ukuxhuzula, ifiva, okanye ukuphefumla nzima: yiya esibhedlele ngoku.",
  "danger.newborn": "Yiya esibhedlele ngoku ukuba {name} akancanci okanye uyaxhuzula. Yiya ngoku ukuba {name} uphefumla ngokukhawuleza okanye isifuba singena ngaphakathi. Yiya ngoku ukuba {name} uyatshisa, uyabanda okanye ulele kakhulu. Yiya ngoku ukuba iintende zezandla okanye iinyawo zimthubi.",
  "danger.newborn.simple": "Akancanci, uyaxhuzula, uphefumla ngokukhawuleza, uyatshisa okanye uyabanda, ulele kakhulu: yiya esibhedlele ngoku.",
  "danger.child": "Yiya ekliniki ngoku ukuba {name} akakwazi ukusela okanye ugabha yonke into. Yiya ngoku ukuba uyaxhuzula, ulele kakhulu okanye uphefumla ngokukhawuleza.",
  "danger.child.simple": "Akakwazi ukusela, uyaxhuzula, ulele kakhulu, okanye uphefumla ngokukhawuleza: yiya ekliniki ngoku.",
  "alert.go_now": "Yiya esibhedlele ngoku. Musa ukulinda.",
  "alert.go_today": "Yiya ekliniki namhlanje.",
  "alert.fallback": "Sixhalabile ngempilo yakho. Yiya ekliniki namhlanje.",
  "alert.convulsions": "Ukuxhuzula kuyingozi xa ukhulelwe nasemva kokubeleka. Yiya esibhedlele ngoku. Musa ukulinda.",
  "alert.postpartum_haemorrhage": "Ukopha kakhulu emva kokubeleka kuyingozi kakhulu. Hamba nomntu onokunika igazi. Yiya esibhedlele ngoku. Musa ukulinda.",
  "alert.newborn_danger": "{name} unophawu lwengozi. Endleleni, gcina {name} efudumele esifubeni sakho. Yiya esibhedlele ngoku. Musa ukulinda.",
  "alert.child_fever": "{name} unefiva. {name} kufuneka ahlolelwe imalariya namhlanje. Yiya ekliniki namhlanje.",
  "rest.itn": "Lala phantsi komnatha weengcongconi onyangiweyo rhoqo ebusuku, unyaka wonke.",
  "rest.sleep_side.simple": "Lala ngecala, hayi ngomqolo.",
  "baby.warm.simple": "Gcina {name} efudumele. Phatha umntwana ulusu nolusu.",
  "bf.prepare.simple": "Ncancisa kwiyure yokuqala. Ubisi lwebele kuphela iinyanga ezi-6.",
  "bf.more_milk.simple": "Ncancisa rhoqo, emini nasebusuku. Ukuncanca okuninzi kwenza ubisi oluninzi.",
  "med.iron_folate.simple": "Thatha ipilisi enye yegazi yonke imihla.",
  "med.art.simple": "Thatha iyeza lakho le-HIV yonke imihla.",
  "visit.anc_next.date.simple": "Utyelelo olulandelayo ekliniki: {date}.",
  "nutr.water": "Sela malunga neekomityi ezi-8 zamanzi acocekileyo yonke imihla.",
  "mh.check_in": "Uziva njani? Ungasixelela ukuba ulusizi okanye uxhalabile. Uncedo lukhona.",
};

/** VISIT_TEXT lines; shown once the visits module registers its templates */
const VISITS: Record<string, string> = {
  "vt.next_visit.simple": "Utyelelo olulandelayo: {date}.",
  "vt.refer_now": "Nceda uye e-{place} ngoku. Musa ukulinda.",
};

export const xh = draftPack({
  code: 'xh',
  name: "isiXhosa",
  nativeName: "isiXhosa",
  note: `${DRAFT_NOTE} Long clinical alerts, food lines with {food}, traditional practices and visit findings are left in English.`,
  ui: {
    "nav.today": "Namhlanje",
    "nav.mothers": "Oomama",
    "nav.visits": "Utyelelo",
    "nav.messages": "Imiyalezo",
    "nav.settings": "Iisetingi",
    "nav.back": "Buyela umva",
    "nav.search": "Khangela",
    "cat.danger_signs": "Iimpawu zengozi",
    "cat.medication": "Amayeza",
    "cat.nutrition": "Ukutya",
    "cat.breastfeeding": "Ukuncancisa",
    "cat.immunisation": "Izitofu",
    "stage.pregnancy": "Ukukhulelwa",
    "stage.postpartum": "Emva kokubeleka",
    "stage.infant": "Usana",
    "alert.level.emergency": "Ingxakeko",
    "alert.level.urgent": "Kungxamisekile",
    "alert.level.warning": "Isilumkiso",
    "alert.action.call_mother": "Mtsalele umnxeba",
    "alert.action.show_mother": "Bonisa umama",
    "alert.action.why": "Ngoba?",
    "plan.title": "Isicwangciso sokhathalelo",
    "plan.done": "Kwenziwe",
    "dual.show_to_mother": "Bonisa umama",
    "conf.fallback": "IsiNgesi",
    "common.yes": "Ewe",
    "common.no": "Hayi",
    "common.today": "Namhlanje",
    "common.tomorrow": "Ngomso",
    "common.mother": "Umama",
    "common.baby": "Usana",
    "common.save": "Gcina",
    "common.cancel": "Rhoxisa",
    "common.close": "Vala",
    "common.english": "IsiNgesi",
    "msg.send": "Thumela",
  },
  core: CORE,
  visits: VISITS,
  glossary: {
    ...monthGlossary('{d} {m}', ["Januwari", "Februwari", "Matshi", "Epreli", "Meyi", "Juni", "Julayi", "Agasti", "Septemba", "Oktobha", "Novemba", "Disemba"]),
    'the baby': "umntwana",
    'your baby': "umntwana wakho",
  },
  source: 'Machine draft by the Gaskin build team, Nov 2026; awaiting review by isiXhosa-speaking midwives',
});
