# Gaskin module contracts

All shared types live in `src/types/index.ts`. Each module exports exactly the functions below from its `index.ts`. Modules are built in parallel; code against these signatures.

## Clinical knowledge base and rules engine (`src/clinical`, `src/engine`)

From `src/clinical/index.ts`:
- `CITATIONS: Record<string, Citation>`
- `TRADITIONAL_PRACTICES: TraditionalPractice[]`
- `SYMPTOM_LABELS: Record<SymptomCode, string>`
- `CONDITION_LABELS: Record<ConditionCode, string>`
- `CATEGORY_LABELS: Record<PlanCategory, string>`
- `EVIDENCE_LABELS: Record<EvidenceGrade, { label: string; description: string }>`
- `IMMUNISATION_SCHEDULES: Record<CountryCode, { ageDays: number; label: string; vaccines: string[] }[]>`
- `LOCAL_FOODS: Record<CountryCode, { name: string; nutrients: string[]; costTier: 'cheap' | 'moderate' | 'dear'; notes?: string }[]>`

From `src/engine/index.ts`:
- `type PlanContext = { overrides: Override[]; learnedRules: LearnedRule[]; previous?: { version: number; itemIds: string[]; alertIds: string[] } }`
- `deriveState(mother: Mother, asOf: string): PatientState`
- `buildPlan(mother: Mother, asOf: string, ctx: PlanContext): CarePlan`
- `ruleMatches(cond: RuleCondition, mother: Mother, state: PatientState): boolean`
- `upsertProposal(override: Override, mother: Mother, state: PatientState, proposals: RuleProposal[], now: string): RuleProposal[]`
- `approveProposal(p: RuleProposal, reviewerId: string, note: string, now: string): { proposal: RuleProposal; rule: LearnedRule }`
- `gestationalWeeks(lmp: string, asOf: string): number`
- `eddFromLmp(lmp: string): string`

## Data, countries, messaging, demo scenarios (`src/data`, `src/messaging`, `src/demo`)

From `src/data/index.ts`:
- `COUNTRIES: Record<CountryCode, CountryProfile>`
- `LANGUAGE_NAMES: Record<LanguageCode, string>`
- `DEMO_START_CLOCK: string`
- `createSeedState(): DemoState`

From `src/messaging/index.ts`:
- `chooseChannel(mother: Mother, country: CountryProfile): { channel: Channel; reason: string; alternatives: Channel[] }`
- `smsSegments(text: string): number`
- `estimateCost(channel: Channel, text: string, country: CountryProfile): { local: number; usd: number; units: number; unitLabel: string }`
- `composeFallbackMessage(plan: CarePlan, mother: Mother, opts: { channel: Channel; language: LanguageCode; itemIds?: string[] }): string`
- `parseSymptomsFromText(text: string): SymptomCode[]`

From `src/demo/index.ts`:
- `type Scenario = { id: string; title: string; description: string; appliesTo: (m: Mother, s: PatientState) => boolean; apply: (state: DemoState, motherId: string) => DemoState }`
- `SCENARIOS: Scenario[]`
- `advanceClock(state: DemoState, days: number): DemoState`

## Illustrations and handouts (`src/illustrations`)

From `src/illustrations/index.ts`:
- `ILLUSTRATION_KEYS: IllustrationKey[]`
- `renderIllustration(key: IllustrationKey, opts?: { size?: number; title?: string }): string` (inline SVG markup)
- `renderHandoutHTML(input: { mother: Mother; plan: CarePlan; items: PlanItem[]; language: LanguageCode; translated?: Record<string, string>; brandName: string; workerName?: string; facilityName?: string; emergencyLine?: string }): string` (a complete printable A4 HTML document)

## AI layer (`src/ai`) and privacy (`src/privacy`)

Gaskin works fully with no AI (mode `none`, the template provider is a first-class mode). AI is optional and comes from anywhere; every prompt is de-identified on the device first. Pseudonymised data can still be personal data under the NDPA / Kenya DPA / Ghana DPA, so consent and processor agreements still apply to cloud providers; `none` and `on_device` avoid transfer altogether.

From `src/ai/index.ts`:
- `type AIProvider = { id: string; label: string; live: boolean; personaliseMessage(a: { plan: CarePlan; mother: Mother; channel: Channel; language: LanguageCode; itemIds: string[]; maxChars?: number; signal?: AbortSignal; onText?: (t: string) => void; facilityName?: string; workerName?: string; emergencyLine?: string }): Promise<string>; translate(a: { texts: Record<string, string>; language: LanguageCode; signal?: AbortSignal; mother?: Mother; plan?: CarePlan; channel?: Channel }): Promise<Record<string, string>>; extractFindings(a: { text: string; signal?: AbortSignal; mother?: Mother; plan?: CarePlan }): Promise<ExtractedFinding[]>; explainPlan(a: { plan: CarePlan; mother: Mother; signal?: AbortSignal; onText?: (t: string) => void }): Promise<string>; suggestItems(a: { plan: CarePlan; mother: Mother; signal?: AbortSignal }): Promise<Array<Pick<PlanItem, 'title' | 'detail' | 'motherText' | 'category'>>> }`
  - Optional extras (all backwards compatible): pass `mother`/`plan` to `translate` and `extractFindings` so her identifiers are scrubbed and dates made relative; `workerName`/`facilityName`/`emergencyLine` for the sign-off (otherwise looked up from `setPrivacyDirectory`).
  - Live providers never throw on AI failure: they return the template result and report it via `aiStatus`. Aborts (`signal`) reject with an `AbortError`.
- `getAIProvider(): Promise<AIProvider>`: provider for the current settings, cached. `auto`: Claude via the artifact `sample` capability if it resolves within 10 s, else the build-time OpenAI-compatible server (`VITE_AI_BASE_URL`, `VITE_AI_MODEL`, `VITE_AI_API_KEY`), else templates. Re-call after `configureAI`.
- `validateAIText(text: string, plan: CarePlan, mother: Mother, opts?: { audience?: 'mother' | 'worker'; allowedSource?: string }): { ok: boolean; issues: string[] }`: medicines or doses not in active items, "stop taking"/"no need to go"/"it is normal" while alerts exist, missing danger-sign line with emergency/urgent alerts, leftover placeholders, "[needs translation]". Use `audience: 'worker'` for plan explanations.
- `type AISettings = { mode: 'auto' | 'none' | 'claude_here' | 'own_key' | 'on_device' | 'any_app'; ownKey?: { kind: 'openai_compatible' | 'anthropic' | 'gemini'; baseUrl?: string; model: string; apiKey: string }; onDevice?: { kind: 'local_server' | 'in_browser'; baseUrl?: string; model: string; deidentify?: boolean } }`
- `configureAI(s: AISettings): AISettings` (throws a plain-English `Error` if incomplete; the UI persists settings in browser storage and calls this at startup), `getAISettings(): AISettings` (default `{ mode: 'auto' }`).
- `PROVIDER_OPTIONS: Array<{ id; mode; label; description; needs; cost; privacy; leavesDevice: boolean; tasks; fields?: ('ownKey' | 'onDevice')[]; presets?: { label; kind; baseUrl?; model }[] }>`, one per mode.
- Status: `aiStatus: { get(): AIStatus; subscribe(fn: () => void): () => void }` (works with `useSyncExternalStore`), `onAIStatus(listener: (s: AIStatus) => void): () => void`, `getAIStatus()`. `AIStatus = { provider: string; label: string; live: boolean; mode?: string; lastError?: string; lastFallbackOp?: string; at?: string }`; `provider` is `'none'` when AI is switched off, `'template'` when templates answer in another mode.
- Copy and paste (`any_app`): `onManualRequest(listener: (r: { id: string; task: string; prompt: string; instructions: string; expects: 'text' | 'json'; createdAt: string }) => void): () => void` (pending requests replay to new listeners), `submitManualReply(id: string, text: string | null): boolean` (null/empty cancels), `cancelManualRequest(id: string): boolean`, `getPendingManualRequests()`. The provider call stays pending until a reply or cancel; guardrails then run and the template replaces a failing reply.
- On device: `hasWebGPU()`, `WEBLLM_MODELS` (Qwen2.5-1.5B, Llama-3.2-1B, Gemma-2-2B MLC ids), `onWebLLMProgress(listener)`. WebLLM loads at run time from jsDelivr only when WebGPU exists; weight download failures (e.g. in the sandboxed hosted demo) are reported in `aiStatus.lastError`.
- `on_device` and `any_app` are constrained: only personalise, translate and extract use the model; explain and suggest use templates (`[]` for suggestions).
- Also exported: `templateProvider`, `composeTemplateMessage`, `extractFindingsFromText`, `filterSuggestions`, `MEDICINE_LEXICON`, `findMedicines`, `createClaudeSampleProvider`, `createOpenAICompatibleProvider`, `createOnDeviceProvider`, `createManualProvider`, `prompts`, plus the privacy functions below.

From `src/privacy/index.ts` (also re-exported from `src/ai` where noted):
- `setPrivacyDirectory(dir: { mothers?: Mother[]; workers?: { id; name }[]; facilities?: { id; name; region }[]; extraNames?: { name; placeholder? }[] })`: the store should call this once with the seed state so every known name, community and facility is scrubbed everywhere. (re-exported)
- `deidentify(input: { text: string; mother?; plan?; asOf?; workerName?; facilityName? } | { plan: CarePlan; mother: Mother; itemIds?; includeDetail?; workerName?; facilityName? }): { text?: string; payload?: SafeContext; map: ReidentifyMap; removed: PrivacyCategory[]; terms }` (re-exported)
- `reidentify(text: string, map: ReidentifyMap): string`: restores first names, worker, facility locally. (re-exported)
- `previewForAI(task: 'personalise' | 'translate' | 'explain' | 'suggest' | 'extract', args: { plan?; mother?; channel?; language?; itemIds?; maxChars?; texts?; text? }): { text: string; removed: string[]; categories: string[]; provider: string; mode: string; wouldSend: boolean; bytes: number }`: byte-identical to what the current settings would send. (re-exported)
- `getAIAuditLog(): Array<{ id; at; provider; mode; task; categories: string[]; removed: string[]; bytes: number; destination: 'cloud' | 'on_device' | 'artifact_host' | 'copy_paste' | 'none'; deidentified: boolean; outcome: 'sent' | 'blocked' | 'error' | 'fallback'; note? }>`: in memory, no content. (re-exported)
- Placeholders: `[MOTHER] [BABY] [CARER] [WORKER] [DOCTOR] [PERSON] [PHONE] [EMAIL] [ID] [ADDRESS] [COMMUNITY] [FACILITY] [REGION] [DATE] [EMERGENCY_LINE]`. Age becomes a five-year band (adolescent flag kept); dates become relative; location becomes country + zone.

## Language (`src/i18n`)

Two languages on one screen. The worker's language (chosen at onboarding) drives the whole interface. Each patient has her own language (set at registration, defaulting to her location's language; the midwife can change it), used only for mother-facing content: plan mother text, Show to mother, handouts and messages. Packs download once and work offline. Anything not translated falls back to plain English and is labelled; nothing is guessed. Pidgin is optional and never a default.

From `src/i18n/index.ts`:
- Types: `PackCode = LanguageCode | 'fr'`, `PackStatus = 'reviewed' | 'machine_draft' | 'partial' | 'none'`, `Confidence = 'reviewed' | 'draft' | 'fallback'`, `LanguagePack { code; name; nativeName; direction: 'ltr' | 'rtl'; version; licence: 'CC-BY-4.0'; status; reviewers; regions; note; ui: Partial<Record<UiKey,string>>; mother: Record<key,string>; glossary: Record<string,string>; confidence?: Record<'ui:…' | 'mother:…' | 'glossary:…', Confidence>; sources }`. Confidence comes from the pack status (`reviewed` gives 'reviewed', otherwise 'draft'), with per-entry overrides in `confidence`; a missing string is 'fallback'.
- Packs: `getPack(code)`, `allPacks()`, `PACKS`, `PACK_ORDER`, `summarisePack(code): PackSummary` (status, size, coverage, installed).
- Install: `installedLanguages(): PackCode[]` (always includes 'en'), `installPack(code, { onProgress?, signal?, durationMs? }): Promise<LanguagePack>` (simulated one-time download, async so a real download can replace it), `uninstallPack(code)`, `isInstalled(code)`, `installProgress(code)`, `packStore` (for `useSyncExternalStore`). Installed list is kept in browser storage (`gaskin.i18n.installed.v1`).
- Worker UI: `t(uiKey, lang, params?)`, `uiConfidence(key, lang)`, `dirFor(lang)`, `EN_UI` / `UI_KEYS` (~150 keys: nav, plan categories, stages, alert levels and actions, plan, patient, dual view, confidence, packs, onboarding, settings, common, messages).
- Mother text: `renderMotherText(key, params, lang): { text; lang; confidence; english; key?; missing?: 'key' | 'template' | 'glossary'; checkedLocally; dir }`. Food servings, 'the baby' and dates ('12 Nov') are translated through the pack glossary; if a value has no glossary entry the whole line falls back to English rather than mixing languages.
- Both audiences: `renderForBoth(item | alert, workerLang, motherLang): DualRendering { kind; id; isDanger; level?; illustration; worker: { lang; dir; heading; headingConfidence; title; detail; clinicalLang: 'en'; plain }; mother: MotherRendering | null; english; showPictogram; showEnglishBeneath }`. Rule: alerts, `danger_signs` items and `refer.*` items always show their pictogram, and in a draft language also show the English line beneath. Worker-only items have `mother: null`. Items with no `motherTextKey` fall back to their English `motherText`.
- Templates: built on `MOTHER_TEXT`; `registerTemplates(source, table)` adds another module's plain-language table (e.g. `VISIT_TEXT`) so packs can translate it; `englishTemplates()`.
- Local review: `markChecked(lang, key, text, { workerId? })`, `unmarkChecked`, `isCheckedLocally`, `listLocalReviews()`, `reviewStore`. Stored in browser storage (`gaskin.i18n.reviews.v1`), tied to a hash of the exact text; never upgrades confidence.
- Back-translation: `backTranslate({ key?, text, from, to, signal? }): Promise<string | null>` (live AI provider only; null when AI is off; sends the pack template with {placeholders}, never her filled-in line), `setBackTranslator(fn | null)`.
- Patient language: `defaultPatientLanguage(location?: { country; region; language? }, onboardingDefault?: LanguageCode): LanguageCode` (explicit `language`, then region table `REGION_LANGUAGE`, then the onboarding default, then the country default: NG en, KE sw, GH en).

Components (from `src/i18n/index.ts`; styles self-inject, use theme `var(--…)` tokens, classes prefixed `i18n-`):
- `<LanguagePicker uiLang value onChange multiple? only? hidePidgin? installOnSelect? downloadMs? label? onInstalled? />`: search by English or native name, status badge, size, coverage, download with progress, remove.
- `<DualLanguageView item? | alert? workerLang motherLang motherName? workerId? hideShowToMother? allowBackTranslate? />`: worker side (her language headings, clinical detail in English, the mother line in her language) and mother side (her language, plain words, pictogram, confidence badge, "I checked this", "What does this say?"). Side by side above 720px, stacked below.
- `<ShowToMother item? | alert? workerLang motherLang motherName? onClose />`: full-screen, large type in the mother's language with the pictogram; confidence note in the worker's language only; English line beneath for draft danger lines. Escape closes.
- `<ConfidenceBadge confidence lang checked? compact? />`.

## Visits: guided visit checklists (`src/visits`)

From `src/visits/index.ts`:
- `buildVisitChecklist(mother: Mother, asOf: string, opts?: { visitTemplateId?: string; childId?: string; referralFacilityId?: string }): VisitChecklist`: the due visit for her stage (or the one asked for), personalised from her record: risk factors add checks (SCD, HIV, previous caesarean, twins, preterm/LBW, low milk supply, diabetes, hypertension, anaemia), tests and one-time newborn checks already done are skipped (listed in `skipped`), vaccines due today come from `IMMUNISATION_SCHEDULES` with catch-up and 4-week intervals, milestones use the child's corrected age, and items are ordered by section then priority.
- `checklistToEvents(checklist: VisitChecklist, results: Record<string, ChecklistResult>, workerId: string, asOf: string): ClinicalEvent[]`: one `visit` event (note carries `done:` ids so one-time checks are not repeated), plus `vitals`, `growth`, `lab`, `screening`, `feeding`, `immunisation`, `medication`, `symptom` (so the engine raises its danger-sign alerts) and one `referral` per person for findings whose action is `refer`. Append to `mother.events` and rebuild the plan.
- `referralAlerts(mother: Mother, asOf: string): Alert[]`: open visit referrals from the last 14 days as alerts. Findings with no symptom code (club foot, cleft palate, hips, eyes, genitals, development) reach the worker this way; merge with `plan.alerts`.
- `evaluateFindings(checklist, results): Finding[]`, `findingsFor(item, result)`, `findingsToAlerts(findings): Alert[]`, `isItemActive(item, checklist, results)`, `dueTemplateId(mother, asOf, childId?)`, `vaccinePlan(f, child, country)`, `plainVaccines(codes)`.
- `VISIT_TEMPLATES` (22: preconception; ANC 1–8 at 12/20/26/30/34/36/38/40 weeks; birth; PNC 24 h, 48–72 h, 7–14 days, 6 weeks; child 10 wk, 14 wk, 6, 9, 12, 15, 18, 24 months), `CATALOGUE`, `CDC_MILESTONES`, `WHO_MOTOR_WINDOWS`, `VISIT_CITATIONS`.
- `VISIT_TEXT: Record<string, string>`: mother-facing templates with `{placeholders}` (`vt.*` and `ms.*` keys; items may also point at `MOTHER_TEXT` keys). The component registers it with `registerTemplates('visits', VISIT_TEXT)` on load; packs translate it like `MOTHER_TEXT`. `renderVisitText(key, params)` renders English.
- Types: `VisitChecklist { id; templateId; label; motherId; asOf; country; stage; visitType; contactNumber?; children[]; context[]; personalisation[]; sections: { id; title; items }[]; items: ChecklistItem[]; skipped[]; nextVisit?; referralFacilityId? }`; `ChecklistItem { id; baseId; section: 'ask'|'check_mother'|'check_baby'|'milestones'|'do'|'tell'|'book'; subject; childId?; title; how?; why; sources; priority; input; emit?; illustration?; once?; dependsOn?; textKey?; params?; english?; subKeys?; vaccines?; dueDate?; next?; because? }`; `ChecklistResult { itemId; status; value?; value2?; choice?; choices?; selfHarm?; date?; note? }`; `Finding`.
- Component: `VisitChecklistView` (also `src/visits/components/VisitChecklist.tsx` as `VisitChecklist`), props `{ mother; asOf; workerLang; motherLang; workerId?; options?: BuildOptions; onComplete(events, checklist, results); onCancel() }`. One section at a time, 48 px+ targets, `visit-` classes, theme custom properties, styles injected once.

## Setup, location and storage (`src/setup`, `src/location`, `src/storage`)

Guided onboarding picks the quickest working setup for the person and applies it with one button. Location profiles flavour plans with local foods, practices, malaria policy and named referral hospitals. Storage keeps records in a chosen folder (USB stick), the browser, or the browser plus backup files. Docs: `docs/location-data.md`, `docs/run-anywhere.md`.

From `src/setup/index.ts`:
- `<OnboardingWizard onComplete={(plan: SetupPlan, answers: SetupAnswers) => void} initialAnswers? env?: SetupEnvironment onSkipAll?: () => void applyOptions? />`: full-screen, one question per screen (14 questions, branching), progress dots, back/skip, pictograms, text in the worker's language from question 2 (local drafts for pcm/ha/yo/ig/sw/tw/fr/zh, then `t()` from src/i18n, then English). Ends on "Here is your setup"; the button calls `applySetupPlan` (storage, `installPack` for each language, `configureAI` with de-identification on, location profile, then saves). Classes `setup-*`; theme via `var(--…)`.
- `recommendSetup(answers: SetupAnswers, env?: SetupEnvironment, now?): SetupPlan`: deterministic rules. `SetupPlan = { version; createdAt; country; countryName; region; district?; locationProfileId; run: { where: 'phone_app'|'laptop_usb'|'laptop_browser'|'facility_hub'; label; reason }; storage: { mode: 'browser'|'folder'|'file'; label; reason; backupEveryDays; locationLabel? }; languages: { ui; worker; mothers: LanguageCode[]; install; notes }; ai: { mode: 'none'|'auto'|'on_device'|'own_key'|'any_app'|'connect_assistant'|'claude_here'; settings: AISettings; label; reason; deidentify: true; needsKey?; assistant?; fallback }; channels: { channel; primary; reason }[]; printing: { where; routine }; sync: { routine; method }; firstTenMinutes: string[]; notes: string[] }`. `planChannels(plan)` gives channels primary first.
- `applySetupPlan(plan, answers, { apiKey?, onProgress?, online?, packDurationMs?, deps? }): Promise<ApplyResult>`: never throws; own_key without a key falls back to `any_app`; AI errors fall back to `none`; persists AI settings under `gaskin.ai-settings.v1` (same key as Settings).
- `useSetup(): SavedSetup | null` (`{ plan; answers; completedAt; applied? }`), `setupStore` (`get/set/subscribe`), `getSetupPlan()`, `isSetupDone()`, `resetSetup()`. Stored under `gaskin.setup.v1`.
- `connectAssistant(target: 'claude_desktop'|'claude_web'|'chatgpt'|'other'): Promise<AssistantConnection>` (stub: `.mcpb` download for Claude Desktop, copyable connector address for others) and `setAssistantConnector(fn)` for the MCP server agent to supply the real one.
- Also: `QUESTIONS`, `visibleQuestions(answers)`, `detectSetupEnvironment()`, `requestPosition()`, `SetupIcon`, `st(key, lang)`.

From `src/location/index.ts`:
- `type LocationProfile = { id; country; region; regionKind; capital; centroid; district?; languages; otherLanguages; localFoods: { name; nutrients; householdMeasure; season; costTier; why; sourceIds }[]; seasonality; prevalentPractices: string[]; malariaEndemic; malariaRisk; malariaNote; referralFacilities: { name; type; town; townLatLon?; distanceKm: number | null; note?; sourceIds }[]; connectivityNote; sources: Citation[]; reviewedAt; origin: 'curated'|'generated'|'country_default' }`
- `getLocationProfile(country, region): LocationProfile` (curated for the 18 demo regions, aliases such as Calabar or Bolga; otherwise a country default with no invented facilities), `hasCuratedProfile`, `listRegions(country)`, `nearestRegion(lat, lon)`, `withDistances(profile, lat, lon)`.
- `toPlanLocation(profile)`: the engine's `PlanContext.location` shape.
- `buildLocationProfile({ country, region, district?, lat?, lon? }, { online?, fetchImpl?, radiusKm?, timeoutMs? })`: offline returns the curated profile at once; online adds named OSM hospitals (Overpass) and caches under `gaskin.location.cache.v1`. `OPEN_DATASETS` lists the dataset URLs. `saveLocationProfile` / `loadSavedLocationProfile` (`gaskin.location.profile.v1`).

From `src/storage/index.ts`:
- `createStore<T>({ mode?: 'auto'|'browser'|'folder'|'file', backupEveryDays?, keepBackups?, backupIntervalMin?, describeAs?: 'usb'|'folder', saveDebounceMs?, deps? }): Promise<GaskinStore<T>>` with `load()`, `save(data)` (coalesced), `subscribe(fn: (s: StoreStatus) => void)`, `status()`, `chooseFolder()` and `reconnectFolder()` (call from a click), `exportFile()`, `importFile(blob)`, `setMode(mode)`, `mode`. `StoreStatus = { mode; state: 'idle'|'loading'|'saving'|'saved'|'needs_folder'|'needs_permission'|'error'; message; savedAt?; where; lastBackupAt?; backupDue; persisted?; kvKind? }`. Folder mode writes `gaskin-data.json` plus rolling `backups/gaskin-data-<time>.json`; every mode mirrors to IndexedDB (localStorage, then memory, as fallbacks).
- `getAppStore<T>(opts?)`: the shared app store (also used by `applySetupPlan`). `detectCapabilities()`, `chooseMode(caps, remembered?)`, `openKV()`.
- `registerPWA()`: adds `manifest.webmanifest` and registers `sw.js` only over http(s), top-level, when the files exist; no-op from file:// or in an iframe. `pwaSupport()`.

## Hosted (`src/hosted`, `server/`)

One `Backend` interface for shared data, three implementations, chosen automatically. Docs: `docs/hosting.md`.

From `src/hosted/index.ts`:
- `pickBackend(opts?: { prefer?: 'artifact'|'http'|'local'; serverUrl?; artifact?; http?; local? }): Promise<{ backend: Backend; reason: 'artifact'|'server'|'server_needs_login'|'local'; serverUrl? }>`: never throws. Artifact runtime present → artifactBackend (falls back to local with `status().fallbackReason` when `claude.use('db')` is null); else a server URL (`opts.serverUrl`, `?server=`, saved, or `VITE_GASKIN_SERVER_URL`) → httpBackend, or local with reason `server_needs_login` when nobody is signed in (show phone + PIN, call `login()`, then `pickBackend()` again); else localBackend.
- `interface Backend {`
  - `kind: 'artifact'|'http'|'local'`
  - `load(): Promise<HostedSnapshot | null>` (null: empty store, offer "load demo data" → `importSnapshot`)
  - `subscribe(fn: (u: BackendUpdate) => void): () => void` (subscribe once; fires for local and remote changes)
  - `appendEvents(motherId, events: ClinicalEvent[]): Promise<void>` (append-only, idempotent by event id)
  - `saveMother(mother: Mother)`, `saveOverride(o)`, `saveProposal(p)`, `saveRule(r)`, `saveInbound(m)`: `Promise<void>`, optimistic (subscribers hear the change at once; saving is debounced and retried)
  - `sendMessage(req: SendMessageRequest, opts?: { onStatus?(u: MessageStatusUpdate) }): Promise<SendMessageResponse>` (artifact and local simulate delivery; numbers ending 0000/0001 fail as do-not-disturb / switched off)
  - `aiProxy(req: AIProxyRequest, opts?: { signal?; onText?(text) }): Promise<AIProxyResponse>`, `hasAIProxy(): boolean` (http only; others reject with `BackendError` code `unavailable`)
  - `whoami(): Promise<Identity>`, `saveMeta(patch: SharedMeta)` (shared demo clock, library version, other AppState fields), `getUserSettings(key)`, `setUserSettings(key, value)` (private per user), `importSnapshot(s)`, `flush()`, `status(): BackendStatus`, `close()` `}`
- `HostedSnapshot = { mothers: Mother[]; overrides; proposals; learnedRules; outbound: OutboundMessage[]; inbound: InboundMessage[]; meta: SharedMeta }`.
- `BackendUpdate = { snapshot; changedMotherIds: string[] | 'all'; notes: BackendNote[]; messageUpdates: MessageStatusUpdate[]; status: BackendStatus; origin: 'local'|'remote' }`. Show `notes` (conflicts: "Ngozi's record was saved by someone else at the same time as you…", offline, read-only) as toasts.
- `BackendStatus = { kind; label; online; pending; lastSyncAt?; stale; fallbackReason? }` for the status line.
- `Identity = { userId; name; role: 'worker'|'supervisor'|'clinical_reviewer'|'programme_officer'|'admin'; facilityIds; workerId?; country?; canWrite; source }`.
- `MessageStatusUpdate = { messageId; motherId?; status; at; provider?; providerMessageId?; reason?; costLocal?; costUSD?; currency?; simulated? }`. Status only moves forward (`laterStatus`).
- Also: `login(baseUrl, phone, pin)`, `savedSession()`, `clearSession()`, `getDeviceId()`, `createArtifactBackend`, `createHttpBackend`, `createLocalBackend`, `ARTIFACT_CAPABILITIES`, `toArtifactDocs(snapshot)`, `BackendError` (`code: 'unavailable'|'unauthorised'|'forbidden'|'offline'|'invalid'|'conflict'|'server'`), wire types `SyncOp`, `SyncRequest`, `SyncResponse`, `ChangeRow`.
- localBackend saves the same AppState object as before (record arrays plus every other field as `meta`) through `getAppStore()`; in local mode save through the backend only.

Artifact demo `db` layout: `mothers/<id>` (profile + events, chunked to `mothers/<id>/events/cN` past ~160 KB), `messages/<motherId>`, `overrides/<id>`, `proposals/<id>`, `rules/<id>`, `meta/demo`, `data/users/<viewerId>/settings`. Publish with `ARTIFACT_CAPABILITIES`: `db.rules = [{path:'', read:'view', write:'interact'}, {path:'rules', read:'view', write:'admin'}, {path:'data/users/{self}', read:'interact', write:'interact'}]`, `user: { scopes: ['profile'] }`, `sample: {}`, `downloads: true`. Seed with `cd server && npm run artifact-seed -- <dir>` and ArtifactData batch writes.

Server HTTP API (`server/src/app.ts`): `POST /api/auth/login`, `GET /api/me`, `GET /api/snapshot`, `POST /api/sync`, `GET /api/events` (SSE), `GET /api/mothers/:id/plan`, `GET /api/alerts`, `POST /api/messages/send`, `POST /api/ai` (+ `/preview`), `GET|PUT /api/settings/:key`, `GET /api/reports/dhis2?period=YYYYMM`, `POST /api/reports/dhis2/push`, `GET /api/reports/costs`, `GET /api/public/metrics` (no login), `GET /api/audit`, `POST /api/admin/users|facilities`, `/webhooks/{africastalking/sms|inbound|voice, termii, whatsapp}`.

## Integration (wired 5 Nov, integration engineer)

- **Plans.** `planFor(state, mother)` in `src/store` is the app's one plan computation; it passes `ctx.location = toPlanLocation(getLocationProfile(m.country, m.region))` (cached per region). Open visit referrals (`referral` events with `vc-` ids, last 14 days) are raised as alerts inside the engine by `visitReferralAlerts` in `src/engine/alerts.ts`, with the same ids as `visits/referralAlerts`, so the UI, dashboard, MCP server and server all see them. Their mother text comes from `VISIT_TEXT` (`vt.finding.*`, `vt.refer_*`).
- **Backend.** `src/store/backend.tsx` calls `pickBackend()` once, hydrates the reducer from `load()`, writes local actions through the backend as diffs (`appendEvents`, `saveMother`, `saveOverride`, `saveProposal`, `saveRule`, `saveInbound`, `saveMeta`), applies `subscribe()` updates, and shows notes as toasts and `status()` in the banner. Messages go through `sendThroughBackend()`. `server_needs_login` shows phone + PIN sign-in; an empty shared store offers "Load demo data". Viewers who cannot write keep a per-viewer working copy (artifact overlay), with the note "your changes stay on this device". View state (country filter, acting worker, offline switch, read markers) is per viewer and never shared. The artifact backend now reads the saved overlay before going read-only, so a viewer's changes survive a reload.
- **Setup.** No saved setup opens `OnboardingWizard`, with three presets above it (`PERSONAS` in `src/ui/setupFlow.tsx`). The worker's language from `plan.languages.ui` drives `useT()` through `registerTranslator`. Message templates use the language packs through `registerMessagePacks()` (lines a pack does not translate stay in English).
- **Patient language.** `defaultLanguageFor()` (registration, follows the region until changed) and `motherLanguageOf()` (her side of every dual view). Editable on her record.
- **UI pieces.** `MotherLine` (her line, badge, Show to mother, both languages), `ShowToMotherCard` (flip card), `VisitScreen` (route `visit`), `SettingsExtra` (languages, connect your assistant, storage, run setup again).
