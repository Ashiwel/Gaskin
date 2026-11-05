# Location data in Gaskin

Gaskin tells a mother in Benue to eat "2 oranges a day" in season, rather than "250 mg of vitamin C", because Benue grows over a million tonnes of citrus a year and oranges sell there for about ₦1,000 a 100 kg bag at the farm gate. Location profiles carry this kind of knowledge into every plan: local foods with household measures and seasons, traditional practices to ask about, malaria policy, named referral hospitals, languages and connectivity.

Code lives in `src/location/`. The engine reads a profile through `PlanContext.location` (`toPlanLocation(profile)`).

## What a profile holds

| Field | Used for |
|---|---|
| `localFoods` (name, nutrients, household measure, season, cost tier, why, sources) | Nutrition items list local foods first, in household measures |
| `prevalentPractices` (ids from `src/clinical/traditional.ts`) | "Ask about common local practices" item, filtered to her stage |
| `malariaEndemic`, `malariaRisk`, `malariaNote` | IPTp eligibility (national policy) and how strongly to stress nets and fever testing |
| `referralFacilities` (named, typed, with town coordinates; `distanceKm` null until setup) | Referral advice and the setup summary |
| `languages`, `otherLanguages` | Default mothers' languages when the worker is not sure |
| `connectivityNote` | Channel choice at setup |
| `sources` | Every claim above points at a citation |

## The curated profiles

Eighteen regions are hand-built and checked on 5 November 2026: Lagos, Kano, Kaduna, Enugu, Oyo, Edo, Delta, Benue, Cross River and Borno in Nigeria; Kisumu, Kilifi, Turkana and Nairobi in Kenya; Northern, Upper East, Ashanti and Greater Accra in Ghana. `src/location/sources.ts` lists every source with its URL. The main ones are:

- **Crops and foods.** State profiles and ministry statements (Benue citrus and soybeans; Kaduna maize, ginger, tomatoes and soya; Kano groundnuts, millet, cowpea, sesame and soybeans; Oyo, Edo, Delta, Borno and Lagos commodity lists), the Upper East regional profile, and the MOFA figure that the northern regions grow 85% of Ghana's groundnuts.
- **Peer-reviewed nutrition.** Afang soup composition (Alozie and Ene-Obong, Food Chemistry 2018); dagaa or omena nutrients (Wessels et al., Food Security 2023: a 30 g portion gives about 91% of the calcium reference intake); anaemia and low intakes in Ashanti (Ayensu et al., PLoS One 2020); kontomire consumption in Accra (Harrison et al., BMC Nutrition 2026); African leafy vegetables in western Kenya (Makokha, Maseno 2013); pastoralist diets (Wayua, AJFAND 2017).
- **Malaria.** Nigeria Malaria Indicator Survey 2021; Ghana Malaria Indicator Survey 2019; Kenya's county malaria zoning. Nigeria and Ghana give IPTp to every pregnant woman, so all their regions are marked endemic for the engine. Kenya gives IPTp only in lake and coast endemic counties, so Turkana (seasonal) and Nairobi (low risk) are not.
- **Facilities.** Only named public teaching, federal, county or regional hospitals confirmed by a cited source. Where no source could be found, the facility was left out. Distances stay empty until the worker shares her location.
- **Connectivity.** Nigeria DHS 2023-24, Communications Authority of Kenya analysis of KDHS 2022, Ghana DHS 2022 and the 2021 Ghana census.

Practices are chosen from the library entries whose named groups live in the area (for example wankan jego for Hausa areas, omugwo for Igbo and Yoruba areas). They prompt a question; they are not prevalence estimates. Seasons are broad and cost tiers are relative within the area, so a local nutritionist should check both before a pilot.

For any other region of Nigeria, Kenya or Ghana, `getLocationProfile` returns a country default: the cheapest national foods, the practices the library lists for that country, national IPTp policy and no facilities.

## How a live pipeline fetches and caches open data

`buildLocationProfile(input, { online })` is the entry point. Offline, the default, it returns the curated profile at once, adds the district, and fills straight-line distances to each referral hospital from the worker's shared position. Setup never waits for the network.

With `online: true` the pipeline runs these steps. Each one is optional, has a timeout of eight seconds and is skipped silently on failure. Step 2 is implemented; the rest are specified here for the next build.

1. **Region and district from GPS.** Download geoBoundaries ADM1 and ADM2 polygons once per country (`https://www.geoboundaries.org/api/current/gbOpen/{NGA|KEN|GHA}/ADM2/`) and look up the point. Until then, `nearestRegion(lat, lon)` guesses from the nearest capital and the wizard asks the worker to confirm.
2. **Nearby hospitals.** Query OpenStreetMap through Overpass for named `amenity=hospital` within 60 km (`https://overpass-api.de/api/interpreter`). healthsites.io offers the same OSM data with an API key (`https://healthsites.io/api/v3/facilities/?country={iso3}&extent={bbox}`). New hospitals are added after the curated ones, each marked "confirm it offers emergency obstetric care". In Nigeria, the GRID3 health facility layer (`https://data.grid3.org/`) is the better source; it is a download portal rather than a JSON API, so the plan is to bundle a compressed per-state extract with each release.
3. **Malaria risk.** Read Malaria Atlas Project admin-1 parasite rate summaries (`https://data.malariaatlas.org/`) to set `malariaRisk`. `malariaEndemic` keeps following national IPTp policy, because that is what the clinical rule depends on.
4. **Crops and seasons for regions without a curated profile.** FAOSTAT production (`https://faostatservices.fao.org/api/v1/en/data/QCL`) gives national crop lists; FAO GIEWS country briefs (`https://www.fao.org/giews/countrybrief/country.jsp?code={iso3}`) give the lean season and harvest calendar. Foods are mapped to nutrients through the national food list, never invented.
5. **Cache.** The result is stored in browser storage under `gaskin.location.cache.v1`, keyed by country, region and district, so later starts are offline. The worker's chosen profile is also saved under `gaskin.location.profile.v1`.

The OpenStreetMap step sends only the coordinates rounded to the request, and only when the worker has agreed to share her location. Nothing about mothers leaves the device.

## Updating a curated profile

Edit `src/location/profiles.ts`, add any new source to `src/location/sources.ts`, and run `npx vitest run src/location`. The tests fail if a food or facility cites an unknown source, if a practice id is not in the library, or if a household measure slips into milligrams.
