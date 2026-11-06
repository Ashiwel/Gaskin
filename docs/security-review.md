# Security and QA review

Gaskin holds the pregnancy, birth, mental-health and HIV records of women who never chose to be in a database, many of them adolescents. This review, carried out on 5 November 2026, asked what an attacker, a careless file copy or a manipulated AI reply could do with them, checked each answer in the code, and fixed what could be fixed without touching the screens other agents are redesigning. It found 37 issues: 4 critical, 11 high, 13 medium and 9 low. Twenty-eight are fixed with tests or verified sound, nine remain open, and eight screen changes for the UI agents are listed at the end, three of which switch on protections already built below the screens.

## Scope

The review covered the front end's logic modules (`src/engine`, `src/clinical`, `src/privacy`, `src/ai`, `src/messaging`, `src/storage`, `src/hosted`, `src/illustrations`, `src/data` and `src/setup/apply.ts`), the MCP connector in `mcp-server/`, and the production server in `server/`. Screens in `src/ui`, `src/components`, `App.tsx`, `index.css` and the component folders of `src/setup`, `src/visits` and `src/i18n` were read but not edited, because other agents were redesigning them at the time. Findings there are listed for those agents in the section on open items.

The method was the same throughout. A threat model came first, then the code was read with that model in mind, then each suspicion was confirmed with a throwaway probe before anything was changed, and every fix was locked in with a test that fails on the old code.

## Threat model

Gaskin runs in four places, and each has a different attacker.

| Where | What is at risk | Who could attack it | How |
|---|---|---|---|
| A USB stick or shared laptop | `gaskin-data.json`, its backups and the browser's copy | Whoever finds the stick or uses the laptop next | Opens the files; plants a crafted backup for the next import |
| The browser | Records in IndexedDB and localStorage, the worker's AI key | A crafted record (from an import, a synced override or a typed note) that becomes markup; a page script | Stored XSS through a field rendered as HTML or as a link |
| AI calls | Prompts and replies | A doctor's report, an inbound SMS or a worker-added item containing instructions; a model that drifts | Prompt injection; reassurance or a new medicine in a reply; a placeholder restored as the wrong person |
| The Gaskin server | Every mother in a programme | Anyone on the internet; a worker reaching past her facility; a forged gateway callback | PIN guessing, token theft, cross-facility reads, fake "danger sign" SMS, re-identification from public counts |
| The MCP connector | The data folder | An assistant given bad input; a link planted in the folder; a web page reaching the HTTP mode | Path or link tricks, unbounded input, CSRF or DNS rebinding against localhost |

The things that must never happen are a danger-sign item hidden or reworded by one person, a real name or number reaching an AI provider, a message to a mother telling her to stay home or stop a medicine, and one mother's identity being shown as another's.

## Findings

Severity follows the usual scale. Critical means a mother could come to harm or records could be read or changed by someone who should not have them, without unusual effort. High means the same with some effort or luck. Medium weakens a defence that another layer still covers. Low is hardening or hygiene.

| ID | Severity | Area | Finding | Status | Fix or recommendation |
|---|---|---|---|---|---|
| SEC-01 | Critical | Illustrations | `renderIllustration` wrote the key into `data-illustration="${key}"` unescaped. A worker-added item, an imported backup or a synced override with a crafted `illustration` value became live markup in every `dangerouslySetInnerHTML` that shows the pictogram, and in the handout. Confirmed with a probe: `zz"><img src=x onerror=…>` reached the handout HTML. | Fixed | Keys are checked against the drawing library before use; unknown keys draw the plain disc; `size` is clamped to a number. The handout picks its own pictogram the same way. |
| SEC-02 | Critical | Engine | A `modify` override on a locked item replaced its title and mother text and could set `status: 'removed'`, so one worker could turn the danger-sign card into "It is normal. Stay at home." The lock covered `remove` and `add` only. | Fixed | Locked items ignore worker `modify` overrides (an approved clinical rule can still change them), and `modify` can no longer remove any item. |
| SEC-03 | Critical | Privacy | Every known mother, worker and facility was scrubbed to the same placeholders as her own ([MOTHER], [WORKER], [FACILITY]), and replies were re-identified by filling those placeholders with her details. "Go to Lagos University Teaching Hospital" came back as "Go to Surulere Primary Health Centre", and "Ask for Dr Musa Bello" as "Ask for Dr Adaeze Adaeze". The server proxy had the same fault. | Fixed | Other people and places now get placeholders that are never restored ([PERSON], [PLACE], [OTHER_FACILITY]). A referral hospital is restored only when the source names exactly one; otherwise the placeholder stays and the guardrails send the template. |
| SEC-04 | High | AI | A doctor's report went into the extraction prompt between `"""` markers it could itself contain, so a report could close the block and write instructions after it. Translation sources were not fenced at all. | Fixed | Untrusted text sits inside a fixed `GASKIN_DATA` fence; copies of the markers and bidirectional-override characters inside the text are broken up; every prompt (and the server's system prompt) says the fenced text is data. |
| SEC-05 | High | AI | Guardrails ran on personalised messages only for small on-device and copy-and-paste models. A capable model talked into reassurance passed straight to the worker. The patterns also missed "Stop iron.", "no need to hurry", "nothing serious", markup and links. | Fixed | `validateAIText` now runs on every transport, and catches named-medicine stops, "no rush" and "nothing serious" phrasing, HTML and script, and links the plan did not give. |
| SEC-06 | High | Privacy | The privacy sweep covered seeded records but not text a worker types: added items naming a neighbour, household notes in item details, or another mother's name and number. | Fixed | A second sweep runs every seeded mother through all five AI tasks, full and compact, with an added item naming another mother of the same facility, her phone, community and two date formats. No leaks. |
| SEC-07 | Medium | AI keys | The worker's own API key was stored in localStorage with the other AI settings, with no way to keep it off the device, and a provider error echoing the key could reach the status line and audit note. | Fixed (API); UI open | `saveAISettings(settings, 'device' \| 'session' \| 'memory')`, `loadAISettings()` and `forgetAIKey()` in `src/ai`; onboarding uses them. Key-like strings are redacted from every error. Screens still need the choice (UI-03). |
| SEC-08 | High | Storage | Folder mode writes `gaskin-data.json` and ten rolling backups in plain JSON to a stick that can be lost; browser and downloaded backups are plain too. | Fixed (API); UI open | Optional passphrase encryption: AES-256-GCM, PBKDF2-SHA-256 with 600,000 rounds, fresh salt per passphrase and fresh IV per write, WebCrypto only. Off by default. Saves are refused, never written in plain text, while locked. UI wiring is UI-01. |
| SEC-09 | High | Storage | A backup import accepted any object with a `mothers` array. A file with a missing timeline, a non-list field or a `__proto__` key could crash every screen or pollute prototypes, and `javascript:` source links would render as live links. | Fixed (API); UI open | `validateImportedState()` checks every record, drops prototype keys and unsafe links, caps sizes and returns plain-English reasons. `importFile` refuses files over 50 MB. The Settings import still calls `dispatch` directly (UI-02). |
| SEC-10 | High | Server | The server sent no Content-Security-Policy or `frame-ancestors`, allowed `X-Frame-Options: SAMEORIGIN`, and let record responses be cached. It accepted the session token in the query string on every endpoint, so tokens could land in proxy logs. | Fixed | `default-src 'none'` and `frame-ancestors 'none'`, `X-Frame-Options: DENY`, one-year HSTS, a Permissions-Policy, and `Cache-Control: no-store` on record responses. Query tokens are accepted on `/api/events` only. |
| SEC-11 | High | Server | Sign-in was rate-limited per IP only, so an attacker rotating addresses could keep guessing one worker's PIN between lockouts. The rate-limit map was unbounded. Sessions lasted 30 days with no idle timeout or rotation. | Fixed | A second limit per phone number (10 tries in 15 minutes), bounded maps, PINs over 16 characters refused before hashing, a 14-day idle timeout, `POST /api/auth/refresh` to rotate a token, a 90-day ceiling on renewal, and `revokeAllSessions()`. |
| SEC-12 | Critical | Server | Africa's Talking callbacks had no authentication, and Termii and WhatsApp skipped signature checks when their secrets were unset. In live mode anyone could post a forged inbound SMS ("I am bleeding") for any number, or fake delivery receipts. | Fixed | AT callbacks need `?token=` matching `AT_WEBHOOK_TOKEN`; in live mode every gateway refuses callbacks it cannot verify. The WhatsApp verify token is compared in constant time. |
| SEC-13 | Medium | Server | `CORS_ORIGINS='*'` reflected any origin, and nothing warned about an unset `AUDIT_IP_SALT` (which made the salt random per restart), a plain-http `PUBLIC_URL`, missing webhook secrets or a small `SUPPRESS_BELOW`. | Fixed | `configProblems()` names each unsafe setting at start-up; with `NODE_ENV=production` the server refuses to start unless `GASKIN_ALLOW_UNSAFE_CONFIG=yes`. |
| SEC-14 | High | Server | Public metrics published a rate whenever its denominator reached 10, with the denominator beside it, so "25% of 12" revealed a count of 3. Stage counts had no secondary suppression against the enrolled total. | Fixed | A rate is withheld when its numerator, or the number who did not, is between 1 and 9. Stage counts get the same secondary suppression as the DHIS2 export. |
| SEC-15 | High | MCP | The connector followed symbolic links: a `gaskin-data.json` or `backups` link planted in the folder made it read or write a file elsewhere, and its backup pruning could delete through a link. Data files of any size were parsed. | Fixed | Links are refused for the data file, backups folder, audit log and token file; temp files open with `wx` and mode 600; data files over 64 MB are refused. |
| SEC-16 | Medium | MCP | Tool schemas accepted any number (NaN, Infinity, 1e308), unbounded strings and arrays, and any token text. | Fixed | Finite numbers, bounded strings and lists, a token pattern, and an EPDS score of 0 to 30. |
| SEC-17 | Medium | MCP | The audit log could have lines removed or edited with no trace. | Fixed | Each line carries a hash of the line before it; `verifyAuditChain()` reports where the chain breaks. Lines still hold no content. |
| SEC-18 | Medium | MCP | `--http --host 0.0.0.0` opened the connector to the network with a 10-character key; `GASKIN_ALLOWED_HOSTS=*` switched off the DNS-rebinding guard; requests from other web pages were accepted. | Fixed | A non-loopback bind needs a 24-character fixed token and named hosts, `*` is refused, and requests whose `Origin` is a foreign site are refused. |
| SEC-19 | Medium | Build | The single-file build has no CSP for self-hosted use. | Fixed (helper); open for build | `selfHostedCSP()` in `src/storage` produces a policy for a facility server or launcher. Emitting it in the build, ideally with script hashes instead of `'unsafe-inline'`, is BUILD-01. |
| SEC-20 | Medium | Engine | Worker-added and learned items copied `sources` as given, so a `javascript:` URL in an override or synced record became a clickable link in the plan and library. | Fixed | `safeSources()` keeps only http(s) links on worker and learned items. |
| SEC-21 | Medium | Server | `/api/ai/preview` was open to every role, so a programme officer could learn which names exist in records by watching what the scrubber removed. | Fixed | Preview needs the same role as a real AI call. |
| SEC-22 | Medium | Server | Settings keys, AI request fields, cost-report dates, and admin facility and user input were barely validated, and a failed account creation echoed the database error. | Fixed | Key and id patterns, bounded prompts, known AI tasks, known facilities and countries, and a generic error message. |
| SEC-23 | Low | Handout | The handout had no CSP of its own and no `dir` for Arabic. | Fixed | A `default-src 'none'` CSP meta in every handout, and `dir="rtl"` for Arabic. |
| SEC-24 | Medium | Handout preview | The preview iframe uses `sandbox="allow-modals allow-same-origin"`. It has no `allow-scripts`, so scripts cannot run, but `allow-same-origin` is not needed for the escaped, script-free handout. | Open (UI) | UI-04: drop `allow-same-origin` and print through a `blob:` window, or keep it only for printing. |
| SEC-25 | High | Dependencies | `nodemailer` 7 in the server had a run of advisories (address-parser recipient injection, SMTP command injection and several denial-of-service bugs); the fix is version 10, a breaking change. | Fixed (6 Nov) | Pinned to nodemailer 10.3.1, which ships its own types (`@types/nodemailer` removed). The SMTP adapter loads it lazily and creates every transport with `disableFileAccess` and `disableUrlAccess`, so a message can never read a local file or fetch a URL. New tests build a real transport from the SMTP URL and send through nodemailer's JSON transport. `npm audit --omit=dev` in `server/` reports 0. |
| SEC-26 | Medium | Dependencies | `@anthropic-ai/mcpb` (build-time only) pulls in vulnerable `tmp`, `zod` 3 and `@inquirer` packages. None ships in `dist/server.js` or the `.mcpb`. | Open | DEP-02: checked 6 Nov: 2.1.2 (December 2025) is still the latest release and depends on `zod` ^3 and `@inquirer/prompts` ^6, so no fixed version exists. It runs only on the developer's machine to validate and pack the extension; `npm audit --omit=dev` reports 0. Update when upstream releases a fix. |
| SEC-27 | Low | Dependencies | Several ranges use `^` in all three packages; only the lockfiles pin exact versions. | Open | DEP-03: build releases with `npm ci` only (the Dockerfile does), and consider exact versions for `hono`, `better-sqlite3` and the MCP SDK. |
| SEC-28 | Low | Licences | Every runtime dependency is MIT, ISC, Apache-2.0, BSD, 0BSD or MIT-0, all compatible with AGPL-3.0. Build tools add MPL-2.0 and a dual BSD-3/GPL-2.0 package, which do not ship. The MCP bundle banner said "Licence: Apache-2.0". | Fixed | The banner now says AGPL-3.0-only. |
| SEC-29 | Low | Service worker | The service worker caches only same-origin GETs and never patient data, but it would also cache a same-origin `GET /api/…` response if the app and API share an origin. | Open (low) | SW-01: skip `/api/` paths in `public/sw.js` when a deployment serves both from one origin. |
| SEC-30 | Low | AI audit | The in-memory AI audit log has no content, as documented. The MCP and server audit logs were checked too; none holds prompt, reply or record text. | Verified | Tests assert the absence of content and keys. |
| QA-01 | High | Engine | `buildPlan` throws on a record missing `events`, `children` or `consent` (as an old or hand-edited backup might have). The store skips such a mother silently, so she vanishes from Today with no warning. | Fixed at the boundary | Import validation now refuses such files with a reason. The store should still show "N records could not be read" (UI-05). |
| QA-02 | Medium | Handout | Arabic handouts were laid out left to right. | Fixed | See SEC-23. |
| QA-03 | Medium | Messaging | A mother with no phone is correctly routed to the printed sheet, but the Compose screen still offers SMS and WhatsApp and only fails at send. | Open (UI) | UI-06. |
| QA-04 | Low | Storage | An encrypted data file made the MCP connector fail with "not a Gaskin data file". | Fixed | It now says the file is encrypted and what to do. |
| QA-05 | Low | Data | The seed has no current twin pregnancy and no twins born, so twin logic (engine risk, visit checklist) is covered by unit tests but not by the demo. | Open | DATA-01: add one twin pregnancy and one set of twins to the synthetic cohort. |
| QA-07 | Low | Engine | The engine's new `untested.refer` item, added by another agent during this review, has no mother-text template key, so one existing test fails and the item cannot be translated. | Open (other agent) | Give it a `MOTHER_TEXT` key. |
| QA-06 | Low | Build | During this review another agent's change to `src/engine/state.ts` imported a `./constraints` module that did not yet exist, and `src/types` gained language and symptom codes that `labels.ts`, `countries.ts`, `prompts.ts` and the language registry do not cover. Both break type-checking and the server and MCP builds until finished. | Partly fixed | Both modules have landed. The label and language tables still need the new codes (`pallor`; `pt`, `zu`, `xh` and others) for a clean type-check. |

## What was fixed, and the tests that prove it

Each fix has a test that fails on the old code. Test names are shown as they appear in the runner.

| Finding | Test |
|---|---|
| SEC-01 | `src/illustrations/illustrations.test.ts`: "security: an unknown or crafted illustration key never reaches the markup (SEC-01)" |
| SEC-23 | `src/illustrations/illustrations.test.ts`: "security: the handout carries a CSP that forbids scripts and network, and sets dir for Arabic" |
| SEC-02 | `src/engine/engine.test.ts`: "security: a locked item cannot be rewritten or hidden by a modify override (SEC-02)" and "security: a modify override never removes an unlocked item either" |
| SEC-03 | `src/privacy/__tests__/privacy.test.ts`: "a named referral hospital comes back as itself, not as her own clinic" and "another mother or another worker named in her record is removed and never restored as her"; `server/test/security.test.ts`: "another mother's name in a prompt comes back as [PERSON], not as this mother's first name" |
| SEC-04, SEC-05 | `src/ai/__tests__/security.test.ts`: "prompt injection (SEC-04)" (four tests) and "guardrails catch what an injected reply would say (SEC-05)" (seven cases) |
| SEC-06 | `src/privacy/__tests__/privacy.test.ts`: "extended privacy sweep" (one test per seeded mother, 37 in all) |
| SEC-07 | `src/ai/__tests__/security.test.ts`: "API keys (SEC-07)"; `src/ai/__tests__/keyStore.test.ts`: "where the API key is kept (SEC-07)" |
| SEC-08 | `src/storage/storage.test.ts`: "passphrase encryption at rest (SEC-08)" (three tests, including the full folder, backup, browser and export path) |
| SEC-09, QA-01 | `src/storage/storage.test.ts`: "importing a malformed or malicious backup (SEC-09)" (nine cases) |
| SEC-19 | `src/storage/storage.test.ts`: "self-hosted CSP (SEC-19)" |
| SEC-10, SEC-21, SEC-22 | `server/test/security.test.ts`: "HTTP hardening (SEC-10)" (five tests) |
| SEC-11 | `server/test/security.test.ts`: "sign-in and sessions (SEC-11)" (four tests) |
| SEC-12 | `server/test/security.test.ts`: "webhooks in live mode (SEC-12)" (three tests) |
| SEC-13 | `server/test/security.test.ts`: "configuration checks (SEC-13)" |
| SEC-14 | `server/test/security.test.ts`: "public metrics never re-identify (SEC-14)" |
| SEC-15, QA-04 | `mcp-server/test/security.test.ts`: "data folder: links, size and atomic writes (SEC-15)" (four tests) |
| SEC-16 | `mcp-server/test/security.test.ts`: "input validation on every tool (SEC-16)" (nine tests) |
| SEC-17 | `mcp-server/test/security.test.ts`: "audit log integrity (SEC-17)" |
| SEC-18 | `mcp-server/test/security.test.ts`: "HTTP mode (SEC-18)" (three tests) |

What held up under probing deserves recording too. The server's facility scoping refused every cross-facility read, write, send, plan view and AI call that was tried, including moving a mother to another facility and taking over her id from a second account. Only a clinical reviewer could approve a proposal or publish a rule. PINs are salted scrypt, tokens are stored as SHA-256, every SQL statement is parameterised, and the audit trail holds no content. DHIS2 suppression and its secondary rule were already correct. The handout escaped every user string it was given; the hole was the one unescaped key.

## New APIs for the screen agents

These are exported and tested, and wait only for a screen to use them.

**Encryption at rest** (`src/storage`). `store.enableEncryption(passphrase)`, `store.disableEncryption()`, `store.unlock(passphrase)`, `store.lock()` and `store.isEncrypted()` on the app store from `getAppStore()`; `passphraseProblem(p)` for live feedback; `PassphraseError` with `code` `wrong_passphrase`, `weak_passphrase`, `unsupported` or `corrupt`. `StoreStatus` gains `state: 'needs_passphrase'`, `encrypted` and `locked`.

**Import checks** (`src/storage`). `validateImportedState(raw)` returns `{ ok, problems, state, counts }`.

**Key storage** (`src/ai`). `saveAISettings(settings, 'device' | 'session' | 'memory')`, `loadAISettings()`, `forgetAIKey()`, `keyPersistence()` and `needsKeyAgain()`.

**Self-hosted CSP** (`src/storage`). `selfHostedCSP({ serverOrigin, aiOrigins, allowWebLLM, allowOverpass })`.

**Server** (`server/`). `POST /api/auth/refresh` returns a fresh token; the app should call it weekly and on start-up. New settings: `AT_WEBHOOK_TOKEN` (add `?token=…` to every Africa's Talking callback URL), `GASKIN_ALLOW_UNSAFE_CONFIG` and `AI_PROCESSOR_AGREEMENT`. `.env.example` and `docs/hosting.md` should list them.

## Open items for the UI agents

| ID | Screen | What to do |
|---|---|---|
| UI-01 | Settings, storage section; onboarding's storage step | Offer "Protect records with a passphrase", recommended when records go to a folder or USB stick. Call `enableEncryption`; show `passphraseProblem` as she types; say plainly that a forgotten passphrase cannot be recovered and suggest writing it down. When `status().state === 'needs_passphrase'`, show an unlock screen before Today that calls `store.unlock()`. Add "Lock now" to the menu. Tell her to delete old plain-text files in `backups/` after switching on. |
| UI-02 | Settings, "Import backup" | Call `validateImportedState(parsed.state)` before `dispatch({ type: 'import' })`, show `problems` when it fails, use `counts` in the toast, and import `result.state`, not the raw file. For an encrypted file, ask for its passphrase and use `decryptWithPassphrase`. |
| UI-03 | Settings, "Your own API key"; onboarding key step | Replace the direct `localStorage` reads and writes in `Settings.tsx` (`restoreAISettings`, `persist`) with `loadAISettings` and `saveAISettings`. Add a choice: "Remember on this phone", "Until I close Gaskin" or "Ask me every time", defaulting to the second on shared devices. Add "Remove my key from this phone" calling `forgetAIKey()`. When `needsKeyAgain()` is true, ask for the key rather than falling back silently. |
| UI-04 | Handout preview (`HandoutSheet.tsx`) | Keep the sandbox without `allow-scripts`, and drop `allow-same-origin`. For printing, open the HTML as a `blob:` URL in a new window, or keep `allow-same-origin` only on a hidden print frame. |
| UI-05 | Today, store | When some records cannot be read, say how many, rather than dropping them silently. |
| UI-06 | Compose | For a mother whose `phone.access` is `none`, or who has no number, offer only the printed sheet and voice through a carer, and say why. |
| UI-07 | Every screen with outbound links | Library, plan sources and visit sources render `s.url` from data. The engine now cleans worker and learned sources, but the screens should still render only `http:` and `https:` links, as a second layer. |
| UI-08 | Long names and RTL | A 300-character name and Arabic text were not tested on the redesigned screens. Check truncation on Today cards and the dual-language view's `dir` on the worker side. |

## Residual risks

Some risks remain by design, and a pilot should know them.

Regex de-identification misses names it has never seen. A neighbour's name typed into a note, or a place described as "behind the mosque in Ajegunle", can reach a cloud model; "BVN 22123456789" and a bare "803 123 4567" also passed the scrubber in testing. The "What the AI sees" panel and the leak check reduce this, and switching AI off or running it on the device removes it. Pseudonymised prompts are still personal data under the NDPA, Kenya's DPA and Ghana's DPA.

Encryption protects a lost stick, not an open laptop. While Gaskin is unlocked, anyone at the keyboard, or malware on the computer, can read the records. A weak passphrase can be guessed offline, slowly. The MCP connector cannot yet read encrypted files, so a worker who uses both must choose. A forgotten passphrase loses the records.

Guardrails are pattern lists in seven languages. A reply in Hausa or Igbo that reassures in words the lists do not know will pass to the worker, who still has to read it and tick "I have read this message" before it sends. That human step is the real control, and it should stay mandatory.

The browser copy and the folder file are written separately, and the MCP connector and the app can still write the same file within the same second. Backups keep the earlier version, but a lost write is possible.

The server's PIN is four to eight digits. With the per-number limit, an attacker gets about 960 guesses a day per account before lockouts, against a million possible six-digit PINs. Six digits should be the minimum for a pilot, and a second factor for supervisors and admins is worth planning.

## Test results

Suites were run at the start of the review and again at the end. The Playwright walk-through passed all 32 steps at the start, with no console errors and no horizontal scroll, in light and dark themes, at phone and desktop sizes, and from `file://`. Its screenshots went to a scratch folder, so the published ones in `docs/screens/final` were not disturbed.

Near the end, two modules imported by another agent's concurrent engine edits (`src/engine/constraints.ts` and `src/clinical/guides.ts`) did not yet exist, which stopped every engine-dependent suite for about fifteen minutes. Both have since landed and the final runs below are on the shared tree. One front-end test fails there: "every item and alert carries a template key from MOTHER_TEXT" reports that the new `untested.refer` item has no `motherTextKey`. That item arrived with the other agent's engine change at 19:30 and is theirs to finish (QA-07); the same suite passed in full, 442 of 442, on a copy taken just before it.

| Suite | At the start | At the end |
|---|---|---|
| Front end (`npm test`, `src/`) | 33 files, 410 tests passed | 441 of 442 passed; the one failure is QA-07 (another agent's new item) |
| Server (`server/`, `npm test`) | 7 files, 31 tests passed | 8 files, 46 tests passed |
| MCP connector (`mcp-server/`, `npm test`) | 2 files, 21 tests passed | 3 files, 39 tests passed, including the end-to-end tests against the rebuilt `dist/server.js` |
| Build (`npm run build`) | Passed: `dist/index.html`, 2.04 MB | Passed: 3.07 MB (the redesign added React Aria) |
| Walk-through (`scripts/walkthrough.mjs`) | 32 of 32 steps | Not rerun: the screens were mid-redesign |
| `npm audit` | Front end 0; server 1 high (nodemailer); MCP 6 (3 high, 3 low, build-only) | 6 Nov: `--omit=dev` is 0 in all three packages. The MCP build tool still carries 6 (3 high, 3 low) with no fixed release; see SEC-26 |

The most serious finding was the quietest. Nothing crashed and no test failed when a referral hospital's name came back as the mother's own health post; the message simply sent her to the wrong place.

## Release 2 additions (6 November)

- **Desktop launchers.** The servers in `release/Gaskin-desktop.zip` (`app/serve.py`, `app/serve.ps1`, `app/serve.js`) bind `127.0.0.1` only, answer GET and HEAD for a fixed list of nine paths with no directory listing, and send `nosniff`, `no-referrer` and `X-Frame-Options: DENY`. `scripts/test-desktop.mjs` checks that raw `../` and percent-encoded traversal requests are refused. The PowerShell server has not yet been run on Windows.
- **Recovery code shown before sign-in.** Resetting a forgotten PIN with the recovery code used to sign the worker in at once, which closed the lock screen before the replacement code appeared, so the new code was never seen and the old one no longer worked. The new code is now shown first and sign-in follows.
- **Saves flushed on page hide.** Changes are coalesced for 400 ms; a reload or a closed tab inside that window lost the last change. The store now starts the write at once on `pagehide`, `beforeunload` and when the tab is hidden, which narrows the window to about 200 ms; browsers do not wait for IndexedDB during unload, so it cannot close it entirely.
- **Personal use.** A woman who sets Gaskin up for herself in Nigeria, Kenya or Ghana now gets her own empty record, linked to her profile. Before, "My day" showed the first demo mother on the device, in that mother's language. Elsewhere the rules engine has no country rules yet, so no record is made and this remains open.
