import type { LanguagePack } from '../types';
import { DRAFT_NOTE, monthGlossary } from './shared';

const EN_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * Igbo (standard Igbo, dotted vowels ị ọ ụ and ṅ; tone marks left out, as in everyday print).
 * Full machine draft of every mother line, not yet reviewed. The mother is addressed politely
 * with "biko" (please) and the singular gị, which is the everyday respectful written form.
 * Clinic and hospital are both "ụlọ ọgwụ", so an emergency line never sends her somewhere smaller.
 * Medicine names, test names and some conditions stay in English (folic acid, calcium, aspirin,
 * HIV, syphilis, hepatitis B, tetanus, sickle cell, vitamin A, scan, drip, protein, SHA).
 * Dates use English month names, as most mothers say them.
 *
 * REVIEW FIRST (least sure; native-speaking midwives please check these before anything else):
 * - "akwụkwụ" for fits/convulsions (English "fits" kept in brackets the first time in each line):
 *   danger.*, alert.eclampsia, alert.convulsions.
 * - "ọbara mgbali" for blood pressure: alert.eclampsia, alert.severe_pre_eclampsia(.urgent),
 *   alert.hypertension, alert.check_bp_now, visit.bp_after_birth.
 * - danger.newborn: "obi ya na-adaba n’ime" for chest indrawing.
 * - "ebe nzuzo gị" (your private part) in danger.postpartum and alert.puerperal_sepsis(.urgent).
 * - alert.ruptured_membranes(.urgent): "akpa mmiri gbara nwa gburugburu agbawaala".
 * - alert.dvt(.emergency): "ọbara kpụkọrọ akpụkọ" for a blood clot (English kept in brackets).
 * - alert.severe_malnutrition: "dị gịrịgịrị nke ukwuu" for too thin.
 * - "otubo" for the baby's cord: baby.cord_*, alert.cord_infection, trad.cord_substances.
 * - mh.*, alert.depression, alert.low_mood_screen: "obi ida mbà" for feeling low.
 * - educ.symptom.heartburn and educ.symptom.leg_cramps (English word kept in brackets).
 * - trad.uvulectomy: "ịkpụ ihe n’akpịrị nwa" for uvula cutting.
 * - trad.wankan_jego: "kanwa" kept as the Hausa word; trad.nzu_clay: "nzu ma ọ bụ ụrọ".
 * - Glossary food measures ("aka juru" for a handful).
 */
export const ig: LanguagePack = {
  code: 'ig',
  name: 'Igbo',
  nativeName: 'Asụsụ Igbo',
  direction: 'ltr',
  version: '0.2.0',
  licence: 'CC-BY-4.0',
  status: 'machine_draft',
  reviewers: [],
  regions: ['NG'],
  note: DRAFT_NOTE,
  ui: {
    'nav.today': 'Taa',
    'nav.mothers': 'Ndị nne',
    'cat.medication': 'Ọgwụ',
    'cat.nutrition': 'Nri',
    'cat.immunisation': 'Ọgwụ mgbochi',
    'alert.level.emergency': 'Ihe mberede',
    'dual.show_to_mother': 'Gosi nne',
    'dual.close': 'Mechie',
    'dual.english_line': 'Bekee',
    'conf.fallback': 'Bekee',
    'onb.welcome': 'Nnọọ na Gaskin',
    'onb.your_language': 'Asụsụ gị',
    'settings.language': 'Asụsụ',
    'common.yes': 'Ee',
    'common.no': 'Mba',
    'common.close': 'Mechie',
    'common.today': 'Taa',
    'common.tomorrow': 'Echi',
    'common.mother': 'Nne',
    'common.baby': 'Nwa',
    'common.english': 'Bekee',
    'common.language': 'Asụsụ',
  },
  mother: {
    // ---------- Alerts and referral items (drafted first) ----------
    'alert.go_now': 'Gaa n’ụlọ ọgwụ ugbu a. Echela.',
    'alert.go_today': 'Biko gaa n’ụlọ ọgwụ taa.',
    'alert.eclampsia': 'I nwere akwụkwụ (fits), ọbara mgbali gị dịkwa elu nke ukwuu. Nke a dị ize ndụ nye gị na nwa. Gaa n’ụlọ ọgwụ ugbu a. Echela.',
    'alert.severe_pre_eclampsia': 'Ọbara mgbali gị dị elu karịa, ọ rịgokwara ngwa ngwa. Nke a nwere ike imerụ imeju gị, akụrụ gị na nwa. Gaa n’ụlọ ọgwụ ugbu a. Echela.',
    'alert.severe_pre_eclampsia.urgent': 'Ọbara mgbali gị dị elu karịa, protein dịkwa na mamịrị gị. Nke a nwere ike imerụ gị na nwa. Gaa n’ụlọ ọgwụ taa.',
    'alert.hypertension': 'Ọbara mgbali gị dị elu karịa ka o kwesịrị. Anyị kwesịrị ịlele ya ọzọ taa. Biko gaa n’ụlọ ọgwụ taa.',
    'alert.check_bp_now': 'Isi ọwụwa siri ike, anya na-adịghị ahụ ụzọ nke ọma, ma ọ bụ ihu zara aza nwere ike ịpụta ọbara mgbali elu. Anyị kwesịrị ịlele ya taa. Biko gaa n’ụlọ ọgwụ taa.',
    'alert.convulsions': 'Akwụkwụ (fits) dị ize ndụ n’oge ime na mgbe a mụsịrị nwa. Gaa n’ụlọ ọgwụ ugbu a. Echela.',
    'alert.vaginal_bleeding': 'Ọbara ọgbụgba n’oge ime nwere ike ịdị ize ndụ nye gị na nwa. Dinara n’akụkụ aka ekpe gị n’ụzọ. Gaa n’ụlọ ọgwụ ugbu a.',
    'alert.postpartum_haemorrhage': 'Ọbara ọgbụgba dị ukwuu mgbe a mụsịrị nwa dị ize ndụ nke ukwuu. Kpọrọ onye nwere ike inye gị ọbara. Gaa n’ụlọ ọgwụ ugbu a. Echela.',
    'alert.puerperal_sepsis': 'Ahụ ọkụ na isi ọjọọ na-esi n’ebe nzuzo gị nwere ike ịpụta ọrịa nje n’ime ahụ. Ị chọrọ ọgwụ. Gaa n’ụlọ ọgwụ ugbu a.',
    'alert.puerperal_sepsis.urgent': 'Isi ọjọọ na-esi n’ebe nzuzo gị nwere ike ịpụta ọrịa nje n’ime ahụ. Ị chọrọ ọgwụ. Biko gaa n’ụlọ ọgwụ taa.',
    'alert.maternal_fever': 'Ahụ ọkụ nwere ike ịbụ ịba (malaria) ma ọ bụ ọrịa ọzọ. Ị chọrọ ule taa. Biko gaa n’ụlọ ọgwụ taa.',
    'alert.mastitis': 'Ara na-ekpo ọkụ, na-afụ ụfụ, ya na ahụ ọkụ, chọrọ ọgwụ. Na-enye nwa ara n’ara abụọ. Biko gaa n’ụlọ ọgwụ taa.',
    'alert.reduced_fetal_movement': 'Ọ bụrụ na nwa dị n’afọ anaghị emegharị ahụ dị ka ọ na-eme, nwa ahụ nwere ike ịnọ ná nsogbu. Anyị kwesịrị ịge ntị n’obi nwa taa. Biko gaa n’ụlọ ọgwụ taa.',
    'alert.severe_abdominal_pain': 'Afọ ọwụwa siri ike n’oge ime nwere ike ịdị ize ndụ. Gaa n’ụlọ ọgwụ ugbu a. Echela.',
    'alert.ruptured_membranes': 'Mmiri na-agbapụta pụtara na akpa mmiri gbara nwa gburugburu agbawaala. Oge ya eruteghị. Gaa n’ụlọ ọgwụ ugbu a.',
    'alert.ruptured_membranes.urgent': 'Mmiri na-agbapụta pụtara na akpa mmiri gbara nwa gburugburu agbawaala. Gaa ebe ị ga-amụ nwa ugbu a.',
    'alert.severe_vomiting': 'Ịgbọ ihe niile nwere ike ime ka mmiri kọọ n’ahụ gị. I nwere ike ịchọ drip. Biko gaa n’ụlọ ọgwụ taa.',
    'alert.post_term': 'Oge ọmụmụ nwa gị agafeela ugbu a. Biko kpọọ anyị taa, ma ọ bụ bịa n’ụlọ ọgwụ.',
    'alert.dvt': 'Ụkwụ na-afụ ụfụ ma zaa aza nwere ike ịpụta ọbara kpụkọrọ akpụkọ (blood clot). Ehichala ụkwụ ahụ. Gaa n’ụlọ ọgwụ taa.',
    'alert.dvt.emergency': 'Ụkwụ na-afụ ụfụ na iku ume siri ike nwere ike ịpụta ọbara kpụkọrọ akpụkọ (blood clot) na ngụgụ. Gaa n’ụlọ ọgwụ ugbu a. Echela.',
    'alert.breathlessness': 'Iku ume siri ike nwere ike ịpụta nsogbu n’obi gị ma ọ bụ na ngụgụ gị. Gaa n’ụlọ ọgwụ taa.',
    'alert.breathlessness.emergency': 'Iku ume siri ike nke ukwuu nwere ike ịpụta nsogbu n’obi gị ma ọ bụ na ngụgụ gị. Gaa n’ụlọ ọgwụ ugbu a. Echela.',
    'alert.self_harm': 'Ọ bụghị naanị gị nọ, ọ bụghịkwa ụta gị. Anyị chọrọ inyere gị aka taa. Biko nọrọ nso onye ị tụkwasịrị obi.',
    'alert.depression': 'Obi ida mbà nke ukwuu bụ ọrịa, ọ bụghị adịghị ike. A pụrụ ịgwọ ya. Anyị ga-enyere gị aka ịhụ onye ga-enyere gị aka n’izu a.',
    'alert.low_mood_screen': 'Ọtụtụ ndị nne na-enwe obi ida mbà. Ọ na-adị mma ma a nyere aka. Anyị ga-abịa leta gị n’izu a ka anyị kparịta ụka.',
    'alert.severe_anaemia': 'Ọbara gị adịghị ike ma ọlị. Nke a dị ize ndụ ma ọ bụrụ na ọbara agbaa gị. I nwere ike ịchọ ka e nye gị ọbara. Gaa n’ụlọ ọgwụ taa.',
    'alert.moderate_anaemia': 'Ọbara gị adịghị ike. Ị chọrọ ọgwụ ọbara siri ike karịa. Biko hụ nọọsụ n’izu a.',
    'alert.malaria_pregnancy': 'I nwere ịba (malaria). O nwere ike imerụ gị na nwa. Ị chọrọ ọgwụ taa. Biko gaa n’ụlọ ọgwụ taa.',
    'alert.scd_pathway': 'N’ihi sickle cell, ị chọrọ nlekọta pụrụ iche n’oge ime. Ihe mgbu, ahụ ọkụ, ma ọ bụ iku ume siri ike: gaa n’ụlọ ọgwụ n’ụbọchị ahụ.',
    'alert.newborn_danger': '{name} nwere ihe ịrịba ama nke ihe egwu. Debe {name} n’obi gị ka ahụ ya kpoo ọkụ n’ụzọ. Gaa n’ụlọ ọgwụ ugbu a. Echela.',
    'alert.child_danger': '{name} nwere ihe ịrịba ama nke ihe egwu. Na-enye ya ara n’ụzọ ma ọ bụrụ na {name} nwere ike ịṅụ. Gaa n’ụlọ ọgwụ ugbu a.',
    'alert.child_fever': '{name} nwere ahụ ọkụ. {name} chọrọ ule ịba (malaria) taa. Biko gaa n’ụlọ ọgwụ taa.',
    'alert.jaundice': 'Akpụkpọ ahụ ma ọ bụ anya {name} na-acha odo odo. Anyị kwesịrị ilele {name} taa. Biko gaa n’ụlọ ọgwụ taa.',
    'alert.cord_infection': 'Otubo {name} na-acha ọbara ọbara. O nwere ike ịbụ na nje abanyela ya. Etinyela ihe ọ bụla na ya. Biko gaa n’ụlọ ọgwụ taa.',
    'alert.child_diarrhoea': '{name} na-anyụ nsị mmiri mmiri. Na-enye ya ara. {name} nwere ike ịchọ ọgwụ na mmiri ọṅụṅụ pụrụ iche. Biko gaa n’ụlọ ọgwụ taa.',
    'alert.severe_malnutrition': '{name} dị gịrịgịrị nke ukwuu. Nri pụrụ iche si n’ụlọ ọgwụ nwere ike inyere {name} aka itolite. Biko gaa n’ụlọ ọgwụ n’izu a.',
    'alert.fallback': 'Anyị na-echegbu onwe anyị maka ahụ ike gị. Biko gaa n’ụlọ ọgwụ taa.',

    // ---------- Danger signs ----------
    'danger.pregnancy': 'Gaa n’ụlọ ọgwụ ozugbo ma ọbara na-agba gị ma ọ bụ i nwee akwụkwụ (fits). Gaa ozugbo maka isi ọwụwa siri ike ma ọ bụ anya na-adịghị ahụ ụzọ nke ọma. Gaa ozugbo maka ahụ ọkụ ma ọ bụ afọ ọwụwa siri ike. Gaa ozugbo ma mmiri na-agbapụta ma ọ bụ nwa dị n’afọ anaghị emegharị ahụ dị ka ọ na-eme.',
    'danger.pregnancy.simple': 'Ọbara ọgbụgba, akwụkwụ (fits), isi ọwụwa siri ike, ahụ ọkụ, ma ọ bụ nwa anaghị emegharị ahụ: gaa n’ụlọ ọgwụ ugbu a.',
    'danger.postpartum': 'Gaa n’ụlọ ọgwụ ozugbo ma ọbara na-agba gị nke ukwuu. Gaa ozugbo maka akwụkwụ (fits), isi ọwụwa siri ike ma ọ bụ ahụ ọkụ. Gaa ozugbo maka isi ọjọọ na-esi n’ebe nzuzo gị. Gaa ozugbo ma iku ume siri ike, ma ọ bụ otu ụkwụ na-afụ ụfụ ma zaa aza.',
    'danger.postpartum.simple': 'Ọbara ọgbụgba dị ukwuu, akwụkwụ (fits), ahụ ọkụ, ma ọ bụ iku ume siri ike: gaa n’ụlọ ọgwụ ugbu a.',
    'danger.newborn': 'Gaa n’ụlọ ọgwụ ugbu a ma {name} anaghị aṅụ ara ma ọ bụ nwee akwụkwụ (fits). Gaa ugbu a ma {name} na-eku ume ọsọ ọsọ ma ọ bụ obi ya na-adaba n’ime mgbe ọ na-eku ume. Gaa ugbu a ma ahụ {name} na-ekpo ọkụ nke ukwuu, jụrụ oyi, ma ọ bụ ụra na-atụ ya nke ukwuu. Gaa ugbu a ma ọbụ aka ma ọ bụ ọbụ ụkwụ ya na-acha odo odo.',
    'danger.newborn.simple': 'Anaghị aṅụ ara, akwụkwụ (fits), iku ume ọsọ ọsọ, ahụ ọkụ ma ọ bụ oyi, ụra nke ukwuu: gaa n’ụlọ ọgwụ ugbu a.',
    'danger.child': 'Gaa n’ụlọ ọgwụ ugbu a ma {name} enweghị ike ịṅụ ihe ma ọ bụ na-agbọpụta ihe niile. Gaa ugbu a maka akwụkwụ (fits), ụra miri emi, ma ọ bụ iku ume ọsọ ọsọ.',
    'danger.child.simple': 'Enweghị ike ịṅụ ihe, akwụkwụ (fits), ụra nke ukwuu, ma ọ bụ iku ume ọsọ ọsọ: gaa n’ụlọ ọgwụ ugbu a.',

    // ---------- Antenatal visits ----------
    'visit.anc_next.booking': 'Biko bịa n’ụlọ ọgwụ n’oge na-adịghị anya maka nlele ime gị nke mbụ.',
    'visit.anc_next.overdue': 'Ị gafere otu nlele n’ụlọ ọgwụ. Biko bịa n’izu a.',
    'visit.anc_next.date': 'Nleta gị ọzọ n’ụlọ ọgwụ bụ {date}. Biko bịa ọ bụrụgodị na ahụ dị gị mma.',
    'visit.anc_next.date.simple': 'Nleta ọzọ n’ụlọ ọgwụ: {date}.',
    'visit.anc_schedule': 'Ụbọchị nleta gị n’ụlọ ọgwụ bụ {dates}.',
    'visit.birth_notification': 'Mgbe ị mụrụ nwa gị, kpọọ anyị ma ọ bụ zitere anyị ozi n’ụbọchị ahụ. Anyị ga-abịa lelee gị na nwa ahụ.',
    'visit.birth_notification.simple': 'Mgbe nwa bịarutere, kpọọ anyị n’ụbọchị ahụ.',
    'visit.scd_specialist': 'Ị chọrọ nlekọta site n’aka ndị dọkịta sickle cell, tinyere ụlọ ọgwụ a. Na-aṅụ mmiri nke ukwuu, ma mee ka ahụ gị kpoo ọkụ. Gaa n’ụlọ ọgwụ n’ụbọchị ahụ maka ihe mgbu, ahụ ọkụ ma ọ bụ iku ume siri ike.',
    'visit.scd_specialist.simple': 'Hụkwa dọkịta sickle cell. Ihe mgbu ma ọ bụ ahụ ọkụ: gaa n’ụlọ ọgwụ taa.',

    // ---------- Medicines in pregnancy ----------
    'med.folic_acid_high_dose': 'Na-aṅụ ọgwụ folic acid gị kwa ụbọchị. Aṅụla ọgwụ ọbara ma ọ bụrụ na dọkịta gị ekwughị.',
    'med.folic_acid_high_dose.simple': 'Na-aṅụ folic acid kwa ụbọchị. Ọ dịghị ọgwụ ọbara ma dọkịta ekwughị.',
    'med.folic_acid_scd': 'Na-aṅụ ọgwụ folic acid gị kwa ụbọchị. Aṅụla ọgwụ ọbara ma ọ bụrụ na dọkịta gị ekwughị.',
    'med.folic_acid_preconception': 'Ọ bụrụ na ị chọrọ nwa ọzọ, malite ịṅụ ọgwụ folic acid kwa ụbọchị site ugbu a.',
    'med.iron_treatment': 'Ọbara gị adịghị ike. Na-aṅụ ọgwụ ọbara gị kwa ụbọchị, dị ka nọọsụ si kwuo. Na-eri agwa, akwa na akwụkwọ nri.',
    'med.iron_treatment.simple': 'Ọbara gị adịghị ike. Na-aṅụ ọgwụ ọbara kwa ụbọchị.',
    'med.iron_folate': 'Ṅụọ otu mkpụrụ ọgwụ ọbara kwa ụbọchị. Ọ bụrụ na ọ na-emebi gị afọ, ṅụọ ya n’abalị ya na nri.',
    'med.iron_folate.simple': 'Ṅụọ otu mkpụrụ ọgwụ ọbara kwa ụbọchị.',
    'med.iron_folate.after_birth': 'Gaa n’ihu na-aṅụ ọgwụ ọbara gị kwa ụbọchị ruo ọnwa 3 mgbe ị mụsịrị nwa.',
    'med.folic_acid.after_birth': 'Gaa n’ihu na-aṅụ folic acid gị kwa ụbọchị. Ọ dịghị ọgwụ ọbara ma dọkịta gị ekwughị.',
    'med.calcium': 'Na-aṅụ ọgwụ calcium gị kwa ụbọchị. Ṅụọ ha n’oge dị iche na mgbe ị na-aṅụ ọgwụ ọbara.',
    'med.calcium.simple': 'Na-aṅụ ọgwụ calcium kwa ụbọchị, ọ bụghị ya na ọgwụ ọbara.',
    'med.aspirin': 'Ṅụọ otu obere mkpụrụ ọgwụ aspirin kwa abalị, dị ka dọkịta gị si kwuo. Gaa n’ihu na-aṅụ ya ruo mgbe a mụrụ nwa.',
    'med.aspirin.simple': 'Na-aṅụ obere aspirin gị kwa abalị.',
    'med.iptp.later': 'Site n’ọnwa nke anọ nke ime gị, ị ga-aṅụ ọgwụ ịba (malaria) n’ụlọ ọgwụ.',
    'med.iptp': 'Ṅụọ ọgwụ ịba (malaria) gị n’ụlọ ọgwụ oge ọ bụla ị bịara. Ha na-echebe gị na nwa gị.',
    'med.iptp.simple': 'Ṅụọ ọgwụ ịba (malaria) n’ụlọ ọgwụ oge ọ bụla ị bịara.',
    'med.iptp.cotrimoxazole': 'Ọgwụ HIV gị na-echebekwa gị pụọ n’ịba (malaria). Na-ehi ụra n’ime ụgbụ anwụnta gị.',
    'med.deworming': 'Ṅụọ otu ọgwụ ikpuru n’ụlọ ọgwụ mgbe ọnwa nke atọ nke ime gị gafere.',
    'med.art': 'Na-aṅụ ọgwụ HIV gị kwa ụbọchị, n’otu oge ahụ. Ọ na-eme ka ahụ dị gị mma, ọ na-echebekwa nwa gị.',
    'med.art.simple': 'Ṅụọ ọgwụ HIV gị kwa ụbọchị.',
    'med.art.after_birth': 'Na-aṅụ ọgwụ HIV gị kwa ụbọchị. {name} chọrọ ọgwụ na ule mgbe ọ dị izu 6.',
    'med.diabetes_care': 'Na-eri obere nri n’otu oge kwa ụbọchị. Belata ihe ọṅụṅụ nwere shuga. Belata nri ọcha nwere starch (white starch). Na-eje ije kwa ụbọchị. Na-aga nleta ụlọ ọgwụ shuga gị.',
    'med.vitamin_a.first': '{name} ga-enweta ọgwụ vitamin A n’ụlọ ọgwụ mgbe ọ gbara ọnwa 6. Ọ bụ n’efu.',
    'med.vitamin_a.repeat': '{name} na-enweta ọgwụ vitamin A n’ụlọ ọgwụ ọnwa 6 ọ bụla. Ọ bụ n’efu.',

    // ---------- Tests ----------
    'test.hiv_syphilis_hbv': 'Anyị na-enyocha HIV, syphilis na hepatitis B iji chebe gị na nwa gị. Ọgwụgwọ bụ n’efu.',
    'test.blood_level': 'Anyị ga-elele ọbara gị n’ụlọ ọgwụ ịma ma o zuru.',
    'test.genotype': 'Anyị ga-enyocha ọbara gị maka sickle cell.',
    'test.ultrasound': 'Mee otu scan nke nwa gị tupu ọnwa nke isii nke ime gị.',
    'test.sugar': 'Ị chọrọ ule shuga n’ụlọ ọgwụ n’etiti ọnwa 6 na 7 nke ime.',
    'test.infant_hiv': '{name} chọrọ ọgwụ HIV site n’ọmụmụ ya na ule mgbe ọ dị izu 6.',

    // ---------- Vaccines ----------
    'imm.td': 'Gaa nara ọgwụ mgbochi tetanus n’ụlọ ọgwụ. Ọ na-echebe gị na nwa gị.',
    'imm.child_next.date': 'Ọgwụ mgbochi {name} ga-eru na {date}. Ọgwụ mgbochi bụ n’efu. Biko bịa na kaadị ọgwụ mgbochi.',
    'imm.child_next.date.simple': 'Ọgwụ mgbochi {name}: {date}. N’efu.',
    'imm.child_next.now': 'Oge ọgwụ mgbochi {name} eruola ugbu a. Ọgwụ mgbochi bụ n’efu. Biko bịa na kaadị ọgwụ mgbochi.',
    'imm.child_next.now.simple': 'Oge ọgwụ mgbochi {name} eruola. Ọ bụ n’efu.',

    // ---------- Common discomforts in pregnancy ----------
    'educ.symptom.nausea': 'Ọ bụrụ na obi na-agbagwoju gị, na-eri obere nri kpọrọ nkụ. Tii jinja na-enyere aka.',
    'educ.symptom.heartburn': 'Ọ bụrụ na obi na-ere gị ọkụ (heartburn), na-eri obere nri. Edinala ala ozugbo i risịrị nri.',
    'educ.symptom.leg_cramps': 'Ọ bụrụ na akwara ụkwụ na-akpụkọ gị (cramps), setịpụ ụkwụ gị. Gaa n’ihu na-aṅụ calcium gị.',
    'educ.symptom.constipation': 'Ọ bụrụ na nsị gị siri ike, ṅụkwuo mmiri. Na-eri mkpụrụ osisi, akwụkwọ nri na agwa.',
    'educ.symptom.back_pain': 'Ọ bụrụ na azụ na-afụ gị ụfụ, mee mgbatị ahụ nwayọọ. Akwa e ji ekechi afọ nwere ike inyere aka.',
    'educ.substances': 'Aṅụla mmanya, aṅụla sịga. Aṅụla karịa iko kọfị 2 n’ụbọchị.',
    'educ.caesarean_wound': 'Mee ka ọnya gị dị ọcha ma kpọọ nkụ. Bịa ngwa ngwa ma ọ na-acha ọbara ọbara, nwee nsị ọnya, ma ọ bụ i nwee ahụ ọkụ.',

    // ---------- Food ----------
    'nutr.iron_foods': 'Kwa ụbọchị, rie {food1}. Rie kwa {food2}. Rie {fruit} ya na nri gị. Nke a na-eme ka ọbara gị sie ike. Gaa n’ihu na-aṅụ ọgwụ ọbara gị kwa.',
    'nutr.iron_foods.simple': 'Kwa ụbọchị, rie {food1}. Rie kwa {fruit}.',
    'nutr.protein_calcium.one': 'Rie otu obere nri ọzọ kwa ụbọchị. Kwa ụbọchị, rie {food1}. Rie kwa {food2}.',
    'nutr.protein_calcium.one.simple': 'Rie otu obere nri ọzọ kwa ụbọchị. Tinye {food1}.',
    'nutr.protein_calcium.two': 'Rie obere nri abụọ ọzọ kwa ụbọchị. Kwa ụbọchị, rie {food1}. Rie kwa {food2}.',
    'nutr.protein_calcium.two.simple': 'Rie obere nri abụọ ọzọ kwa ụbọchị. Tinye {food1}.',
    'nutr.protein_calcium.feeding': 'Rie otu nri ọzọ kwa ụbọchị mgbe ị na-enye nwa ara. Kwa ụbọchị, rie {food1}. Rie kwa {food2}.',
    'nutr.protein_calcium.feeding.simple': 'Rie otu nri ọzọ kwa ụbọchị. Tinye {food1}.',
    'nutr.water': 'Ṅụọ ihe dị ka iko mmiri dị ọcha 8 kwa ụbọchị.',
    'nutr.water.feeding': 'Ṅụọ otu iko mmiri oge ọ bụla ị na-enye nwa ara.',
    'nutr.first_foods.prepare': 'Mgbe ọ gbara ọnwa 6, {name} ga-amalite nri mbụ. Ruo mgbe ahụ, naanị mmiri ara ka ị ga-enye ya.',
    'nutr.first_foods.6_8': 'Nye {name} akamụ siri ike ya na {food}. Tinye agwa a gwịrị agwị, akwa na akwụkwọ nri. Nye ya obere nri 2 ruo 3 n’ụbọchị. Gaa n’ihu na-enye ya ara.',
    'nutr.first_foods.6_8.simple': 'Akamụ siri ike ya na {food}, akwa na agwa, ugboro 2 ruo 3 n’ụbọchị. Gaa n’ihu na-enye ara.',
    'nutr.first_foods.9_11': 'Nye {name} nri ezinụlọ a gwịrị agwị ma ọ bụ bee obere obere, ya na {food}. Tinye agwa, akwa na akwụkwọ nri. Nye ya nri 3 ruo 4 n’ụbọchị na otu nri nta. Gaa n’ihu na-enye ya ara.',
    'nutr.first_foods.9_11.simple': 'Nri ezinụlọ a gwịrị agwị, ya na akwa na agwa, ugboro 3 ruo 4 n’ụbọchị. Gaa n’ihu na-enye ara.',
    'nutr.first_foods.12_23': 'Nye {name} nri ezinụlọ ya na {food}. Tinye agwa, akwa ma ọ bụ azụ, na akwụkwọ nri. Nye ya nri 3 ruo 4 n’ụbọchị na nri nta 2. Gaa n’ihu na-enye ya ara.',
    'nutr.first_foods.12_23.simple': 'Nri ezinụlọ ya na akwa, agwa na akwụkwọ nri, ugboro 3 ruo 4 n’ụbọchị. Gaa n’ihu na-enye ara.',

    // ---------- Rest and activity ----------
    'rest.itn': 'Na-ehi ụra n’ime ụgbụ anwụnta nwere ọgwụ kwa abalị, n’afọ niile.',
    'rest.sleep_side': 'Site ugbu a gaa n’ihu, na-ehi ụra n’akụkụ. Akụkụ aka ekpe kacha mma. Ọ bụrụ na i teta n’azụ gị, naanị tụgharịa.',
    'rest.sleep_side.simple': 'Na-ehi ụra n’akụkụ, ọ bụghị n’azụ gị.',
    'rest.after_birth': 'Zuo ike mgbe {name} na-ehi ụra. Ka ezinụlọ nyere gị aka isi nri na ịsa akwa. Mee ka {name} dina n’azụ ya mgbe ọ na-ehi ụra, n’ime ụgbụ anwụnta.',
    'rest.after_birth.simple': 'Zuo ike mgbe {name} na-ehi ụra. Nwa na-ehi ụra n’azụ ya.',
    'activity.pregnancy': 'Na-eje ije ma ọ bụ rụọ ọrụ dị mfe kwa ụbọchị. Zuo ike mgbe ike gwụrụ gị. Ebula ibu dị arọ.',

    // ---------- Birth preparation ----------
    'birth.hospital': 'N’ihi ahụ ike gị, ọ ka mma ka a mụọ nwa gị n’ụlọ ọgwụ. Kwadebe otu ị ga-esi ruo ebe ahụ, ehihie ma ọ bụ abalị.',
    'birth.hospital.simple': 'A ga-amụrịrị nwa gị n’ụlọ ọgwụ.',
    'birth.skilled': 'Onye na-agba ebe (midwife) nwere ike ịkwụsị ọbara ọgbụgba dị ukwuu ma nyere nwa aka iku ume. Onye na-enyere gị aka nwere ike iso gị bịa n’ụlọ ọgwụ.',
    'birth.plan': 'Kwadebe ugbu a ebe ị ga-amụ nwa. Kwadebe otu ị ga-esi ruo ebe ahụ n’abalị. Chekwaa ego ụgbọ. Họrọ onye ga-eso gị. Kwakọba akpa nwere akwa dị ọcha na uwe nwa.',
    'birth.plan.simple': 'Kwadebe ebe ị ga-amụ nwa, ụgbọ na ego ugbu a.',
    'birth.blood_donor': 'Họrọ mmadụ abụọ n’ezinụlọ gị ahụ dị mma ka ha soro gị. Ha nwere ike inye gị ọbara ma ọ bụrụ na ị chọrọ ya.',
    'birth.sha': 'Debanye aha gị na SHA ugbu a ka SHA kwụọ ụgwọ ọmụmụ nwa gị. Ị gaghị enwe ike idebanye aha mgbe ime na-eme gị.',

    // ---------- Breastfeeding ----------
    'bf.prepare': 'Nye nwa gị ara n’ime otu awa mbụ mgbe a mụrụ ya. Mmiri ara mbụ na-acha odo odo dị nnọọ mma nye nwa. Naanị mmiri ara ka ị ga-enye ya ruo ọnwa 6.',
    'bf.prepare.simple': 'Nye nwa ara n’ime awa mbụ. Naanị mmiri ara ruo ọnwa 6.',
    'bf.only_breast_milk': 'Nye {name} naanị mmiri ara ruo ọnwa 6. Enyela ya mmiri, enyela ya akamụ, enyela ya ọgwụ akwụkwọ. Mmiri ara nwere mmiri niile nwa chọrọ.',
    'bf.only_breast_milk.simple': 'Nye {name} naanị mmiri ara. Enyela ya mmiri, enyela ya akamụ.',
    'bf.latch': 'Bute {name} nso, afọ ya na afọ gị. Chere ka o meghee ọnụ ya nke ọma. Mgbe ahụ bute nwa ahụ n’ara. Inye nwa ara ekwesịghị ịfụ gị ụfụ.',
    'bf.latch.simple': 'Afọ nwa na afọ gị. Chere ka o meghee ọnụ nke ọma, wee nye ya ara.',
    'bf.more_milk': 'Na-enye {name} ara ọtụtụ mgbe, opekata mpe ugboro 8 n’ụbọchị na n’abalị. Jide nwa gị, akpụkpọ ahụ ya na nke gị. Ka nwa na-amịkwu ara, ka mmiri ara na-abawanye. Akwụkwọ moringa na ofe nwere ike inyere aka.',
    'bf.more_milk.simple': 'Na-enye ara ọtụtụ mgbe, ehihie na abalị. Ka nwa na-amịkwu ara, ka mmiri ara na-abawanye.',
    'bf.continue': 'Gaa n’ihu na-enye {name} ara ya na nri ndị ọzọ, ruo afọ 2 ma ọ bụ karịa.',

    // ---------- Baby care ----------
    'baby.cord_gel': 'Tee otubo {name} ude ụlọ ọgwụ otu ugboro n’ụbọchị ruo ụbọchị 7. Etinyela ihe ọzọ n’otubo ahụ. Mee ka ọ dị ọcha ma kpọọ nkụ.',
    'baby.cord_gel.simple': 'Otubo: ude ụlọ ọgwụ otu ugboro n’ụbọchị ruo ụbọchị 7. Ọ dịghị ihe ọzọ.',
    'baby.cord_dry': 'Mee ka otubo {name} dị ọcha ma kpọọ nkụ. Etinyela ihe ọ bụla na ya.',
    'baby.skin_to_skin': 'Jide {name} n’obi gị, n’enweghị uwe n’etiti unu, n’ime akwa ị kechiri. Mee nke a ọtụtụ awa, ehihie na abalị. Ndị ezinụlọ nwere ike ịnara ya n’otu n’otu.',
    'baby.skin_to_skin.simple': 'Jide {name} n’obi gị, akpụkpọ ahụ na akpụkpọ ahụ, ehihie na abalị.',
    'baby.skin_to_skin.continue': 'Gaa n’ihu na-ejide {name}, akpụkpọ ahụ na akpụkpọ ahụ, dị ka i nwere ike.',
    'baby.warm': 'Mee ka ahụ {name} kpoo ọkụ: kpuo ya okpu, yinye ya otu uwe karịa nke i yi. Jide nwa gị, akpụkpọ ahụ na akpụkpọ ahụ.',
    'baby.warm.simple': 'Mee ka ahụ {name} kpoo ọkụ. Jide nwa gị, akpụkpọ ahụ na akpụkpọ ahụ.',
    'baby.safe_sleep': 'Mee ka {name} dina n’azụ ya mgbe ọ na-ehi ụra. Jiri ụgbụ anwụnta. Ekpuchila ihu ya.',
    'baby.weigh.monthly': 'Kpọta {name} ka a tụọ ya ibu kwa ọnwa.',
    'baby.weigh.fortnightly': 'Kpọta {name} ka a tụọ ya ibu izu 2 ọ bụla.',

    // ---------- After-birth visits ----------
    'visit.after_birth.done': 'E mere nlele na {date}.',
    'visit.after_birth.due': 'Nlele ahụ ike gị na nke {name}: {date}.',
    'visit.bp_after_birth': 'Anyị ga-elele ọbara mgbali gị oge nleta ọ bụla. Isi ọwụwa ma ọ bụ anya na-adịghị ahụ ụzọ nke ọma: gaa n’ụlọ ọgwụ ugbu a.',

    // ---------- Family planning ----------
    'fp.plan_ahead': 'Chee echiche ugbu a gbasara ịhazi ọmụmụ nwa mgbe nwa a gasịrị. Ahụ gị chọrọ izu ike tupu ime ọzọ.',
    'fp.after_birth': 'Họrọ ụzọ ịhazi ọmụmụ nwa tupu izu 6. Ichere afọ 2 tupu nwa ọzọ na-eme ka ahụ dị onye ọ bụla mma.',
    'fp.after_birth.simple': 'Họrọ ịhazi ọmụmụ nwa tupu izu 6.',
    'fp.spacing': 'Jiri ịhazi ọmụmụ nwa ka ahụ gị zuo ike afọ 2 tupu nwa ọzọ.',
    'fp.timing': 'Kwadebe mgbe ị chọrọ nwa gị ọzọ. Ịhazi ọmụmụ nwa bụ n’efu n’ụlọ ọgwụ. Ọ bụrụ na nsọ nwanyị gị egbuola oge, bịa ka e lelee gị.',

    // ---------- Mind and mood ----------
    'mh.screen.pregnancy': 'Anyị ga-ajụ gị ajụjụ ole na ole gbasara otu obi dị gị. Ọtụtụ ndị nne na-enwe obi ida mbà. Enyemaka dị.',
    'mh.screen.after_birth': 'Anyị ga-ajụ gị otu obi dị gị n’oge na-adịbeghị anya. Ọtụtụ ndị nne ọhụrụ na-enwe obi ida mbà. Ị nwere ike ịgwa anyị okwu.',
    'mh.support': 'Obi ida mbà na-adịkarị, ọ na-adịkwa mma ma a nyere aka. Ka anyị na-ezute kwa izu ka anyị kparịta ụka. Ị bụ ezigbo nne.',
    'mh.support.simple': 'Obi ida mbà na-adịkarị. Anyị ga-ezute kwa izu ka anyị kparịta ụka.',
    'mh.check_in': 'Kedu ka obi dị gị? Ị nwere ike ịgwa anyị ma obi adịghị gị mma ma ọ bụ ị na-echegbu onwe gị. Enyemaka dị.',

    // ---------- Family ----------
    'family.partner': 'Rịọ di gị ma ọ bụ ezinụlọ gị ka ha nyere gị aka n’ọrụ ụlọ. Rịọ ha ka ha mụtakwa ihe ịrịba ama nke ihe egwu.',
    'family.young_mother': 'Ọ bụghị naanị gị nọ. Ọ bụrụ na ị chọrọ, kpọta onye ị tụkwasịrị obi ka o soro gị bịa nleta.',
    'family.omugwo_carer': 'Rịọ nne nne na-enyere gị aka ka ọ mụta ihe ịrịba ama nke ihe egwu. O nwere ike ịkpọ anyị ma ọ bụrụ na ọ na-echegbu onwe ya gbasara gị ma ọ bụ {name}.',

    // ---------- Traditional practices ----------
    'trad.ask_local': 'Gwa anyị omenala ezinụlọ gị na-eso. Ọtụtụ n’ime ha dị mma, anyị nwekwara ike inyere gị aka n’ndị fọdụrụ.',
    'trad.omugwo': 'Omugwo bụ ngọzị. Ka onye na-enyere gị aka mụtakwa ihe ịrịba ama nke ihe egwu. Naanị mmiri ara ka nwa ga-aṅụ.',
    'trad.hot_water_compress': 'Akwa nhicha ahụ na-ekpo ọkụ nwayọọ n’azụ gị na n’afọ gị dị mma. Buru ụzọ nwalee ya n’ọkpụkpụ aka gị. O kwesịrị ikpo ọkụ nwayọọ, ọ bụghị ọkụ nke ukwuu.',
    'trad.wankan_jego': 'Mee ka ahụ gị kpoo ọkụ ma zuo ike. Jiri naanị obere nnu kanwa. Iku ume ọ siri gị ike, ma ọ bụ ụkwụ gị zara aza? Gaa n’ụlọ ọgwụ taa.',
    'trad.pap_ogi': 'Akamụ dị gị mma. Tinye ahụekere a gwịrị agwị, oporo ma ọ bụ akwa ka o nwekwuo ike. Naanị mmiri ara ka nwa na-aṅụ ruo ọnwa 6.',
    'trad.pepper_soup': 'Ofe ose ya na azụ bụ nri dị gị mma. Rie ya ya na nri ndị ọzọ, ma ṅụọ mmiri nke ukwuu.',
    'trad.moringa': 'Akwụkwọ moringa n’ofe gị dị mma, o nwekwara ike ime ka mmiri ara gị bawanye. Inye nwa ara ọtụtụ mgbe na-enyere aka karịa.',
    'trad.galactagogue_leaves': 'Inye nwa ara ọtụtụ mgbe bụ ụzọ kacha mma isi nweta mmiri ara karịa. Jụọ anyị tupu ị ṅụọ tii akwụkwọ ọ bụla.',
    'trad.agbo': 'Biko gwa anyị ọgwụ akwụkwọ ọ bụla ị na-aṅụ. Ejila agbo dochie ọgwụ ụlọ ọgwụ gị. Aṅụla ọgwụ akwụkwọ iji malite ime ime.',
    'trad.labour_herbs': 'Biko aṅụla ọgwụ akwụkwọ iji malite ma ọ bụ mee ka ime ime gaa ngwa ngwa. Ha nwere ike imerụ gị na nwa. Gaa n’ụlọ ọgwụ mgbe ime malitere ime gị.',
    'trad.nzu_clay': 'Agụụ iri nzu ma ọ bụ ụrọ nwere ike ịpụta na ọbara gị adịghị ike. Ka anyị lelee ọbara gị. Nwaa jinja ma ọ bụ ahụekere a ṅara aṅa kama.',
    'trad.food_taboo_protein': 'Akwa, azụ na agwa na-enye gị na nwa gị ọbara siri ike. Ha anaghị eme ka ime ime sie ike.',
    'trad.eating_less': 'Na-eri nri nke ọma. Nwa ahụ dị mma na onye na-agba ebe maara ọrụ na-eme ka ọmụmụ nwa dị nchebe. Iri obere nri anaghị eme nke ahụ.',
    'trad.food_taboo_minor': 'Ị nwere ike ịhapụ nri ndị a. Rie agwa, akwa, azụ ma ọ bụ oporo kwa ụbọchị kama ha.',
    'trad.colostrum_discard': 'Mmiri ara mbụ na-acha odo odo bụ ọgwụ mbụ nwa gị. Nye nwa gị ya niile, malite n’awa mbụ.',
    'trad.prelacteal_feeds': 'Mmiri ara nwere mmiri niile nwa gị chọrọ, ọ bụrụgodị n’oge okpomọkụ. Ọ dịghị mmiri, glucose ma ọ bụ ọgwụ akwụkwọ tupu ọnwa 6.',
    'trad.early_complementary': 'Ọ bụrụ na ọ dị ka agụụ na-agụ nwa gị, na-enye ya ara ọtụtụ mgbe karịa. Malite nri ndị ọzọ mgbe ọ gbara ọnwa 6.',
    'trad.cord_substances': 'Etinyela ihe ọ bụla n’otubo ma ọ bụghị ude ụlọ ọgwụ. Mee ka ọ dị ọcha ma kpọọ nkụ. Bịa ngwa ngwa ma ọ chawa ọbara ọbara ma ọ bụ na-esi isi.',
    'trad.uvulectomy': 'Biko ekwela ka onye ọ bụla bee ihe n’akpịrị nwa gị. Ọ bụrụ na nwa gị na-akwa ụkwara ma ọ bụ anaghị aṅụ ara, bịa n’ụlọ ọgwụ.',
    'trad.baby_massage_shea': 'Iji ude okwuma dị ọcha hịa nwa ahụ nwayọọ dị mma. Etela ya n’otubo. Jiri nwayọọ mee aka na ụkwụ ya.',
    'trad.postpartum_confinement': 'Izu ike dị gị mma. Onye ọrụ ahụ ike gị nwere ike ileta gị n’ụlọ. Nwa gị ka chọrọ ọgwụ mgbochi n’oge ha.',
    'trad.abdominal_binder': 'Ịkechi afọ gị maka nkwado dị mma. Kechie ya nwayọọ, ka ọ ghara ịkpa nke ukwuu.',
    'trad.back_carrying': 'Ịkwa nwa gị n’azụ dị mma. Ekpuchila ihu ya ka o nwee ike iku ume.',
    'trad.ginger_nausea': 'Tii jinja dị mma maka obi mgbagwoju n’oge mbido ime. Ọ bụrụ na mmiri anaghị anọ gị n’afọ, bịa n’ụlọ ọgwụ.',
    'trad.tba_birth': 'Onye na-enyere gị aka ịmụ nwa nwere ike iso gị bịa n’ụlọ ọgwụ. Onye na-agba ebe n’ụlọ ọgwụ nwere ike ịkwụsị ọbara ọgbụgba dị ukwuu. Onye na-agba ebe ọdịnala enweghị ike.',
    'trad.bleeding_home_remedies': 'Ọbara ọgbụgba dị ukwuu mgbe a mụsịrị nwa bụ ihe mberede. Gaa n’ụlọ ọgwụ ugbu a. Echerela ọgwụ akwụkwọ.',
  },
  glossary: {
    ...monthGlossary('{d} {m}', EN_MONTHS),
    'the baby': 'nwa ahụ',
    'your baby': 'nwa gị',
    'a fruit': 'otu mkpụrụ osisi',
    'a cup of cooked beans': 'otu iko agwa e siri esi',
    'a handful of crayfish in your soup': 'oporo aka juru n’ofe gị',
    'two handfuls of cooked green leaves': 'akwụkwọ nri e siri esi aka abụọ juru',
    'two handfuls of cooked ugu': 'ugu e siri esi aka abụọ juru',
    'two handfuls of cooked efo': 'inine e siri esi aka abụọ juru',
    'one egg': 'otu akwa',
    'a bowl of pap with a spoon of groundnut paste': 'otu efere akamụ ya na otu ngaji ahụekere a gwịrị agwị',
    'a handful of groundnuts': 'ahụekere aka juru',
    'a spoon of red palm oil in your soup': 'otu ngaji mmanụ nri n’ofe gị',
    'a handful of small dried fish': 'obere azụ a mịrị amị aka juru',
    'a slice of pawpaw or a mango': 'otu iberi okwuru bekee ma ọ bụ otu mangoro',
    'a cup of soy milk or a piece of awara': 'otu iko mmiri ara soya ma ọ bụ otu iberi awara',
    'a handful of moringa leaves in your soup': 'akwụkwọ moringa aka juru n’ofe gị',
    'a small piece of liver twice a week': 'obere iberi imeju, ugboro abụọ n’izu',
    'a piece of fish': 'otu iberi azụ',
    'a cup of nono or a piece of wara': 'otu iko nono ma ọ bụ otu iberi wara',
    'a piece of meat or chicken': 'otu iberi anụ ma ọ bụ ọkụkọ',
    'groundnut paste and crayfish': 'ahụekere a gwịrị agwị na oporo',
  },
  sources: [{ label: 'Machine draft by the Gaskin build team, 2026; awaiting review by Igbo-speaking midwives' }],
};
