import type { Citation } from '../types';

/**
 * Every source the knowledge base and rules engine cite. URLs come from the
 * Gaskin research notes (Nov 2026). Where a primary national document could not
 * be retrieved, the label says which secondary source describes it.
 */
const list: Citation[] = [
  // ---- WHO antenatal care 2016 (labels follow the guideline's recommendation numbers) ----
  { id: 'who-anc-2016', label: 'WHO ANC recommendations for a positive pregnancy experience, 2016', url: 'https://www.who.int/news/item/07-11-2016-new-guidelines-on-antenatal-care-for-a-positive-pregnancy-experience' },
  { id: 'who-anc-2016-e7', label: 'WHO ANC 2016, rec. E.7: eight-contact model (recommended)', url: 'https://content.sph.harvard.edu/wwwhsph/sites/2413/2018/02/ANC-OverviewBriefer-letter.pdf' },
  { id: 'who-anc-2016-a1', label: 'WHO ANC 2016, rec. A.1.1: healthy eating and physical activity (recommended)', url: 'https://content.sph.harvard.edu/wwwhsph/sites/2413/2018/02/ANC-OverviewBriefer-letter.pdf' },
  { id: 'who-anc-2016-a13', label: 'WHO ANC 2016, rec. A.1.2–A.1.3: energy and protein in undernourished women (context-specific)', url: 'https://content.sph.harvard.edu/wwwhsph/sites/2413/2018/02/ANC-OverviewBriefer-letter.pdf' },
  { id: 'who-anc-2016-a21', label: 'WHO ANC 2016, rec. A.2.1: daily iron 30–60 mg + folic acid 400 µg (recommended)', url: 'https://content.sph.harvard.edu/wwwhsph/sites/2413/2018/02/ANC-OverviewBriefer-letter.pdf' },
  { id: 'who-anc-2016-a3', label: 'WHO ANC 2016, rec. A.3: calcium 1.5–2 g/day where dietary calcium is low (context-specific)', url: 'https://content.sph.harvard.edu/wwwhsph/sites/2413/2018/02/ANC-OverviewBriefer-letter.pdf' },
  { id: 'who-anc-2016-b11', label: 'WHO ANC 2016, rec. B.1.1: anaemia testing by FBC or haemoglobinometer', url: 'https://content.sph.harvard.edu/wwwhsph/sites/2413/2018/02/ANC-OverviewBriefer-letter.pdf' },
  { id: 'who-anc-2016-b13', label: 'WHO ANC 2016, rec. B.1.3: clinical enquiry about intimate partner violence (context-specific)', url: 'https://content.sph.harvard.edu/wwwhsph/sites/2413/2018/02/ANC-OverviewBriefer-letter.pdf' },
  { id: 'who-anc-2016-b14', label: 'WHO ANC 2016, rec. B.1.4: hyperglycaemia in pregnancy, WHO 2013 criteria', url: 'https://content.sph.harvard.edu/wwwhsph/sites/2413/2018/02/ANC-OverviewBriefer-letter.pdf' },
  { id: 'who-anc-2016-b15', label: 'WHO ANC 2016, rec. B.1.5–B.1.6: ask about tobacco, alcohol and substances', url: 'https://content.sph.harvard.edu/wwwhsph/sites/2413/2018/02/ANC-OverviewBriefer-letter.pdf' },
  { id: 'who-anc-2016-b17', label: 'WHO ANC 2016, rec. B.1.7: provider-initiated HIV testing (recommended)', url: 'https://content.sph.harvard.edu/wwwhsph/sites/2413/2018/02/ANC-OverviewBriefer-letter.pdf' },
  { id: 'who-anc-2016-b21', label: 'WHO ANC 2016, rec. B.2.1: ask about fetal movements at each contact', url: 'https://content.sph.harvard.edu/wwwhsph/sites/2413/2018/02/ANC-OverviewBriefer-letter.pdf' },
  { id: 'who-anc-2016-b24', label: 'WHO ANC 2016, rec. B.2.4: one ultrasound before 24 weeks (recommended)', url: 'https://content.sph.harvard.edu/wwwhsph/sites/2413/2018/02/ANC-OverviewBriefer-letter.pdf' },
  { id: 'who-anc-2016-c4', label: 'WHO ANC 2016, rec. C.4: deworming after the first trimester (context-specific)', url: 'https://content.sph.harvard.edu/wwwhsph/sites/2413/2018/02/ANC-OverviewBriefer-letter.pdf' },
  { id: 'who-anc-2016-c5', label: 'WHO ANC 2016, rec. C.5: tetanus toxoid by vaccination history (recommended)', url: 'https://content.sph.harvard.edu/wwwhsph/sites/2413/2018/02/ANC-OverviewBriefer-letter.pdf' },
  { id: 'who-anc-2016-c6', label: 'WHO ANC 2016, rec. C.6: IPTp-SP from the second trimester, ≥1 month apart, ≥3 doses (context-specific)', url: 'https://content.sph.harvard.edu/wwwhsph/sites/2413/2018/02/ANC-OverviewBriefer-letter.pdf' },
  { id: 'who-anc-2016-d', label: 'WHO ANC 2016, recs D.1–D.6: common physiological symptoms (recommended)', url: 'https://content.sph.harvard.edu/wwwhsph/sites/2413/2018/02/ANC-OverviewBriefer-letter.pdf' },
  { id: 'who-anc-nutrition-2018', label: 'MCSP and WHO ANC Nutrition Brief, 2018', url: 'https://www.childhealthtaskforce.org/sites/default/files/2018-11/MCSP%20and%20WHO_ANC%20Nutrition%20Brief_4.2018.pdf' },
  { id: 'who-mip-anc-brief', label: 'Malaria in pregnancy ANC brief (IPTp-SP)', url: 'https://EndMalaria.org/sites/default/files/MIP-ANC-BRIEF-English-final-2.pdf' },

  // ---- WHO other maternal guidance ----
  { id: 'who-aspirin-2021', label: 'WHO 2021: low-dose aspirin for women at high risk of pre-eclampsia (context-specific, moderate certainty)', url: 'https://bigg-rec.bvsalud.org/en/recommendations/762d64c70e1051be68b26bca8b01ce920b0951f0' },
  { id: 'who-pe-2011', label: 'WHO recommendations for prevention and treatment of pre-eclampsia and eclampsia, 2011', url: 'https://www.who.int/publications/i/item/9789241548335' },
  { id: 'perinatology-pe-criteria', label: 'Pre-eclampsia risk criteria and aspirin dosing across USPSTF, ACOG, NICE (secondary summary)', url: 'https://perinatology.com/Reference/OBRx/Preeclampsia.htm' },
  { id: 'iadpsg-gdm', label: 'IADPSG / WHO 2013 GDM thresholds on 75 g OGTT (review summary)', url: 'https://nutrition-evidence.com/article/147897/diagnostic-criteria-for-gestational-diabetes-mellitus' },
  { id: 'who-scd-2025', label: 'WHO guideline on sickle cell disease in pregnancy, June 2025', url: 'https://www.who.int/news/item/19-06-2025-who-issues-first-global-guideline-to-improve-pregnancy-care-for-women-with-sickle-cell-disease' },
  { id: 'who-scd-2025-summary', label: 'AlignMNH summary of the WHO 2025 SCD-in-pregnancy guideline (folic acid, iron, scans)', url: 'https://www.alignmnh.org/?p=22114' },
  { id: 'who-malaria-first-trimester-2022', label: 'WHO Nov 2022: artemether-lumefantrine for malaria in the first trimester', url: 'https://severemalaria.org/node/1964' },
  { id: 'who-ifa-2012', label: 'WHO 2012 guideline: daily iron and folic acid supplementation in pregnant women (treatment of anaemia)', url: 'https://www.who.int/publications/i/item/9789241501996' },
  { id: 'who-cf-principles-2003', label: 'WHO/PAHO 2003: guiding principles for complementary feeding of the breastfed child (meal frequency, texture)', url: 'https://www.who.int/publications/i/item/9275124604' },
  { id: 'who-folic-periconception', label: 'WHO: periconceptional folic acid 400 µg daily to 12 weeks', url: 'https://www.who.int/tools/elena/interventions/folate-periconceptional' },
  { id: 'who-hiv-2021', label: 'WHO consolidated HIV guidelines (prevention, testing, treatment), 2021', url: 'https://www.who.int/publications/i/item/9789240031593' },
  { id: 'who-birth-spacing-2005', label: 'WHO technical consultation on birth spacing (WHO/RHR/07.1)', url: 'https://www.who.int/publications/i/item/WHO-RHR-07.1' },
  { id: 'who-sam-2009', label: 'WHO/UNICEF 2009: growth standards and identification of severe acute malnutrition (MUAC <115 mm)', url: 'https://www.who.int/publications/i/item/9789241598163' },
  { id: 'cronin-2019-sleep', label: 'Cronin et al., EClinicalMedicine 2019: going to sleep on the back after 28 weeks and late stillbirth (aOR 2.63)', url: 'https://pubmed.ncbi.nlm.nih.gov/31193832/' },
  { id: 'who-smart-anc-dak', label: 'WHO Digital Adaptation Kit for antenatal care (SMART Guidelines), 2021', url: 'https://www.who.int/publications/i/item/9789240020306' },
  { id: 'who-smart-anc-danger', label: 'WHO SMART ANC danger-sign value set (ANC.B5.DE48): any sign = urgent referral', url: 'https://build.fhir.org/ig/WorldHealthOrganization/smart-anc/ValueSet-anc-b5-de48-choices-grouper.html' },

  // ---- WHO postnatal care 2022 ----
  { id: 'who-pnc-2022', label: 'WHO recommendations on maternal and newborn care for a positive postnatal experience, 2022', url: 'https://www.who.int/publications/i/item/9789240045989' },
  { id: 'who-pnc-2022-rec1', label: 'WHO PNC 2022, rec. 1: maternal physiological assessment', url: 'https://e-lactancia.org/media/papers/WHO_recommendations_on_maternal_and_newborn_care_for_a_positive_postnatal_experience.pdf' },
  { id: 'who-pnc-2022-rec18', label: 'WHO PNC 2022, rec. 18: screen for postnatal depression and anxiety with a validated tool', url: 'https://e-lactancia.org/media/papers/WHO_recommendations_on_maternal_and_newborn_care_for_a_positive_postnatal_experience.pdf' },
  { id: 'who-pnc-2022-rec20', label: 'WHO PNC 2022, rec. 20: postpartum iron ± folic acid 6–12 weeks (context-specific)', url: 'https://e-lactancia.org/media/papers/WHO_recommendations_on_maternal_and_newborn_care_for_a_positive_postnatal_experience.pdf' },
  { id: 'who-pnc-2022-rec22', label: 'WHO PNC 2022, recs 22–23: postpartum physical activity', url: 'https://e-lactancia.org/media/papers/WHO_recommendations_on_maternal_and_newborn_care_for_a_positive_postnatal_experience.pdf' },
  { id: 'who-pnc-2022-rec24', label: 'WHO PNC 2022, rec. 24: postpartum contraception counselling', url: 'https://e-lactancia.org/media/papers/WHO_recommendations_on_maternal_and_newborn_care_for_a_positive_postnatal_experience.pdf' },
  { id: 'who-pnc-2022-rec25', label: 'WHO PNC 2022, rec. 25: newborn danger signs at every contact', url: 'https://e-lactancia.org/media/papers/WHO_recommendations_on_maternal_and_newborn_care_for_a_positive_postnatal_experience.pdf' },
  { id: 'who-pnc-2022-rec26', label: 'WHO PNC 2022, recs 26–28: newborn eye, hearing and jaundice screening', url: 'https://e-lactancia.org/media/papers/WHO_recommendations_on_maternal_and_newborn_care_for_a_positive_postnatal_experience.pdf' },
  { id: 'who-pnc-2022-rec30', label: 'WHO PNC 2022, rec. 30: delay the first bath to at least 24 hours', url: 'https://e-lactancia.org/media/papers/WHO_recommendations_on_maternal_and_newborn_care_for_a_positive_postnatal_experience.pdf' },
  { id: 'who-pnc-2022-rec32', label: 'WHO PNC 2022, rec. 32: clean dry cord care; 4% chlorhexidine where harmful substances are commonly applied', url: 'https://e-lactancia.org/media/papers/WHO_recommendations_on_maternal_and_newborn_care_for_a_positive_postnatal_experience.pdf' },
  { id: 'who-pnc-2022-rec33', label: 'WHO PNC 2022, rec. 33: newborn sleeps on the back', url: 'https://e-lactancia.org/media/papers/WHO_recommendations_on_maternal_and_newborn_care_for_a_positive_postnatal_experience.pdf' },
  { id: 'who-pnc-2022-rec34', label: 'WHO PNC 2022, rec. 34: immunise the newborn per the national schedule', url: 'https://e-lactancia.org/media/papers/WHO_recommendations_on_maternal_and_newborn_care_for_a_positive_postnatal_experience.pdf' },
  { id: 'who-pnc-2022-rec42', label: 'WHO PNC 2022, rec. 42: exclusive breastfeeding to 6 months', url: 'https://e-lactancia.org/media/papers/WHO_recommendations_on_maternal_and_newborn_care_for_a_positive_postnatal_experience.pdf' },
  { id: 'who-pnc-2022-rec44', label: 'WHO PNC 2022, rec. 44: at least four postnatal contacts (24 h, 48–72 h, 7–14 days, 6 weeks)', url: 'https://www.who.int/news/item/30-03-2022-who-urges-quality-care-for-women-and-newborns-in-critical-first-weeks-after-childbirth' },
  { id: 'who-pnc-2022-rec52', label: "WHO PNC 2022, rec. 52: men's involvement in postnatal care", url: 'https://e-lactancia.org/media/papers/WHO_recommendations_on_maternal_and_newborn_care_for_a_positive_postnatal_experience.pdf' },
  { id: 'who-pnc-model-2023', label: 'WHO postnatal care model, BMJ Global Health 2023 (extra contacts for higher-risk dyads)', url: 'https://gh.bmj.com/content/8/Suppl_2/e010992' },
  { id: 'who-psbi-2024', label: 'WHO 2024: serious bacterial infection in infants 0–59 days (7-sign algorithm)', url: 'https://www.ncbi.nlm.nih.gov/books/NBK610598/' },
  { id: 'who-kmc-2022', label: 'WHO 2022: immediate kangaroo mother care for preterm and low-birthweight babies', url: 'https://www.paho.org/en/news/15-11-2022-who-advises-immediate-skin-skin-care-survival-small-and-preterm-babies' },

  // ---- Infant and young child feeding ----
  { id: 'who-cf-2023', label: 'WHO guideline for complementary feeding of infants and young children 6–23 months, 2023', url: 'https://www.who.int/timorleste/publications/i/item/9789240081864' },
  { id: 'who-cf-2023-summary', label: 'ENN Field Exchange 72: summary of WHO 2023 complementary feeding guideline', url: 'https://ennonline.net/fex/72/who-guideline-for-complementary-feeding-of-infants-and-young-children' },
  { id: 'lactmed-moringa', label: 'LactMed (NIH): Moringa', url: 'https://pubmed.ncbi.nlm.nih.gov/30000959/' },
  { id: 'lactmed-fenugreek', label: 'LactMed (NIH): Fenugreek', url: 'https://pubmed.ncbi.nlm.nih.gov/30000838/' },
  { id: 'lactmed-coleus', label: 'LactMed (NIH): Coleus (torbangun)', url: 'https://pubmed.ncbi.nlm.nih.gov/30000934/' },
  { id: 'ammar-2025-moringa', label: 'Ammar et al., Foods 2025: systematic review of moringa RCTs for milk volume', url: 'https://pubmed.ncbi.nlm.nih.gov/40724308/' },
  { id: 'tahiru-2025-zimso', label: 'Tahiru et al., Int Breastfeed J 2025: millet–soya drink RCT, Tamale, Ghana', url: 'https://pubmed.ncbi.nlm.nih.gov/40855498/' },

  // ---- Perinatal mental health ----
  { id: 'epds-nigeria-adewuya', label: 'Adewuya et al.: EPDS validation in Nigerian women (≥10 any, ≥12 major depression)', url: 'https://www.mentalhealthdataprizeafrica.aphrc.org/repository/paper/35053/validation-of-the-edinburgh-postnatal-depression-scale-as-a-screening-tool-for-depression-in-late-pregnancy-among-nigerian-women' },
  { id: 'exponate-2019', label: 'Gureje et al., Br J Psychiatry 2019: EXPONATE trial, Ibadan (EPDS ≥12, stepped care)', url: 'https://core-prod.cambridgecore.org/core/product/35E0F1E403F89FAB0E15FDA0A5989486' },
  { id: 'who-thinking-healthy-2015', label: 'WHO Thinking Healthy manual (WHO/MSD/MER/15.1), 2015', url: 'https://www.hsph.harvard.edu/wp-content/uploads/sites/2413/2016/12/WHO_MSD_MER_15.1_eng.pdf' },
  { id: 'ppd-ilorin-2026', label: 'Postpartum depression in Ilorin, BMC Womens Health 2026 (prior depression, marital violence)', url: 'https://pubmed.ncbi.nlm.nih.gov/41840387/' },
  { id: 'peng-2026-support-meta', label: 'Peng et al., BMC Pregnancy Childbirth 2026: social support and perinatal depression meta-analysis (null pooled)', url: 'https://pubmed.ncbi.nlm.nih.gov/42420901/' },

  // ---- Nigeria ----
  { id: 'ng-mip-2018', label: 'MCSP Nigeria Malaria in Pregnancy Country Profile, 2018 (8 contacts adopted; IPTp policy)', url: 'https://www.mcsprogram.org/wp-content/uploads/dlm_uploads/2018/09/Nigeria-MIPCountryProfile.pdf' },
  { id: 'ng-nphcda-immunisation', label: 'NPHCDA routine immunisation schedule (Nigeria Immunization FHIR IG v0.9.0)', url: 'https://build.fhir.org/ig/Nigeria-FHIR-Community/NPHCDA-ImmunizationIG/health-interventions-recommendations.html' },
  { id: 'ng-standing-orders-2015', label: 'NPHCDA National Standing Orders for CHO/CHEW and JCHEW, 2015 (as described in Ajisegiri et al. 2023; primary text not retrieved)', url: 'https://www.frontiersin.org/articles/10.3389/fpubh.2023.1038062' },
  { id: 'ng-clip-2016', label: 'Sotunsa et al., Reprod Health 2016 (CLIP Nigeria): CHEW scope for pre-eclampsia', url: 'https://link.springer.com/content/pdf/10.1186/s12978-016-0218-9.pdf' },
  { id: 'ng-mgso4-training', label: 'Ishaku / Population Council 2015: MgSO4 in Nigerian primary care training', url: 'https://hsph.harvard.edu/wp-content/uploads/2015/12/Ishaku.pdf' },
  { id: 'ng-tsts-2025', label: 'Pathfinder 2025 TSTS progress brief: Nigeria task-shifting policy (FP, AMTSL, vitamin A)', url: 'https://www.pathfinder.org/wp-content/uploads/2025/11/2025_TSTS-Progress-Brief.pdf' },
  { id: 'ng-chx-strategy', label: 'FMoH National Strategy for Scale-up of Chlorhexidine 2016–2021 (7.1% gel, daily for 7 days, all birth settings), via case study', url: 'https://www.medrxiv.org/content/10.1101/2025.10.22.25338605.full.pdf' },
  { id: 'ng-ndhs-2024', label: 'Nigeria DHS 2023–24 Key Indicators Report (NPC/ICF)', url: 'https://dhsprogram.com/pubs/pdf/PR157/PR157.pdf' },
  { id: 'ng-bhcpf-2020', label: 'BHCPF 2020 Guidelines: maternal package (ANC, delivery, CS, PNC to 6 weeks)', url: 'https://nationalqoc.fmohconnect.gov.ng/wp-content/uploads/2023/07/BHCPF-2020-Guidelines.pdf' },
  { id: 'ng-mamii', label: 'MAMII: free emergency obstetric care and transport in 172 LGAs (FMINO, Sept 2026)', url: 'https://fmino.gov.ng/fg-flags-off-incentives-to-boost-maternal-newborn-care-utilisation-reduce-maternal-and-neonatal-mortality/' },
  { id: 'ng-traditional-medicine-policy', label: 'Nigeria Traditional Medicine Policy (FMoH)', url: 'https://policyvault.africa/?p=71299' },

  // ---- Kenya ----
  { id: 'ke-kepi', label: 'Kenya KEPI routine immunisation schedule incl. Nov 2025 changes (secondary study guide; confirm against MoH KEPI chart)', url: 'https://open-exam-prep.com/study-guides/ke-coc-pre-internship/child-nutrition-kepi-prevention/kepi-schedule-vaccine-logistics' },
  { id: 'ke-kdhs-2022', label: 'Kenya DHS 2022 (KNBS)', url: 'https://www.knbs.or.ke/kenya-demographic-and-health-survey-kdhs-2022/' },
  { id: 'ke-linda-jamii', label: 'SHA Linda Jamii maternity cover (registration before labour required)', url: 'https://www.the-star.co.ke/news/2025-06-21-duale-hails-linda-jamii-as-a-game-changer-in-maternal-health' },
  { id: 'ke-kalenjin-2017', label: "Riang'a et al., J Ethnobiol Ethnomed 2017: Kalenjin pregnancy food beliefs, Uasin Gishu", url: 'https://link.springer.com/content/pdf/10.1186/s13002-017-0157-8.pdf' },
  { id: 'ke-tba-2016', label: 'Maasai/Samburu TBA practices, Pan African Medical Journal 2016', url: 'https://www.panafrican-med-journal.com/content/series/25/2/13/full/' },

  // ---- Ghana ----
  { id: 'gh-ghs-immunisation', label: 'Ghana Health Service routine immunisation schedule', url: 'https://ghs.gov.gh/immunisation' },
  { id: 'gh-free-maternal-care', label: 'Ghana free maternal care under NHIS (BMC Health Serv Res 2024)', url: 'https://link.springer.com/10.1186/s12913-024-10661-5' },
  { id: 'gh-mch-record-book', label: 'Ghana Mother and Child Health Record Book (JICA, 2026)', url: 'https://www.jica.go.jp/english/jica_ri/news/interview/2026/1581366_70693.html' },
  { id: 'gh-gdhs-2022', label: 'Ghana DHS 2022 key indicators (MoH/GSS)', url: 'https://www.moh.gov.gh/wp-content/uploads/2023/06/GDHS-KIR-release-presentation_short.pdf' },
  { id: 'gh-herbal-2019', label: 'Peprah et al., BMC Complement Altern Med 2019: herbal use in pregnancy, Ghana', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC6419816' },
  { id: 'gh-food-taboo-2015', label: 'Arzoaquoi et al., J Ethnobiol Ethnomed 2015: food taboos in pregnancy, Ghana', url: 'https://hull-repository.worktribe.com/OutputFile/1798377' },

  // ---- Traditional practice studies ----
  { id: 'davidson-1974', label: 'Davidson et al., Bull WHO 1974: peripartum cardiac failure in Zaria (wankan jego hypothesis)', url: 'https://pubmed.ncbi.nlm.nih.gov/4549486/' },
  { id: 'adesanya-1991', label: 'Adesanya et al., Br Heart J 1991: salt and water overload in peripartum heart failure', url: 'https://pubmed.ncbi.nlm.nih.gov/1826604/' },
  { id: 'peace-2020', label: 'Karaye et al., ESC Heart Fail 2020 (PEACE registry): hot baths and kanwa-salted pap not significant for PPCM', url: 'https://pubmed.ncbi.nlm.nih.gov/31990449/' },
  { id: 'peace-selenium-2024', label: 'Karaye et al., West Afr J Med 2024: selenium deficiency and PPCM in Kano', url: 'https://pubmed.ncbi.nlm.nih.gov/38583094/' },
  { id: 'abegunde-2017-cord', label: 'Abegunde et al., BMC Pregnancy Childbirth 2017: cord care trends in Bauchi and Sokoto', url: 'https://pubmed.ncbi.nlm.nih.gov/29121870/' },
  { id: 'cochrane-chx-2026', label: 'Cochrane 2026 update: chlorhexidine cord care in LMICs', url: 'https://www.cochrane.org/about-us/news/simple-antiseptic-can-reduce-newborn-infections' },
  { id: 'omotosho-2025-shea', label: 'Omotosho et al., Case Rep Infect Dis 2025: shea butter on cord and omphalitis', url: 'https://pubmed.ncbi.nlm.nih.gov/41424753/' },
  { id: 'anyakorah-2025-cord', label: 'Anyakorah et al., BMC Pediatr 2025: Nigerian cord care practices (qualitative review)', url: 'https://pubmed.ncbi.nlm.nih.gov/39815231/' },
  { id: 'puhakka-2026-heat', label: "Puhakka et al., Front Med 2026: superficial heat for pain in women's health", url: 'https://pubmed.ncbi.nlm.nih.gov/42433975/' },
  { id: 'lin-2025-binder', label: 'Lin et al., Midwifery 2025: abdominal binder after caesarean, meta-analysis of 13 RCTs', url: 'https://pubmed.ncbi.nlm.nih.gov/39793406/' },
  { id: 'daramola-2026-pap', label: 'Daramola et al., BMC Microbiol 2026: B. cereus in ready-to-eat fermented foods, Osogbo', url: 'https://pubmed.ncbi.nlm.nih.gov/42437884/' },
  { id: 'onyemelukwe-2026-utazi', label: 'Onyemelukwe et al., J Appl Toxicol 2026: utazi extract in rats', url: 'https://pubmed.ncbi.nlm.nih.gov/40854564/' },
  { id: 'adeoye-2023-herbal', label: 'Adeoye & Etuk, BMC Complement Med Ther 2023: Ibadan Pregnancy Cohort, herbal use', url: 'https://pubmed.ncbi.nlm.nih.gov/36670404/' },
  { id: 'alhassan-2024-kaligutim', label: 'Alhassan et al., BMC Pregnancy Childbirth 2024: "kaligutim" labour herbs, Tamale', url: 'https://pubmed.ncbi.nlm.nih.gov/39198836/' },
  { id: 'herb-drug-2026', label: 'Curr Med Chem 2026: herb–drug interactions via CYP450', url: 'https://pubmed.ncbi.nlm.nih.gov/41764614/' },
  { id: 'ezemenahi-2023-pica', label: 'Ezemenahi et al., West Afr J Med 2023: pica in antenatal women, Anambra', url: 'https://pubmed.ncbi.nlm.nih.gov/37768267/' },
  { id: 'odesa-2026-clay', label: 'Odesa et al., Environ Geochem Health 2026: heavy metals in Nigerian geophagic clays', url: 'https://pubmed.ncbi.nlm.nih.gov/41739270/' },
  { id: 'ekwochi-2016-taboo', label: 'Ekwochi et al., J Ethnobiol Ethnomed 2016: food taboos in Enugu', url: 'https://pubmed.ncbi.nlm.nih.gov/26818243/' },
  { id: 'varela-2025-taboo', label: 'Varela et al., Cureus 2025: African scoping review of pregnancy food taboos', url: 'https://pubmed.ncbi.nlm.nih.gov/41439093/' },
  { id: 'agho-2016-prelacteal', label: 'Agho et al., Nutrients 2016: prelacteal feeding in Nigeria, DHS 2003–2013', url: 'https://pubmed.ncbi.nlm.nih.gov/27483309/' },
  { id: 'shittu-2026-jigawa', label: 'Shittu et al., Sci Rep 2026: early water and foods in Jigawa', url: 'https://pubmed.ncbi.nlm.nih.gov/41748805/' },
  { id: 'asaro-2023-colostrum', label: 'Asaro et al., BMC Nutr 2023: colostrum avoidance and prelacteal feeding', url: 'https://pubmed.ncbi.nlm.nih.gov/36691106/' },
  { id: 'uvulectomy-2026', label: 'Jaber Amin et al., PLoS One 2026: traditional uvulectomy and complications', url: 'https://pubmed.ncbi.nlm.nih.gov/42461928/' },
  { id: 'katz-2024-massage', label: 'Katz et al., BMJ Glob Health 2024: newborn oil massage cluster RCT, Nepal', url: 'https://pubmed.ncbi.nlm.nih.gov/38423547/' },
  { id: 'infant-massage-2022', label: 'Int J Environ Res Public Health 2022: infant massage systematic review', url: 'https://pubmed.ncbi.nlm.nih.gov/35681968/' },
  { id: 'iwuagwu-2024-omugwo', label: 'Iwuagwu, Innov Aging 2024: grandmothers and omugwo, south-east Nigeria', url: 'https://pubmed.ncbi.nlm.nih.gov/38577519/' },
  { id: 'costenbader-2025-bf', label: 'Costenbader et al., Matern Child Nutr 2025: family elders and breastfeeding in Nigeria', url: 'https://pubmed.ncbi.nlm.nih.gov/40528686/' },
  { id: 'support-ebf-2026', label: 'Nigerian Med J 2026: social support and exclusive breastfeeding review', url: 'https://pubmed.ncbi.nlm.nih.gov/42756483/' },
  { id: 'babywearing-2026', label: 'Lovell-Kennedy et al., BMJ Paediatr Open 2026: babywearing systematic review', url: 'https://pubmed.ncbi.nlm.nih.gov/42235974/' },
  { id: 'tba-2026', label: 'Yalley & Sanusi Gumbi, Front Glob Womens Health 2026: why women choose TBAs (Kano, Oyo)', url: 'https://pubmed.ncbi.nlm.nih.gov/42232019/' },
  { id: 'who-tm-strategy-2025', label: 'WHO Global Traditional Medicine Strategy 2025–2034', url: 'https://who.int/publications/i/item/9789240113176' },
];

export const CITATIONS: Record<string, Citation> = Object.fromEntries(list.map((c) => [c.id, c]));

/** Look up citations by id; throws on an unknown id so typos fail tests rather than ship. */
export function cite(...ids: string[]): Citation[] {
  return ids.map((id) => {
    const c = CITATIONS[id];
    if (!c) throw new Error(`Unknown citation id: ${id}`);
    return c;
  });
}
