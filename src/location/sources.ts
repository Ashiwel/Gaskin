import type { Citation } from '../types';

/**
 * Sources for the curated location profiles. Every food, facility and malaria
 * statement in profiles.ts points at one of these ids. Checked 5 Nov 2026.
 */
export const LOCATION_SOURCES: Record<string, Citation> = {
  // ---------- Nigeria ----------
  'wiki-benue': { id: 'wiki-benue', label: 'Benue State (Wikipedia): oranges, yams, mangoes, sesame, rice, cassava; over 70% of Nigeria\'s soybeans', url: 'https://en.wikipedia.org/wiki/Benue_State' },
  'benfruit': { id: 'benfruit', label: 'Benfruit Plant (Wikipedia): Benue produces over 1,000,000 t of citrus a year', url: 'https://en.wikipedia.org/wiki/Benfruit_Plant' },
  'freshplaza-benue-2025': { id: 'freshplaza-benue-2025', label: 'FreshPlaza, 27 Oct 2025: Benue to buy surplus oranges after price collapse (100 kg bag at ₦1,000 on farms)', url: 'https://www.freshplaza.com/europe/article/9778647/benue-state-to-buy-surplus-oranges-after-price-collapse' },
  'fmc-makurdi': { id: 'fmc-makurdi', label: 'Federal Medical Centre Makurdi, About us', url: 'https://fmcmakurdi.gov.ng/about-us/' },
  'wiki-bsuth': { id: 'wiki-bsuth', label: 'Benue State University Teaching Hospital (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Benue_State_University_Teaching_Hospital' },
  'wiki-kano': { id: 'wiki-kano', label: 'Kano State (Wikipedia): millet, cowpeas, sorghum, maize, rice; groundnuts, sesame, soybeans; Hausa and Fulfulde', url: 'https://en.wikipedia.org/wiki/Kano_State' },
  'wiki-kano-hospitals': { id: 'wiki-kano-hospitals', label: 'List of hospitals in Kano (Wikipedia)', url: 'https://en.wikipedia.org/wiki/List_of_hospitals_in_Kano' },
  'wiki-akth': { id: 'wiki-akth', label: 'Aminu Kano Teaching Hospital (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Aminu_Kano_Teaching_Hospital' },
  'leadership-kaduna': { id: 'leadership-kaduna', label: 'Leadership: Kaduna leads Nigeria in maize and ginger, second in tomatoes, third in soya (Commissioner for Agriculture, KadInvest 7.0)', url: 'https://leadership.ng/we-lead-in-maize-ginger-production-commissioner' },
  'kdsg-bdth': { id: 'kdsg-bdth', label: 'Kaduna State Ministry of Health: Barau Dikko Teaching Hospital', url: 'https://health.kdsg.gov.ng/barau-dikko-teaching-hospital/' },
  'wiki-abuth': { id: 'wiki-abuth', label: 'Ahmadu Bello University Teaching Hospital, Zaria (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Ahmadu_Bello_University_Teaching_Hospital' },
  'wiki-enugu': { id: 'wiki-enugu', label: 'Enugu State (Wikipedia): yams, rice, cocoyam, oil palm, cassava; UNTH; ESUTH (Park Lane)', url: 'https://en.wikipedia.org/wiki/Enugu_State' },
  'wiki-unth': { id: 'wiki-unth', label: 'University of Nigeria Teaching Hospital, Ituku-Ozalla (Wikipedia)', url: 'https://en.wikipedia.org/wiki/University_of_Nigeria_Teaching_Hospital' },
  'commodity-oyo': { id: 'commodity-oyo', label: 'Commodity Nigeria, Oyo State: maize, cassava, rice, yam, beans, cocoa, cashew; catfish and tilapia', url: 'https://commodity.ng/?p=935' },
  'wiki-adeoyo': { id: 'wiki-adeoyo', label: 'Adeoyo Hospital, Ibadan, formerly Adeoyo Maternity Hospital (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Adeoyo_Hospital' },
  'wiki-uch': { id: 'wiki-uch', label: 'University College Hospital, Ibadan (Wikipedia)', url: 'https://en.wikipedia.org/wiki/University_College_Hospital,_Ibadan' },
  'commodity-edo': { id: 'commodity-edo', label: 'Commodity Nigeria, Edo State: cassava, rice, maize, yam, plantain; oil palm, rubber, cocoa, cashew; riverine fish', url: 'https://commodity.ng/?p=887' },
  'wiki-ubth': { id: 'wiki-ubth', label: 'University of Benin Teaching Hospital, Benin City (Wikipedia)', url: 'https://en.wikipedia.org/wiki/University_of_Benin_Teaching_Hospital' },
  'commodity-delta': { id: 'commodity-delta', label: 'Commodity Nigeria, Delta State: cassava, yam, maize, rice, plantain; oil palm, rubber, pineapple, cocoa; fisheries', url: 'https://commodity.ng/?p=891' },
  'wiki-fmc-asaba': { id: 'wiki-fmc-asaba', label: 'Federal Medical Centre, Asaba (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Federal_Medical_Centre,_Asaba' },
  'wiki-delsuth': { id: 'wiki-delsuth', label: 'Delta State University Teaching Hospital, Oghara (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Delta_State_University_Teaching_Hospital' },
  'wiki-cross-river': { id: 'wiki-cross-river', label: 'Cross River State (Wikipedia): cocoyam, oil palm, yam, cocoa, cashews, plantain, fishing; Efik, Bekwarra, Ejagham', url: 'https://en.wikipedia.org/wiki/Cross_River_State' },
  'alozie-2018': { id: 'alozie-2018', label: 'Alozie YE, Ene-Obong HN. Afang soup (waterleaf and Gnetum africanum) recipe standardisation and nutrients. Food Chem 2018, PMID 28867103', url: 'https://doi.org/10.1016/j.foodchem.2016.12.071' },
  'wiki-ucth': { id: 'wiki-ucth', label: 'University of Calabar Teaching Hospital (Wikipedia)', url: 'https://en.wikipedia.org/wiki/University_of_Calabar_Teaching_Hospital' },
  'commodity-borno': { id: 'commodity-borno', label: 'Commodity Nigeria, Borno State: millet, sorghum, maize, rice, cowpea, groundnut, sesame, sweet potato; Lake Chad dried fish', url: 'https://commodity.ng/?p=854' },
  'wiki-borno': { id: 'wiki-borno', label: 'Borno State (Wikipedia): Kanuri and Shuwa Arabic; insurgency and acute food insecurity', url: 'https://en.wikipedia.org/wiki/Borno_State' },
  'wiki-umth': { id: 'wiki-umth', label: 'University of Maiduguri Teaching Hospital (Wikipedia)', url: 'https://en.wikipedia.org/wiki/University_of_Maiduguri_Teaching_Hospital' },
  'commodity-lagos': { id: 'commodity-lagos', label: 'Commodity Nigeria, Lagos State: cassava, maize, rice, vegetables; poultry; marine and fresh-water fish', url: 'https://commodity.ng/?p=931' },
  'wiki-lasuth': { id: 'wiki-lasuth', label: 'Lagos State University Teaching Hospital, Ikeja (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Lagos_State_University_Teaching_Hospital' },
  'wiki-luth': { id: 'wiki-luth', label: 'Lagos University Teaching Hospital, Idi-Araba (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Lagos_University_Teaching_Hospital' },
  'nmis-2021': { id: 'nmis-2021', label: 'Nigeria Malaria Indicator Survey 2021: 22% of children 6-59 months positive nationally; Lagos lowest (3%), Kebbi 49% (as reported 30 Nov 2022)', url: 'https://thefact.ng/?p=22180' },
  'ng-dhs-2023': { id: 'ng-dhs-2023', label: 'Nigeria DHS 2023-24 Key Indicators: 30% of women own a smartphone; internet use from 3% (Kebbi) to 72% (Lagos)', url: 'https://dhsprogram.com/pubs/pdf/SR294/SR294.pdf' },

  // ---------- Kenya ----------
  'ke-malaria-zones': { id: 'ke-malaria-zones', label: 'Kenya malaria epidemiological zones by county (Pulse Kenya, 25 Apr 2023, from the Kenya Malaria Strategy zoning)', url: 'https://www.pulse.co.ke/story/breakdown-of-top-malaria-risk-zones-in-kenya-by-county-world-malaria-day-2024072909324084405' },
  'ke-ca-ict-2024': { id: 'ke-ca-ict-2024', label: 'Communications Authority of Kenya (2024), ICT uptake from KDHS 2022: women\'s smartphone ownership Nairobi 71.7%, Turkana 13.0%', url: 'https://ca.go.ke/sites/default/files/2024-12/Analytical%20Report%20on%20Uptake%20of%20ICTs%20Using%202022%20Kenya%20Demographic%20and%20Health%20Survey.pdf' },
  'wessels-2023': { id: 'wessels-2023', label: 'Wessels L et al. Putting small fish on the table (dagaa/omena: a 30 g portion gives about 91% of calcium, 56% of iron and 61% of zinc reference intakes). Food Security 2023', url: 'https://doi.org/10.1007/s12571-023-01362-8' },
  'wiki-kisumu': { id: 'wiki-kisumu', label: 'Kisumu County (Wikipedia): fishing, sugarcane and rice; Dholuo; Jaramogi Oginga Odinga Teaching and Referral Hospital', url: 'https://en.wikipedia.org/wiki/Kisumu_County' },
  'lstm-jootrh': { id: 'lstm-jootrh', label: 'LSTM: Jaramogi Oginga Odinga Teaching and Referral Hospital serves more than 10 western Kenya counties', url: 'https://www.lstmed.ac.uk/jaramogi-oginga-odinga-teaching-and-referral-hospital-jootrh' },
  'makokha-2013': { id: 'makokha-2013', label: 'Makokha G (2013), African leafy vegetables (cowpea leaves, amaranth, spider plant, nightshade) grown in western Kenya, Maseno University', url: 'https://repository.maseno.ac.ke/handle/123456789/5075' },
  'wiki-kilifi': { id: 'wiki-kilifi', label: 'Kilifi County (Wikipedia): maize and cassava staples; coconuts, cashew, citrus, mangoes; fishing; one county referral hospital', url: 'https://en.wikipedia.org/wiki/Kilifi_County' },
  'peopledaily-kilifi-2023': { id: 'peopledaily-kilifi-2023', label: 'People Daily, 11 Apr 2023: Kilifi revives cassava farming to tame food insecurity', url: 'https://peopledaily.digital/news/kilifi-revives-cassava-farming-in-bid-to-tame-food-insecurity' },
  'cog-malindi-2026': { id: 'cog-malindi-2026', label: 'Council of Governors (2026): new maternity wing at Malindi Sub-County Hospital, Kilifi', url: 'https://maarifa.cog.go.ke/sites/default/files/2026-03/Kilifi%20County%20Strengthens%20Maternal%20and%20Referral%20Care%20with%20Modern%20Maternity%20Wing%20at%20Malindi%20Sub-County%20Hospital.pdf' },
  'lodwar-pamj-2026': { id: 'lodwar-pamj-2026', label: 'Gathii P et al. Hepatitis B at Lodwar County Referral Hospital, Turkana. Pan Afr Med J 2026', url: 'https://doi.org/10.11604/pamj.2026.53.52.50250' },
  'unops-turkana': { id: 'unops-turkana', label: 'UNOPS: Lodwar County Referral Hospital is the only referral hospital in Turkana; some women travel over 500 km', url: 'https://www.unops.org/news-and-stories/stories/inside-a-turkana-maternity-ward' },
  'wayua-2017': { id: 'wayua-2017', label: 'Wayua FO (2017) Nutritional and health challenges of pastoralist populations in Kenya. AJFAND 17(1): milk-based diets; restricted eating in pregnancy', url: 'https://ajfand.net/Volume17/No1/Wayua16810.pdf' },
  'nairobi-pumwani': { id: 'nairobi-pumwani', label: 'Nairobi City County: Pumwani Maternity Hospital, obstetric referral hospital', url: 'https://nairobi.go.ke/pumwani-maternity-hospital' },
  'wiki-knh': { id: 'wiki-knh', label: 'Kenyatta National Hospital (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Kenyatta_National_Hospital' },

  // ---------- Ghana ----------
  'gh-mis-2019': { id: 'gh-mis-2019', label: 'Ghana Malaria Indicator Survey 2019: children 6-59 months positive by microscopy, Northern 13%, Upper East 10%, Ashanti 10%, Greater Accra 2%', url: 'https://dhsprogram.com/pubs/pdf/MF29/MF29.pdf' },
  'modernghana-ue': { id: 'modernghana-ue', label: 'Upper East Region profile: millet, guinea corn, maize, groundnut, beans, sorghum, dry-season tomatoes and onions; Gurene, Kasem, Nankani, Kusaal', url: 'https://www.modernghana.com/GhanaHome/regions/uppereast.asp?menu_id=6' },
  'gna-groundnut-2020': { id: 'gna-groundnut-2020', label: 'GNA, Mar 2020: northern regions produce 85% of Ghana\'s groundnuts (MOFA)', url: 'https://gna.org.gh/2020/03/northern-sector-produces-85-percent-of-ghanas-groundnuts/' },
  'fao-giews-gha': { id: 'fao-giews-gha', label: 'FAO GIEWS Ghana country brief: June to August lean season; northern regions most food insecure', url: 'https://www.fao.org/giews/countrybrief/country.jsp?code=GHA' },
  'wiki-northern-gh': { id: 'wiki-northern-gh', label: 'Northern Region, Ghana (Wikipedia): Dagbani most widely spoken; Tamale Teaching Hospital', url: 'https://en.wikipedia.org/wiki/Northern_Region_(Ghana)' },
  'wiki-tth': { id: 'wiki-tth', label: 'Tamale Teaching Hospital (Wikipedia): referral hospital for the five northern regions', url: 'https://en.wikipedia.org/wiki/Tamale_Teaching_Hospital' },
  'gna-uerh-2025': { id: 'gna-uerh-2025', label: 'GNA, Apr 2025: Upper East Regional Hospital, Bolgatanga', url: 'https://gna.org.gh/2025/04/staff-shortage-parliamentary-committee-speaks-for-upper-east-regional-hospital/' },
  'gna-war-memorial': { id: 'gna-war-memorial', label: 'GNA: War Memorial Hospital, Navrongo', url: 'https://gna.org.gh/?p=144970' },
  'ayensu-2020': { id: 'ayensu-2020', label: 'Ayensu J et al. Anaemia (56.5%) and low nutrient intake in pregnant women, Ashanti Region. PLoS One 2020, PMID 31978048', url: 'https://doi.org/10.1371/journal.pone.0226026' },
  'wiki-kath': { id: 'wiki-kath', label: 'Komfo Anokye Teaching Hospital, Kumasi (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Komfo_Anokye_Teaching_Hospital' },
  'wiki-kbth': { id: 'wiki-kbth', label: 'Korle-Bu Teaching Hospital, Accra (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Korle_Bu_Teaching_Hospital' },
  'gh-literacy-2021': { id: 'gh-literacy-2021', label: 'Ghana 2021 census literacy: Northern 41.3%, Upper East 48.1%, Greater Accra 87.9% (Peace FM, citing GSS)', url: 'https://www.peacefmonline.com/pages/local/news/202202/460411.php' },
  'gdhs-2022': { id: 'gdhs-2022', label: 'Ghana DHS 2022: 80% of women own a mobile phone, 43% used the internet in the last year', url: 'https://www.dhsprogram.com/pubs/pdf/SR283/SR283.pdf' },
  'harrison-2026': { id: 'harrison-2026', label: 'Harrison OA et al. Consumption and folate of green leafy vegetables in Accra. BMC Nutr 2026', url: 'https://doi.org/10.1186/s40795-026-01400-6' },

  'wiki-ashanti': { id: 'wiki-ashanti', label: 'Ashanti Region (Wikipedia): cocoa and yam; Akan 94% of residents', url: 'https://en.wikipedia.org/wiki/Ashanti_Region' },
  'wiki-oyo': { id: 'wiki-oyo', label: 'Oyo State (Wikipedia): maize, yam, cassava, cashew; cassava and cocoa most important; mostly Yoruba', url: 'https://en.wikipedia.org/wiki/Oyo_State' },
  'kch-bmjopen-2023': { id: 'kch-bmjopen-2023', label: 'Trends in mortality among young infants admitted to Kilifi County Hospital, Kenya. BMJ Open 2023, PMID 36631234', url: 'https://doi.org/10.1136/bmjopen-2022-067482' },
  'gaskin-local-foods': { id: 'gaskin-local-foods', label: 'Gaskin national food list (src/clinical/foods.ts), drawn from the project research notes; to be validated by a local nutritionist' },

  // ---------- Practices ----------
  'gaskin-trad-library': { id: 'gaskin-trad-library', label: 'Gaskin traditional practices library (groups named per practice, src/clinical/traditional.ts)' },
};

export function src(...ids: string[]): Citation[] {
  return ids.map((id) => {
    const c = LOCATION_SOURCES[id];
    if (!c) throw new Error(`Unknown location source ${id}`);
    return c;
  });
}
