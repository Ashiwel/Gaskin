import { DRAFT_NOTE, monthGlossary } from './shared';
import { draftPack } from './late';

/**
 * Sesotho for Lesotho and South Africa (Free State, Gauteng). Machine draft in simple, warm everyday words for mothers with little
 * schooling. South African Sesotho orthography (madi, jwale); Lesotho spelling differs (mali, joale) and needs its own review. The English word "fits" is kept where no sure Sesotho term was found.
 * Numbers, medicine names (HIV, malaria) and every {placeholder} are kept as in the English.
 * Only the short (.simple) danger lines are drafted; long danger lines, clinical alerts, food, traditional practices and visit findings are left in English.
 *
 * REVIEW FIRST (least sure; native-speaking midwives please check these before anything else):
 * - danger.* keep the English word "fits"; a Sesotho term is wanted
 * - danger.* "feberu" for fever
 * - danger.pregnancy.simple "ngwana a sisinyeha hanyane" for baby moving less
 * - rest.itn "letlowa la menang"
 * - Orthography: South African vs Lesotho spelling
 */
const CORE: Record<string, string> = {
  "danger.pregnancy.simple": "Ho tswa madi, fits, hlooho e bohloko haholo, feberu, kapa ngwana a sisinyeha hanyane: eya sepetlele hona jwale.",
  "danger.postpartum.simple": "Ho tswa madi a mangata, fits, feberu, kapa ho hema ka thata: eya sepetlele hona jwale.",
  "danger.newborn.simple": "Ha a anye, fits, o hema kapele, o a fisa kapa o a bata, o robala haholo: eya sepetlele hona jwale.",
  "danger.child.simple": "Ha a kgone ho nwa, fits, o robala haholo, kapa o hema kapele: eya tleliniking hona jwale.",
  "alert.go_now": "Eya sepetlele hona jwale. O se ke wa ema.",
  "alert.go_today": "Eya tleliniking kajeno.",
  "alert.fallback": "Re tshwenyehile ka bophelo ba hao. Eya tleliniking kajeno.",
  "alert.newborn_danger": "{name} o na le sesupo sa kotsi. Tseleng, boloka {name} a futhumetse sefubeng sa hao. Eya sepetlele hona jwale. O se ke wa ema.",
  "alert.child_fever": "{name} o na le feberu. {name} o hloka ho hlahlojwa malaria kajeno. Eya tleliniking kajeno.",
  "rest.itn": "Robala ka tlasa letlowa la menang le nang le moriana bosiu bo bong le bo bong, selemo kaofela.",
  "rest.sleep_side.simple": "Robala ka lehlakore, eseng ka mokokotlo.",
  "bf.prepare.simple": "Anyesa ka hora ya pele. Lebese la letsoele feela dikgwedi tse 6.",
  "bf.more_milk.simple": "Anyesa kgafetsa, motshehare le bosiu. Ho anya haholo ho tlisa lebese le lengata.",
  "med.iron_folate.simple": "Nwa pilisi e le nngwe ya madi letsatsi le leng le le leng.",
  "med.art.simple": "Nwa moriana wa hao wa HIV letsatsi le leng le le leng.",
  "visit.anc_next.date.simple": "Ketelo e latelang tleliniking: {date}.",
  "nutr.water": "Nwa dikopi tse ka bang 8 tsa metsi a hlwekileng letsatsi le leng le le leng.",
  "mh.check_in": "O ikutlwa jwang? O ka re bolella haeba o hloname kapa o tshwenyehile. Thuso e teng.",
};

/** VISIT_TEXT lines; shown once the visits module registers its templates */
const VISITS: Record<string, string> = {
  "vt.next_visit.simple": "Ketelo e latelang: {date}.",
};

export const st = draftPack({
  code: 'st',
  name: "Sesotho",
  nativeName: "Sesotho",
  note: `${DRAFT_NOTE} Only the short (.simple) danger lines are drafted; long danger lines, clinical alerts, food, traditional practices and visit findings are left in English.`,
  ui: {
    "nav.today": "Kajeno",
    "nav.mothers": "Bomme",
    "nav.messages": "Melaetsa",
    "nav.back": "Kgutlela morao",
    "nav.search": "Batla",
    "cat.danger_signs": "Matshwao a kotsi",
    "cat.medication": "Meriana",
    "cat.nutrition": "Dijo",
    "cat.breastfeeding": "Ho anyesa",
    "stage.pregnancy": "Boimana",
    "stage.postpartum": "Ka mora pelehi",
    "stage.infant": "Lesea",
    "alert.action.show_mother": "Bontsha mme",
    "alert.action.why": "Hobaneng?",
    "dual.show_to_mother": "Bontsha mme",
    "conf.fallback": "Senyesemane",
    "common.yes": "E",
    "common.no": "Tjhe",
    "common.today": "Kajeno",
    "common.tomorrow": "Hosane",
    "common.mother": "Mme",
    "common.baby": "Lesea",
    "common.close": "Kwala",
    "common.english": "Senyesemane",
    "msg.send": "Romela",
  },
  core: CORE,
  visits: VISITS,
  glossary: {
    ...monthGlossary('{d} {m}', ["Phesekgong", "Hlakola", "Hlakubele", "Mmesa", "Motsheanong", "Phupjane", "Phupu", "Phato", "Lewedu", "Mphalane", "Pudungwana", "Tshitwe"]),
    'the baby': "ngwana",
    'your baby': "ngwana wa hao",
  },
  source: 'Machine draft by the Gaskin build team, Nov 2026; awaiting review by Sesotho-speaking midwives',
});
