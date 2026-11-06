# Third-party notices

Gaskin's own code is released under the GNU Affero General Public License, version 3 only (AGPL-3.0-only). Its clinical content, illustrations, language packs and traditional practices library are released under Creative Commons Attribution 4.0 (CC-BY-4.0). The components below keep their own licences, which are reproduced here.

| Component | Version | Licence | How Gaskin uses it |
|---|---|---|---|
| React and React DOM | 19.3.1 (pinned) | MIT | User interface (bundled into the single file) |
| Tailwind CSS and @tailwindcss/vite | 4.3.3 (pinned) | MIT | Build time only: generates the stylesheet. No Tailwind code runs in the app. |
| Animata (codse/animata) | copied 5 Nov 2026 | MIT | Two components were copied and adapted, not installed: the animated border trail and the flip card. Each file in `src/ui/animata/` carries the notice and lists what was changed. The bar chart, bento grid and sibling focus navigation were removed in the redesign (6 Nov). |
| Untitled UI React (untitleduico/react) | copied 5 Nov 2026, commit 1d410cb | MIT | Components and theme copied into `src/components/` and `src/styles/theme.css`, not installed, then adapted (brand colour, Stone neutral, offline-only assets, relative imports). `src/components/LICENSE-untitledui.txt` holds the licence. |
| @untitledui/icons | 0.0.23 (pinned) | MIT | Interface icons. Gaskin's pictograms are its own (CC-BY-4.0). |
| react-aria-components, react-aria, react-stately, @internationalized/date | 1.22.1, 3.53.1, 3.51.0, 3.12.4 (pinned) | Apache-2.0 | Accessible behaviour for the Untitled UI components. |
| tailwind-merge | 3.7.0 (pinned) | MIT | Merges Tailwind class names in components. |
| tailwindcss-react-aria-components, tailwindcss-animate, @react-aria/optimize-locales-plugin | 2.2.0, 1.0.7, 2.1.0 (pinned) | Apache-2.0, MIT, Apache-2.0 | Build time only. |
| Inter | 4.1 (rsms/inter release) | SIL Open Font License 1.1 | Embedded as a subset woff2 data URI by `scripts/font/build-inter.py`, so it works offline. |
| Model Context Protocol SDK, zod | see `mcp-server/package.json` | MIT | The Gaskin connector for AI assistants (`mcp-server/`). |
| Hono and the server dependencies | see `server/package.json` | MIT and others as listed there | The optional production server (`server/`). |

Animata components that depend on an animation library (for example the card stack, which needs `motion`) were not used.

## Animata

```
MIT License

Copyright (c) Animata

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.```

## Tailwind CSS

```
MIT License

Copyright (c) Tailwind Labs, Inc.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## React

```
MIT License

Copyright (c) Meta Platforms, Inc. and affiliates.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Geography and language data (`src/geo/data`, 6 Nov, geography agent)

Bundled into the single file; generated by `scripts/geo/build.mjs` from the pinned versions below. Full provenance, counts and corrections: `src/geo/SOURCES.md`.

| Component | Version | Licence | How Gaskin uses it |
|---|---|---|---|
| iso-3166 (Titus Wormer) | 4.4.0 | MIT | ISO 3166-1 country codes and ISO 3166-2 first-level subdivisions |
| countries-list (Annexare Studio) | 3.4.1 | MIT | Country names (English and native), aliases, calling codes, currencies |
| Unicode CLDR (cldr-core, cldr-localenames-full) | 48.2.0 | Unicode License v3 | Languages per country with population share and official status; language names |
| geoBoundaries (William & Mary geoLab), gbOpen NGA ADM1/ADM2 | commit 9469f09 | CC BY 4.0; source: GRID3 Nigeria LGA boundaries | 774 Nigerian LGAs by state, with approximate centres |
| geoBoundaries gbOpen KEN ADM1/ADM2 | commit 9469f09 | ADM1 public domain (RCMRD); ADM2 CC BY 3.0 IGO (IEBC, OCHA ROSEA) | 47 counties, 290 sub-counties |
| geoBoundaries gbOpen ZAF ADM1/ADM3 | commit 9469f09 | CC BY 3.0 IGO (Municipal Demarcation Board, OCHA ROSEA) | 9 provinces, 213 municipalities |
| ghana-geo-data (Eric Bidopa) | commit c4570a4 | CC BY-SA 4.0 (data, from Wikipedia "Districts of Ghana") | 16 regions, 261 districts, kept as a separate data file, `src/geo/data/areas/GH.json`, with its licence beside it in `GH.LICENSE.md`. Redistributed under CC BY-SA 4.0 |

Attribution: "geoBoundaries: Runfola, D. et al. (2020) geoBoundaries: A global database of political administrative boundaries. PLoS ONE 15(4): e0231866", with the underlying sources GRID3 (Nigeria), RCMRD and IEBC via OCHA ROSEA (Kenya), and the Municipal Demarcation Board via OCHA ROSEA (South Africa). Ghana districts: Eric Bidopa, ghana-geo-data, from Wikipedia contributors, "Districts of Ghana", CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/).

Share-alike: the Ghana district list stays under CC BY-SA 4.0 wherever it goes. Anyone who changes or redistributes `src/geo/data/areas/GH.json` must keep the attribution above and release their version of that list under CC BY-SA 4.0. The term covers that list only, not Gaskin's code (AGPL-3.0-only) or its other content (CC BY 4.0). In the single-file build the list is inlined as data; this notice and `GH.LICENSE.md` travel with the source.

### iso-3166

```
(The MIT License)

Copyright (c) 2020 Titus Wormer <tituswormer@gmail.com>

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
'Software'), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

### countries-list

```
The MIT License (MIT)

Copyright (c) 2014 Annexare Studio

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.```

### Unicode CLDR

```
UNICODE LICENSE V3

COPYRIGHT AND PERMISSION NOTICE

Copyright © 2004-2026 Unicode, Inc.

NOTICE TO USER: Carefully read the following legal agreement. BY
DOWNLOADING, INSTALLING, COPYING OR OTHERWISE USING DATA FILES, AND/OR
SOFTWARE, YOU UNEQUIVOCALLY ACCEPT, AND AGREE TO BE BOUND BY, ALL OF THE
TERMS AND CONDITIONS OF THIS AGREEMENT. IF YOU DO NOT AGREE, DO NOT
DOWNLOAD, INSTALL, COPY, DISTRIBUTE OR USE THE DATA FILES OR SOFTWARE.

Permission is hereby granted, free of charge, to any person obtaining a
copy of data files and any associated documentation (the "Data Files") or
software and any associated documentation (the "Software") to deal in the
Data Files or Software without restriction, including without limitation
the rights to use, copy, modify, merge, publish, distribute, and/or sell
copies of the Data Files or Software, and to permit persons to whom the
Data Files or Software are furnished to do so, provided that either (a)
this copyright and permission notice appear with all copies of the Data
Files or Software, or (b) this copyright and permission notice appear in
associated Documentation.

THE DATA FILES AND SOFTWARE ARE PROVIDED "AS IS", WITHOUT WARRANTY OF ANY
KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT OF
THIRD PARTY RIGHTS.

IN NO EVENT SHALL THE COPYRIGHT HOLDER OR HOLDERS INCLUDED IN THIS NOTICE
BE LIABLE FOR ANY CLAIM, OR ANY SPECIAL INDIRECT OR CONSEQUENTIAL DAMAGES,
OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS,
WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION,
ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THE DATA
FILES OR SOFTWARE.

Except as contained in this notice, the name of a copyright holder shall
not be used in advertising or otherwise to promote the sale, use or other
dealings in these Data Files or Software without prior written
authorization of the copyright holder.

SPDX-License-Identifier: Unicode-3.0
```
