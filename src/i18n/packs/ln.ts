import { DRAFT_NOTE, monthGlossary } from './shared';
import { draftPack } from './late';

/**
 * Lingala for DR Congo (Kinshasa) and Republic of Congo. Machine draft in simple, warm everyday words for mothers with little
 * schooling. Everyday Kinshasa Lingala, written without tone marks and with plain e/o, as in most health posters; French loans that mothers use are kept ("dispanseri", "moustiquaire", "convulsion").
 * Numbers, medicine names (HIV, malaria) and every {placeholder} are kept as in the English.
 * Only the short (.simple) danger lines are drafted; the long danger lines, clinical alerts, food, traditional practices and visit findings are left in English.
 *
 * REVIEW FIRST (least sure; native-speaking midwives please check these before anything else):
 * - danger.* "convulsion" (French loan) for fits; "ndeke" is avoided because of its cultural meaning
 * - danger.* "nzoto moto" for fever
 * - danger.pregnancy.simple "mwana azali koningana mingi te" for baby moving less
 * - rest.itn "moustiquaire ya nkisi"
 * - ui common.tomorrow "Lobi" (also means yesterday)
 */
const CORE: Record<string, string> = {
  "danger.pregnancy.simple": "Makila ezali kobima, convulsion, moto ezali kobeta makasi, nzoto moto, to mwana azali koningana mingi te: kende na lopitalo sikoyo.",
  "danger.postpartum.simple": "Makila mingi, convulsion, nzoto moto, to kopema malamu te: kende na lopitalo sikoyo.",
  "danger.newborn.simple": "Azali komela mabele te, convulsion, azali kopema noki noki, nzoto moto to malili, azali kolala mingi: kende na lopitalo sikoyo.",
  "danger.child.simple": "Akoki komela te, convulsion, azali kolala mingi, to azali kopema noki noki: kende na dispanseri sikoyo.",
  "alert.go_now": "Kende na lopitalo sikoyo. Kozela te.",
  "alert.go_today": "Kende na dispanseri lelo.",
  "alert.fallback": "Tozali komitungisa mpo na nzoto na yo. Kende na dispanseri lelo.",
  "alert.newborn_danger": "{name} azali na elembo ya likama. Na nzela, batela {name} na molunge na ntolo na yo. Kende na lopitalo sikoyo. Kozela te.",
  "alert.child_fever": "{name} azali na nzoto moto. {name} asengeli komekama malaria lelo. Kende na dispanseri lelo.",
  "rest.itn": "Lala na kati ya moustiquaire ya nkisi butu nyonso, mbula mobimba.",
  "bf.prepare.simple": "Pesa mwana mabele na ngonga ya liboso. Mabele kaka na sanza 6.",
  "bf.more_milk.simple": "Pesa mabele mbala na mbala, moi na butu. Soki mwana amela mingi, mabele ekoya mingi.",
  "med.art.simple": "Mela nkisi na yo ya HIV mokolo na mokolo.",
  "visit.anc_next.date.simple": "Okozonga na dispanseri: {date}.",
  "nutr.water": "Mela pene na kopo 8 ya mai ya peto mokolo na mokolo.",
  "mh.check_in": "Ozali ndenge nini? Okoki koyebisa biso soki ozali na mawa to na komitungisa. Lisalisi ezali.",
};

/** VISIT_TEXT lines; shown once the visits module registers its templates */
const VISITS: Record<string, string> = {
  "vt.next_visit.simple": "Okozonga: {date}.",
};

export const ln = draftPack({
  code: 'ln',
  name: "Lingala",
  nativeName: "Lingála",
  note: `${DRAFT_NOTE} Only the short (.simple) danger lines are drafted; the long danger lines, clinical alerts, food, traditional practices and visit findings are left in English.`,
  ui: {
    "nav.today": "Lelo",
    "nav.mothers": "Bamama",
    "nav.messages": "Bansango",
    "nav.back": "Zonga",
    "nav.search": "Luka",
    "cat.danger_signs": "Bilembo ya likama",
    "cat.medication": "Nkisi",
    "cat.nutrition": "Bilei",
    "cat.breastfeeding": "Kopesa mabele",
    "stage.pregnancy": "Zemi",
    "stage.infant": "Mwana",
    "alert.level.emergency": "Likama",
    "alert.action.show_mother": "Lakisa mama",
    "alert.action.why": "Mpo na nini?",
    "dual.show_to_mother": "Lakisa mama",
    "conf.fallback": "Lingelesi",
    "common.yes": "Iyo",
    "common.no": "Te",
    "common.today": "Lelo",
    "common.tomorrow": "Lobi",
    "common.mother": "Mama",
    "common.baby": "Mwana",
    "common.close": "Kanga",
    "common.english": "Lingelesi",
    "msg.send": "Tinda",
  },
  core: CORE,
  visits: VISITS,
  glossary: {
    ...monthGlossary('{d} {m}', ["sanza ya yambo", "sanza ya mibale", "sanza ya misato", "sanza ya minei", "sanza ya mitano", "sanza ya motoba", "sanza ya nsambo", "sanza ya mwambe", "sanza ya libwa", "sanza ya zomi", "sanza ya zomi na moko", "sanza ya zomi na mibale"]),
    'the baby': "mwana",
    'your baby': "mwana na yo",
  },
  source: 'Machine draft by the Gaskin build team, Nov 2026; awaiting review by Lingala-speaking midwives',
});
