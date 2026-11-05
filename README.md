# Gaskin

Gaskin is an open-source care planner for midwives and community health workers. It keeps one shared plan for each mother and her child, from conception to the child's first 1,000 days, and tells the health worker who to see next and what to do when she gets there. It is built for Nigeria first, then Ghana and Kenya, and it works on a smartphone, a shared basic phone at a facility hub, or an old laptop running from a USB stick.

## The problem

In Nigeria, 62.5% of women who gave birth in the five years before the 2023–24 Demographic and Health Survey received antenatal care from a skilled provider, but only 43.3% gave birth in a health facility and 42.8% had a postnatal check within two days of the birth (NDHS 2023–24). Care falls away at the moment it is most needed: most maternal and newborn deaths happen around birth and in the first two days after it.

The women who drop out are usually still in contact with someone. A community health worker visited them, or a midwife booked them in. What breaks is continuity, because each visit starts from a blank card and nothing reminds anyone who is due, who is overdue, and who is in danger.

## What it does

Gaskin keeps one plan per mother-child pair, from conception to day 1,000, and recalculates it whenever anything new is recorded. It puts the worker's caseload in order each morning, with danger signs first, then missed contacts, then contacts due today.

Danger-sign alerts come from fixed rules that no AI can override or hide. Severe pre-eclampsia, heavy bleeding, newborn danger signs and thoughts of self-harm raise an alert with what to do now and where to refer, and the matching plan items are locked so that one person cannot remove them.

Guided visit checklists cover every contact, from the first antenatal visit to the two-year child check. Each checklist is built for that mother and child: it asks the right questions, lists the checks for mother and baby, adds the vaccines due today and the milestones to watch, and skips what has already been done. Findings with no symptom code, such as club foot, cleft palate, hip problems or delayed development, open a referral that appears as an alert on her plan until someone confirms she arrived.

Each mother has her own language, set when she is registered. Gaskin uses it for everything she sees or hears: plain-language lines in her plan, the large-type "Show to mother" card with its picture, printable pictorial handouts, and SMS, WhatsApp or voice messages. The worker's screens stay in the worker's own language. Every translated line carries a badge that says whether it has been reviewed by a speaker, is a draft, or has fallen back to English.

When a health worker removes or changes an item, she gives a reason and can propose the change for every mother like this one. A clinical board reviews the proposals, and approved rules reach every plan in the next scheduled library release, so the planner learns from the people who use it without changing under their feet.

A programme dashboard shows what a state ministry or funder needs to see, starting with the share of mothers who had a postnatal check within 48 hours. The same figures are published as de-identified open data, with small counts suppressed.

## How it builds a plan

A rules engine builds every plan. Its rules follow the WHO recommendations on antenatal care (2016) and postnatal care (2022) and each country's national schedules for antenatal contacts, vaccines and malaria prevention, and each item shows its evidence grade and source. Location profiles add local foods, common traditional practices and named referral hospitals for the region where she lives.

AI is optional. When it is switched on, it is used for language (writing messages in plain words and in her language), triage of free-text replies, and putting the caseload in order. Safety comes from the rules alone. Gaskin works fully with no AI at all: the rules build the plan and templates write the messages.

AI can come from anywhere. A health worker can use Claude inside the hosted demo, her own API key for any OpenAI-compatible service, Anthropic or Gemini, a small model on her own laptop or in the browser, or any AI app she already has through copy and paste. Before any text leaves the device, Gaskin removes names, phone numbers, places and exact dates and replaces them with placeholders, then puts them back when the answer arrives. A "What the AI sees" panel shows the exact text that would be sent.

## Ways to run it

| Where | What you need | Where records are kept |
|---|---|---|
| Hosted demo on claude.ai | A link | A shared demo workspace for the owner, and a private working copy in the browser for everyone else |
| A single file from a USB stick | Any modern browser, no internet | A folder on the stick, or the browser with automatic backup files |
| A self-hosted server (`server/`) | A small Linux server in the country of care | A SQLite or Postgres database, synced to each phone, with real SMS, WhatsApp, voice and DHIS2 reporting |
| Your own AI assistant (`mcp-server/`) | Claude Desktop, or any assistant that accepts an MCP connector | The same folder as the USB-stick version |

The single-file build is one `index.html` of about 2 MB, of which about 440 KB is the Claude Desktop extension, embedded so that it can be installed offline. Opened from a file or inside the Claude app, Gaskin registers no service worker. Served over https, it can be installed as an app. See `docs/run-anywhere.md`, `docs/hosting.md` and `docs/connect-your-assistant.md`.

On first launch Gaskin asks fourteen short questions about the worker's role, place, devices, power, internet and languages, then shows the setup it recommends and applies it with one button. Reviewers can skip the questions and start as one of three health workers: a midwife in Lagos with a smartphone, a community health extension worker (CHEW) in Kano with a shared basic phone and no internet, or a CHEW in Cross River with an old Windows laptop on patchy 3G.

## Languages

Gaskin ships draft language packs for Hausa, Yoruba, Igbo, Nigerian Pidgin, Arabic, Kiswahili, Twi and French, all awaiting review by native-speaking midwives, and each line says so. Pidgin is offered but never chosen by default. Fulfulde, Edo, Urhobo, Dholuo, Ewe and Dagbani have no complete drafts yet, so Gaskin shows plain English for them rather than guess.

To contribute a pack, copy `src/i18n/packs/en.ts`, translate the interface strings and the mother-facing templates (keep every `{placeholder}`), add yourself as a reviewer, and open a pull request. The tests check that every placeholder and number survives translation. Packs are shared under CC BY 4.0.

## Privacy and safety

Gaskin records consent separately for keeping records and for receiving messages, and involves a guardian for mothers under 18. Records stay on the worker's device or the programme's own server, and each mother has a Gaskin ID that survives a change of SIM. De-identification is on by default for every AI call, and an audit log records what kind of data was sent, where, and how many bytes, with no content. Pseudonymised data is still personal data under Nigeria's Data Protection Act 2023, Kenya's Data Protection Act 2019 and Ghana's Data Protection Act 2012, so consent and processor agreements are still needed for cloud AI; switching AI off, or running it on the device, avoids the transfer altogether.

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
| `src/ui`, `src/store` | Screens and app state; the adapted Animata components are in `src/ui/animata` |
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
node scripts/walkthrough.mjs          # end-to-end walk-through in headless Chrome, screenshots in docs/screens/final
node scripts/walkthrough.mjs --file   # the same from file://, as from a USB stick
```

The connector and the server have their own `npm test` and `npm run build`; `npm run bundle` in `mcp-server/` rebuilds the Claude Desktop extension that the app embeds. The interface uses Tailwind CSS v4 at build time, mapped to Gaskin's own colour and type tokens, and icons from lucide-react.

## Licence

The code is released under the GNU Affero General Public License, version 3 only (AGPL-3.0-only); see `LICENSE`. Clinical content, illustrations, language packs and the traditional practices library are released under Creative Commons Attribution 4.0; see `LICENSE-CONTENT.md`. Third-party components keep their own licences; see `THIRD_PARTY_NOTICES.md`.

## Founders

Gaskin was founded by Ash Okang Ochui, who leads product and engineering, and Elizabeth Okang, a midwife and midwife trainer with more than 30 years of rural practice, who leads clinical work.
