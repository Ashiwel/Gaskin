import { DRAFT_NOTE, monthGlossary } from './shared';
import { draftPack } from './late';

/**
 * isiZulu for South Africa (KwaZulu-Natal, Gauteng) and Eswatini neighbours. Machine draft in simple, warm everyday words for mothers with little
 * schooling. Standard isiZulu orthography; the mother is addressed in the singular. Names are written without the u- / ka- prefixes so the line reads correctly when the baby has no name yet (glossary "umntwana", class 1, so verb agreement with {name} holds).
 * Numbers, medicine names (HIV, malaria) and every {placeholder} are kept as in the English.
 * Long clinical alerts (pre-eclampsia, sepsis, ruptured membranes, DVT, anaemia), traditional-practice lines, food lines with {food}, and most visit findings are left in English.
 *
 * REVIEW FIRST (least sure; native-speaking midwives please check these before anything else):
 * - danger.* "ukuquleka" for fits (some areas say "isithuthwane", which also means epilepsy)
 * - danger.newborn "isifuba singena ngaphakathi" for chest in-drawing
 * - danger.postpartum "endaweni yangasese" for private part
 * - baby.cord_dry and imm.child_next.date.simple: sentences reshaped around {name} to avoid noun-class prefixes
 * - alert.self_harm (sensitive wording)
 * - ui alert.level.emergency "Isimo esiphuthumayo"
 */
const CORE: Record<string, string> = {
  "danger.pregnancy": "Hamba esibhedlela ngokushesha uma wopha noma uquleka. Hamba ngokushesha uma ikhanda likuhlaba kakhulu noma amehlo engaboni kahle. Hamba ngokushesha uma unemfiva noma isisu sikuhlaba kakhulu. Hamba ngokushesha uma kuphuma amanzi noma ingane inyakaza kancane.",
  "danger.pregnancy.simple": "Ukopha, ukuquleka, ikhanda elibuhlungu kakhulu, imfiva, noma ingane inyakaza kancane: hamba esibhedlela manje.",
  "danger.postpartum": "Hamba esibhedlela ngokushesha uma wopha kakhulu. Hamba ngokushesha uma uquleka, ikhanda likuhlaba kakhulu noma unemfiva. Hamba ngokushesha uma kunephunga elibi endaweni yangasese. Hamba ngokushesha uma uphefumula kanzima noma umlenze ubuhlungu futhi uvuvukele.",
  "danger.postpartum.simple": "Ukopha kakhulu, ukuquleka, imfiva, noma ukuphefumula kanzima: hamba esibhedlela manje.",
  "danger.newborn": "Hamba esibhedlela manje uma {name} engafuni ukuncela noma equleka. Hamba manje uma {name} ephefumula ngokushesha noma isifuba singena ngaphakathi. Hamba manje uma {name} eshisa, ebanda noma elala kakhulu. Hamba manje uma izintende zezandla noma izinyawo ziphuzi.",
  "danger.newborn.simple": "Akanceli, uyaquleka, uphefumula ngokushesha, uyashisa noma uyabanda, ulala kakhulu: hamba esibhedlela manje.",
  "danger.child": "Hamba emtholampilo manje uma {name} engakwazi ukuphuza noma ehlanza konke. Hamba manje uma equleka, elala kakhulu noma ephefumula ngokushesha.",
  "danger.child.simple": "Akakwazi ukuphuza, uyaquleka, ulala kakhulu, noma uphefumula ngokushesha: hamba emtholampilo manje.",
  "alert.go_now": "Hamba esibhedlela manje. Ungalindi.",
  "alert.go_today": "Hamba emtholampilo namuhla.",
  "alert.fallback": "Sikhathazekile ngempilo yakho. Hamba emtholampilo namuhla.",
  "alert.eclampsia": "Uqulekile futhi umfutho wegazi uphezulu kakhulu. Lokhu kuyingozi kuwe nasenganeni. Hamba esibhedlela manje. Ungalindi.",
  "alert.convulsions": "Ukuquleka kuyingozi uma ukhulelwe nangemva kokubeletha. Hamba esibhedlela manje. Ungalindi.",
  "alert.vaginal_bleeding": "Ukopha uma ukhulelwe kungaba yingozi kuwe nasenganeni. Endleleni, lala ngohlangothi lwesobunxele. Hamba esibhedlela manje.",
  "alert.postpartum_haemorrhage": "Ukopha kakhulu ngemva kokubeletha kuyingozi kakhulu. Hamba nomuntu ongakupha igazi. Hamba esibhedlela manje. Ungalindi.",
  "alert.severe_abdominal_pain": "Isisu esibuhlungu kakhulu uma ukhulelwe singaba yingozi. Hamba esibhedlela manje. Ungalindi.",
  "alert.reduced_fetal_movement": "Uma ingane inyakaza kancane ingaba senkingeni. Sidinga ukulalela inhliziyo yengane namuhla. Hamba emtholampilo namuhla.",
  "alert.maternal_fever": "Imfiva ingasho umalaleveva noma okunye ukutheleleka. Udinga ukuhlolwa namuhla. Hamba emtholampilo namuhla.",
  "alert.malaria_pregnancy": "Unomalaleveva. Ungakulimaza wena nengane. Udinga umuthi namuhla. Hamba emtholampilo namuhla.",
  "alert.newborn_danger": "{name} unophawu lwengozi. Endleleni, gcina {name} efudumele esifubeni sakho. Hamba esibhedlela manje. Ungalindi.",
  "alert.child_danger": "{name} unophawu lwengozi. Uma {name} ekwazi ukuphuza, qhubeka umncelisa endleleni. Hamba esibhedlela manje.",
  "alert.child_fever": "{name} unemfiva. {name} udinga ukuhlolelwa umalaleveva namuhla. Hamba emtholampilo namuhla.",
  "alert.jaundice": "{name} uphuzi esikhunjeni noma emehlweni. Sidinga ukuhlola {name} namuhla. Hamba emtholampilo namuhla.",
  "alert.cord_infection": "{name} unenkaba ebomvu. Ingase ibe nokutheleleka. Ungafaki lutho kuyo. Hamba emtholampilo namuhla.",
  "alert.self_harm": "Awuwedwa, futhi akulona iphutha lakho. Sifuna ukukusiza namuhla. Sicela uhlale nomuntu omethembayo.",
  "rest.itn": "Lala ngaphansi kwenetha yomiyane elashwe ngomuthi njalo ebusuku, unyaka wonke.",
  "rest.sleep_side.simple": "Lala ngohlangothi, hhayi ngomhlane.",
  "baby.safe_sleep": "Lalisa {name} ngomhlane. Sebenzisa inetha yomiyane. Ungambozi ubuso.",
  "baby.cord_dry": "{name}: gcina inkaba ihlanzekile futhi yomile. Ungafaki lutho kuyo.",
  "baby.warm.simple": "Gcina {name} efudumele. Bamba ingane isikhumba nesikhumba.",
  "baby.weigh.monthly": "Letha {name} azokalwa isisindo njalo ngenyanga.",
  "bf.prepare.simple": "Ncelisa ngehora lokuqala. Ubisi lwebele kuphela izinyanga eziyi-6.",
  "bf.only_breast_milk.simple": "Nika {name} ubisi lwebele kuphela. Akukho manzi, akukho phalishi.",
  "bf.more_milk.simple": "Ncelisa kaningi, emini nasebusuku. Ukuncela kakhulu kwenza ubisi oluningi.",
  "med.iron_folate.simple": "Phuza iphilisi elilodwa legazi nsuku zonke.",
  "med.art.simple": "Phuza umuthi wakho we-HIV nsuku zonke.",
  "visit.anc_next.date.simple": "Ukuvakasha okulandelayo emtholampilo: {date}.",
  "imm.child_next.date.simple": "{name} uzogonywa ngo-{date}. Mahhala.",
  "imm.child_next.now.simple": "{name} kufanele agonywe manje. Mahhala.",
  "nutr.water": "Phuza cishe izinkomishi eziyi-8 zamanzi ahlanzekile nsuku zonke.",
  "mh.check_in": "Uzizwa kanjani? Ungasitshela uma udabukile noma ukhathazekile. Usizo lukhona.",
  "fp.after_birth.simple": "Khetha indlela yokuhlela umndeni ngaphambi kwamasonto ayi-6.",
};

/** VISIT_TEXT lines; shown once the visits module registers its templates */
const VISITS: Record<string, string> = {
  "vt.next_visit.simple": "Ukuvakasha okulandelayo: {date}.",
  "vt.refer_today": "Sicela uye ku-{place} namuhla. Sizobazisa ukuthi uyeza.",
  "vt.refer_now": "Sicela uye ku-{place} manje. Ungalindi.",
  "vt.fetal_movement": "Zwa ingane yakho inyakaza nsuku zonke. Uma inyakaza kancane, woza emtholampilo ngalolo suku.",
};

export const zu = draftPack({
  code: 'zu',
  name: "isiZulu",
  nativeName: "isiZulu",
  note: `${DRAFT_NOTE} Long clinical alerts (pre-eclampsia, sepsis, ruptured membranes, DVT, anaemia), traditional-practice lines, food lines with {food}, and most visit findings are left in English.`,
  ui: {
    "nav.today": "Namuhla",
    "nav.mothers": "Omama",
    "nav.visits": "Ukuvakasha",
    "nav.messages": "Imilayezo",
    "nav.settings": "Izilungiselelo",
    "nav.back": "Emuva",
    "nav.search": "Sesha",
    "cat.danger_signs": "Izimpawu zengozi",
    "cat.visits": "Ukuvakasha",
    "cat.medication": "Imithi",
    "cat.nutrition": "Ukudla",
    "cat.breastfeeding": "Ukuncelisa",
    "cat.baby_care": "Ukunakekela ingane",
    "cat.immunisation": "Imigomo",
    "stage.pregnancy": "Ukukhulelwa",
    "stage.postpartum": "Ngemva kokubeletha",
    "stage.infant": "Ingane",
    "alert.level.emergency": "Isimo esiphuthumayo",
    "alert.level.urgent": "Kuyaphuthuma",
    "alert.level.warning": "Isexwayiso",
    "alert.action.refer_now": "Dlulisela manje",
    "alert.action.call_mother": "Mfonele",
    "alert.action.show_mother": "Bonisa umama",
    "alert.action.why": "Kungani?",
    "plan.title": "Uhlelo lokunakekela",
    "plan.for_worker": "Okwakho",
    "plan.for_mother": "Okukamama",
    "plan.done": "Kwenziwe",
    "plan.next_contact": "Ukuxhumana okulandelayo",
    "plan.send_message": "Thumela umlayezo",
    "dual.show_to_mother": "Bonisa umama",
    "dual.close": "Vala",
    "conf.fallback": "IsiNgisi",
    "common.yes": "Yebo",
    "common.no": "Cha",
    "common.today": "Namuhla",
    "common.tomorrow": "Kusasa",
    "common.mother": "Umama",
    "common.baby": "Ingane",
    "common.save": "Londoloza",
    "common.cancel": "Khansela",
    "common.close": "Vala",
    "common.english": "IsiNgisi",
    "msg.send": "Thumela",
  },
  core: CORE,
  visits: VISITS,
  glossary: {
    ...monthGlossary('{d} {m}', ["Januwari", "Febhuwari", "Mashi", "Ephreli", "Meyi", "Juni", "Julayi", "Agasti", "Septemba", "Okthoba", "Novemba", "Disemba"]),
    'the baby': "umntwana",
    'your baby': "umntwana wakho",
  },
  source: 'Machine draft by the Gaskin build team, Nov 2026; awaiting review by isiZulu-speaking midwives',
});
