import type { LanguagePack } from '../types';
import { DRAFT_NOTE, monthGlossary } from './shared';

const EN_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * Twi (Asante Twi, with ɛ and ɔ). Full machine draft of every mother line, not yet reviewed.
 * The mother is addressed respectfully as "Maame" at the start of the most important lines,
 * and "Yɛsrɛ wo" (we beg you) is used for "please". Clinic and hospital are both "ayaresabea",
 * so an emergency line never sends her somewhere smaller. Medicine names, test names and some
 * conditions stay in English (folic acid, calcium, aspirin, HIV, syphilis, hepatitis B, tetanus,
 * sickle cell, vitamin A, blood pressure, scan, drip, protein, glucose, SHA).
 * Dates use English month names, as most mothers say them.
 *
 * REVIEW FIRST (least sure; native-speaking midwives please check these before anything else):
 * - Fits/convulsions are described as "wo ho wosow denneennen" with "(fits)" kept in English:
 *   danger.*, alert.eclampsia, alert.convulsions, alert.newborn_danger context.
 * - "kokoam" for the private part: danger.postpartum, alert.puerperal_sepsis(.urgent).
 * - danger.newborn: "ne koko twetwe kɔ mu" for chest indrawing.
 * - alert.ruptured_membranes(.urgent): "nsuo kotokuo a ɛtwa abofra no ho ahyia no apae".
 * - alert.dvt(.emergency): "mogya a apɔ mu (blood clot)".
 * - Vaccines are "ahobammɔ panee (vaccines)": imm.*, trad.postpartum_confinement.
 * - mh.*, alert.depression, alert.low_mood_screen: "awerɛhoɔ" for feeling low.
 * - educ.symptom.heartburn and educ.symptom.leg_cramps (English word kept in brackets).
 * - trad.uvulectomy, trad.nzu_clay (clay as "dɔteɛ"), trad.wankan_jego ("kanwa" kept).
 * - The baby's cord is "funuma": baby.cord_*, alert.cord_infection, trad.cord_substances.
 * - Glossary food measures ("nsa ma" for a handful; agushie, kontomire, ayoyo, wagashi kept).
 */
export const tw: LanguagePack = {
  code: 'tw',
  name: 'Twi',
  nativeName: 'Twi',
  direction: 'ltr',
  version: '0.2.0',
  licence: 'CC-BY-4.0',
  status: 'machine_draft',
  reviewers: [],
  regions: ['GH'],
  note: DRAFT_NOTE,
  ui: {
    'nav.today': 'Nnɛ',
    'cat.medication': 'Nnuro',
    'cat.nutrition': 'Aduane',
    'dual.english_line': 'Borɔfo',
    'conf.fallback': 'Borɔfo',
    'onb.welcome': 'Akwaaba wɔ Gaskin',
    'settings.language': 'Kasa',
    'common.yes': 'Aane',
    'common.no': 'Daabi',
    'common.today': 'Nnɛ',
    'common.tomorrow': 'Ɔkyena',
    'common.mother': 'Ɛna',
    'common.baby': 'Abofra',
    'common.english': 'Borɔfo',
    'common.language': 'Kasa',
  },
  mother: {
    // ---------- Alerts and referral items (drafted first) ----------
    'alert.go_now': 'Maame, kɔ ayaresabea seesei ara. Ntwɛn.',
    'alert.go_today': 'Maame, kɔ ayaresabea nnɛ.',
    'alert.eclampsia': 'Maame, wo ho wosow denneennen (fits), na wo blood pressure akɔ soro dodo. Eyi yɛ asiane ma wo ne abofra no. Kɔ ayaresabea seesei ara. Ntwɛn.',
    'alert.severe_pre_eclampsia': 'Maame, wo blood pressure akɔ soro dodo, na ɛkɔɔ soro ntɛmntɛm. Eyi betumi asɛe wo berɛboɔ, wo asaabo ne abofra no. Kɔ ayaresabea seesei ara. Ntwɛn.',
    'alert.severe_pre_eclampsia.urgent': 'Maame, wo blood pressure akɔ soro dodo, na protein wɔ wo dwonsɔ mu. Eyi betumi apira wo ne abofra no. Kɔ ayaresabea nnɛ.',
    'alert.hypertension': 'Maame, wo blood pressure kɔ soro sen sɛnea ɛsɛ. Ɛsɛ sɛ yɛsan susu no nnɛ. Kɔ ayaresabea nnɛ.',
    'alert.check_bp_now': 'Tipae a ano yɛ den, w’ani a ɛnhu adeɛ yie, anaa w’anim a ahono betumi akyerɛ sɛ wo blood pressure akɔ soro. Ɛsɛ sɛ yɛsusu no nnɛ. Kɔ ayaresabea nnɛ.',
    'alert.convulsions': 'Sɛ wo ho wosow denneennen (fits) a, ɛyɛ asiane wɔ nyinsɛn mu ne awoɔ akyi. Kɔ ayaresabea seesei ara. Ntwɛn.',
    'alert.vaginal_bleeding': 'Mogya a ɛtu wo wɔ nyinsɛn mu betumi ayɛ asiane ama wo ne abofra no. Da wo benkum so wɔ kwan so. Kɔ ayaresabea seesei ara.',
    'alert.postpartum_haemorrhage': 'Mogya bebree a ɛtu wo awoɔ akyi yɛ asiane kɛse. Fa obi a ɔbetumi de mogya ama wo ka wo ho. Kɔ ayaresabea seesei ara. Ntwɛn.',
    'alert.puerperal_sepsis': 'Ho hyeɛ ne hua bɔne a efi wo kokoam betumi akyerɛ sɛ yareɛ mmoawa wɔ wo mu. Wohia aduru. Kɔ ayaresabea seesei ara.',
    'alert.puerperal_sepsis.urgent': 'Hua bɔne a efi wo kokoam betumi akyerɛ sɛ yareɛ mmoawa wɔ wo mu. Wohia aduru. Kɔ ayaresabea nnɛ.',
    'alert.maternal_fever': 'Ho hyeɛ betumi ayɛ atiridii (malaria) anaa yareɛ foforɔ. Wohia nhwehwɛmu nnɛ. Kɔ ayaresabea nnɛ.',
    'alert.mastitis': 'Nufu a ɛyɛ hyew na ɛyɛ ya, a ho hyeɛ ka ho, hia aduru. Kɔ so ma abofra no nufu wɔ nufu mmienu no nyinaa mu. Kɔ ayaresabea nnɛ.',
    'alert.reduced_fetal_movement': 'Sɛ abofra a ɔwɔ wo yafunu mu no nkeka ne ho sɛnea ɔyɛ daa a, ebia ɔwɔ ɔhaw mu. Ɛsɛ sɛ yɛtie abofra no akoma nnɛ. Kɔ ayaresabea nnɛ.',
    'alert.severe_abdominal_pain': 'Yafunu yaw a ano yɛ den wɔ nyinsɛn mu betumi ayɛ asiane. Kɔ ayaresabea seesei ara. Ntwɛn.',
    'alert.ruptured_membranes': 'Nsuo a ɛtu fi wo mu kyerɛ sɛ nsuo kotokuo a ɛtwa abofra no ho ahyia no apae. Ne berɛ nnuruiɛ. Kɔ ayaresabea seesei ara.',
    'alert.ruptured_membranes.urgent': 'Nsuo a ɛtu fi wo mu kyerɛ sɛ nsuo kotokuo a ɛtwa abofra no ho ahyia no apae. Kɔ baabi a wobɛwo no seesei ara.',
    'alert.severe_vomiting': 'Sɛ wofe biribiara a, nsuo betumi asa wo mu. Ebia wohia drip. Kɔ ayaresabea nnɛ.',
    'alert.post_term': 'Wo awoɔ berɛ atwam seesei. Yɛsrɛ wo, frɛ yɛn nnɛ, anaa bra ayaresabea.',
    'alert.dvt': 'Nan a ɛyɛ ya na ahono betumi akyerɛ mogya a apɔ mu (blood clot). Nnwiriw nan no. Kɔ ayaresabea nnɛ.',
    'alert.dvt.emergency': 'Nan a ɛyɛ ya ne home a ɛyɛ den betumi akyerɛ mogya a apɔ mu (blood clot) wɔ ahrawa mu. Kɔ ayaresabea seesei ara. Ntwɛn.',
    'alert.breathlessness': 'Home a ɛyɛ den betumi akyerɛ ɔhaw wɔ w’akoma anaa w’ahrawa mu. Kɔ ayaresabea nnɛ.',
    'alert.breathlessness.emergency': 'Home a ɛyɛ den dodo betumi akyerɛ ɔhaw wɔ w’akoma anaa w’ahrawa mu. Kɔ ayaresabea seesei ara. Ntwɛn.',
    'alert.self_harm': 'Maame, ɛnyɛ wo nko ara, na ɛnyɛ wo mfomsoɔ. Yɛpɛ sɛ yɛboa wo nnɛ. Yɛsrɛ wo, tena obi a wo ho to no so ho.',
    'alert.depression': 'Awerɛhoɔ kɛse yɛ yareɛ, ɛnyɛ mmerɛyɛ. Wɔtumi sa. Yɛbɛboa wo ma woahu obi nnawɔtwe yi.',
    'alert.low_mood_screen': 'Maamenom bebree nya awerɛhoɔ. Sɛ wɔboa wo a, ɛyɛ yie. Yɛbɛba abɛsra wo nnawɔtwe yi na yɛabɔ nkɔmmɔ.',
    'alert.severe_anaemia': 'Maame, wo mogya ayɛ mmerɛ dodo. Eyi yɛ asiane sɛ mogya tu wo a. Ebia wohia mogya. Kɔ ayaresabea nnɛ.',
    'alert.moderate_anaemia': 'Wo mogya ayɛ mmerɛ. Wohia mogya aduru a ano yɛ den. Yɛsrɛ wo, hu nɛɛse no nnawɔtwe yi.',
    'alert.malaria_pregnancy': 'Maame, wowɔ atiridii (malaria). Ebetumi apira wo ne abofra no. Wohia aduru nnɛ. Kɔ ayaresabea nnɛ.',
    'alert.scd_pathway': 'Esiane sickle cell nti, wohia ahwɛyie foforɔ wɔ nyinsɛn mu. Yaw, ho hyeɛ, anaa home a ɛyɛ den: kɔ ayaresabea da no ara.',
    'alert.newborn_danger': '{name} wɔ asiane nsɛnkyerɛnne. Fa {name} to wo koko so na ne ho nyɛ hyew wɔ kwan so. Kɔ ayaresabea seesei ara. Ntwɛn.',
    'alert.child_danger': '{name} wɔ asiane nsɛnkyerɛnne. Kɔ so ma no nufu wɔ kwan so sɛ {name} tumi nom a. Kɔ ayaresabea seesei ara.',
    'alert.child_fever': '{name} ho yɛ hyew. {name} hia atiridii (malaria) nhwehwɛmu nnɛ. Kɔ ayaresabea nnɛ.',
    'alert.jaundice': '{name} honam anaa n’ani ayɛ akokɔsradeɛ. Ɛsɛ sɛ yɛhwɛ {name} nnɛ. Kɔ ayaresabea nnɛ.',
    'alert.cord_infection': '{name} funuma ayɛ kɔkɔɔ. Ebia yareɛ mmoawa akɔ mu. Mmfa hwee ngu so. Kɔ ayaresabea nnɛ.',
    'alert.child_diarrhoea': '{name} ayamtuo a ɛyɛ nsuo. Kɔ so ma no nufu. Ebia {name} hia aduru ne nsuo soronko bi a ɔbɛnom. Kɔ ayaresabea nnɛ.',
    'alert.severe_malnutrition': '{name} afɔn dodo. Aduane soronko a efi ayaresabea betumi aboa {name} ma ɔanyin. Kɔ ayaresabea nnawɔtwe yi.',
    'alert.fallback': 'Maame, yɛn ho nni yɛn wɔ wo apɔmuden ho. Kɔ ayaresabea nnɛ.',

    // ---------- Danger signs ----------
    'danger.pregnancy': 'Maame, kɔ ayaresabea ntɛm ara sɛ mogya tu wo anaa wo ho wosow denneennen (fits) a. Kɔ ntɛm ara sɛ tipae a ano yɛ den ka wo, anaa w’ani nhu adeɛ yie a. Kɔ ntɛm ara sɛ wo ho yɛ hyew anaa yafunu yaw a ano yɛ den ka wo a. Kɔ ntɛm ara sɛ nsuo tu fi wo mu, anaa abofra a ɔwɔ wo yafunu mu no nkeka ne ho sɛnea ɔyɛ daa a.',
    'danger.pregnancy.simple': 'Mogya, ho wosow (fits), tipae a ano yɛ den, ho hyeɛ, anaa abofra a ɔnkeka ne ho: kɔ ayaresabea seesei ara.',
    'danger.postpartum': 'Maame, kɔ ayaresabea ntɛm ara sɛ mogya tu wo bebree a. Kɔ ntɛm ara sɛ wo ho wosow denneennen (fits), tipae a ano yɛ den anaa ho hyeɛ ka wo a. Kɔ ntɛm ara sɛ hua bɔne fi wo kokoam a. Kɔ ntɛm ara sɛ home yɛ den ma wo, anaa wo nan baako yɛ wo ya na ahono a.',
    'danger.postpartum.simple': 'Mogya bebree, ho wosow (fits), ho hyeɛ, anaa home a ɛyɛ den: kɔ ayaresabea seesei ara.',
    'danger.newborn': 'Kɔ ayaresabea seesei ara sɛ {name} nnum nufu, anaa ne ho wosow denneennen (fits) a. Kɔ seesei ara sɛ {name} home ntɛmntɛm, anaa ne koko twetwe kɔ mu bere a ɔhome a. Kɔ seesei ara sɛ {name} ho yɛ hyew dodo, ne ho adwo dodo, anaa ɔda dodo a. Kɔ seesei ara sɛ ne nsam anaa ne nan ase ayɛ akokɔsradeɛ a.',
    'danger.newborn.simple': 'Ɔnnum nufu, ho wosow (fits), home ntɛmntɛm, ho hyew anaa ho dwo, nna dodo: kɔ ayaresabea seesei ara.',
    'danger.child': 'Kɔ ayaresabea seesei ara sɛ {name} ntumi nnom hwee, anaa ɔfe biribiara a. Kɔ seesei ara sɛ ne ho wosow denneennen (fits), ɔda dodo a wontumi nnyane no, anaa ɔhome ntɛmntɛm a.',
    'danger.child.simple': 'Ɔntumi nnom hwee, ho wosow (fits), nna dodo, anaa home ntɛmntɛm: kɔ ayaresabea seesei ara.',

    // ---------- Antenatal visits ----------
    'visit.anc_next.booking': 'Maame, bra ayaresabea ntɛm ma wɔnhwɛ wo nyinsɛn no mprenkan.',
    'visit.anc_next.overdue': 'Woantumi amma ayaresabea nhwehwɛmu baako. Yɛsrɛ wo, bra nnawɔtwe yi.',
    'visit.anc_next.date': 'Wo ayaresabea nsrahwɛ a ɛdi hɔ yɛ {date}. Yɛsrɛ wo, bra bere mpo a wo ho tɔ wo.',
    'visit.anc_next.date.simple': 'Ayaresabea nsrahwɛ a ɛdi hɔ: {date}.',
    'visit.anc_schedule': 'Wo ayaresabea nna ne {dates}.',
    'visit.birth_notification': 'Sɛ wowo wo ba no a, frɛ yɛn anaa fa nkra bra da no ara. Yɛbɛba abɛhwɛ wo ne abofra no.',
    'visit.birth_notification.simple': 'Sɛ abofra no ba a, frɛ yɛn da no ara.',
    'visit.scd_specialist': 'Wohia ahwɛyie fi sickle cell dɔkotafoɔ hɔ, ne ayaresabea yi nso. Nom nsuo bebree na ma wo ho nyɛ hyew. Sɛ yaw, ho hyeɛ anaa home a ɛyɛ den ka wo a, kɔ ayaresabea da no ara.',
    'visit.scd_specialist.simple': 'Kɔhu sickle cell dɔkota no nso. Yaw anaa ho hyeɛ: kɔ ayaresabea nnɛ.',

    // ---------- Medicines in pregnancy ----------
    'med.folic_acid_high_dose': 'Nom wo folic acid aduru da biara. Nnom mogya aduru gye sɛ wo dɔkota ka sɛ nom a.',
    'med.folic_acid_high_dose.simple': 'Nom folic acid da biara. Mogya aduru biara nni hɔ gye sɛ dɔkota ka a.',
    'med.folic_acid_scd': 'Nom wo folic acid aduru da biara. Nnom mogya aduru gye sɛ wo dɔkota ka sɛ nom a.',
    'med.folic_acid_preconception': 'Sɛ wopɛ abofra foforɔ a, fi ase nom folic acid aduru da biara fi seesei.',
    'med.iron_treatment': 'Wo mogya ayɛ mmerɛ. Nom wo mogya aduru da biara, sɛnea nɛɛse no ka no. Di adua, kosua ne ahabammono.',
    'med.iron_treatment.simple': 'Wo mogya ayɛ mmerɛ. Nom mogya aduru da biara.',
    'med.iron_folate': 'Nom mogya aduru baako da biara. Sɛ ɛhaw wo yafunu a, nom no anadwo ne aduane.',
    'med.iron_folate.simple': 'Nom mogya aduru baako da biara.',
    'med.iron_folate.after_birth': 'Kɔ so nom wo mogya aduru da biara kosi abosome 3 wɔ awoɔ akyi.',
    'med.folic_acid.after_birth': 'Kɔ so nom wo folic acid da biara. Mogya aduru biara nni hɔ gye sɛ wo dɔkota ka a.',
    'med.calcium': 'Nom wo calcium aduru da biara. Nom no bere foforɔ, ɛnyɛ bere a wonom mogya aduru no.',
    'med.calcium.simple': 'Nom calcium aduru da biara, ɛnyɛ ne mogya aduru no bere koro.',
    'med.aspirin': 'Nom aspirin aduru ketewa baako anadwo biara, sɛnea wo dɔkota ka no. Kɔ so nom no kosi sɛ wobɛwo abofra no.',
    'med.aspirin.simple': 'Nom wo aspirin ketewa no anadwo biara.',
    'med.iptp.later': 'Efi wo nyinsɛn bosome a ɛtɔ so anan no, wobɛnom atiridii (malaria) nnuro wɔ ayaresabea.',
    'med.iptp': 'Nom wo atiridii (malaria) nnuro wɔ ayaresabea bere biara a wobɛba. Ɛbɔ wo ne wo ba no ho ban.',
    'med.iptp.simple': 'Nom atiridii (malaria) nnuro wɔ ayaresabea bere biara a wobɛba.',
    'med.iptp.cotrimoxazole': 'Wo HIV aduru no bɔ wo ho ban fi atiridii (malaria) ho nso. Kɔ so da wo ntontom ntama no mu.',
    'med.deworming': 'Nom sonsono aduru baako wɔ ayaresabea bere a wo nyinsɛn bosome a ɛtɔ so mmiɛnsa atwam.',
    'med.art': 'Nom wo HIV aduru da biara, bere koro no ara. Ɛma wo ho yɛ wo dɛ na ɛbɔ wo ba no ho ban.',
    'med.art.simple': 'Nom wo HIV aduru da biara.',
    'med.art.after_birth': 'Nom wo HIV aduru da biara. {name} hia aduru ne nhwehwɛmu wɔ nnawɔtwe 6.',
    'med.diabetes_care': 'Di aduane kakra bere koro no ara da biara. Te nsa a asikyire wom so. Te aduane fitaa a ɛyɛ starch (white starch) so. Nantew da biara. Kɔ wo asikyire yareɛ ayaresabea nsrahwɛ.',
    'med.vitamin_a.first': '{name} bɛnya vitamin A aduru wɔ ayaresabea wɔ abosome 6. Ɛyɛ kwa.',
    'med.vitamin_a.repeat': '{name} nya vitamin A aduru wɔ ayaresabea abosome 6 biara. Ɛyɛ kwa.',

    // ---------- Tests ----------
    'test.hiv_syphilis_hbv': 'Yɛhwehwɛ HIV, syphilis ne hepatitis B mu de bɔ wo ne wo ba ho ban. Ayaresa no yɛ kwa.',
    'test.blood_level': 'Yɛbɛhwɛ wo mogya dodoɔ wɔ ayaresabea.',
    'test.genotype': 'Yɛbɛhwehwɛ wo mogya mu ahwɛ sickle cell.',
    'test.ultrasound': 'Ma wɔnyɛ wo ba no scan baako ansa na wo nyinsɛn bosome a ɛtɔ so nsia aduru.',
    'test.sugar': 'Wohia asikyire nhwehwɛmu wɔ ayaresabea wɔ nyinsɛn abosome 6 ne 7 ntam.',
    'test.infant_hiv': '{name} hia HIV aduru fi ne awoɔ da ne nhwehwɛmu wɔ nnawɔtwe 6.',

    // ---------- Vaccines ----------
    'imm.td': 'Kɔgye wo tetanus panee wɔ ayaresabea. Ɛbɔ wo ne wo ba no ho ban.',
    'imm.child_next.date': '{name} ahobammɔ panee (vaccines) da yɛ {date}. Ahobammɔ panee yɛ kwa. Fa ne panee krataa bra.',
    'imm.child_next.date.simple': '{name} ahobammɔ panee (vaccines): {date}. Ɛyɛ kwa.',
    'imm.child_next.now': '{name} ahobammɔ panee (vaccines) berɛ aduru seesei. Ahobammɔ panee yɛ kwa. Fa ne panee krataa bra.',
    'imm.child_next.now.simple': '{name} ahobammɔ panee (vaccines) berɛ aduru seesei. Ɛyɛ kwa.',

    // ---------- Common discomforts in pregnancy ----------
    'educ.symptom.nausea': 'Sɛ w’akoma tu a, di aduane kakra a ɛyɛ hyew-hyew a nsuo nni mu. Akakaduro tii boa.',
    'educ.symptom.heartburn': 'Sɛ wo koko hyew wo (heartburn) a, di aduane kakra. Nna fam ntɛm bere a wodidi wie.',
    'educ.symptom.leg_cramps': 'Sɛ wo nan ntini twitwa wo (cramps) a, tetew wo nan mu. Kɔ so nom wo calcium.',
    'educ.symptom.constipation': 'Sɛ w’agyanan yɛ den a, nom nsuo pii. Di nnuaba, nhabammono ne adua.',
    'educ.symptom.back_pain': 'Sɛ w’akyi yɛ wo ya a, yɛ apɔmuteteɛ brɛoo. Ntama a wɔde kyekyere yafunu betumi aboa.',
    'educ.substances': 'Nnom nsã, na nnom sigaret. Nnom kɔfe nkuruwa bɛboro 2 da koro.',
    'educ.caesarean_wound': 'Ma wo kuro no ho nte na ɛnwo. Bra ntɛm sɛ ayɛ kɔkɔɔ, nnyi rebɔ mu, anaa wo ho yɛ hyew a.',

    // ---------- Food ----------
    'nutr.iron_foods': 'Da biara, di {food1}. Di {food2} nso. Di {fruit} ka wo aduane ho. Eyi ma wo mogya yɛ den. Kɔ so nom wo mogya aduru nso.',
    'nutr.iron_foods.simple': 'Da biara, di {food1}. Di {fruit} nso.',
    'nutr.protein_calcium.one': 'Di aduane ketewa baako ka ho da biara. Da biara, di {food1}. Di {food2} nso.',
    'nutr.protein_calcium.one.simple': 'Di aduane ketewa baako ka ho da biara. Fa {food1} ka ho.',
    'nutr.protein_calcium.two': 'Di aduane ketewa mmienu ka ho da biara. Da biara, di {food1}. Di {food2} nso.',
    'nutr.protein_calcium.two.simple': 'Di aduane ketewa mmienu ka ho da biara. Fa {food1} ka ho.',
    'nutr.protein_calcium.feeding': 'Di aduane baako ka ho da biara bere a wo ma abofra nufu. Da biara, di {food1}. Di {food2} nso.',
    'nutr.protein_calcium.feeding.simple': 'Di aduane baako ka ho da biara. Fa {food1} ka ho.',
    'nutr.water': 'Nom nsuo kronkron bɛyɛ nkuruwa 8 da biara.',
    'nutr.water.feeding': 'Nom nsuo kuruwa baako bere biara a wo ma abofra nufu.',
    'nutr.first_foods.prepare': 'Wɔ abosome 6, {name} bɛfi ase adi aduane a edi kan. Kosi saa bere no, ma no nufusuo nko ara.',
    'nutr.first_foods.6_8': 'Ma {name} koko a emu yɛ duru ne {food}. Fa adua a woatwitwa, kosua ne ahabammono ka ho. Ma no aduane ketewa 2 kosi 3 da koro. Kɔ so ma no nufu.',
    'nutr.first_foods.6_8.simple': 'Koko a emu yɛ duru ne {food}, kosua ne adua, mpɛn 2 kosi 3 da koro. Kɔ so ma no nufu.',
    'nutr.first_foods.9_11': 'Ma {name} fie aduane a woatwitwa anaa woatwa no nketenkete, ne {food}. Fa adua, kosua ne ahabammono ka ho. Ma no aduane 3 kosi 4 da koro ne nnidiwa baako. Kɔ so ma no nufu.',
    'nutr.first_foods.9_11.simple': 'Fie aduane a woatwitwa, ne kosua ne adua, mpɛn 3 kosi 4 da koro. Kɔ so ma no nufu.',
    'nutr.first_foods.12_23': 'Ma {name} fie aduane ne {food}. Fa adua, kosua anaa nam, ne ahabammono ka ho. Ma no aduane 3 kosi 4 da koro ne nnidiwa 2. Kɔ so ma no nufu.',
    'nutr.first_foods.12_23.simple': 'Fie aduane ne kosua, adua ne ahabammono, mpɛn 3 kosi 4 da koro. Kɔ so ma no nufu.',

    // ---------- Rest and activity ----------
    'rest.itn': 'Da ntontom ntama a aduru wɔ mu no mu anadwo biara, afe mu nyinaa.',
    'rest.sleep_side': 'Efi seesei rekɔ, da wo nkyɛn so. Benkum nkyɛn na ɛyɛ papa sen biara. Sɛ wonyan na woda w’akyi so a, dan wo ho kɛkɛ.',
    'rest.sleep_side.simple': 'Da wo nkyɛn so, ɛnyɛ w’akyi so.',
    'rest.after_birth': 'Gye w’ahome bere a {name} da. Ma w’abusuafoɔ mmoa wo wɔ aduane noa ne ntade horo mu. Ma {name} nna n’akyi so, wɔ ntontom ntama mu.',
    'rest.after_birth.simple': 'Gye w’ahome bere a {name} da. Abofra no nna n’akyi so.',
    'activity.pregnancy': 'Nantew anaa yɛ adwuma a ɛnyɛ den da biara. Gye w’ahome bere a wo ho abrɛ wo. Nsoa nneɛma a emu yɛ duru.',

    // ---------- Birth preparation ----------
    'birth.hospital': 'Esiane w’apɔmuden nti, ɛsɛ sɛ wowo wo ba no wɔ ayaresabea. Yɛ nhyehyɛeɛ sɛnea wobɛduru hɔ, awia anaa anadwo.',
    'birth.hospital.simple': 'Ɛsɛ sɛ wowo wo ba no wɔ ayaresabea.',
    'birth.skilled': 'Awogyefoɔ (midwife) betumi asiw mogya bebree a ɛtu ano na wɔaboa abofra ma wahome. Obi a ɔboa wo betumi abɛka wo ho aba ayaresabea.',
    'birth.plan': 'Yɛ nhyehyɛeɛ seesei faako a wobɛwo. Yɛ nhyehyɛeɛ sɛnea wobɛduru hɔ anadwo. Kora kaa sika. Yi obi a ɔbɛka wo ho akɔ. Boaboa kotokuo ano a ntama a ɛho tew ne abofra ntadeɛ wom.',
    'birth.plan.simple': 'Yɛ nhyehyɛeɛ seesei ma faako a wobɛwo, kaa, ne awoɔ sika.',
    'birth.blood_donor': 'Yi w’abusuafoɔ baanu a wɔn ho yɛ den ma wɔnka wo ho. Wɔbetumi de mogya ama wo sɛ wohia a.',
    'birth.sha': 'Kyerɛw wo din wɔ SHA mu seesei na SHA atua wo awoɔ ka. Wontumi nkyerɛw wo din bere a awoɔ yea aba.',

    // ---------- Breastfeeding ----------
    'bf.prepare': 'Ma wo ba no nufu wɔ dɔnhwerew a edi kan no mu wɔ awoɔ akyi. Nufusuo a edi kan a ɛyɛ akokɔsradeɛ no yɛ papa ma abofra no yiye. Ma no nufusuo nko ara abosome 6.',
    'bf.prepare.simple': 'Ma abofra nufu wɔ dɔnhwerew a edi kan mu. Nufusuo nko ara abosome 6.',
    'bf.only_breast_milk': 'Ma {name} nufusuo nko ara kosi abosome 6. Mma no nsuo, mma no koko, mma no abibiduru. Nufusuo mu wɔ nsuo a abofra hia nyinaa.',
    'bf.only_breast_milk.simple': 'Ma {name} nufusuo nko ara. Mma no nsuo, mma no koko.',
    'bf.latch': 'Fa {name} bɛn wo, ne yafunu ne wo yafunu hyia. Twɛn kosi sɛ obue n’ano kɛse. Afei fa abofra no to nufu no so. Nufu ma nyɛ wo ya.',
    'bf.latch.simple': 'Abofra yafunu ne wo yafunu nhyia. Twɛn na obue n’ano kɛse, afei ma no nufu.',
    'bf.more_milk': 'Ma {name} nufu mpɛn pii, anyɛ yiye koraa mpɛn 8 da koro, ne anadwo nso. Fa wo ba no to wo honam so, honam ne honam. Sɛ ɔfefe nufu pii a, nufusuo dɔɔso. Moringa nhaban wɔ nkwan mu betumi aboa.',
    'bf.more_milk.simple': 'Ma no nufu mpɛn pii, awia ne anadwo. Sɛ ɔfefe pii a, nufusuo dɔɔso.',
    'bf.continue': 'Kɔ so ma {name} nufu ka aduane foforɔ ho, kosi mfeɛ 2 anaa nea ɛboro saa.',

    // ---------- Baby care ----------
    'baby.cord_gel': 'Fa ayaresabea aduru (gel) no fa {name} funuma so prɛko da koro, nna 7. Mmfa biribi foforɔ biara ngu funuma no so. Ma ne ho nte na ɛnwo.',
    'baby.cord_gel.simple': 'Funuma: ayaresabea aduru (gel) prɛko da koro, nna 7. Biribi foforɔ biara nni hɔ.',
    'baby.cord_dry': 'Ma {name} funuma ho nte na ɛnwo. Mmfa hwee ngu so.',
    'baby.skin_to_skin': 'Fa {name} to wo koko so, a ntadeɛ biara nni mo ntam, wɔ wo ntama mu. Yɛ saa nnɔnhwerew pii, awia ne anadwo. W’abusuafoɔ betumi asesa wo.',
    'baby.skin_to_skin.simple': 'Fa {name} to wo koko so, honam ne honam, awia ne anadwo.',
    'baby.skin_to_skin.continue': 'Kɔ so fa {name} to wo honam so, honam ne honam, sɛnea wobɛtumi.',
    'baby.warm': 'Ma {name} ho nyɛ hyew: fa kyɛw hyɛ no, na fa ntadeɛ baako ka ho sen nea wohyɛ. Fa wo ba no to wo honam so, honam ne honam.',
    'baby.warm.simple': 'Ma {name} ho nyɛ hyew. Fa wo ba no to wo honam so, honam ne honam.',
    'baby.safe_sleep': 'Ma {name} nna n’akyi so. Fa ntontom ntama di dwuma. Nkata n’anim.',
    'baby.weigh.monthly': 'Fa {name} bra ma wɔnkari ne mu duru bosome biara.',
    'baby.weigh.fortnightly': 'Fa {name} bra ma wɔnkari ne mu duru nnawɔtwe 2 biara.',

    // ---------- After-birth visits ----------
    'visit.after_birth.done': 'Wɔhwɛɛ wo {date}.',
    'visit.after_birth.due': 'Apɔmuden nhwehwɛmu ma wo ne {name}: {date}.',
    'visit.bp_after_birth': 'Yɛbɛsusu wo blood pressure nsrahwɛ biara mu. Tipae anaa w’ani a ɛnhu adeɛ yie: kɔ ayaresabea seesei ara.',

    // ---------- Family planning ----------
    'fp.plan_ahead': 'Dwene seesei fa abusua nhyehyɛeɛ ho wɔ abofra yi akyi. Wo nipadua hia ahomegyeɛ ansa na nyinsɛn foforɔ aba.',
    'fp.after_birth': 'Yi abusua nhyehyɛeɛ kwan bi ansa na nnawɔtwe 6 atwam. Sɛ wotwɛn mfeɛ 2 ansa na woanya abofra foforɔ a, ɛma obiara ho yɛ den.',
    'fp.after_birth.simple': 'Yi abusua nhyehyɛeɛ ansa na nnawɔtwe 6 atwam.',
    'fp.spacing': 'Fa abusua nhyehyɛeɛ di dwuma na wo nipadua agye n’ahome mfeɛ 2 ansa na abofra foforɔ aba.',
    'fp.timing': 'Yɛ nhyehyɛeɛ bere a wopɛ wo ba a ɔdi hɔ. Abusua nhyehyɛeɛ yɛ kwa wɔ ayaresabea. Sɛ wo bosome akyɛ a, bra ma wɔnhwɛ wo.',

    // ---------- Mind and mood ----------
    'mh.screen.pregnancy': 'Yɛbɛbisa wo nsɛmmisa kakra fa sɛnea wo tirim te. Maamenom bebree nya awerɛhoɔ. Mmoa wɔ hɔ.',
    'mh.screen.after_birth': 'Yɛbɛbisa wo sɛnea wo tirim te nnansa yi. Maamenom foforɔ bebree nya awerɛhoɔ. Wobetumi ne yɛn akasa.',
    'mh.support': 'Awerɛhoɔ yɛ adeɛ a ɛtaa ba, na sɛ wɔboa wo a, ɛyɛ yie. Momma yɛnhyia nnawɔtwe biara nkasa. Woyɛ ɛna pa.',
    'mh.support.simple': 'Awerɛhoɔ taa ba. Yɛbɛhyia nnawɔtwe biara akasa.',
    'mh.check_in': 'Maame, wo ho te sɛn? Wobetumi aka akyerɛ yɛn sɛ wo werɛ ahow anaa wo ho nni wo a. Mmoa wɔ hɔ.',

    // ---------- Family ----------
    'family.partner': 'Srɛ wo kunu anaa w’abusuafoɔ ma wɔmmoa wo wɔ fie nnwuma mu. Srɛ wɔn ma wɔnsua asiane nsɛnkyerɛnne no nso.',
    'family.young_mother': 'Ɛnyɛ wo nko ara. Sɛ wopɛ a, fa obi a wo ho to no so bra wo nsrahwɛ.',
    'family.omugwo_carer': 'Srɛ nana baa a ɔboa wo no ma ɔnsua asiane nsɛnkyerɛnne no. Ɔbetumi afrɛ yɛn sɛ ne ho nni no wɔ wo anaa {name} ho a.',

    // ---------- Traditional practices ----------
    'trad.ask_local': 'Ka amammerɛ a w’abusua di so kyerɛ yɛn. Ebi pii yɛ papa, na yɛbetumi aboa wo wɔ nkaeɛ no ho.',
    'trad.omugwo': 'Omugwo yɛ nhyira. Ma obi a ɔboa wo no nsua asiane nsɛnkyerɛnne no nso. Ma abofra no nufusuo nko ara.',
    'trad.hot_water_compress': 'Tawul a ɛyɛ hyew kakra wɔ w’akyi ne wo yafunu so yɛ. Di kan sɔ hwɛ wɔ wo nsa ntini so. Ɛsɛ sɛ ɛyɛ hyew kakra, ɛnyɛ hyew dodo.',
    'trad.wankan_jego': 'Ma wo ho nyɛ hyew na gye w’ahome. Fa kanwa kakra nko ara. Home yɛ den ma wo, anaa wo nan ahono? Kɔ ayaresabea nnɛ.',
    'trad.pap_ogi': 'Koko yɛ ma wo. Fa nkateɛ a wɔayam, apataa anaa kosua ka ho na ɛnyɛ den. Abofra no nom nufusuo nko ara kosi abosome 6.',
    'trad.pepper_soup': 'Mmɔkono nkwan a nam wom yɛ aduane pa ma wo. Di no ka aduane foforɔ ho, na nom nsuo pii.',
    'trad.moringa': 'Moringa nhaban wɔ wo nkwan mu yɛ, na ebetumi aboa ma wo nufusuo adɔɔso. Sɛ wo ma abofra no nufu mpɛn pii a, ɛno na ɛboa kɛse.',
    'trad.galactagogue_leaves': 'Sɛ wo ma abofra nufu mpɛn pii a, ɛno ne kwan pa a wobɛnya nufusuo pii. Bisa yɛn ansa na woanom nhaban tii biara.',
    'trad.agbo': 'Yɛsrɛ wo, ka abibiduru biara a wonom kyerɛ yɛn. Mmfa agbo nsi wo ayaresabea nnuro anan mu. Nnom abibiduru mfa mfi awoɔ yea ase.',
    'trad.labour_herbs': 'Yɛsrɛ wo, nnom abibiduru mfa mfi awoɔ yea ase anaa mfa mma ɛnkɔ ntɛm. Ebetumi apira wo ne abofra no. Kɔ ayaresabea bere a awoɔ yea fi ase.',
    'trad.nzu_clay': 'Sɛ w’akɔnnɔ kɔ dɔteɛ so a, ebetumi akyerɛ sɛ wo mogya ayɛ mmerɛ. Ma yɛnhwɛ wo mogya. Sɔ akakaduro anaa nkateɛ a wɔatoto hwɛ mmom.',
    'trad.food_taboo_protein': 'Kosua, nam ne adua ma wo ne wo ba mogya a ɛyɛ den. Ɛmma awoɔ nyɛ den.',
    'trad.eating_less': 'Didi yie. Abofra a ne ho yɛ den ne awogyefoɔ a ɔnim n’adwuma ma awoɔ yɛ dwoodwoo. Aduane a wobɛte so remma saa.',
    'trad.food_taboo_minor': 'Wobetumi agyae saa nnuane yi. Di adua, kosua, nam anaa apataa da biara mmom.',
    'trad.colostrum_discard': 'Nufusuo a edi kan a ɛyɛ akokɔsradeɛ no ne wo ba aduru a edi kan. Ma wo ba no ne nyinaa, fi dɔnhwerew a edi kan no mu.',
    'trad.prelacteal_feeds': 'Nufusuo mu wɔ nsuo a wo ba hia nyinaa, bere mpo a ewim yɛ hyew. Nsuo, glucose anaa abibiduru biara nni hɔ ansa na abosome 6 aduru.',
    'trad.early_complementary': 'Sɛ ɛte sɛ ɔkɔm de wo ba a, ma no nufu mpɛn pii sen kan. Fi aduane foforɔ ase wɔ abosome 6.',
    'trad.cord_substances': 'Mmfa hwee ngu funuma so gye ayaresabea aduru (gel) no. Ma ne ho nte na ɛnwo. Bra ntɛm sɛ ayɛ kɔkɔɔ anaa ɛbɔ hua a.',
    'trad.uvulectomy': 'Yɛsrɛ wo, mma obiara ntwa biribi wɔ wo ba mene mu. Sɛ wo ba bɔ wa anaa ɔnnum nufu a, bra ayaresabea.',
    'trad.baby_massage_shea': 'Sɛ wode nkuto a ɛho tew sra abofra no brɛoo a, ɛyɛ. Mmfa nka funuma no. Yɛ no brɛoo wɔ ne nsa ne ne nan ho.',
    'trad.postpartum_confinement': 'Ahomegyeɛ yɛ ma wo. Wo apɔmuden odwumayɛni betumi aba abɛsra wo wɔ fie. Wo ba no da so hia ahobammɔ panee (vaccines) wɔ ne bere mu.',
    'trad.abdominal_binder': 'Sɛ wokyekyere wo yafunu de boa wo a, ɛnyɛ bɔne. Kyekyere no brɛoo, nkyekyere no den.',
    'trad.back_carrying': 'Sɛ wo wo ba no wɔ w’akyi a, ɛyɛ. Nkata n’anim, na ama watumi ahome.',
    'trad.ginger_nausea': 'Akakaduro tii yɛ ma akoma tu wɔ nyinsɛn mfiaseɛ. Sɛ nsuo mpo ntena wo yafunu mu a, bra ayaresabea.',
    'trad.tba_birth': 'Ɔbaa a ɔboa wo awoɔ mu no betumi aka wo ho aba ayaresabea. Awogyefoɔ a ɔwɔ ayaresabea betumi asiw mogya bebree a ɛtu ano. Amammerɛ awogyefoɔ ntumi nyɛ saa.',
    'trad.bleeding_home_remedies': 'Mogya bebree a ɛtu wo awoɔ akyi yɛ asiane kɛse. Kɔ ayaresabea seesei ara. Ntwɛn abibiduru.',
  },
  glossary: {
    ...monthGlossary('{d} {m}', EN_MONTHS),
    'the baby': 'abofra no',
    'your baby': 'wo ba',
    'a fruit': 'aduaba baako',
    'a cup of cooked beans': 'adua a wɔanoa kuruwa baako',
    'two handfuls of cooked green leaves': 'ahabammono a wɔanoa nsa ma mmienu',
    'two handfuls of kontomire': 'kontomire nsa ma mmienu',
    'two handfuls of cooked ayoyo or alefi': 'ayoyo anaa alefi a wɔanoa nsa ma mmienu',
    'a bowl of koko with groundnut': 'koko a nkateɛ wom kyɛnsee baako',
    'a handful of small dried fish': 'apataa nketewa a wɔahata nsa ma baako',
    'a bowl of agushie or groundnut soup': 'agushie nkwan anaa nkatenkwan kyɛnsee baako',
    'one egg': 'kosua baako',
    'a bowl of palm-nut soup': 'abɛnkwan kyɛnsee baako',
    'a slice of pawpaw or a mango': 'bɔfrɛ asinasin baako anaa mango baako',
    'a handful of moringa leaves in your soup': 'moringa nhaban nsa ma baako wɔ wo nkwan mu',
    'a cup of milk or a piece of wagashi': 'nufusuo kuruwa baako anaa wagashi asinasin baako',
    'a piece of liver, chicken or fish': 'berɛboɔ, akokɔ nam anaa apataa asinasin baako',
    'a handful of groundnuts': 'nkateɛ nsa ma baako',
    'a piece of fish': 'apataa asinasin baako',
    'groundnut or soy': 'nkateɛ anaa soya',
  },
  sources: [{ label: 'Machine draft by the Gaskin build team, 2026; awaiting review by Twi-speaking midwives' }],
};
