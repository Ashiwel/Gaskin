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

## Visits v2 (5 Nov, clinical logic agent): follow-ups, constraints, unknown tests, how-to, guides

Types (additive, all optional) in `src/types/index.ts` and `src/visits/types.ts`:
- `ConstraintEvent { kind: 'constraint'; itemId; childId?; reason: ConstraintReason; temporary?; note? }` joins `ClinicalEvent`. `ConstraintReason = 'cannot_afford' | 'not_available' | 'side_effects' | 'declined' | 'forgets' | 'no_transport'`. `itemId` is a plan item id (`med.iron_folate`), a test id (`test.haemoglobin`, `test.urine_protein`, `test.malaria_rdt`, … one per `LabTest`), a vaccine (`imm.<CODE>`), or `transport`. "Not done today" is `reason: 'not_available', temporary: true`. Timelines should render it as "Could not: <item> (<reason>)".
- `HowTo { steps: string[]; examples?: string[]; avoid?: string[]; stepKeys?; exampleKeys?; avoidKeys?; illustration?; guideId? }`. Keys point at `PLAN_TEXT` (`src/clinical/planText.ts`, translatable like `MOTHER_TEXT`; register it with `registerTemplates('plan', PLAN_TEXT)` next to `VISIT_TEXT`).
- `PlanItem` gains `howTo?`, `alternatives?: Array<{ reason; item: { title; detail; motherText; motherTextKey?; motherTextParams?; howTo? } }>`, `constraint?: { reason; at }`, `childId?`, `workerOnly?`. `Alert` gains `childId?`.
- `PatientState` gains `unknowns?: Array<{ test; since; consequence; action: 'refer_for_test' | 'test_next_visit'; childId? }>` and `constraints?: Array<{ itemId; reason; at; childId? }>`.
- `ChecklistItem` gains `followUps?: Array<{ when: { answerIn: string[] }; items: ChecklistItem[] }>`, `howTo?`, `isTest?`, `constraintTarget?`, `constraintOn?: Record<string, ConstraintReason>`, `guideId?`.
- `ChecklistResult.status` adds `'not_available' | 'declined' | 'not_done_today'` (test items: offer Done, Not available, Declined, Not done today; a missing result is unknown, never normal or abnormal).
- `ChecklistSummary { abnormal: Finding[]; rechecks: {itemId; label}[]; unanswered: {itemId; label; important}[]; unknowns: {itemId; label; status; consequence; referToday}[]; recommendations: {text; guideId?; itemId?}[]; perChild: {childId; name; answered; total; findings}[] }`.

Behaviour:
- A follow-up opens when the parent's answer (its `status`, `choice`, or any of `choices`) is in `answerIn`. Follow-ups nest. Use `activeItems(checklist, results)` (flat list: top-level items plus open follow-ups, in order) everywhere you would use `checklist.items` for answering, counting or saving; `isItemActive` still handles `dependsOn`. `checklistToEvents` and `evaluateFindings` already include open follow-ups.
- Follow-ups exist for: iron/folic acid (`a.adherence`, `d.ifa`), ART (`a.hiv_art`), ANC attendance (`a.anc_missed`), bed net (`d.itn`), breastfeeding (`a.ebf`), every vaccine (`d.vaccine.*`), diet (`a.diet`), transport (`d.birth_plan`, `a.transport`). Reason answers write a `ConstraintEvent`; the engine then adds the alternative to the plan.
- Engine on a constraint: the original item stays (marked `constraint`), and an `alt.<itemId>.<reason>` item is added. Iron and folic acid with `cannot_afford`: where to get it free (Nigeria: ask at your PHC, free under BHCPF where the PHC is accredited), a local iron-rich food plan with servings from the location profile (food never replaces the tablet in pregnancy, and the item says so), and an earlier Hb recheck (`test.hb_recheck_early`, 4 weeks). `side_effects`: take with food or at night, constipation tips, before stopping. `not_available`: another source or referral.
- Unknown tests: when a missing result could hide danger (urine protein unknown with BP ≥140/90; Hb unknown with pallor or breathlessness; malaria test unknown with fever, mother or child), the engine raises an urgent `alert.untested.<test>` ("Refer for this test today") and an item `untested.<test>`; other unknowns appear as `untested.<test>` items with "test at the next visit".

From `src/visits/index.ts` (new): `summariseChecklist(checklist, results): ChecklistSummary`, `activeItems(checklist, results): ChecklistItem[]`, `EPDS_PLAIN` (10 items: `{ ask, standard, opts: [label, score][], standardOpts }`, worker reads `ask` aloud; `standard` is the validated wording), `EPDS_WORDING_NOTE`, `epdsScore` (unchanged).
From `src/clinical/index.ts` (new): `GUIDES: Record<string, Guide>` (`thinking_healthy`, `back_pain_exercises`, `breastfeeding_positions`, `kangaroo_care`, `birth_preparedness`, `family_planning_after_birth`, `iron_rich_foods`, `breastfeeding_while_pregnant`, `birth_spacing`), `Guide = { id; title; forWorker: { summary; steps?; sessions? }; forMother: { summary; steps }; whereToGetHelp: Partial<Record<CountryCode | 'default', { name; contact?; note }[]>>; sources: Citation[] }`, `PLAN_TEXT`, `HOW_TO`, `howToFor(itemId, category)`.

## Custom visit questions and the Next steps page (5 Nov, patient screens agent)

From `src/visits/customQuestions.ts` (for the Settings agent):
- `listCustomQuestions(filter?: { workerId?; facilityId?; visitType?; templateId? }): CustomQuestion[]`: oldest first. With `workerId`/`facilityId`, only that worker's own questions and their facility's; with `visitType`/`templateId`, only questions for that visit type (`'anc' | 'pnc' | 'child_health' | 'home_visit'…`) or that one template (`'anc3'`, `'pnc_6wk'`…). No filter lists every question on the device (use this in Settings).
- `addCustomQuestion({ text, visitType, answer: 'yes_no' | 'text', scope: 'worker' | 'facility', ownerId, createdBy, createdAt? }): CustomQuestion` (throws a plain-English `Error` on empty text; trims to 240 characters).
- `deleteCustomQuestion(id: string): boolean`.
- `customQuestionStore` (`subscribe`, `getVersion`) for `useSyncExternalStore`, so Settings and an open visit refresh together.
- `CustomQuestion = { id; text; visitType; answer; scope; ownerId; createdBy; createdAt }`. Stored in browser storage under `gaskin.customQuestions.v1` (memory fallback), per worker or per facility.
- Answers are saved on the visit event's `note` as `cq:<id>=<urlencoded "question -> answer">` pairs; `decodeCustomAnswers(note)` reads them back (the Timeline shows them). A visit finished with important items unanswered carries `finished_anyway:<urlencoded reason>` in the same note.
- The visit's Ask step shows these questions and an "Add your own question" control. Deleting lives in Settings.

From `src/illustrations/visitSheet.ts`:
- `renderVisitSheetHTML(input: VisitSheetInput): string`: the mother's printable "Next steps" page after a visit (A4 or Letter via `input.paper`, grayscale-safe, escaped, no scripts, same CSP as the handout). `VisitSheetInput = { name; children?; stage?; language; dir?; labels?: Partial<VisitSheetLabels>; visitDate; medicines: { name; dose?; when?; perDay?; days?; illustration? }[]; foods: { name; serving?; note? }[]; todo: { title; steps?; illustration? }[]; dangerSigns: { label; illustration? }[]; tests: { name; where?; when? }[]; nextVisit?: { date; label?; place? }; emergencyNumber?; workerName?; facilityName?; brandName?; paper? }`.
- `visitSheetText(input, maxChars?)`: the short SMS/WhatsApp version. `VISIT_SHEET_LABELS` holds the English section headings (pass `labels` to translate them).
- `src/ui/patient/NextSteps.tsx` builds the input from her plan (`nextStepsInput`) and shows it after every visit with a language switch, Print (sandboxed iframe), Download (inside the claude.ai viewer, where printing is blocked) and Send as message.

## Several children, constraints, personal mode and review data (5 Nov, clinical logic agent)

Types (additive): `PatientState.children?: ChildState[]` (every child aged 0–1,000 days, oldest first; `infant` stays the youngest), `concurrent?`, `interpregnancyMonths?`, `unknowns?`, `constraints?`. `ChildState { childId; name; sex; dob; ageDays; correctedAgeDays?; feeding; twin; latestWeightKg?; latestWeightAt?; latestMuacCm?; immunisation: { next?; overdue }; milestonesDueMonths?; risks }`. `PlanItem.childId?`, `Alert.childId?`. `ConstraintEvent` also has `declinedReason?: DeclinedReason` (required for 'declined') and `sideEffect?: { symptoms: string[]; severity: 'mild'|'moderate'|'severe' }` (required for 'side_effects'; codes from `SIDE_EFFECTS`). `Mother.selfCare?: { registeredWithClinicAt?; clinicName?; nextCheckupAt? }`. `Override.revertedBy?/revertedAt?`, `RuleProposal.createdBy?`, `OutboundMessage.createdBy?/sentBy?`, `InboundMessage.handledBy?`. `SymptomCode` adds `'pallor'`.

Engine behaviour:
- Stages run together: a pregnancy plan also plans every child under 1,000 days; postpartum and infant plans cover every child. The youngest child's items keep their ids; a sibling's items are `<id>@<childId>` with `childId` set (alerts likewise: `alert.child_fever@c1`). Unlabelled baby symptoms and growth count for the youngest.
- New items: `risk.short_birth_interval` (conception under 18 months after a birth: risk `short_birth_interval`; under 24: `birth_interval_under_24m`), `bf.while_pregnant`, `nutr.sibling_feeding`, `nutr.back_to_back`, `fp.after_close_births`, `family.several_children`. Sources: WHO birth spacing 2005/07, Conde-Agudelo JAMA 2006, López-Fernández 2017, WHO ANC A.2.1, WHO 2023 complementary feeding.
- Every plan item has `howTo` (steps, examples, avoid, translation keys, optional `guideId`).
- Constraints: see Visits v2. Declined adds `alt.<item>.declined` (her decision recorded, the concern answered per reason, offered again) and, for safety-critical items, `alt.<item>.declined_danger`. Side effects: mild gives tips and continue; moderate adjusts and reviews; severe or a serious symptom (rash with blisters, face swelling, breathing difficulty, yellow eyes, convulsion) raises `alert.side_effect.<item>` (urgent, emergency for convulsion, breathing or swelling): stop and refer; reportable groups (IPTp, vaccines/AEFI, ART, aspirin) add the reporting route (Nigeria: NAFDAC Pharmacovigilance Directorate, verified; elsewhere "through your facility").

From `src/engine/index.ts` (new): `PlanContext.mode?: 'worker' | 'personal'`, `nearestFacility?`, `emergencyNumber?`; `childStates(f)`, `activeConstraints(f)`, `computeUnknowns(f)`, `personalItems`, `personalAlerts`; `simulateProposalImpact(proposal, mothers, asOf, ctx): ProposalImpact { mothersAffected; byStage: Record<JourneyStage, number>; byRegion: Record<string, number>; examples: { motherId; before: PlanItem | null; after: PlanItem | null }[] (up to 6); touchesLocked; conflictsWithGuideline: string | null; evidenceGrade; safetyNotes: string[] }`, `proposalTimeline(proposal, overrides): TimelineEntry[] { at; kind: 'override'|'support'|'proposal_created'|'reviewed'|'reverted'; actorId; text; overrideId?; motherId? }` (oldest first), `releaseNotes(rules): { title; entries: { ruleId; approvedAt; approvedBy; change; appliesTo; itemId }[]; markdown }`.
Personal mode: mother text only (each item's `detail` is her line), worker-only items hidden, every alert's `action` is "Go to [place] now/today. If you cannot get there, call [number]." (`personal.go_now` / `personal.go_today`), and `personal.register` / `personal.book` stay at the top until `Mother.selfCare` records them.

From `src/clinical/index.ts` (new): `PLAN_TEXT`, `HOW_TO`, `howToFor(itemId, category?)`, `renderPlanText`, `SIDE_EFFECTS`, `sideEffectGroup(itemId)`, `ADVERSE_EVENT_REPORTING`, `GUIDES`. `renderMotherText` (clinical) also resolves PLAN_TEXT keys. **UI: call `registerTemplates('plan', PLAN_TEXT)` and `registerTemplates('legal', LEGAL_TEXT)` next to `VISIT_TEXT`** so packs can translate them.
Visits: one checklist covers the mother and every child under 1,000 days (each child gets the visit due for her own age; `children[].templateId/templateLabel`); `checklist.bySubject` groups sections per person (mother first, then each child). `opts.childId` narrows to one child and a twin. Also exported: `childTemplateId(ageDays)`.

## Workers (`src/auth`)

Several health workers on one device or facility. Roles match the hosted server (`worker | supervisor | clinical_reviewer | programme_officer | admin`).
- `WorkerProfile { id; name; role; cadre: WorkerRole | 'self'; facilityId; country?; communities: string[]; caseloadMotherIds?; languages; isClinicalReviewer; isSupervisor; personal?; phone?; active; createdAt; createdBy; deactivatedAt?; deactivatedBy? }`.
- `new AuthStore({ kv?, now?, iterations?, autoLockMinutes?, encryptData? })` or `getAuthStore()`: `load()`, `subscribe(fn)`, `listWorkers({ includeInactive? })`, `getWorker(id)`, `isEmpty()`, `addWorker(profile, pin): Promise<{ worker; recoveryCode }>` (first profile needs no actor; later ones need `manage_workers`; show the recovery code once), `updateWorker`, `deactivateWorker`, `reactivateWorker`, `verifyPin`, `changePin(id, current, next): Promise<newRecoveryCode>`, `unlockStatus(id): { locked; lockedUntil?; attemptsLeft; nextLockMinutes; active }`, `resetPinWithRecoveryCode(id, code, newPin): Promise<newRecoveryCode>`, `resetPinBySupervisor(supervisorId, supervisorPin, targetId, newPin): Promise<newRecoveryCode>` (same facility unless admin), `login(id, pin)`, `switchWorker(id, pin)`, `logout()`, `touch()` (on activity), `isLocked()`, `current(): WorkerProfile | null` (null after auto-lock), `getSession()`, `setAutoLockMinutes(n)`, `dataKey(): Promise<CryptoKey | null>`, `auditLog()`. Module-level `unlockStatus`, `resetPinWithRecoveryCode`, `resetPinBySupervisor` use the default store.
- PINs: 4–8 digits, not repeated or sequential (`pinProblem`); PBKDF2-SHA-256, 16-byte salt, 210,000 iterations, constant-time compare. Lockout: 5 wrong PINs, then 1, 5, 15, 60 minutes; always ends on its own; a correct PIN resets it. Recovery code: 16 characters (80 bits), only its hash stored, single use. With `encryptData`, a 32-byte device data key is wrapped by a PIN-derived key and a recovery-derived key for every worker; `dataKey()` hands it to storage encryption while someone is signed in. Every lockout, reset, recovery, sign-in, switch, auto-lock and profile change is audited (no secrets logged). Profiles persist in the KV under `gaskin.auth.v1`; sessions are in memory.
- `can(worker, action)`, actions `view_own_caseload | view_facility | edit_plan | approve_proposals | publish_releases | view_insights_community | view_insights_wider | manage_workers | export_data | change_settings`. `caseloadFor(worker, mothers, 'own' | 'facility')`, `inOwnCaseload`, `profileFromWorker(seedWorker, mothers)`, `hostedRole(profile)`.
- Acting worker on every record: `stampEvent`, `stampOverride`, `revertOverride(o, workerId, at)`, `stampOutbound(m, workerId, 'create'|'send'|'review')`, `stampInbound`, `stampProposal`, `missingActors(state)` (seed returns `[]`). `upsertProposal` sets `createdBy`.

## Legal and personal use (`src/legal`)

- `LEGAL_TEXT` (translatable keys `legal.disclaimer.*`, `legal.terms.*`, `legal.consent.*`; `{number}`), `DISCLAIMER_KEYS`, `TERMS_KEYS`, `CONSENT_KEYS`, `renderLegal(key, params)`, `PersonalConsent`, `CONSENT_VERSION`, `consentValid(c)`.
- `EMERGENCY_NUMBERS: Record<'NG'|'KE'|'GH'|'ZA', { primary; numbers; helplines; sources; checkedAt; caveat? }>`, `emergencyNumberFor(country)`. Verified 5 Nov 2026: Nigeria 112 (NCC); Kenya 999 and 112 (HapaKenya, March 2026); Ghana 112 (Citi Newsroom 2020 and July 2026: 191/192/193 retired, so 193 is not listed); South Africa 10177 landline, 112 mobile (Gauteng DoH, Western Cape Government). No maternal helpline could be verified, so `helplines` is empty.

## Geography (`src/geo`, 6 Nov, geography agent)

Every country, first-level regions for every country, local areas for Nigeria (774 LGAs), Kenya (290 sub-counties), Ghana (261 districts) and South Africa (213 municipalities), and the languages to offer for a place. Bundled and offline (about 130 KB of JSON; local areas load per country on first use). Generated by `node scripts/geo/build.mjs`; sources, licences and counts in `src/geo/SOURCES.md`. A place never gets another country's languages, foods or practices.

From `src/geo/index.ts`:
- Countries: `listCountries(): Country[]` (249; NG, GH, KE pinned first, then A to Z), `searchCountries(q, limit?)` (English, native, alias such as "Ivory Coast" or "DRC", or ISO code), `findCountry(text)`, `getCountry(code)`, `countryName(code)`, `PINNED_COUNTRIES`. `Country { code; name; nativeName?; callingCode?; currency?; aliases: string[] }`.
- Regions (ISO 3166-2 first level): `listRegions(country): Region[]` (A to Z; [] when none: offer free text), `searchRegions(country, q)`, `findRegion(country, codeOrName)` (accepts 'NG-LA', 'Enugu State', 'Kisumu County', 'FCT', 'Bolga', 'KZN'; never matches across countries). `Region { code: 'NG-LA'; country; name }`. `placeWords(country): { region: 'State' | 'County' | 'Region' | 'Province' | …; area: 'Local government area (LGA)' | 'Sub-county' | 'District' | 'Municipality' | …; areaShort }` for labels.
- Areas: `hasAreaData(country)` (NG, KE, GH, ZA: `AREA_COUNTRIES`), `loadAreas(country, region?): Promise<Area[]>` (lazy per country; [] where there is no list, so use free text), `listAreasSync(country, region?): Area[] | null` (null until loaded), `findArea(country, region, name)`. `Area { name; region: ISO 3166-2; lat?; lon? }` (approximate centre, 0.01°).
- Languages: `languagesFor(country, region?, area?)` or `languagesFor({ country, region, area | district }): LanguageChoice[]`, ordered by likely relevance (curated area list, then curated region list, then CLDR national shares; English always; French, Portuguese and Arabic where official). `LanguageChoice { tag (BCP-47); code (pack code if any, else tag: store this); name; nativeName; share? (national %); official?; pack: 'reviewed' | 'draft' | 'partial' | 'none'; packCode?; from: 'area' | 'region' | 'country' | 'always' | 'other' }`.
- "More languages": `allLanguages(place)` (the place's languages, then the rest of the country's, then every other language A to Z with `from: 'other'`; group by `from`), `searchLanguages(q, place?, limit?)` (English or native name, or tag).
- Packs: `packFor(tag): PackCode | undefined` (one to one: 'zu', 'zu-ZA', 'zul' → zu; 'nya' → ny; 'kin' → rw; 'pt-MZ' → pt; 'fuv' and other Fula → ff; 'shu' → ar; 'ak' → tw), `packStateFor(tag)` (read live from the pack registry), `PACK_STATE_LABELS` (`none` → **"Coming soon"**: use this one wording), `packStateLabel(state)`, `NO_PACK_NOTE` (the line shown with a language that has no pack: messages use plain English for now; invite a pack contribution).
- `languageSource(country, region?)`: the citation behind a place's list, for "Why these languages?". `CURATED_AREAS`, `EXTRA_LANGUAGE_NAMES`.
- `defaultLanguageForPlace(place, { explicit?, onboardingDefault? }): { tag; packCode?; pack }` (never Pidgin as a default).
- Malaria defaults outside the curated profiles: `malariaDefault(country): { iptp; endemic; risk; note }` (WHO World Malaria Report 2024), `IPTP_COUNTRIES`, `OTHER_ENDEMIC`, `MALARIA_SOURCES`.

Language identity beyond packs:
- `Mother.languageTag?: string` (BCP-47, optional) records the language she speaks even without a pack (isiZulu, Tiv, Sepedi). `Mother.language` stays the pack code used for rendering ('en' when there is no pack). `Mother.area?` holds her LGA, sub-county or district.
- From `src/i18n`: `motherLanguageInfo({ language, languageTag }): { tag; render: PackCode; packCode?; pack; note? }`: render with `render`; when `note` is set (no pack yet) show "Coming soon" and the note. `defaultPatientLanguage(country, region?, area?, { explicit?, onboardingDefault? }): { tag; packCode?; pack }` is the new form; the old `defaultPatientLanguage(location?, onboardingDefault?): LanguageCode` still works and is now country-safe (a region name only matches inside its own country). `packFor`, `packStateFor`, `PACK_STATE_LABELS`, `NO_PACK_NOTE` are re-exported from `src/i18n`.

Location profiles (`src/location`): `getLocationProfile(country, region)` accepts any ISO country. Nigeria, Kenya and Ghana keep their curated and country-default profiles; any other country gets `origin: 'generic'`: no local foods, practices or facilities, languages from `languagesFor`, and malaria from `malariaDefault`. It never falls back to Nigeria. `genericProfile(country, region)`, `isKnownCountry(code)`. `listRegions` in `src/location` still lists only curated regions; use `src/geo` `listRegions` for dropdowns.

Setup data (`src/setup`, the UI agent builds the components):
- `SetupAnswers` adds `audience?: 'health_worker' | 'supervisor' | 'personal'`, `countryCode?` (ISO, any country; `country` stays 'NG' | 'KE' | 'GH' | 'other'), `regionCode?` (ISO 3166-2), `languageTag?` (her own language in personal use), `personalStage?: ('pregnant' | 'child_under_2' | 'planning' | 'other')[]`, `clinicRegistered?`, `phone?`. `mothersLanguages` accepts any BCP-47 tag as well as pack codes. Helpers: `countryAnswer(code)` and `regionAnswer(country, codeOrName)` (the patches to apply on a pick), `answerCountry(a)`, `answerPlace(a)`, `resolveCountryCode(a)` (also resolves an older typed `countryOther`).
- Questions: `AUDIENCE_QUESTION` ("Who will use Gaskin?", options `AUDIENCE_OPTIONS`) comes first; `visibleQuestions(a)` returns it then `QUESTIONS` (health worker and supervisor; supervisors skip `role`) or `PERSONAL_QUESTIONS` (country, where she lives with area, `languageTag`, `personalStage`, `clinicRegistered`, `phone`, `internet`). Structured questions carry `place: PlaceQuestion`: `country` (`pinned()`, `all()`, `search(q)`), `region` (on the `location` question: `label(a)`, `all(a)`, `search(a, q)`, free text allowed, plus `area: AREA_QUESTION` with `label`, `hasList`, `load`, `now`; answer goes to `district`), `language` (`workerLanguage`, `languageTag`, `mothersLanguages`: `audience`, `multiple`, `top(a)` (show these; `TOP_LANGUAGES` = worker 4, mothers 6, self 4), `all(a)` and `search(a, q)` for the "More languages" sheet, `requirePack` (screens need a pack; mothers may pick any language), `labels`, `noPackNote`). Every question still has `options(a)` for simple renderers.
- `SetupPlan` adds `mode: 'worker' | 'supervisor' | 'personal'`, `countryCode`, `regionCode?`, `languages.motherLanguages?: { tag; name; nativeName; packCode?; pack }[]` (every chosen language, including "Coming soon" ones), and for personal use `personal: { stage; clinicRegistered; nudges: string[]; nearestFacilities: { name; town; distanceKm }[] }`. Personal plans have AI off, storage on the phone, no printing or programme sync, and nudges to register at a clinic and see a health worker. `languages.mothers` stays pack codes. `locationProfileId` is still null outside the launch countries (the generic profile is computed from `countryCode`). Also `setupMode(answers)`.
- Country is chosen in onboarding and Settings only; daily screens should not offer a country switch (founder, 6 Nov).

## UI modules other screens import (`src/ui/accounts`, `src/ui/settings/prefs.ts`, `src/ui/onboarding/geo.ts`)

Workers on this device (`src/ui/accounts/auth.ts`, a React-friendly layer over `src/auth`):
- Types: `Profile` (= `WorkerProfile`), `AuthAction`, `RoleChoice = 'worker' | 'supervisor' | 'clinical_reviewer' | 'programme_officer' | 'personal'`, `NewProfile`, `UnlockStatus`, `AccountsView`. Labels: `ROLE_LABEL`, `ROLE_HINT`, `roleOf(p)`, `roleLabel(p)`. `DEMO_PIN = '2580'` (demo profiles only; `isDemoProfile(id)`).
- Reading: `accountsStore`, `useAccounts(): AccountsView` (re-renders on change), `whenReady()`, `listProfiles(includeInactive?)`, `currentProfile()`, `getProfile(id)`, `can(profile, action)`, `pinLengthOf(id)`, `pinProblem(pin)`, `unlockStatus(id)`, `waitWords(seconds)`, `autoLockMinutes()`, `authAudit()`.
- Changing: `createProfile(input): Promise<{ profile; recoveryCode }>`, `updateProfile(id, patch)`, `setRole(id, role)`, `setActive(id, active)`, `verifyPin(id, pin)`, `resetPinWithRecoveryCode(id, code, newPin)`, `resetPinBySupervisor(supervisorId, supervisorPin, targetId, newPin)`, `changePin(id, current, next)`, `lockNow()`, `logOut()`, `requestSwitch(id | null)`, `switchTarget()`, `touch()`, `setAutoLockMinutes(m)`, `checkAutoLock()`, `useAutoLock()`, `seedDemoProfiles(workers, mothers, signInWorkerId)`, `demoSwitch(id)`, `clearAccounts()`. Functions that change a profile resolve to an error message or `null`.

Account screens (`src/ui/accounts/Accounts.tsx`): `AccountGate` (wraps the app: first-worker setup, lock screen, switch), `LockScreen`, `ProfilePicker`, `ChoosePin`, `RecoveryCodeCard`, `NewWorkerFlow` (`NewWorkerFlowProps`), `Overlay`, `openAddWorker()`, `useWorkerMenuActions()` (lock, switch, add, sign out for the shell menu), `useShellWorker(fallback?)` (who to show as acting).

Display preferences (`src/ui/settings/prefs.ts`), kept on this device under `PREFS_KEY = 'gaskin.prefs.v1'`:
- `Prefs` with `TextSize`, `MotionPref`, `Density`, `DateFormat`, `WeightUnit`, `TempUnit`, `CurrencyDisplay`, `Situation`, `PaperSize`; `DEFAULT_PREFS`, `prefsStore`, `getPrefs()`, `usePrefs(): [prefs, set(patch)]`, `applyPrefs(p?)` (root font size, motion, density on `<html>`), `prefersReducedMotion()`.
- Formatters that honour the preferences: `formatDatePref(iso, fmt?)`, `formatWeight(kg, unit?)`, `formatTemperature(c, unit?)`, `formatMoney(local, currencyCode, usd?, display?)`, `smsCharLimit(parts?)`, `inQuietHours(at?, p?)`.

Places, languages and legal lines for onboarding and Settings (`src/ui/onboarding/geo.ts`, a thin adapter over `src/geo`, `src/i18n` and `src/legal`):
- Places: `geoModuleReady`, `GeoCountry`, `PINNED`, `listCountries()`, `countryName(code)`, `countryCurrency(code)`, `isLaunch(code)`, `flagOf(code)`, `listRegionsFor(country)`, `listDistrictsFor(country, region)`, `loadDistricts(country, region)`, `useDistricts(country, region)`, `regionWords(country)`.
- Languages: `PlaceLanguage`, `languagesFor(place)`, `allLanguages(place)`, `languageName(code, inOwn?)`, `describeLanguage(code)`, `GLOBAL_LANGS`.
- Personal use: `emergencyFor(country): { number; label; verified }`, `dialable(n)`, `Disclaimer`, `personalDisclaimers(country)`, `termsLines()`, `consentLines(country)`, `footerDisclaimer()`, `CONSENT_STORE_KEY`, `saveConsent(c)`, `loadConsent()`, and re-exports `CONSENT_VERSION`, `consentValid`, `renderLegal`, `PersonalConsent`.

Personal "My day" (`src/ui/today/MyDay.tsx`) reads `SetupPlan.personal` (nudges and nearest facilities) and `firstTenMinutes` from `useSetup()`, and ends with `footerDisclaimer()`.
