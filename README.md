# Gaskin

Gaskin is an open-source care planner for midwives and community health workers. It keeps one shared plan for each mother and her child, from conception to the child's first 1,000 days, and tells the health worker who to see next and what to do when she gets there. It is built for Nigeria first, then Ghana and Kenya, and it works on a smartphone, a shared basic phone at a facility hub, or an old laptop running from a USB stick.

## The problem

In Nigeria, 62.5% of women who gave birth in the five years before the 2023–24 Demographic and Health Survey received antenatal care from a skilled provider, but only 43.3% gave birth in a health facility and 42.8% had a postnatal check within two days of the birth (NDHS 2023–24). Care falls away at the moment it is most needed: most maternal and newborn deaths happen around birth and in the first two days after it.

The women who drop out are usually still in contact with someone. A community health worker visited them, or a midwife booked them in. What breaks is continuity, because each visit starts from a blank card and nothing reminds anyone who is due, who is overdue, and who is in danger.

## What it does

Gaskin keeps one plan per mother-child pair, from conception to day 1,000, and recalculates it whenever anything new is recorded. It puts the worker's caseload in order each morning, with danger signs first, then missed contacts, then contacts due today.

Danger-sign alerts come from fixed rules that no AI can override or hide. Severe pre-eclampsia, heavy bleeding, newborn danger signs and thoughts of self-harm raise an alert with what to do now and where to refer, and the matching plan items are locked so that one person cannot remove them.

A mother may be pregnant while caring for a toddler, or have twins and an older child, all within the 1,000 days. Gaskin plans for every one of them at once: the journey line on her record shows each child, and every item, alert and vaccine says which child it is about.

Guided visit checklists cover every contact, from the first antenatal visit to the two-year child check, for the mother and each child in one sitting. Each checklist is built for that family: it asks the right questions, lists the checks, adds the vaccines due today and the milestones to watch, and skips what has already been done. A "No" answer opens a follow-up question. When she cannot afford something, it is not available, it caused side effects or she declined, the checklist offers a local, affordable alternative with servings she can measure at home. A test that was not done is recorded as unknown, never as normal, and where an unknown result could hide danger it is escalated. Every recommendation carries a how-to, and nine guides, from Thinking Healthy for low mood to kangaroo care for small babies, say what to do and where to get help. Depression screening uses the ten EPDS questions in plain words.

The visit ends with an actionable summary: what to refer, treat or recheck, each with the next step, and what to tell her in her language at the urgency the finding calls for. A routine finding such as club foot tells her to go to the named clinic within two weeks; an emergency tells her to go now. Saving opens a "Next steps" page in her language, led by pictures, to print, download or send. Findings with no symptom code, such as club foot, cleft palate, hip problems or delayed development, open a referral that stays as an alert on her plan until someone confirms she arrived.

Each mother has her own language, set when she is registered. Gaskin uses it for everything she sees or hears: plain-language lines in her plan, the large-type "Show to mother" card with its picture, printable pictorial handouts, and SMS, WhatsApp or voice messages. The worker's screens stay in the worker's own language. Every translated line carries a badge that says whether it has been reviewed by a speaker, is a draft, or has fallen back to English.

When a health worker removes or changes an item, she gives a reason and can propose the change for every mother like this one. In Expert review a clinical reviewer sees each proposal with its evidence, the workers behind it, and a simulation of which mothers' plans would change and how. Approved rules reach every plan in the next numbered library release, with release notes, so the planner learns from the people who use it without changing under their feet.

Insights shows how care is going for the mothers in the worker's own caseload, her facility or her area, never another community. The first figure is the share of mothers who had a postnatal check within 48 hours of birth, because most maternal and newborn deaths happen in that window. Charts follow the care cascade, risk, referrals and messaging cost. The same figures are published as de-identified open data, with counts from 1 to 9 withheld.

Several health workers can share one phone or laptop. Each has her own name, role and PIN, and every record shows who did what. Roles decide what each person sees: a health worker her caseload, a supervisor her facility, a clinical reviewer the proposals, and a programme officer only aggregate figures. Five wrong PINs bring a wait that lengthens each time, and a forgotten PIN is reset with a one-time recovery code or by a supervisor.

A woman can also use Gaskin for herself. Her version is simpler: "My day" shows her next check-up, three things to do today in plain words and her language, her children's next vaccines, and the nearest hospitals Gaskin knows. Every screen nudges her to register at a clinic and see a health worker, shows her country's emergency number, and says that Gaskin is not a doctor.

## How it builds a plan

A rules engine builds every plan. Its rules follow the WHO recommendations on antenatal care (2016) and postnatal care (2022) and each country's national schedules for antenatal contacts, vaccines and malaria prevention, and each item shows its evidence grade and source. Location profiles add local foods, common traditional practices and named referral hospitals for the region where she lives.

AI is optional. When it is switched on, it is used for language (writing messages in plain words and in her language), triage of free-text replies, and putting the caseload in order. Safety comes from the rules alone. Gaskin works fully with no AI at all: the rules build the plan and templates write the messages.

AI can come from anywhere. A health worker can use Claude inside the hosted demo, her own API key for any OpenAI-compatible service, Anthropic or Gemini, a small model on her own laptop or in the browser, or any AI app she already has through copy and paste. Before any text leaves the device, Gaskin removes names, phone numbers, places and exact dates and replaces them with placeholders, then puts them back when the answer arrives. A "What the AI sees" panel shows the exact text that would be sent.

## Ways to run it

| Where | What you need | Where records are kept |
|---|---|---|
| Hosted demo on claude.ai | A link | A shared demo workspace for the owner, and a private working copy in the browser for everyone else |
| The desktop download (`release/Gaskin-desktop.zip`) | Windows, Mac or Linux; Python 3, PowerShell or Node to serve it, or none to open the file directly | A folder the worker picks, or the browser with automatic backup files |
| A single file from a USB stick | Any modern browser, no internet | A folder on the stick, or the browser with automatic backup files |
| A self-hosted server (`server/`) | A small Linux server in the country of care | A SQLite or Postgres database, synced to each phone, with real SMS, WhatsApp, voice and DHIS2 reporting |
| Your own AI assistant (`mcp-server/`) | Claude Desktop, or any assistant that accepts an MCP connector | The same folder as the USB-stick version |

The single-file build is one `index.html` of about 3.7 MB, including the embedded Inter font, the place and language data for every country, and the Claude Desktop extension, so that all of it works offline. The desktop download is that file as `Gaskin.html` with three double-click launchers. Each launcher serves the folder at `http://127.0.0.1` with whatever the computer has (Python 3, then PowerShell on Windows, then Node) and opens the browser. Because that address counts as a secure origin, Gaskin can install as an app and save straight into a folder, such as one on a USB stick. With none of the three, the launcher opens the file directly, which still works with records kept in the browser. Opened from a file or inside the Claude app, Gaskin registers no service worker. See `docs/run-anywhere.md`, `docs/hosting.md` and `docs/connect-your-assistant.md`.

On first launch Gaskin asks who will use it: a health worker, a supervisor or a woman for herself. It then asks for the country, region and local area (every country, with local government areas for Nigeria, sub-counties for Kenya, districts for Ghana and municipalities for South Africa) and offers the languages spoken there, followed by short questions about devices, power, internet and AI. It shows the setup it recommends and applies it with one button. The place is set here and in Settings only; daily screens never ask for a country. Reviewers can skip the questions and start as one of three health workers: a midwife in Lagos with a smartphone, a community health extension worker (CHEW) in Kano with a shared basic phone and no internet, or a CHEW in Cross River with an old Windows laptop on patchy 3G. Each signs in with the demo PIN 2580.

## Languages

Gaskin ships draft language packs for Hausa, Yoruba, Igbo, Nigerian Pidgin, Arabic, Kiswahili, Twi, French and Portuguese, and for isiZulu, isiXhosa, Sesotho, Setswana, chiShona, Chichewa, Kinyarwanda and Lingala, with partial packs for Luganda and Gĩkũyũ. All await review by native-speaking midwives, and each line says so. Pidgin is offered but never chosen by default. Any other language can still be recorded as the one a mother speaks: it shows "Coming soon", and her messages use plain English until a pack exists. That includes Fulfulde, Edo, Urhobo, Dholuo, Ewe and Dagbani, for which Gaskin shows plain English rather than guess.

To contribute a pack, copy `src/i18n/packs/en.ts`, translate the interface strings and the mother-facing templates (keep every `{placeholder}`), add yourself as a reviewer, and open a pull request. The tests check that every placeholder and number survives translation. Packs are shared under CC BY 4.0.

## Privacy and safety

Gaskin records consent separately for keeping records and for receiving messages, and involves a guardian for mothers under 18. Records stay on the worker's device or her own organisation's server, and each mother has a Gaskin ID that survives a change of SIM. De-identification is on by default for every AI call, and an audit log records what kind of data was sent, where, and how many bytes, with no content. Pseudonymised data is still personal data under Nigeria's Data Protection Act 2023, Kenya's Data Protection Act 2019 and Ghana's Data Protection Act 2012, so consent and processor agreements are still needed for cloud AI. Switching AI off, or running it on the device, avoids the transfer altogether.

PINs are stored only as salted PBKDF2 hashes, and records can be encrypted with a passphrase. Danger alerts can be acknowledged but never dismissed, and no worker, AI reply or MCP tool can remove a locked safety item. The desktop launchers listen on `127.0.0.1` only and serve a fixed list of files. A security and QA review (`docs/security-review.md`) found 37 issues on 5 November and records how each was fixed or why it is still open; `npm audit --omit=dev` reports no known vulnerabilities in the app, the connector or the server.

## Clinical status

Gaskin is a prototype. Every mother, worker and facility in it is synthetic. The clinical rules are written from published guidelines and await review by the clinical lead, Elizabeth Okang, and an independent clinical board. Gaskin is not for patient care yet.

## Repository structure

| Path | What is there |
|---|---|
| `src/engine`, `src/clinical` | The rules engine, danger-sign alerts, schedules, evidence and citations |
| `src/visits` | Guided visit checklists, milestones and referral findings |
| `src/i18n` | Language packs, the dual-language view, "Show to mother" and the language picker |
| `src/ai`, `src/privacy` | AI providers, guardrails, de-identification and the audit log |
| `src/setup`, `src/location`, `src/storage` | Onboarding, location profiles, and storage in a folder, the browser or backup files |
| `src/hosted` | The shared-data layer: the claude.ai demo workspace, the Gaskin server, or this device |
| `src/data`, `src/demo`, `src/messaging`, `src/illustrations` | Synthetic cohort, demo scenarios, message channels and costs, and pictograms and handouts |
| `src/ui`, `src/store` | Screens and app state; the two adapted Animata components are in `src/ui/animata` |
| `src/auth`, `src/legal`, `src/geo` | Worker profiles, PINs and roles; disclaimers, consent and emergency numbers; countries, regions, local areas and the languages spoken there |
| `src/components`, `src/styles`, `src/theme`, `src/design` | The design system: Untitled UI components, chart primitives, the app shell, tokens, the embedded Inter font, the theme provider and the `#design` showcase |
| `server/` | The production server: accounts, sync, messaging gateways, AI proxy, DHIS2 export and public metrics |
| `mcp-server/` | The Gaskin connector for AI assistants, packaged as a one-click Claude Desktop extension |
| `docs/` | Guides, location data notes, sample handouts and screenshots |

## Development

```bash
npm install
npm run dev          # local development server
npm test             # unit and component tests (vitest)
npm run build        # type-check, then build the single file dist/index.html
npm run lint         # oxlint
npm run test:all     # the app, the connector and the server
npm run walkthrough  # the demo path end to end in headless Chrome (after npm run build)
npm run package:desktop   # build, bundle the extension, make release/Gaskin-desktop.zip and test it
```

The walk-through runs the founder's demo path at 390 and 1440 pixels, in light and dark: onboarding, the PIN, Today, Show to mother in Igbo, a rising blood pressure, a guided visit with club foot, a message in Yoruba, the mother's reply in Pidgin, Expert review and a release, Insights, Settings, a Kano worker in Hausa and a woman using Gaskin for herself, then the core path again from `file://`. It fails on any console error, any request to another host, sideways scrolling or text cut off, and saves screenshots to `docs/screens/release-2/`.

The connector and the server have their own `npm test` and `npm run build`; `npm run bundle` in `mcp-server/` rebuilds the Claude Desktop extension that the app embeds. The interface is built on Untitled UI React components copied into `src/components/`, styled with Tailwind CSS v4 at build time on Gaskin's tokens, with Inter embedded for offline use; `docs/design-system.md` describes the tokens, components, charts and layout rules, and the `#design` route shows them all in light and dark.

## Licence

The code is released under the GNU Affero General Public License, version 3 only (AGPL-3.0-only); see `LICENSE`. Clinical content, illustrations, language packs and the traditional practices library are released under Creative Commons Attribution 4.0; see `LICENSE-CONTENT.md`. Third-party components keep their own licences; see `THIRD_PARTY_NOTICES.md`.

## Founders

Gaskin was founded by Ash Okang Ochui, who leads product and engineering, and Elizabeth Okang, a midwife and midwife trainer with more than 30 years of rural practice, who leads clinical work.
