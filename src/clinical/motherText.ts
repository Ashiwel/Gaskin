/**
 * Every mother-facing sentence the engine produces, as templates with {placeholders}.
 * This table is the English source for translation packs.
 *
 * Rules for this table:
 * - Plain everyday words. No clinical terms (say "blood tablet", "the first yellow milk", "first foods").
 * - One idea per sentence; fewer than 15 words a sentence.
 * - A key ending in '.simple' is the short version used when literacy is none or basic.
 * - Placeholders: {name} baby's name; {date} a short date; foods are household measures.
 */
export const MOTHER_TEXT: Record<string, string> = {
  // ---------- Antenatal visits ----------
  'visit.anc_next.booking': 'Come to the clinic soon for your first pregnancy check.',
  'visit.anc_next.overdue': 'You have missed a clinic check. Please come this week.',
  'visit.anc_next.date': 'Your next clinic visit is on {date}. Please come even if you feel well.',
  'visit.anc_next.date.simple': 'Next clinic visit: {date}.',
  'visit.anc_schedule': 'Your clinic dates are {dates}.',
  'visit.birth_notification': 'When your baby is born, call or send us a message that day. We will come to check you and the baby.',
  'visit.birth_notification.simple': 'When the baby comes, call us the same day.',
  'visit.scd_specialist': 'You need care from the sickle cell doctors as well as this clinic. Drink plenty of water and keep warm. Go to hospital the same day for pain, fever or hard breathing.',
  'visit.scd_specialist.simple': 'See the sickle cell doctor too. Pain or fever: go to hospital today.',

  // ---------- Danger signs ----------
  'danger.pregnancy': 'Go to the hospital at once if you bleed or have fits. Go at once for a bad headache or blurred eyes. Go at once for fever or strong belly pain. Go at once if water leaks or the baby moves less.',
  'danger.pregnancy.simple': 'Bleeding, fits, bad headache, fever, or baby moving less: go to hospital now.',
  'danger.postpartum': 'Go to the hospital at once if you bleed a lot. Go at once for fits, a bad headache or fever. Go at once for a bad smell from your private part. Go at once if breathing is hard or a leg is painful and swollen.',
  'danger.postpartum.simple': 'Heavy bleeding, fits, fever, or hard breathing: go to hospital now.',
  'danger.newborn': 'Go to the hospital now if {name} will not feed or has fits. Go now if {name} breathes fast or the chest pulls in. Go now if {name} feels hot, cold or very sleepy. Go now if the palms or feet look yellow.',
  'danger.newborn.simple': 'Not feeding, fits, fast breathing, hot or cold, very sleepy: go to hospital now.',
  'danger.child': 'Go to the clinic now if {name} cannot drink or vomits everything. Go now for fits, deep sleepiness or fast breathing.',
  'danger.child.simple': 'Cannot drink, fits, very sleepy, or fast breathing: go to the clinic now.',

  // ---------- Medicines in pregnancy ----------
  'med.folic_acid_high_dose': 'Take your folic acid tablet every day. Do not take blood tablets unless your doctor says so.',
  'med.folic_acid_high_dose.simple': 'Take folic acid every day. No blood tablets unless the doctor says.',
  'med.folic_acid_scd': 'Take your folic acid tablet every day. Do not take blood tablets unless your doctor says so.',
  'med.folic_acid_preconception': 'If you want another baby, start a folic acid tablet every day now.',
  'med.iron_treatment': 'Your blood is weak. Take your blood tablets every day, as the nurse says. Eat beans, eggs and green leaves.',
  'med.iron_treatment.simple': 'Your blood is weak. Take blood tablets every day.',
  'med.iron_folate': 'Take one blood tablet every day. If it upsets your stomach, take it at night with food.',
  'med.iron_folate.simple': 'Take one blood tablet every day.',
  'med.iron_folate.after_birth': 'Keep taking your blood tablet every day for 3 months after birth.',
  'med.folic_acid.after_birth': 'Keep taking your folic acid every day. No blood tablets unless your doctor says.',
  'med.calcium': 'Take your calcium tablets each day. Take them at a different time from your blood tablet.',
  'med.calcium.simple': 'Take calcium tablets each day, not with the blood tablet.',
  'med.aspirin': 'Take one small aspirin tablet each night, as your doctor says. Keep taking it until the baby is born.',
  'med.aspirin.simple': 'Take your small aspirin every night.',
  'med.iptp.later': 'From your fourth month, you will take malaria tablets at the clinic.',
  'med.iptp': 'Take your malaria tablets at the clinic at each visit. They protect you and your baby.',
  'med.iptp.simple': 'Take malaria tablets at the clinic each visit.',
  'med.iptp.cotrimoxazole': 'Your HIV medicine also protects you from malaria. Keep sleeping under your net.',
  'med.deworming': 'Take one worm tablet at the clinic after your third month.',
  'med.art': 'Take your HIV medicine every day, at the same time. It keeps you well and protects your baby.',
  'med.art.simple': 'Take your HIV medicine every day.',
  'med.art.after_birth': 'Take your HIV medicine every day. {name} needs medicine and a test at 6 weeks.',
  'med.diabetes_care': 'Eat small meals at regular times. Drink fewer sugary drinks. Eat less white starch. Walk every day. Go to your sugar clinic visits.',
  'med.vitamin_a.first': '{name} gets a vitamin A capsule at the clinic at 6 months. It is free.',
  'med.vitamin_a.repeat': '{name} gets a vitamin A capsule at the clinic every 6 months. It is free.',

  // ---------- Tests ----------
  'test.hiv_syphilis_hbv': 'We test for HIV, syphilis and hepatitis B to protect you and your baby. Treatment is free.',
  'test.blood_level': 'We will check your blood level at the clinic.',
  'test.genotype': 'We will test your blood for sickle cell.',
  'test.ultrasound': 'Have one scan of your baby before your sixth month.',
  'test.sugar': 'You need a sugar test at the clinic between 6 and 7 months.',
  'test.infant_hiv': '{name} needs HIV medicine from birth and a test at 6 weeks.',

  // ---------- Vaccines ----------
  'imm.td': 'Get your tetanus injection at the clinic. It protects you and your baby.',
  'imm.child_next.date': '{name}’s vaccines are due on {date}. Vaccines are free. Bring the vaccine card.',
  'imm.child_next.date.simple': '{name}’s vaccines: {date}. Free.',
  'imm.child_next.now': '{name}’s vaccines are due now. Vaccines are free. Bring the vaccine card.',
  'imm.child_next.now.simple': '{name}’s vaccines are due now. Free.',

  // ---------- Common discomforts in pregnancy ----------
  'educ.symptom.nausea': 'For sickness, eat small dry meals. Ginger tea helps.',
  'educ.symptom.heartburn': 'For heartburn, eat small meals. Do not lie down after eating.',
  'educ.symptom.leg_cramps': 'For cramps, stretch your legs. Keep taking your calcium.',
  'educ.symptom.constipation': 'For hard stool, drink more water. Eat fruit, vegetables and beans.',
  'educ.symptom.back_pain': 'For back pain, do gentle exercise. A support cloth can help.',
  'educ.substances': 'Do not drink alcohol or smoke. Have no more than 2 cups of coffee a day.',
  'educ.caesarean_wound': 'Keep your wound clean and dry. Come quickly if it is red, has pus, or you have fever.',

  // ---------- Food ----------
  'nutr.iron_foods': 'Each day, eat {food1}. Also eat {food2}. Eat {fruit} with your food. This makes your blood strong. Keep taking your blood tablets too.',
  'nutr.iron_foods.simple': 'Each day, eat {food1}. Eat {fruit} too.',
  'nutr.protein_calcium.one': 'Eat one extra small meal each day. Each day, eat {food1}. Also eat {food2}.',
  'nutr.protein_calcium.one.simple': 'Eat one extra small meal each day. Add {food1}.',
  'nutr.protein_calcium.two': 'Eat two extra small meals each day. Each day, eat {food1}. Also eat {food2}.',
  'nutr.protein_calcium.two.simple': 'Eat two extra small meals each day. Add {food1}.',
  'nutr.protein_calcium.feeding': 'Eat one extra meal each day while you breastfeed. Each day, eat {food1}. Also eat {food2}.',
  'nutr.protein_calcium.feeding.simple': 'Eat one extra meal each day. Add {food1}.',
  'nutr.water': 'Drink about 8 cups of clean water every day.',
  'nutr.water.feeding': 'Drink a cup of water each time you breastfeed.',
  'nutr.first_foods.prepare': 'At 6 months, {name} starts first foods. Keep giving only breast milk until then.',
  'nutr.first_foods.6_8': 'Give {name} thick porridge with {food}. Add mashed beans, egg and green leaves. Give 2 to 3 small meals a day. Keep breastfeeding.',
  'nutr.first_foods.6_8.simple': 'Thick porridge with {food}, egg and beans, 2 to 3 times a day. Keep breastfeeding.',
  'nutr.first_foods.9_11': 'Give {name} mashed or chopped family food with {food}. Add beans, egg and green leaves. Give 3 to 4 meals a day and a snack. Keep breastfeeding.',
  'nutr.first_foods.9_11.simple': 'Mashed family food with egg and beans, 3 to 4 times a day. Keep breastfeeding.',
  'nutr.first_foods.12_23': 'Give {name} family food with {food}. Add beans, egg or fish, and green leaves. Give 3 to 4 meals a day and 2 snacks. Keep breastfeeding.',
  'nutr.first_foods.12_23.simple': 'Family food with egg, beans and greens, 3 to 4 times a day. Keep breastfeeding.',

  // ---------- Rest and activity ----------
  'rest.itn': 'Sleep under a treated mosquito net every night, all year.',
  'rest.sleep_side': 'From now on, go to sleep lying on your side. The left side is best. If you wake on your back, just turn over.',
  'rest.sleep_side.simple': 'Sleep on your side, not your back.',
  'rest.after_birth': 'Rest when {name} sleeps. Let family help with cooking and washing. Put {name} to sleep on the back, under a net.',
  'rest.after_birth.simple': 'Rest when {name} sleeps. Baby sleeps on the back.',
  'activity.pregnancy': 'Walk or do light work every day. Rest when you are tired. Do not lift heavy loads.',

  // ---------- Birth preparation ----------
  'birth.hospital': 'Your baby should be born in the hospital, because of your health. Plan how you will get there, day or night.',
  'birth.hospital.simple': 'Your baby must be born in the hospital.',
  'birth.skilled': 'A midwife can stop heavy bleeding and help a baby breathe. Your helper can come with you to the clinic.',
  'birth.plan': 'Plan now where you will give birth. Plan how you will get there at night. Save money for transport. Choose who will go with you. Pack a bag with clean cloths and baby clothes.',
  'birth.plan.simple': 'Plan the place, the transport and the money for the birth now.',
  'birth.blood_donor': 'Choose two healthy family members to come with you. They can give blood if you need it.',
  'birth.sha': 'Register with SHA now so your birth is covered. You cannot register during labour.',

  // ---------- Breastfeeding ----------
  'bf.prepare': 'Put your baby to the breast in the first hour after birth. The first yellow milk is very good for the baby. Give only breast milk for 6 months.',
  'bf.prepare.simple': 'Breastfeed in the first hour. Only breast milk for 6 months.',
  'bf.only_breast_milk': 'Give {name} only breast milk until 6 months. No water, no pap, no herbs. Breast milk has all the water a baby needs.',
  'bf.only_breast_milk.simple': 'Only breast milk for {name}. No water, no pap.',
  'bf.latch': 'Bring {name} close, tummy to tummy. Wait for a wide-open mouth. Then bring the baby onto the breast. Feeding should not hurt.',
  'bf.latch.simple': 'Baby’s tummy to your tummy. Wait for a wide mouth, then feed.',
  'bf.more_milk': 'Feed {name} often, at least 8 times a day and at night. Hold your baby skin-to-skin. More sucking makes more milk. Moringa leaves in soup may help.',
  'bf.more_milk.simple': 'Feed often, day and night. More sucking makes more milk.',
  'bf.continue': 'Keep breastfeeding {name} along with other foods, until 2 years or more.',

  // ---------- Baby care ----------
  'baby.cord_gel': 'Put the clinic gel on {name}’s cord once a day for 7 days. Put nothing else on the cord. Keep it clean and dry.',
  'baby.cord_gel.simple': 'Cord: clinic gel once a day for 7 days. Nothing else.',
  'baby.cord_dry': 'Keep {name}’s cord clean and dry. Put nothing on it.',
  'baby.skin_to_skin': 'Hold {name} on your bare chest, inside your wrapper. Do this for many hours, day and night. Family members can take turns.',
  'baby.skin_to_skin.simple': 'Hold {name} skin-to-skin on your chest, day and night.',
  'baby.skin_to_skin.continue': 'Keep holding {name} skin-to-skin as much as you can.',
  'baby.warm': 'Keep {name} warm with a cap and one more layer than you wear. Hold your baby skin-to-skin.',
  'baby.warm.simple': 'Keep {name} warm. Hold your baby skin-to-skin.',
  'baby.safe_sleep': 'Put {name} to sleep on the back. Use a mosquito net. Keep the face uncovered.',
  'baby.weigh.monthly': 'Bring {name} to be weighed every month.',
  'baby.weigh.fortnightly': 'Bring {name} to be weighed every 2 weeks.',

  // ---------- After-birth visits ----------
  'visit.after_birth.done': 'Check done on {date}.',
  'visit.after_birth.due': 'Health check for you and {name}: {date}.',
  'visit.bp_after_birth': 'We will check your blood pressure at every visit. Headache or blurred eyes: go to hospital now.',

  // ---------- Family planning ----------
  'fp.plan_ahead': 'Think now about family planning after the baby. Your body needs rest before the next pregnancy.',
  'fp.after_birth': 'Choose a family planning method before 6 weeks. Waiting 2 years before the next baby keeps everyone healthier.',
  'fp.after_birth.simple': 'Choose family planning before 6 weeks.',
  'fp.spacing': 'Use family planning so your body rests 2 years before the next baby.',
  'fp.timing': 'Plan when you want your next baby. Family planning is free at the clinic. If your period is late, come for a check.',

  // ---------- Mind and mood ----------
  'mh.screen.pregnancy': 'We will ask you some questions about how you feel. Many mothers feel low. Help is available.',
  'mh.screen.after_birth': 'We will ask how you have been feeling. Many new mothers feel low. You can talk to us.',
  'mh.support': 'Feeling low is common, and it gets better with help. Let us meet each week to talk. You are a good mother.',
  'mh.support.simple': 'Feeling low is common. We will meet each week to talk.',
  'mh.check_in': 'How are you feeling? You can tell us if you feel sad or worried. Help is available.',

  // ---------- Family ----------
  'family.partner': 'Ask your partner or family to help with chores. Ask them to learn the danger signs too.',
  'family.young_mother': 'You are not alone. Bring someone you trust to your visits if you want.',
  'family.omugwo_carer': 'Ask the grandmother helping you to learn the danger signs. She can call us if she is worried about you or {name}.',

  // ---------- Traditional practices (library and plan) ----------
  'trad.ask_local': 'Tell us about the customs your family follows. Many are good, and we can help with the rest.',
  'trad.omugwo': 'Omugwo is a blessing. Let your helper learn the danger signs too. Keep the baby on breast milk only.',
  'trad.hot_water_compress': 'A warm towel on your back and tummy is fine. Test it on your wrist first. It should feel warm, not hot.',
  'trad.wankan_jego': 'Keep warm and rest. Use only a little kanwa salt. Is breathing hard, or are your legs swollen? Go to the hospital today.',
  'trad.pap_ogi': 'Pap is good for you. Add groundnut paste, crayfish or egg to make it stronger. Baby gets only breast milk until 6 months.',
  'trad.pepper_soup': 'Pepper soup with fish is good food for you. Eat it with other foods and drink plenty of water.',
  'trad.moringa': 'Moringa leaves in your soup are good and may help your milk. Feeding your baby often helps most.',
  'trad.galactagogue_leaves': 'Frequent breastfeeding is the best way to make more milk. Ask us before taking herb teas.',
  'trad.agbo': 'Please tell us any herbs you take. Do not use agbo instead of your clinic medicines. Do not take herbs to start labour.',
  'trad.labour_herbs': 'Please do not drink herbs to start or speed labour. They can hurt you and the baby. Go to the clinic when labour starts.',
  'trad.nzu_clay': 'Craving clay can mean your blood is weak. Let us check your blood. Try ginger or roasted groundnuts instead.',
  'trad.food_taboo_protein': 'Eggs, fish and beans give you and your baby strong blood. They do not make labour hard.',
  'trad.eating_less': 'Eat well. A healthy baby and a skilled midwife make birth safer. Eating less does not.',
  'trad.food_taboo_minor': 'You can skip these foods. Eat beans, eggs, fish or crayfish every day instead.',
  'trad.colostrum_discard': 'The first yellow milk is your baby’s first medicine. Give it all to your baby, starting in the first hour.',
  'trad.prelacteal_feeds': 'Breast milk has all the water your baby needs, even when it is hot. No water, glucose or herbs before 6 months.',
  'trad.early_complementary': 'If your baby seems hungry, breastfeed more often. Start other foods at 6 months.',
  'trad.cord_substances': 'Put nothing on the cord except the clinic gel. Keep it clean and dry. Come quickly if it turns red or smells.',
  'trad.uvulectomy': 'Please do not let anyone cut your baby’s throat. If your baby coughs or will not feed, come to the clinic.',
  'trad.baby_massage_shea': 'Gentle massage with clean shea butter is good. Keep it off the cord. Be gentle with arms and legs.',
  'trad.postpartum_confinement': 'Rest is good for you. Your health worker can visit you at home. Your baby still needs vaccines on time.',
  'trad.abdominal_binder': 'Tying your tummy for support is fine. Keep it comfortable, not tight.',
  'trad.back_carrying': 'Carrying your baby on your back is good. Keep the face uncovered so the baby can breathe.',
  'trad.ginger_nausea': 'Ginger tea is good for sickness in early pregnancy. If you cannot keep water down, come to the clinic.',
  'trad.tba_birth': 'Your birth helper can come with you to the clinic. A midwife can stop heavy bleeding. A traditional helper cannot.',
  'trad.bleeding_home_remedies': 'Heavy bleeding after birth is an emergency. Go to the hospital now. Do not wait for herbs.',

  // ---------- Alerts and referral items: what to tell her right now ----------
  'alert.go_now': 'Go to the hospital now. Do not wait.',
  'alert.go_today': 'Go to the clinic today.',
  'alert.eclampsia': 'You had a fit and your blood pressure is very high. This is dangerous for you and the baby. Go to the hospital now. Do not wait.',
  'alert.severe_pre_eclampsia': 'Your blood pressure is too high and went up quickly. This can hurt your liver, kidneys and the baby. Go to the hospital now. Do not wait.',
  'alert.severe_pre_eclampsia.urgent': 'Your blood pressure is too high, and there is protein in your urine. This can hurt you and the baby. Go to the hospital today.',
  'alert.hypertension': 'Your blood pressure is higher than it should be. We need to check it again today. Go to the clinic today.',
  'alert.check_bp_now': 'A bad headache, blurred eyes or a swollen face can mean high blood pressure. We need to check it today. Go to the clinic today.',
  'alert.convulsions': 'A fit is dangerous in pregnancy and after birth. Go to the hospital now. Do not wait.',
  'alert.vaginal_bleeding': 'Bleeding in pregnancy can be dangerous for you and the baby. Lie on your left side on the way. Go to the hospital now.',
  'alert.postpartum_haemorrhage': 'Heavy bleeding after birth is very dangerous. Bring someone who can give blood. Go to the hospital now. Do not wait.',
  'alert.puerperal_sepsis': 'Fever and a bad smell from your private part can mean infection inside. You need medicine. Go to the hospital now.',
  'alert.puerperal_sepsis.urgent': 'A bad smell from your private part can mean infection inside. You need medicine. Go to the clinic today.',
  'alert.maternal_fever': 'Fever can mean malaria or another infection. You need a test today. Go to the clinic today.',
  'alert.mastitis': 'A hot, painful breast with fever needs medicine. Keep feeding from both breasts. Go to the clinic today.',
  'alert.reduced_fetal_movement': 'The baby moving less can mean the baby is in trouble. We need to listen to the baby’s heart today. Go to the clinic today.',
  'alert.severe_abdominal_pain': 'Strong belly pain in pregnancy can be dangerous. Go to the hospital now. Do not wait.',
  'alert.ruptured_membranes': 'Water leaking means the bag around the baby has opened. It is too early. Go to the hospital now.',
  'alert.ruptured_membranes.urgent': 'Water leaking means the bag around the baby has opened. Go to your birth place now.',
  'alert.severe_vomiting': 'Vomiting everything can dry out your body. You may need a drip. Go to the clinic today.',
  'alert.post_term': 'Your baby is now late. Please call us today, or come to the clinic.',
  'alert.dvt': 'A painful, swollen leg can mean a blood clot. Do not rub the leg. Go to the hospital today.',
  'alert.dvt.emergency': 'A painful leg and hard breathing can mean a blood clot in the lungs. Go to the hospital now. Do not wait.',
  'alert.breathlessness': 'Hard breathing can mean a problem with your heart or lungs. Go to the hospital today.',
  'alert.breathlessness.emergency': 'Very hard breathing can mean a problem with your heart or lungs. Go to the hospital now. Do not wait.',
  'alert.self_harm': 'You are not alone, and you are not to blame. We want to help you today. Please stay with someone you trust.',
  'alert.depression': 'Feeling very low is an illness, not a weakness. It can be treated. We will help you see someone this week.',
  'alert.low_mood_screen': 'Many mothers feel low. It gets better with help. We will visit you this week to talk.',
  'alert.severe_anaemia': 'Your blood is very weak. This is dangerous if you bleed. You may need blood. Go to the hospital today.',
  'alert.moderate_anaemia': 'Your blood is weak. You need stronger blood tablets. Please see the nurse this week.',
  'alert.malaria_pregnancy': 'You have malaria. It can harm you and the baby. You need medicine today. Go to the clinic today.',
  'alert.scd_pathway': 'Because of sickle cell, you need extra care in pregnancy. Pain, fever or hard breathing: go to hospital that day.',
  'alert.newborn_danger': '{name} has a danger sign. Keep {name} warm on your chest on the way. Go to the hospital now. Do not wait.',
  'alert.child_danger': '{name} has a danger sign. Keep breastfeeding on the way if {name} can drink. Go to the hospital now.',
  'alert.child_fever': '{name} has fever. {name} needs a malaria test today. Go to the clinic today.',
  'alert.jaundice': '{name}’s skin or eyes look yellow. We need to check {name} today. Go to the clinic today.',
  'alert.cord_infection': '{name}’s cord looks red. It may be infected. Put nothing on it. Go to the clinic today.',
  'alert.child_diarrhoea': '{name} has watery stool. Keep breastfeeding. {name} may need medicine and a special drink. Go to the clinic today.',
  'alert.severe_malnutrition': '{name} is too thin. Special food from the clinic can help {name} grow. Go to the clinic this week.',
  'alert.fallback': 'We are worried about your health. Go to the clinic today.',
};

/** Fill {placeholders}. Throws on an unknown key so missing templates fail tests, not users. */
export function renderMotherText(key: string, params: Record<string, string | number> = {}): string {
  const t = MOTHER_TEXT[key];
  if (t === undefined) throw new Error(`Missing MOTHER_TEXT template: ${key}`);
  return t.replace(/\{(\w+)\}/g, (_, k: string) => (params[k] !== undefined ? String(params[k]) : `{${k}}`));
}
