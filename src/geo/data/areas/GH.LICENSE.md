# Ghana districts (`GH.json`): licence

`GH.json` lists Ghana's 16 regions and 261 districts. It is kept as a separate data file because it is licensed differently from the rest of Gaskin.

- Source: Eric Bidopa, `ghana-geo-data` (GitHub `EricBidopa/ghana-geo-data`, commit c4570a4), compiled from Wikipedia contributors, "Districts of Ghana", which cites the Ministry of Local Government, Decentralisation and Rural Development register.
- Licence: Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0), https://creativecommons.org/licenses/by-sa/4.0/
- Changes: names reshaped into `{ "<ISO 3166-2 region suffix>": "District|District|..." }` by `scripts/geo/build.mjs`; no names were altered.
- Share-alike: if you change or redistribute this file, you must keep this attribution and release your version of this list under CC BY-SA 4.0. The share-alike term covers this list only. It does not change the licence of Gaskin's code (AGPL-3.0-only) or its other content (CC BY 4.0).
