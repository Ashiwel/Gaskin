/**
 * Curated languages for sub-national areas, where the national CLDR figures would mislead
 * (a Kano mother is not likely to speak Yoruba because 13% of Nigerians do).
 *
 * Area names are matched loosely (case, spaces and punctuation ignored), and known spelling variants
 * in the bundled lists are listed too (e.g. GRID3's 'Oturkpo' for Otukpo).
 *
 * Each entry lists BCP-47 tags (ISO 639-3 where there is no two-letter code), most likely first,
 * with a short source. Shares are not given: published figures by state, county or region are
 * rare and dated, so the order is the claim, and it is approximate. Where an area holds many
 * small languages, the larger ones are named and the rest are reached through "More languages".
 *
 * Sources (short ids used below):
 * - eth:  Ethnologue, Languages of the World, 27th ed. (2024), country pages and language summaries.
 *         https://www.ethnologue.com (summaries are free; figures there are approximate).
 * - wiki: Wikipedia article for the state/county/region, "Languages" or "Demographics" section.
 * - ng-ndhs: Nigeria DHS 2018 / 2023-24, respondent's ethnicity and language of interview by state.
 * - kphc19: Kenya Population and Housing Census 2019, Vol. IV (ethnic affiliation by county).
 * - gss21: Ghana Statistical Service, 2021 Population and Housing Census, General Report Vol. 3C
 *          (language literacy and ethnicity by region).
 * - blench: Blench R., An Atlas of Nigerian Languages, 4th ed. (2019), Kay Williamson Educational Foundation.
 */

export interface CuratedArea {
  /** BCP-47 tags, most likely first. Official and lingua francas included where people use them. */
  tags: string[];
  /** Short citation shown in the UI ("Why these languages?") */
  source: string;
  /** True when the order is a judgement from the sources rather than a published ranking */
  approximate: boolean;
  /** Languages by area (LGA, sub-county, district), keyed by the area name as in the bundled lists */
  areas?: Record<string, string[]>;
}

const NG_SRC = 'Ethnologue (2024) Nigeria; Blench, Atlas of Nigerian Languages (2019); Wikipedia state articles; NDHS 2018 ethnicity by state';
const KE_SRC = 'Kenya Population and Housing Census 2019, Vol. IV (ethnicity by county); Ethnologue (2024) Kenya';
const GH_SRC = 'Ghana 2021 Population and Housing Census, Vol. 3C; Ethnologue (2024) Ghana';

/** Keyed by ISO 3166-2 code */
export const CURATED_AREAS: Record<string, CuratedArea> = {
  // ---------------- Nigeria (by state) ----------------
  // North-west and north-east: Hausa is the lingua franca; Fulfulde (Nigerian Fulfulde, fuv) widely spoken.
  'NG-KN': { tags: ['ha', 'fuv', 'en'], source: NG_SRC, approximate: true },
  'NG-KT': { tags: ['ha', 'fuv', 'en'], source: NG_SRC, approximate: true },
  'NG-JI': { tags: ['ha', 'fuv', 'kr', 'en'], source: NG_SRC, approximate: true },
  'NG-KD': {
    tags: ['ha', 'en', 'kaj', 'gbr', 'pcm', 'fuv'],
    source: `${NG_SRC}. Southern Kaduna holds many languages (Jju, Gbagyi, Hyam, Atyap, Bajju); Hausa is shared.`,
    approximate: true,
    areas: {
      'Jema\'a': ['kaj', 'ha', 'en'], 'Kaura': ['kaj', 'ha', 'en'], 'Zangon Kataf': ['kcg', 'kaj', 'ha', 'en'], 'Kachia': ['ha', 'kaj', 'en'],
      'Chikun': ['gbr', 'ha', 'en'], 'Kajuru': ['gbr', 'ha', 'en'], 'Kagarko': ['gbr', 'ha', 'en'], 'Jaba': ['ha', 'kaj', 'en'],
    },
  },
  'NG-SO': { tags: ['ha', 'fuv', 'en'], source: NG_SRC, approximate: true },
  'NG-ZA': { tags: ['ha', 'fuv', 'en'], source: NG_SRC, approximate: true },
  'NG-KE': { tags: ['ha', 'fuv', 'en'], source: `${NG_SRC}. Some Dukawa and Kambari in the south.`, approximate: true },
  'NG-BA': { tags: ['ha', 'fuv', 'en'], source: `${NG_SRC}. Many minority languages in the south (Sayawa, Jarawa).`, approximate: true },
  'NG-GO': { tags: ['ha', 'fuv', 'en'], source: `${NG_SRC}. Tangale, Waja and Tera in the south and east.`, approximate: true },
  'NG-BO': {
    tags: ['kr', 'shu', 'ha', 'en', 'fuv'],
    source: `${NG_SRC}. Kanuri is the largest language; Shuwa Arabic in the north and east; Babur-Bura in the south (Biu, Hawul).`,
    approximate: true,
    areas: { 'Biu': ['bwr', 'ha', 'en'], 'Hawul': ['bwr', 'ha', 'en'], 'Kwaya Kusar': ['bwr', 'ha', 'en'], 'Gwoza': ['ha', 'kr', 'en'], 'Ngala': ['shu', 'kr', 'ha'], 'Dikwa': ['shu', 'kr', 'ha'], 'Kala/Balge': ['shu', 'kr', 'ha'] },
  },
  'NG-YO': { tags: ['kr', 'ha', 'fuv', 'en'], source: `${NG_SRC}. Bade and Ngizim in the west.`, approximate: true },
  'NG-AD': { tags: ['fuv', 'ha', 'en'], source: `${NG_SRC}. Over 50 languages; Fulfulde and Hausa are the shared ones (Bachama, Higgi, Margi).`, approximate: true },
  'NG-TA': { tags: ['ha', 'fuv', 'en'], source: `${NG_SRC}. Jukun, Mumuye and Tiv are widely spoken alongside Hausa.`, approximate: true },
  // North-central (Middle Belt)
  'NG-BE': {
    tags: ['tiv', 'idu', 'en', 'pcm', 'ha'],
    source: `${NG_SRC}. Tiv in the north and east, Idoma in the south (Benue South), Igede in Oju and Obi.`,
    approximate: true,
    areas: {
      'Ado': ['idu', 'en'], 'Agatu': ['idu', 'en'], 'Apa': ['idu', 'en'], 'Obi': ['ige', 'idu', 'en'], 'Ogbadibo': ['idu', 'en'], 'Ohimini': ['idu', 'en'],
      'Oju': ['ige', 'idu', 'en'], 'Okpokwu': ['idu', 'en'], 'Otukpo': ['idu', 'en'], 'Oturkpo': ['idu', 'en'],
    },
  },
  'NG-PL': { tags: ['ha', 'bom', 'en', 'pcm'], source: `${NG_SRC}. Over 40 languages: Berom around Jos, Ngas, Mwaghavul, Tarok and Goemai; Hausa is the lingua franca.`, approximate: true },
  'NG-NA': { tags: ['ha', 'en', 'gbr'], source: `${NG_SRC}. Eggon, Alago, Migili, Gwandara; Hausa shared.`, approximate: true },
  'NG-NI': { tags: ['nup', 'ha', 'gbr', 'en'], source: `${NG_SRC}. Nupe in the south, Hausa in the north, Gbagyi around Minna and Suleja.`, approximate: true },
  'NG-KO': { tags: ['igl', 'ebi', 'yo', 'en'], source: `${NG_SRC}. Igala in the east, Ebira in the centre, Okun Yoruba in the west.`, approximate: true },
  'NG-KW': { tags: ['yo', 'nup', 'en', 'ha'], source: `${NG_SRC}. Yoruba is the majority; Nupe and Baruba (Bariba) in the north.`, approximate: true },
  'NG-FC': { tags: ['en', 'ha', 'pcm', 'gbr', 'yo', 'ig'], source: `${NG_SRC}. Gbagyi are the original inhabitants; Abuja is mixed.`, approximate: true },
  // South-west
  'NG-LA': { tags: ['yo', 'en', 'pcm', 'ig'], source: `${NG_SRC}. Egun (Gun) in Badagry.`, approximate: false, areas: { 'Badagry': ['yo', 'guw', 'en'] } },
  'NG-OY': { tags: ['yo', 'en', 'pcm'], source: NG_SRC, approximate: false },
  'NG-OG': { tags: ['yo', 'en', 'pcm'], source: `${NG_SRC}. Egun in Ipokia and Yewa.`, approximate: false },
  'NG-OS': { tags: ['yo', 'en'], source: NG_SRC, approximate: false },
  'NG-ON': { tags: ['yo', 'en', 'pcm', 'ijc'], source: `${NG_SRC}. Ijaw (Arogbo) and Ilaje on the coast.`, approximate: true },
  'NG-EK': { tags: ['yo', 'en'], source: NG_SRC, approximate: false },
  // South-east
  'NG-AB': { tags: ['ig', 'en', 'pcm'], source: NG_SRC, approximate: false },
  'NG-AN': { tags: ['ig', 'en', 'pcm'], source: NG_SRC, approximate: false },
  'NG-EB': { tags: ['ig', 'en', 'pcm'], source: NG_SRC, approximate: false },
  'NG-EN': { tags: ['ig', 'en', 'pcm'], source: NG_SRC, approximate: false },
  'NG-IM': { tags: ['ig', 'en', 'pcm'], source: NG_SRC, approximate: false },
  // South-south
  'NG-ED': {
    tags: ['bin', 'en', 'pcm', 'ish', 'ets'],
    source: `${NG_SRC}. Edo (Bini) in Edo South, Esan in Edo Central, Etsako in Edo North.`,
    approximate: true,
    areas: {
      'Esan Central': ['ish', 'en', 'pcm'], 'Esan North-East': ['ish', 'en', 'pcm'], 'Esan South-East': ['ish', 'en', 'pcm'], 'Esan West': ['ish', 'en', 'pcm'], 'Igueben': ['ish', 'en', 'pcm'], 'Iguegben': ['ish', 'en', 'pcm'],
      'Etsako Central': ['ets', 'en', 'pcm'], 'Etsako East': ['ets', 'en', 'pcm'], 'Etsako West': ['ets', 'en', 'pcm'], 'Akoko-Edo': ['en', 'pcm', 'ets'],
    },
  },
  'NG-DE': {
    tags: ['urh', 'iso', 'its', 'ukw', 'ig', 'en', 'pcm', 'ijc'],
    source: `${NG_SRC}. Urhobo in the centre, Isoko in Isoko North and South, Itsekiri around Warri, Ukwuani in Ndokwa, Ika and Enuani Igbo in the north, Ijaw on the coast.`,
    approximate: true,
    areas: {
      'Isoko North': ['iso', 'en', 'pcm'], 'Isoko South': ['iso', 'en', 'pcm'],
      'Warri North': ['its', 'ijc', 'pcm', 'en'], 'Warri South': ['its', 'urh', 'pcm', 'en'], 'Warri South West': ['ijc', 'its', 'pcm', 'en'],
      'Ndokwa East': ['ukw', 'pcm', 'en'], 'Ndokwa West': ['ukw', 'pcm', 'en'], 'Ukwuani': ['ukw', 'pcm', 'en'],
      'Ika North East': ['ig', 'en', 'pcm'], 'Ika South': ['ig', 'en', 'pcm'], 'Aniocha North': ['ig', 'en', 'pcm'], 'Aniocha South': ['ig', 'en', 'pcm'], 'Oshimili North': ['ig', 'en', 'pcm'], 'Oshimili South': ['ig', 'en', 'pcm'],
      'Bomadi': ['ijc', 'pcm', 'en'], 'Burutu': ['ijc', 'pcm', 'en'], 'Patani': ['ijc', 'pcm', 'en'],
    },
  },
  'NG-RI': {
    tags: ['pcm', 'en', 'ikw', 'ijc', 'ogo', 'ig'],
    source: `${NG_SRC}. Ikwerre around Port Harcourt, Kalabari (Ijaw) in Akuku-Toru, Asari-Toru and Degema, Ogoni languages (Khana, Gokana, Eleme) in Ogoniland, Ekpeye and Ogba in the north-west. Pidgin is the common language.`,
    approximate: true,
    areas: {
      'Ikwerre': ['ikw', 'pcm', 'en'], 'Obio/Akpor': ['ikw', 'pcm', 'en'], 'Emohua': ['ikw', 'pcm', 'en'], 'Emuoha': ['ikw', 'pcm', 'en'], 'Port Harcourt': ['pcm', 'en', 'ikw'],
      'Akuku-Toru': ['ijn', 'pcm', 'en'], 'Asari-Toru': ['ijn', 'pcm', 'en'], 'Degema': ['ijn', 'pcm', 'en'], 'Bonny': ['ijc', 'pcm', 'en'], 'Okrika': ['ijc', 'pcm', 'en'], 'Andoni': ['ijc', 'pcm', 'en'], 'Opobo/Nkoro': ['ijc', 'pcm', 'en'],
      'Khana': ['ogo', 'pcm', 'en'], 'Gokana': ['gkn', 'pcm', 'en'], 'Tai': ['ogo', 'pcm', 'en'], 'Eleme': ['elm', 'pcm', 'en'],
      'Etche': ['ig', 'pcm', 'en'], 'Omuma': ['ig', 'pcm', 'en'], 'Omumma': ['ig', 'pcm', 'en'], 'Oyigbo': ['ig', 'pcm', 'en'],
    },
  },
  'NG-CR': {
    tags: ['efi', 'en', 'pcm', 'etu', 'bkv'],
    source: `${NG_SRC}. Efik in Calabar, Ejagham in Etung and Akamkpa, Bekwarra in the north (Ogoja, Bekwarra), many small languages elsewhere.`,
    approximate: true,
    areas: {
      'Calabar Municipal': ['efi', 'en', 'pcm'], 'Calabar South': ['efi', 'en', 'pcm'], 'Odukpani': ['efi', 'en', 'pcm'], 'Akpabuyo': ['efi', 'en', 'pcm'], 'Bakassi': ['efi', 'en', 'pcm'],
      'Etung': ['etu', 'en', 'pcm'], 'Akamkpa': ['etu', 'efi', 'en', 'pcm'], 'Ikom': ['etu', 'en', 'pcm'],
      'Bekwarra': ['bkv', 'en', 'pcm'], 'Ogoja': ['bkv', 'en', 'pcm'], 'Obudu': ['bkv', 'en', 'pcm'], 'Yala': ['en', 'pcm'], 'Yakurr': ['en', 'pcm'],
    },
  },
  'NG-AK': { tags: ['ibb', 'en', 'pcm', 'anw', 'efi'], source: `${NG_SRC}. Ibibio is the majority; Annang in the west (Ikot Ekpene, Abak), Oro in the south-east.`, approximate: true },
  'NG-BY': { tags: ['ijc', 'pcm', 'en'], source: `${NG_SRC}. Izon (Ijaw) varieties; Epie-Atissa around Yenagoa.`, approximate: true },

  // ---------------- Kenya (by county) ----------------
  // Kiswahili and English are official everywhere; local languages from KPHC 2019 ethnicity by county.
  'KE-01': { tags: ['sw', 'en', 'kln', 'pko'], source: `${KE_SRC}. Tugen (Kalenjin), Pokot, Il Chamus.`, approximate: true },
  'KE-02': { tags: ['sw', 'en', 'kln'], source: `${KE_SRC}. Kipsigis (Kalenjin).`, approximate: false },
  'KE-03': { tags: ['sw', 'en', 'luy', 'kln'], source: `${KE_SRC}. Bukusu (Luhya); Sabaot around Mt Elgon.`, approximate: true },
  'KE-04': { tags: ['sw', 'en', 'luy', 'teo'], source: `${KE_SRC}. Luhya and Iteso.`, approximate: true },
  'KE-05': { tags: ['sw', 'en', 'kln'], source: `${KE_SRC}. Keiyo and Marakwet (Kalenjin).`, approximate: false },
  'KE-06': { tags: ['sw', 'en', 'ebu', 'ki'], source: `${KE_SRC}. Embu and Mbeere.`, approximate: true },
  'KE-07': { tags: ['so', 'sw', 'en'], source: KE_SRC, approximate: false },
  'KE-08': { tags: ['luo', 'sw', 'en'], source: `${KE_SRC}. Suba on the islands and around Mbita.`, approximate: false },
  'KE-09': { tags: ['sw', 'en', 'gax', 'so', 'saq'], source: `${KE_SRC}. Borana (Oromo), Somali, Turkana, Samburu, Meru.`, approximate: true },
  'KE-10': { tags: ['sw', 'en', 'mas', 'ki'], source: `${KE_SRC}. Maasai; Kikuyu in the north near Nairobi.`, approximate: true },
  'KE-11': { tags: ['luy', 'sw', 'en'], source: KE_SRC, approximate: false },
  'KE-12': { tags: ['sw', 'en', 'kln'], source: `${KE_SRC}. Kipsigis (Kalenjin).`, approximate: false },
  'KE-13': { tags: ['ki', 'sw', 'en'], source: KE_SRC, approximate: false },
  'KE-14': { tags: ['sw', 'nyf', 'en'], source: `${KE_SRC}. Mijikenda: Giriama, Chonyi, Kauma and others.`, approximate: true },
  'KE-15': { tags: ['ki', 'sw', 'en'], source: KE_SRC, approximate: false },
  'KE-16': { tags: ['guz', 'sw', 'en'], source: KE_SRC, approximate: false },
  'KE-17': { tags: ['luo', 'sw', 'en'], source: KE_SRC, approximate: false },
  'KE-18': { tags: ['kam', 'sw', 'en'], source: KE_SRC, approximate: false },
  'KE-19': { tags: ['sw', 'dig', 'en'], source: `${KE_SRC}. Digo and Duruma (Mijikenda).`, approximate: true },
  'KE-20': { tags: ['ki', 'sw', 'en', 'mas', 'saq'], source: `${KE_SRC}. Kikuyu, Maasai, Samburu, Pokot.`, approximate: true },
  'KE-21': { tags: ['sw', 'en'], source: `${KE_SRC}. Bajuni and Swahili; Orma, Somali, Aweer inland.`, approximate: true },
  'KE-22': { tags: ['kam', 'sw', 'en'], source: KE_SRC, approximate: false },
  'KE-23': { tags: ['kam', 'sw', 'en'], source: KE_SRC, approximate: false },
  'KE-24': { tags: ['so', 'sw', 'en'], source: KE_SRC, approximate: false },
  'KE-25': { tags: ['sw', 'en', 'gax', 'rel', 'saq', 'so'], source: `${KE_SRC}. Borana, Gabra, Rendille, Samburu, Turkana, Burji.`, approximate: true },
  'KE-26': { tags: ['mer', 'sw', 'en'], source: KE_SRC, approximate: false },
  'KE-27': { tags: ['luo', 'sw', 'en', 'kuj'], source: `${KE_SRC}. Kuria in Kuria East and West.`, approximate: true },
  'KE-28': { tags: ['sw', 'en', 'nyf'], source: `${KE_SRC}. Mixed; Swahili is the home language of many.`, approximate: true },
  'KE-29': { tags: ['ki', 'sw', 'en'], source: KE_SRC, approximate: false },
  'KE-30': { tags: ['sw', 'en', 'ki', 'luo', 'luy', 'kam'], source: `${KE_SRC}. Mixed city; Sheng widely used.`, approximate: true },
  'KE-31': { tags: ['sw', 'en', 'ki', 'kln'], source: `${KE_SRC}. Kikuyu and Kalenjin, mixed in Nakuru town.`, approximate: true },
  'KE-32': { tags: ['sw', 'en', 'kln'], source: `${KE_SRC}. Nandi (Kalenjin).`, approximate: false },
  'KE-33': { tags: ['mas', 'sw', 'en', 'kln'], source: `${KE_SRC}. Maasai; Kipsigis in Transmara.`, approximate: true },
  'KE-34': { tags: ['guz', 'sw', 'en'], source: KE_SRC, approximate: false },
  'KE-35': { tags: ['ki', 'sw', 'en'], source: KE_SRC, approximate: false },
  'KE-36': { tags: ['ki', 'sw', 'en'], source: KE_SRC, approximate: false },
  'KE-37': { tags: ['saq', 'sw', 'en', 'tuv'], source: `${KE_SRC}. Samburu; Turkana in the north.`, approximate: true },
  'KE-38': { tags: ['luo', 'sw', 'en'], source: KE_SRC, approximate: false },
  'KE-39': { tags: ['dav', 'sw', 'en'], source: `${KE_SRC}. Taita and Taveta.`, approximate: true },
  'KE-40': { tags: ['sw', 'en', 'gax', 'so'], source: `${KE_SRC}. Pokomo, Orma (Oromo), Wardei (Somali).`, approximate: true },
  'KE-41': { tags: ['mer', 'sw', 'en'], source: `${KE_SRC}. Chuka, Muthambi and Tharaka (Meru varieties).`, approximate: true },
  'KE-42': { tags: ['sw', 'en', 'luy', 'kln'], source: `${KE_SRC}. Luhya (Bukusu) and Kalenjin, mixed.`, approximate: true },
  'KE-43': { tags: ['tuv', 'sw', 'en'], source: KE_SRC, approximate: false },
  'KE-44': { tags: ['sw', 'en', 'kln', 'luy', 'ki'], source: `${KE_SRC}. Nandi and Keiyo (Kalenjin); mixed in Eldoret.`, approximate: true },
  'KE-45': { tags: ['luy', 'sw', 'en'], source: `${KE_SRC}. Maragoli, Tiriki, Banyore (Luhya).`, approximate: false },
  'KE-46': { tags: ['so', 'sw', 'en'], source: KE_SRC, approximate: false },
  'KE-47': { tags: ['pko', 'sw', 'en'], source: KE_SRC, approximate: false },

  // ---------------- Ghana (by region, 2018 structure) ----------------
  // English is official everywhere. Twi (Akan) is the widest second language in the south; Hausa in northern towns.
  'GH-AA': { tags: ['tw', 'en', 'gaa', 'ada', 'ee'], source: `${GH_SRC}. Mixed; Akan is the most spoken, Ga and Dangme are the indigenous languages.`, approximate: true },
  'GH-AH': { tags: ['tw', 'en'], source: GH_SRC, approximate: false },
  'GH-BO': { tags: ['tw', 'en'], source: `${GH_SRC}. Bono Twi.`, approximate: false },
  'GH-BE': { tags: ['tw', 'en', 'dag'], source: `${GH_SRC}. Bono; Mo, Nchumburu and northern settlers.`, approximate: true },
  'GH-AF': { tags: ['tw', 'en'], source: GH_SRC, approximate: false },
  'GH-CP': { tags: ['tw', 'en', 'gaa'], source: `${GH_SRC}. Fante (Akan); Awutu-Efutu near Winneba.`, approximate: true },
  'GH-EP': { tags: ['tw', 'en', 'ee', 'ada'], source: `${GH_SRC}. Akuapem, Akyem and Kwahu (Akan); Krobo (Dangme); Ewe.`, approximate: true },
  'GH-WP': { tags: ['tw', 'en', 'nzi'], source: `${GH_SRC}. Fante and Wasa (Akan); Nzema in the south-west.`, approximate: true },
  'GH-WN': { tags: ['tw', 'en'], source: `${GH_SRC}. Sefwi, Aowin (Akan-Bia).`, approximate: true },
  'GH-TV': { tags: ['ee', 'en', 'tw'], source: GH_SRC, approximate: false },
  'GH-OT': { tags: ['ee', 'tw', 'en'], source: `${GH_SRC}. Many languages (Krachi, Nchumburu, Adele, Akyode, Konkomba).`, approximate: true },
  'GH-NP': { tags: ['dag', 'en', 'ha', 'xon'], source: `${GH_SRC}. Dagbani is the majority; Konkomba (Likpakpaln) in the east.`, approximate: true },
  'GH-NE': { tags: ['maw', 'en', 'ha'], source: `${GH_SRC}. Mampruli; Bimoba and Konkomba in the east.`, approximate: true },
  'GH-SV': { tags: ['en', 'ha', 'dag'], source: `${GH_SRC}. Gonja, Vagla, Tampulma.`, approximate: true },
  'GH-UE': { tags: ['gur', 'kus', 'en', 'ha'], source: `${GH_SRC}. Gurene (Frafra) around Bolgatanga, Kusaal around Bawku, Kasem, Buli, Bisa.`, approximate: true },
  'GH-UW': { tags: ['dga', 'sld', 'en', 'ha'], source: `${GH_SRC}. Dagaare and Sisaala; Waale around Wa.`, approximate: true },

  // ---------------- South Africa (by province) ----------------
  // Statistics South Africa, Census 2022, first language by province.
  'ZA-EC': { tags: ['xh', 'af', 'en'], source: 'Statistics South Africa, Census 2022: first language by province', approximate: false },
  'ZA-FS': { tags: ['st', 'af', 'xh', 'tn', 'en'], source: 'Statistics South Africa, Census 2022: first language by province', approximate: false },
  'ZA-GP': { tags: ['zu', 'en', 'af', 'st', 'nso', 'tn', 'xh', 'ts'], source: 'Statistics South Africa, Census 2022: first language by province', approximate: false },
  'ZA-KZN': { tags: ['zu', 'en', 'xh'], source: 'Statistics South Africa, Census 2022: first language by province', approximate: false },
  'ZA-LP': { tags: ['nso', 'ts', 've', 'af', 'en'], source: 'Statistics South Africa, Census 2022: first language by province', approximate: false },
  'ZA-MP': { tags: ['ss', 'zu', 'ts', 'nr', 'nso', 'en'], source: 'Statistics South Africa, Census 2022: first language by province', approximate: false },
  'ZA-NW': { tags: ['tn', 'af', 'st', 'xh', 'en'], source: 'Statistics South Africa, Census 2022: first language by province', approximate: false },
  'ZA-NC': { tags: ['af', 'tn', 'xh', 'en'], source: 'Statistics South Africa, Census 2022: first language by province', approximate: false },
  'ZA-WC': { tags: ['af', 'xh', 'en'], source: 'Statistics South Africa, Census 2022: first language by province', approximate: false },
};

/**
 * English and native names for curated tags that CLDR does not name. Native names follow the
 * language's own usual spelling (Ethnologue, Glottolog); where unsure, the English name is reused.
 */
export const EXTRA_LANGUAGE_NAMES: Record<string, [string, string?]> = {
  fuv: ['Fulfulde (Nigerian)', 'Fulfulde'],
  kr: ['Kanuri', 'Kanuri'],
  knc: ['Kanuri (Central)', 'Kanuri'],
  shu: ['Shuwa Arabic', 'Arabi Shuwa'],
  urh: ['Urhobo', 'Urhobo'],
  iso: ['Isoko', 'Isoko'],
  its: ['Itsekiri', 'Itsekiri'],
  ukw: ['Ukwuani', 'Ukwuani'],
  ijc: ['Ijaw (Izon)', 'Izon'],
  ijn: ['Kalabari', 'Kalabari'],
  ikw: ['Ikwerre', 'Ikwerre'],
  ogo: ['Khana (Ogoni)', 'Khana'],
  gkn: ['Gokana (Ogoni)', 'Gokana'],
  elm: ['Eleme (Ogoni)', 'Eleme'],
  etu: ['Ejagham', 'Ejagham'],
  bkv: ['Bekwarra', 'Bekwarra'],
  anw: ['Annang', 'Annang'],
  idu: ['Idoma', 'Idoma'],
  ige: ['Igede', 'Igede'],
  bom: ['Berom', 'Berom'],
  nup: ['Nupe', 'Nupe'],
  gbr: ['Gbagyi', 'Gbagyi'],
  igl: ['Igala', 'Igala'],
  ebi: ['Ebira', 'Ebira'],
  ish: ['Esan', 'Esan'],
  ets: ['Etsako (Yekhee)', 'Etsako'],
  bwr: ['Bura-Pabir', 'Bura'],
  guw: ['Gun (Egun)', 'Gungbe'],
  kaj: ['Jju', 'Jju'],
  kcg: ['Tyap', 'Tyap'],
  dag: ['Dagbani', 'Dagbanli'],
  maw: ['Mampruli', 'Mampruli'],
  xon: ['Konkomba (Likpakpaln)', 'Likpakpaln'],
  kus: ['Kusaal', 'Kusaal'],
  dga: ['Dagaare', 'Dagaare'],
  sld: ['Sisaala', 'Sisaala'],
  gur: ['Gurene (Frafra)', 'Gurenɛ'],
  nzi: ['Nzema', 'Nzema'],
  tw: ['Twi (Akan)', 'Twi'],
  ak: ['Akan', 'Akan'],
  pko: ['Pokot', 'Pökoot'],
  tuv: ['Turkana', 'Ng\'aturkana'],
  gax: ['Borana (Oromo)', 'Afaan Boraanaa'],
  rel: ['Rendille', 'Rendille'],
  nyf: ['Mijikenda (Giryama)', 'Kigiryama'],
  dig: ['Digo', 'Chidigo'],
  kuj: ['Kuria', 'Igikuria'],
  pcm: ['Nigerian Pidgin', 'Naijá'],
  bin: ['Edo (Bini)', 'Ẹ̀dó'],
};
