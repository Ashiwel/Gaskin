/**
 * Gaskin for an AI assistant. Reads and writes the same data file as the app,
 * builds plans with the app's own engine, and de-identifies every response
 * with the app's own privacy layer unless the worker has switched that off.
 *
 * Safety rules enforced here (there is no tool that could break them):
 *  - nothing is ever deleted: the only write is appending a clinical event;
 *  - locked plan items and alerts come from the engine and cannot be removed
 *    or hidden, because no tool edits items, overrides or alerts;
 *  - a write needs confirmedByWorker: true, otherwise it is a preview;
 *  - messages are drafted, never sent.
 */
import type { CarePlan, Child, ClinicalEvent, LabTest, LanguageCode, Mother, PlanItem, SymptomCode, Channel, Alert } from '../../src/types';
import { buildPlan } from '../../src/engine';
import { CATEGORY_LABELS, EVIDENCE_LABELS, SYMPTOM_LABELS, findPractice } from '../../src/clinical';
import { COUNTRIES, LANGUAGE_NAMES } from '../../src/data/countries';
import { chooseChannel, composeFallbackMessage, fallbackLanguageNote, hasLanguagePack, smsSegments } from '../../src/messaging';
import { ageBand, collectTerms, findLeaks, relativeDate, scrubText, setPrivacyDirectory, stageText, termRegex, zoneFor, COUNTRY_NAMES, type ScrubTerm } from '../../src/privacy';
import { triageSymptoms } from '../../src/store/triage';
import type { DataStore, GaskinState } from './store';

const DAY = 86_400_000;

export const DEID_ON_LINE = 'De-identified: mothers appear as tokens (like M-7F3A) with age bands and relative dates. Names, phone numbers, places and exact dates stay on this device.';
export const DEID_OFF_LINE = 'DE-IDENTIFICATION IS OFF: this response contains names and other identifying details. Switch it back on in Gaskin settings or the assistant connector settings.';

export class ToolError extends Error {}

export interface ToolResult {
  /** Lines of plain text shown before the data */
  text?: string;
  data: unknown;
  mother?: string;
  outcome: string;
}

export interface GaskinOptions {
  deidentifyEnv: boolean | undefined;
}

type Scope = 'mine' | 'facility' | 'all';

export class Gaskin {
  private readonly store: DataStore;
  private readonly opts: GaskinOptions;
  private dirFor: GaskinState | null = null;

  constructor(store: DataStore, opts: GaskinOptions) {
    this.store = store;
    this.opts = opts;
  }

  // ---------- Context ----------

  state(): GaskinState {
    const s = this.store.get();
    if (!s) {
      const err = this.store.error();
      throw new ToolError(
        err ??
          `No Gaskin data found in this folder (${this.store.file}). In the Gaskin app, save your data to this folder as gaskin-data.json, or choose the folder that already holds it in the assistant's Gaskin settings.`,
      );
    }
    if (this.dirFor !== s) {
      setPrivacyDirectory({
        mothers: s.mothers,
        workers: s.workers,
        facilities: s.facilities,
        extraNames: Object.values((s.carers as Record<string, { name: string }> | undefined) ?? {})
          .filter((c) => c?.name)
          .map((c) => ({ name: c.name, placeholder: '[CARER]' as const })),
      });
      this.dirFor = s;
    }
    return s;
  }

  /** De-identification is on unless the app settings or the connector setting explicitly say false. */
  deidentification(s?: GaskinState): { on: boolean; source: string } {
    const st = s ?? this.store.get();
    const set = (st?.settings ?? {}) as Record<string, unknown>;
    const fromSettings =
      typeof set.deidentify === 'boolean'
        ? set.deidentify
        : typeof (set.assistant as Record<string, unknown> | undefined)?.deidentify === 'boolean'
          ? ((set.assistant as Record<string, unknown>).deidentify as boolean)
          : undefined;
    if (this.opts.deidentifyEnv === false) return { on: false, source: 'switched off in the assistant connector settings (GASKIN_DEIDENTIFY=false)' };
    if (fromSettings === false) return { on: false, source: 'switched off in Gaskin settings' };
    return { on: true, source: 'on (default)' };
  }

  headline(): string {
    let on = true;
    try {
      on = this.deidentification().on;
    } catch {
      /* no data yet: default on */
    }
    return on ? DEID_ON_LINE : DEID_OFF_LINE;
  }

  private clock(s: GaskinState): string {
    return s.clock && !Number.isNaN(Date.parse(s.clock)) ? s.clock : new Date().toISOString();
  }

  private tokens(s: GaskinState) {
    const t = this.store.tokensFor(s.mothers);
    if (t.created) {
      try {
        this.store.persistPrivate();
      } catch {
        /* read-only folder: tokens still hold for this session */
      }
    }
    return t;
  }

  private motherByToken(s: GaskinState, token: string): Mother {
    const t = this.tokens(s);
    const raw = (token ?? '').trim().toUpperCase();
    const norm = raw.startsWith('M-') ? raw : `M-${raw}`;
    const id = t.byToken.get(norm);
    let m = id ? s.mothers.find((x) => x.id === id) : undefined;
    // With de-identification off the worker may name her directly.
    if (!m && !this.deidentification(s).on && token.trim()) {
      const q = token.trim().toLowerCase();
      const hits = s.mothers.filter((x) => x.name.toLowerCase() === q || x.name.toLowerCase().split(/\s+/).includes(q));
      if (hits.length === 1) m = hits[0];
    }
    if (!m) throw new ToolError(`No mother with token ${token}. Use gaskin_list_caseload to see the tokens.`);
    return m;
  }

  private planOf(s: GaskinState, m: Mother, withPrevious = true): CarePlan {
    return buildPlan(m, this.clock(s), {
      overrides: (s.overrides ?? []).filter((o) => o.motherId === m.id),
      learnedRules: s.learnedRules ?? [],
      previous: withPrevious ? s.planVersions?.[m.id] : undefined,
    });
  }

  // ---------- Output helpers ----------

  /**
   * Prepares free text for output: engine dates such as "12 Nov" become
   * relative. Identifiers are removed afterwards in one pass over the whole
   * response (see finish), which is much faster than scrubbing field by field.
   */
  private scrubber(s: GaskinState, _m?: Mother): (t: string | undefined) => string {
    const on = this.deidentification(s).on;
    const asOf = this.clock(s);
    return (t) => relativiseShortDates(t ?? '', asOf, on);
  }

  /** One scrub pass over every string in the response, with this mother's and the whole directory's identifiers. */
  private scrubAll(s: GaskinState, data: unknown, m?: Mother): unknown {
    const worker = s.workers.find((w) => w.id === m?.assignedWorkerId);
    const fac = s.facilities.find((f) => f.id === m?.facilityId);
    const terms = termsFor(m, { workerName: worker?.name, facilityName: fac?.name });
    const asOf = this.clock(s);
    const strings: string[] = [];
    walkKeys(data, (k, v) => {
      if (!SKIP_KEYS.has(k)) strings.push(v);
      return v;
    });
    if (!strings.length) return data;
    const SEP = '\n\u241e\n';
    const joined = scrubText(strings.join(SEP), terms, { asOf }).text;
    let parts = joined.split(SEP);
    if (parts.length !== strings.length) parts = strings.map((t) => scrubText(t, terms, { asOf }).text);
    let i = 0;
    return walkKeys(data, (k, v) => (SKIP_KEYS.has(k) ? v : parts[i++]));
  }

  private when(s: GaskinState, iso: string | undefined): string | undefined {
    if (!iso) return undefined;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return undefined;
    const rel = relativeDate(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())), dayStart(this.clock(s)));
    return this.deidentification(s).on ? rel : `${iso.slice(0, 10)} (${rel})`;
  }

  private profile(s: GaskinState, m: Mother, token: string) {
    const on = this.deidentification(s).on;
    const fac = s.facilities.find((f) => f.id === m.facilityId);
    const base = {
      token,
      ageBand: ageBand(m.age),
      adolescent: m.age < 18,
      country: COUNTRY_NAMES[m.country] ?? m.country,
      zone: zoneFor(m.country, m.region) ?? null,
      language: LANGUAGE_NAMES[m.language] ?? m.language,
      literacy: m.literacy,
      phoneAccess: m.phone?.access,
      hasWhatsApp: m.phone?.hasWhatsApp ?? false,
      gravida: m.gravida,
      parity: m.parity,
      conditions: m.conditions.map((c) => c.replace(/_/g, ' ')),
      history: [m.previousCaesarean && 'previous caesarean', m.previousStillbirth && 'previous stillbirth', m.previousPPH && 'previous heavy bleeding after birth'].filter(Boolean),
      consent: { dataProcessing: m.consent?.dataProcessing ?? false, messaging: m.consent?.messaging ?? false },
    };
    if (on) return base;
    return {
      ...base,
      name: m.name,
      age: m.age,
      community: m.community,
      region: m.region,
      phone: m.phone?.number ?? null,
      facility: fac?.name ?? null,
      children: m.children.map((c) => ({ name: c.name, sex: c.sex, dob: c.dob.slice(0, 10) })),
    };
  }

  /** Last-resort gate: in de-identified mode, a known identifier or exact date left in the output is removed. */
  private gate(s: GaskinState, data: unknown, m?: Mother): unknown {
    if (!this.deidentification(s).on) return data;
    const terms = termsFor(m);
    const json = JSON.stringify(data);
    if (findLeaks(json, terms).length === 0) return data;
    return walk(data, (v) => hardRedact(v, terms));
  }

  private finish(s: GaskinState, r: ToolResult, m?: Mother): ToolResult {
    if (!this.deidentification(s).on) return r;
    return { ...r, data: this.gate(s, this.scrubAll(s, r.data, m), m) };
  }

  private caseload(s: GaskinState, scope: Scope): { mothers: Mother[]; scopeUsed: Scope; note?: string } {
    const me = s.workers.find((w) => w.id === s.currentWorkerId);
    const country = s.country && s.country !== 'ALL' ? s.country : undefined;
    const inCountry = s.mothers.filter((m) => !country || m.country === country);
    if (scope === 'all' || !me) return { mothers: inCountry, scopeUsed: 'all' };
    if (scope === 'facility') return { mothers: inCountry.filter((m) => m.facilityId === me.facilityId || m.assignedWorkerId === me.id), scopeUsed: 'facility' };
    const mine = inCountry.filter((m) => m.assignedWorkerId === me.id);
    if (mine.length) return { mothers: mine, scopeUsed: 'mine' };
    return { mothers: inCountry, scopeUsed: 'all', note: 'No mothers are assigned to you yet, so this shows everyone in the file.' };
  }

  // ---------- Tools ----------

  whoami(): ToolResult {
    const s = this.state();
    const deid = this.deidentification(s);
    const me = s.workers.find((w) => w.id === s.currentWorkerId);
    const fac = s.facilities.find((f) => f.id === me?.facilityId);
    const { mothers } = this.caseload(s, 'mine');
    let alerts = 0;
    for (const m of mothers) {
      try {
        alerts += this.planOf(s, m).alerts.length;
      } catch {
        /* skip */
      }
    }
    const settings = Object.fromEntries(
      Object.entries((s.settings ?? {}) as Record<string, unknown>).filter(([k, v]) => !/key|token|secret|password/i.test(k) && (typeof v !== 'object' || v === null)),
    );
    const data = {
      worker: me
        ? deid.on
          ? { name: '[WORKER]', role: me.role, yearsExperience: me.yearsExperience, clinicalReviewer: !!me.isClinicalReviewer }
          : { name: me.name, role: me.role, yearsExperience: me.yearsExperience, clinicalReviewer: !!me.isClinicalReviewer }
        : null,
      facility: fac
        ? deid.on
          ? { name: '[FACILITY]', type: fac.type, country: COUNTRY_NAMES[fac.country], zone: zoneFor(fac.country, fac.region) ?? null }
          : { name: fac.name, type: fac.type, country: COUNTRY_NAMES[fac.country], region: fac.region }
        : null,
      deidentification: { on: deid.on, setting: deid.source },
      sampleData: !!(s as Record<string, unknown>)._sample,
      today: deid.on ? 'today (Gaskin clock)' : this.clock(s).slice(0, 10),
      caseload: { mothers: mothers.length, openAlerts: alerts, allMothersInFile: s.mothers.length },
      settings,
      safety: [
        'No tool can delete records, remove locked plan items, or hide alerts.',
        'Recording an observation needs confirmedByWorker: true; without it you get a preview and nothing is saved.',
        'Messages are drafts for the worker to check and send from Gaskin. Nothing is sent from here.',
      ],
    };
    return this.finish(s, { data, outcome: 'ok' });
  }

  listCaseload(args: { scope?: Scope; limit?: number }): ToolResult {
    const s = this.state();
    const tok = this.tokens(s);
    const { mothers, scopeUsed, note } = this.caseload(s, args.scope ?? 'mine');
    const levelRank = { emergency: 0, urgent: 1, warning: 2 } as const;
    const rows = [];
    for (const m of mothers) {
      let plan: CarePlan;
      try {
        plan = this.planOf(s, m);
      } catch {
        continue;
      }
      const sc = this.scrubber(s, m);
      const top = [...plan.alerts].sort((a, b) => levelRank[a.level] - levelRank[b.level])[0];
      const readAt = (s.readInbound as Record<string, string> | undefined)?.[m.id];
      const unread = (s.inbound ?? []).filter((x) => x.motherId === m.id && (!readAt || x.receivedAt > readAt));
      const tier = triageSymptoms(unread.flatMap((x) => x.parsedSymptoms ?? []));
      const reasons = (plan.state.contactPriority?.reasons ?? []).map(sc);
      if (!reasons.length && plan.nextContact) reasons.push(`${sc(plan.nextContact.label)}, ${this.when(s, plan.nextContact.date)}`);
      const p = this.profile(s, m, tok.byId.get(m.id)!);
      rows.push({
        token: p.token,
        ...(this.deidentification(s).on ? {} : { name: m.name }),
        ageBand: p.ageBand,
        adolescent: p.adolescent,
        stage: stageText(plan),
        priorityScore: plan.state.contactPriority?.score ?? 0,
        why: reasons,
        topAlert: top ? { level: top.level, title: sc(top.title) } : null,
        alertCount: plan.alerts.length,
        unreadMessages: unread.length,
        messageTriage: unread.length ? tier : null,
        nextContact: plan.nextContact ? { what: sc(plan.nextContact.label), when: this.when(s, plan.nextContact.date) } : null,
        _sort: [top ? levelRank[top.level] : 3, tier === 'emergency' ? 0 : 1, -(plan.state.contactPriority?.score ?? 0)],
      });
    }
    rows.sort((a, b) => a._sort[0] - b._sort[0] || a._sort[1] - b._sort[1] || a._sort[2] - b._sort[2]);
    const limit = Math.max(1, Math.min(100, args.limit ?? 10));
    const out = rows.slice(0, limit).map(({ _sort, ...r }, i) => (void _sort, { rank: i + 1, ...r }));
    const data = {
      scope: scopeUsed,
      note: note ?? null,
      showing: out.length,
      total: rows.length,
      order: 'Emergency and urgent alerts first, then danger signs reported by message, then the contact-priority score (higher means see her sooner).',
      mothers: out,
    };
    return this.finish(s, { data, outcome: 'ok' });
  }

  getCarePlan(args: { token: string; includeMotherText?: boolean }): ToolResult {
    const s = this.state();
    const m = this.motherByToken(s, args.token);
    const token = this.tokens(s).byId.get(m.id)!;
    const plan = this.planOf(s, m);
    const sc = this.scrubber(s, m);
    const active = plan.items.filter((i) => i.status === 'active');
    const data = {
      mother: this.profile(s, m, token),
      stage: stageText(plan),
      stageCode: plan.state.stage,
      dueIn: plan.state.edd ? this.when(s, plan.state.edd) : null,
      planVersion: s.planVersions?.[m.id]?.version ?? plan.version,
      summary: sc(plan.summary),
      alerts: plan.alerts.map((a) => this.alertView(a, sc)),
      risks: plan.state.risks.map((r) => ({ label: sc(r.label), severity: r.severity, reason: sc(r.reason) })),
      items: active.map((i) => this.itemView(s, i, sc, !!args.includeMotherText)),
      removedOrDone: plan.items.filter((i) => i.status !== 'active').map((i) => ({ id: i.id, title: sc(i.title), status: i.status })),
      nextContact: plan.nextContact ? { what: sc(plan.nextContact.label), type: plan.nextContact.type, when: this.when(s, plan.nextContact.date) } : null,
      recent: this.recentEvents(s, m, sc),
      latest: plan.state.latest,
      guidance: 'Items marked locked are safety-critical and cannot be removed. Use gaskin_explain_rule with an item id for its sources.',
    };
    return this.finish(s, { data, mother: token, outcome: 'ok' }, m);
  }

  private alertView(a: Alert, sc: (t?: string) => string) {
    return { id: a.id, level: a.level, about: a.subject, title: sc(a.title), doNow: sc(a.action), why: sc(a.reason), tellHer: a.motherText ? sc(a.motherText) : null, sources: a.sources.map((c) => c.label) };
  }

  private itemView(_s: GaskinState, i: PlanItem, sc: (t?: string) => string, motherText: boolean) {
    return {
      id: sc(i.id),
      category: CATEGORY_LABELS[i.category] ?? i.category,
      priority: i.priority,
      title: sc(i.title),
      detail: sc(i.detail),
      because: i.because.filter(Boolean).map(sc),
      evidence: { grade: i.evidence, label: EVIDENCE_LABELS[i.evidence]?.label ?? i.evidence },
      sources: i.sources.map((c) => c.label),
      timing: i.timing ? sc(i.timing) : null,
      due: i.dueDate ? this.when(_s, i.dueDate) : null,
      locked: !!i.locked,
      origin: i.origin,
      audience: i.audience,
      ...(motherText ? { motherText: sc(i.motherText) } : {}),
    };
  }

  private recentEvents(s: GaskinState, m: Mother, sc: (t?: string) => string) {
    const cutoff = Date.parse(this.clock(s));
    return [...m.events]
      .filter((e) => Date.parse(e.at) <= cutoff)
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, 8)
      .map((e) => ({ when: this.when(s, e.at), kind: e.kind, about: e.childId ? 'baby' : 'mother', what: sc(describeEvent(e)), by: e.recordedBy === 'mother' ? 'mother (message)' : e.recordedBy === 'system' ? 'system' : 'health worker' }));
  }

  listAlerts(args: { scope?: Scope; minLevel?: 'warning' | 'urgent' | 'emergency' }): ToolResult {
    const s = this.state();
    const tok = this.tokens(s);
    const { mothers, scopeUsed, note } = this.caseload(s, args.scope ?? 'mine');
    const rank = { emergency: 0, urgent: 1, warning: 2 } as const;
    const min = rank[args.minLevel ?? 'warning'];
    const out: Array<Record<string, unknown> & { _r: number }> = [];
    for (const m of mothers) {
      let plan: CarePlan;
      try {
        plan = this.planOf(s, m);
      } catch {
        continue;
      }
      const sc = this.scrubber(s, m);
      for (const a of plan.alerts) {
        if (rank[a.level] > min) continue;
        out.push({ _r: rank[a.level], token: tok.byId.get(m.id), ...(this.deidentification(s).on ? {} : { name: m.name }), stage: stageText(plan), ...this.alertView(a, sc) });
      }
    }
    out.sort((a, b) => a._r - b._r);
    const data = { scope: scopeUsed, note: note ?? null, count: out.length, alerts: out.map(({ _r, ...r }) => (void _r, r)), reminder: 'Alerts come from the danger-sign rules and cannot be dismissed from here. Act on emergency alerts first.' };
    return this.finish(s, { data, outcome: 'ok' });
  }

  explainRule(args: { token: string; itemId: string }): ToolResult {
    const s = this.state();
    const m = this.motherByToken(s, args.token);
    const token = this.tokens(s).byId.get(m.id)!;
    const plan = this.planOf(s, m);
    const sc = this.scrubber(s, m);
    const q = args.itemId.trim().toLowerCase();
    const alert = plan.alerts.find((a) => a.id.toLowerCase() === q);
    if (alert) {
      const data = { token, kind: 'alert', ...this.alertView(alert, sc), sourceLinks: alert.sources.map((c) => ({ label: c.label, url: c.url ?? null })), canBeDismissed: false };
      return this.finish(s, { data, mother: token, outcome: 'ok' }, m);
    }
    const item =
      plan.items.find((i) => i.id.toLowerCase() === q) ??
      plan.items.find((i) => i.title.toLowerCase() === q) ??
      plan.items.find((i) => i.title.toLowerCase().includes(q) || i.id.toLowerCase().includes(q));
    if (!item) throw new ToolError(`Her plan has no item or alert "${args.itemId}". Use gaskin_get_care_plan to see the item ids.`);
    const override = item.overriddenBy ? (s.overrides ?? []).find((o) => o.id === item.overriddenBy) : undefined;
    const learned = item.overriddenBy ? (s.learnedRules ?? []).find((r) => r.id === item.overriddenBy || r.proposalId === item.overriddenBy) : undefined;
    const practice = item.id.startsWith('trad.') ? findPractice(item.id.slice(5)) : undefined;
    const ev = EVIDENCE_LABELS[item.evidence];
    const data = {
      token,
      kind: 'plan item',
      id: sc(item.id),
      title: sc(item.title),
      status: item.status,
      whyInHerPlan: item.because.filter(Boolean).map(sc),
      whatToDo: sc(item.detail),
      evidence: { grade: item.evidence, label: ev?.label ?? item.evidence, meaning: ev?.description ?? '' },
      sources: item.sources.map((c) => ({ label: c.label, url: c.url ?? null })),
      origin: originText(item.origin),
      locked: !!item.locked,
      lockedMeans: item.locked ? 'Safety-critical: one worker cannot remove it. A senior reviewer must agree.' : null,
      changedBy: override
        ? { kind: 'a health worker change for this mother', action: override.action, reason: sc(override.reason), when: this.when(s, override.createdAt) }
        : learned
          ? { kind: 'an approved rule learned from expert feedback', when: this.when(s, learned.approvedAt) }
          : null,
      traditionalPractice: practice ? { name: practice.name, grade: practice.grade, whatTheEvidenceSays: practice.evidenceSummary, howToRespond: practice.guidance } : null,
    };
    return this.finish(s, { data, mother: token, outcome: 'ok' }, m);
  }

  draftMessage(args: { token: string; channel?: Channel; language?: LanguageCode; itemIds?: string[] }): ToolResult {
    const s = this.state();
    const m = this.motherByToken(s, args.token);
    const token = this.tokens(s).byId.get(m.id)!;
    const plan = this.planOf(s, m);
    const deid = this.deidentification(s).on;
    const country = COUNTRIES[m.country];
    const pick = chooseChannel(m, country);
    const channel = args.channel ?? pick.channel;
    const wanted = args.language ?? m.language;
    const language: LanguageCode = hasLanguagePack(wanted) ? wanted : 'en';
    const ids = args.itemIds?.length ? plan.items.filter((i) => args.itemIds!.includes(i.id)).map((i) => i.id) : undefined;
    const body0 = composeFallbackMessage(plan, m, { channel, language, itemIds: ids });
    // De-identified in finish() with the rest of the response; placeholders are restored in the app.
    const body = relativiseShortDates(body0, this.clock(s), deid);
    const sc = this.scrubber(s, m);
    const data = {
      token,
      status: 'DRAFT ONLY. Not sent. The worker checks it and sends it from Gaskin.',
      channel,
      channelReason: sc(pick.reason),
      language: LANGUAGE_NAMES[language],
      languageNote: language !== wanted ? `No ${LANGUAGE_NAMES[wanted]} pack is installed, so this is plain English. Read it to her in ${LANGUAGE_NAMES[wanted]} or translate it in Gaskin and check it.` : (fallbackLanguageNote(language) ?? null),
      smsParts: channel === 'sms' ? smsSegments(body) : null,
      placeholders: deid ? 'Gaskin fills in [MOTHER], [FACILITY] and similar on the worker\'s device when she sends it.' : null,
      consentToMessage: m.consent?.messaging ?? false,
      message: body,
    };
    return this.finish(s, { data, mother: token, outcome: 'ok' }, m);
  }

  recordObservation(input: ObservationInput): ToolResult {
    const s = this.state();
    const m = this.motherByToken(s, input.token);
    const token = this.tokens(s).byId.get(m.id)!;
    const sc = this.scrubber(s, m);
    const clock = this.clock(s);
    const daysAgo = Math.max(0, Math.min(60, Math.floor(input.daysAgo ?? 0)));
    const at = new Date(Date.parse(clock) - daysAgo * DAY).toISOString();
    // In de-identified mode a note is scrubbed before it is stored, so a name typed by the assistant never lands in the record.
    const note = input.note && this.deidentification(s).on ? scrubText(input.note, termsFor(m), { asOf: clock }).text : input.note;
    const event = buildEvent({ ...input, note }, m, at, s.currentWorkerId || 'worker');

    const before = this.planOf(s, m, false);
    const updated = applyEvent(m, event);
    const after = this.planOf(s, updated, false);
    const diff = planDiff(before, after);
    const newAlerts = after.alerts.filter((a) => diff.newAlerts.includes(a.id)).map((a) => this.alertView(a, sc));
    const view = {
      token,
      observation: sc(describeEvent(event)),
      when: this.when(s, at),
      about: event.childId ? 'baby' : 'mother',
      planChanges: {
        added: diff.added.map((id) => sc(after.items.find((i) => i.id === id)?.title ?? id)),
        removed: diff.removed.map((id) => sc(before.items.find((i) => i.id === id)?.title ?? id)),
        newAlerts,
        clearedAlerts: diff.clearedAlerts.map((id) => sc(before.alerts.find((a) => a.id === id)?.title ?? id)),
      },
      allAlertsNow: after.alerts.map((a) => ({ level: a.level, title: sc(a.title) })),
    };

    if (input.confirmedByWorker !== true) {
      const data = {
        saved: false,
        status: 'PREVIEW ONLY. Nothing was saved. Read this back to the worker. If she agrees, call gaskin_record_observation again with the same values and confirmedByWorker: true.',
        ...view,
      };
      return this.finish(s, { data, mother: token, outcome: 'preview' }, m);
    }

    this.store.update((cur) => {
      const mothers = cur.mothers.map((x) => (x.id === m.id ? applyEvent(x, event) : x));
      const next = { ...cur, mothers } as GaskinState;
      const nm = mothers.find((x) => x.id === m.id)!;
      const prev = cur.planVersions?.[m.id];
      const plan = buildPlan(nm, this.clock(cur), { overrides: (cur.overrides ?? []).filter((o) => o.motherId === m.id), learnedRules: cur.learnedRules ?? [], previous: prev });
      const itemIds = plan.items.filter((i) => i.status !== 'removed').map((i) => i.id);
      const alertIds = plan.alerts.map((a) => a.id);
      const d = { added: itemIds.filter((i) => !prev?.itemIds.includes(i)), removed: (prev?.itemIds ?? []).filter((i) => !itemIds.includes(i)), changed: [] as string[], newAlerts: alertIds.filter((a) => !prev?.alertIds.includes(a)) };
      const changed = !!prev && d.added.length + d.removed.length + d.newAlerts.length > 0;
      const version = prev ? prev.version + (changed ? 1 : 0) : Math.max(1, plan.version || 1);
      next.planVersions = { ...(cur.planVersions ?? {}), [m.id]: { version, itemIds, alertIds } };
      if (changed) next.lastChanges = { ...(cur.lastChanges ?? {}), [m.id]: { diff: d, at: cur.clock, version, cause: 'Recorded through your AI assistant' } };
      return next;
    });
    const data = {
      saved: true,
      status: newAlerts.length ? `Saved. ${newAlerts.length} new alert${newAlerts.length > 1 ? 's' : ''}: act on ${newAlerts.length > 1 ? 'them' : 'it'} now.` : 'Saved. The plan has been updated.',
      ...view,
    };
    return this.finish(s, { data, mother: token, outcome: 'saved' }, m);
  }
}

// ---------- Observations ----------

export type ObservationKind = 'vitals' | 'symptoms' | 'lab' | 'screening' | 'feeding' | 'growth';

export interface ObservationInput {
  token: string;
  kind: ObservationKind;
  about?: 'mother' | 'baby';
  daysAgo?: number;
  vitals?: { systolic?: number; diastolic?: number; weightKg?: number; temperatureC?: number; pulse?: number; fundalHeightCm?: number; fetalHeartRate?: number; muacCm?: number };
  symptoms?: { codes: SymptomCode[]; severity?: 'mild' | 'moderate' | 'severe'; via?: 'visit' | 'sms' | 'whatsapp' | 'voice' | 'worker_call' };
  lab?: { test: LabTest; value: number | string; unit?: string };
  screening?: { instrument: 'epds' | 'phq9' | 'phq2'; score: number; selfHarmFlag?: boolean };
  feeding?: { status: Child['feeding']; milkSupply?: 'good' | 'low' | 'very_low'; feedsPerDay?: number; latchProblem?: boolean };
  growth?: { weightKg?: number; lengthCm?: number; muacCm?: number; headCircumferenceCm?: number };
  note?: string;
  confirmedByWorker?: boolean;
}

const RANGES: Record<string, [number, number]> = {
  systolic: [50, 260],
  diastolic: [30, 180],
  weightKg: [0.3, 250],
  temperatureC: [30, 45],
  pulse: [20, 250],
  fundalHeightCm: [5, 60],
  fetalHeartRate: [50, 240],
  muacCm: [5, 50],
  lengthCm: [20, 130],
  headCircumferenceCm: [20, 60],
  feedsPerDay: [0, 30],
};

function checkRanges(obj: Record<string, unknown>): void {
  for (const [k, v] of Object.entries(obj)) {
    const r = RANGES[k];
    if (r && typeof v === 'number' && (v < r[0] || v > r[1])) throw new ToolError(`${k} ${v} looks wrong (expected ${r[0]} to ${r[1]}). Check the reading with the worker.`);
  }
}

function youngest(m: Mother): Child | undefined {
  return [...m.children].sort((a, b) => a.dob.localeCompare(b.dob)).pop();
}

let seq = 0;
function eventId(): string {
  seq += 1;
  return `ev_mcp_${Date.now().toString(36)}${seq.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function buildEvent(input: ObservationInput, m: Mother, at: string, recordedBy: string): ClinicalEvent {
  const babyDefault = input.kind === 'growth' || input.kind === 'feeding';
  const about = input.about ?? (babyDefault ? 'baby' : 'mother');
  let childId: string | undefined;
  if (about === 'baby') {
    const c = youngest(m);
    if (!c) throw new ToolError('She has no baby recorded yet, so this cannot be recorded for a baby.');
    childId = c.id;
  }
  const base = { id: eventId(), at, recordedBy, ...(childId ? { childId } : {}), ...(input.note?.trim() ? { note: input.note.trim().slice(0, 500) } : {}) };
  switch (input.kind) {
    case 'vitals': {
      const v = input.vitals;
      if (!v || !Object.values(v).some((x) => typeof x === 'number')) throw new ToolError('Give at least one vital sign, for example vitals: { systolic: 150, diastolic: 100 }.');
      checkRanges(v);
      if ((v.systolic === undefined) !== (v.diastolic === undefined)) throw new ToolError('Blood pressure needs both numbers: systolic (top) and diastolic (bottom).');
      if (v.systolic !== undefined && v.diastolic !== undefined && v.diastolic >= v.systolic) throw new ToolError(`BP ${v.systolic}/${v.diastolic}: the bottom number is higher than the top. Check the reading.`);
      return { ...base, kind: 'vitals', ...stripUndef(v) };
    }
    case 'symptoms': {
      const sy = input.symptoms;
      if (!sy?.codes?.length) throw new ToolError('List at least one symptom code, for example symptoms: { codes: ["severe_headache"] }.');
      const bad = sy.codes.filter((c) => !(c in SYMPTOM_LABELS));
      if (bad.length) throw new ToolError(`Unknown symptom code(s): ${bad.join(', ')}.`);
      const babyCodes = sy.codes.some((c) => c.startsWith('baby_'));
      let cid = childId;
      if (babyCodes && !cid) cid = youngest(m)?.id;
      return { ...base, ...(cid ? { childId: cid } : {}), kind: 'symptom', symptoms: sy.codes, ...(sy.severity ? { severity: sy.severity } : {}), via: sy.via ?? 'visit' };
    }
    case 'lab': {
      const l = input.lab;
      if (!l?.test || l.value === undefined || l.value === '') throw new ToolError('Give the test and its result, for example lab: { test: "haemoglobin", value: 9.5 }.');
      if (l.test === 'haemoglobin' && typeof l.value === 'number' && (l.value < 2 || l.value > 22)) throw new ToolError(`Haemoglobin ${l.value} g/dL looks wrong. Check the result.`);
      return { ...base, kind: 'lab', test: l.test, value: l.value, ...(l.unit ? { unit: l.unit } : l.test === 'haemoglobin' ? { unit: 'g/dL' } : {}) };
    }
    case 'screening': {
      const sc = input.screening;
      if (!sc) throw new ToolError('Give the screening tool and score, for example screening: { instrument: "epds", score: 11 }.');
      const max = sc.instrument === 'epds' ? 30 : sc.instrument === 'phq9' ? 27 : 6;
      if (sc.score < 0 || sc.score > max) throw new ToolError(`${sc.instrument.toUpperCase()} score must be 0 to ${max}.`);
      return { ...base, kind: 'screening', instrument: sc.instrument, score: sc.score, ...(sc.selfHarmFlag !== undefined ? { selfHarmFlag: sc.selfHarmFlag } : {}) };
    }
    case 'feeding': {
      const f = input.feeding;
      if (!f?.status) throw new ToolError('Give the feeding status, for example feeding: { status: "exclusive_breastfeeding" }.');
      checkRanges(f as Record<string, unknown>);
      return { ...base, kind: 'feeding', ...stripUndef(f) } as ClinicalEvent;
    }
    case 'growth': {
      const g = input.growth;
      if (!g || !Object.values(g).some((x) => typeof x === 'number')) throw new ToolError('Give at least one measurement, for example growth: { weightKg: 4.2 }.');
      checkRanges(g);
      return { ...base, kind: 'growth', ...stripUndef(g) };
    }
    default:
      throw new ToolError(`Unknown kind ${String((input as { kind: string }).kind)}.`);
  }
}

/** Same bookkeeping as the app's reducer: append the event, keep the baby's feeding status in step. */
export function applyEvent(m: Mother, e: ClinicalEvent): Mother {
  let out: Mother = { ...m, events: [...m.events, e] };
  if (e.kind === 'feeding' && e.childId) out = { ...out, children: out.children.map((c) => (c.id === e.childId ? { ...c, feeding: e.status } : c)) };
  return out;
}

function planDiff(a: CarePlan, b: CarePlan) {
  const ai = new Set(a.items.filter((i) => i.status === 'active').map((i) => i.id));
  const bi = new Set(b.items.filter((i) => i.status === 'active').map((i) => i.id));
  const aa = new Set(a.alerts.map((x) => x.id));
  const ba = new Set(b.alerts.map((x) => x.id));
  return {
    added: [...bi].filter((i) => !ai.has(i)),
    removed: [...ai].filter((i) => !bi.has(i)),
    newAlerts: [...ba].filter((i) => !aa.has(i)),
    clearedAlerts: [...aa].filter((i) => !ba.has(i)),
  };
}

// ---------- Text helpers ----------

export function describeEvent(e: ClinicalEvent): string {
  switch (e.kind) {
    case 'vitals': {
      const p: string[] = [];
      if (e.systolic !== undefined) p.push(`BP ${e.systolic}/${e.diastolic}`);
      if (e.weightKg !== undefined) p.push(`weight ${e.weightKg} kg`);
      if (e.temperatureC !== undefined) p.push(`temperature ${e.temperatureC}°C`);
      if (e.pulse !== undefined) p.push(`pulse ${e.pulse}`);
      if (e.fundalHeightCm !== undefined) p.push(`fundal height ${e.fundalHeightCm} cm`);
      if (e.fetalHeartRate !== undefined) p.push(`fetal heart ${e.fetalHeartRate}/min`);
      if (e.muacCm !== undefined) p.push(`MUAC ${e.muacCm} cm`);
      return `Vitals: ${p.join(', ')}`;
    }
    case 'symptom':
      return `Symptoms${e.severity ? ` (${e.severity})` : ''}: ${e.symptoms.map((c) => SYMPTOM_LABELS[c] ?? c).join(', ')}${e.via && e.via !== 'visit' ? ` (by ${e.via.replace('_', ' ')})` : ''}`;
    case 'lab':
      return `Lab: ${e.test.replace(/_/g, ' ')} ${e.value}${e.unit ? ` ${e.unit}` : ''}`;
    case 'screening':
      return `Screening: ${e.instrument.toUpperCase()} score ${e.score}${e.selfHarmFlag ? ' (self-harm item positive)' : ''}`;
    case 'feeding':
      return `Feeding: ${e.status.replace(/_/g, ' ')}${e.milkSupply ? `, milk supply ${e.milkSupply.replace('_', ' ')}` : ''}${e.feedsPerDay !== undefined ? `, ${e.feedsPerDay} feeds a day` : ''}${e.latchProblem ? ', latch problem' : ''}`;
    case 'growth': {
      const p: string[] = [];
      if (e.weightKg !== undefined) p.push(`weight ${e.weightKg} kg`);
      if (e.lengthCm !== undefined) p.push(`length ${e.lengthCm} cm`);
      if (e.muacCm !== undefined) p.push(`MUAC ${e.muacCm} cm`);
      if (e.headCircumferenceCm !== undefined) p.push(`head ${e.headCircumferenceCm} cm`);
      return `Growth: ${p.join(', ')}`;
    }
    case 'visit':
      return `${e.attended ? 'Visit' : 'Missed visit'}: ${e.visitType.replace(/_/g, ' ')}${e.contactNumber ? ` ${e.contactNumber}` : ''}`;
    case 'birth':
      return `Birth: ${e.birth.mode}, at ${e.birth.place}${e.child?.birthWeightKg ? `, ${e.child.birthWeightKg} kg` : ''}`;
    case 'immunisation':
      return `Vaccines: ${e.vaccines.join(', ')}`;
    case 'medication':
      return `Medicine ${e.action === 'start' ? 'started' : 'stopped'}: ${e.medication.name}${e.medication.dose ? ` ${e.medication.dose}` : ''}`;
    case 'report':
      return `Report from ${e.author}: ${e.text.slice(0, 200)}`;
    case 'referral':
      return `Referral (${e.urgency}): ${e.reason} [${e.status}]`;
    default:
      return 'Event';
  }
}

function originText(o: PlanItem['origin']): string {
  return {
    guideline: 'WHO or national guideline rule',
    traditional: 'traditional practice she mentioned, graded for evidence',
    learned_rule: 'rule learned from expert feedback and approved by a senior reviewer',
    worker_added: 'added by a health worker for this mother',
    ai_suggested: 'suggested by AI and accepted by a health worker',
  }[o];
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const SHORT_DATE_RE = new RegExp(String.raw`\b(on |from |by |since |until )?(\d{1,2}) (${MONTHS.join('|')})\b(?!\s*\d)`, 'g');

function dayStart(iso: string): Date {
  const d = new Date(iso);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** The engine writes worker dates as "12 Nov"; make them relative so no calendar date leaves the device. */
export function relativiseShortDates(text: string, asOf: string, replace: boolean): string {
  if (!text) return text;
  const now = dayStart(asOf);
  return text.replace(SHORT_DATE_RE, (_m, prep: string | undefined, d: string, mon: string) => {
    const mo = MONTHS.indexOf(mon);
    // Nearest year to today (a date in late Dec seen in early Jan is last year).
    let best = new Date(Date.UTC(now.getUTCFullYear(), mo, +d));
    for (const y of [now.getUTCFullYear() - 1, now.getUTCFullYear() + 1]) {
      const c = new Date(Date.UTC(y, mo, +d));
      if (Math.abs(c.getTime() - now.getTime()) < Math.abs(best.getTime() - now.getTime())) best = c;
    }
    const rel = relativeDate(best, now);
    const future = rel.startsWith('in ');
    const p = (prep ?? '').trim();
    let phrase: string;
    if (p === 'from' || p === 'since') phrase = future ? `from ${rel.slice(3)} from now` : rel === 'today' ? 'from today' : `from ${rel}`;
    else if (p === 'by' || p === 'until') phrase = future ? `within ${rel.slice(3)}` : rel === 'today' ? 'by today' : `by ${rel}`;
    else phrase = rel;
    return replace ? phrase : `${prep ?? ''}${d} ${mon} (${rel})`;
  });
}

function stripUndef<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
}

/**
 * The privacy layer splits free-text names (a report author such as
 * "Dr A. B, Registrar (O&G), Lagos Island Maternity Hospital") into words, so
 * ordinary words like "Hospital" would become [DOCTOR]. Those words identify
 * nobody, so they are dropped here; every real name part is kept.
 */
const GENERIC_TERM = new Set(
  'hospital maternity clinic university teaching general specialist consultant registrar obstetrician obstetrics gynaecology paediatrics paediatrician haematology medicine surgery department unit ward scbu nicu o&g og centre center health primary state federal medical island'.split(' '),
);
function termsFor(m: Mother | undefined, opts: { workerName?: string; facilityName?: string } = {}): ScrubTerm[] {
  return collectTerms(m, opts).filter((t) => {
    const o = t.original.trim();
    if (GENERIC_TERM.has(o.toLowerCase().replace(/[()]/g, ''))) return false;
    if (o.length < 3 && !/\d/.test(o)) return false;
    return true;
  });
}

/** Keys whose values are Gaskin's own codes, never free text about a person */
const SKIP_KEYS = new Set(['token', 'level', 'about', 'grade', 'stageCode', 'origin', 'audience', 'kind', 'scope', 'channel', 'literacy', 'phoneAccess', 'severity', 'type', 'messageTriage']);

function walkKeys(v: unknown, fn: (key: string, s: string) => string, key = ''): unknown {
  if (typeof v === 'string') return fn(key, v);
  if (Array.isArray(v)) return v.map((x) => walkKeys(x, fn, key));
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walkKeys(x, fn, k)]));
  return v;
}

function walk(v: unknown, fn: (s: string) => string): unknown {
  if (typeof v === 'string') return fn(v);
  if (Array.isArray(v)) return v.map((x) => walk(x, fn));
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x, fn)]));
  return v;
}

function hardRedact(s: string, terms: ScrubTerm[]): string {
  let out = s;
  for (const t of [...terms].sort((a, b) => b.original.length - a.original.length)) {
    if (!t.original || t.original.trim().length < 2) continue;
    out = out.replace(termRegex(t), t.placeholder);
  }
  return out.replace(/\b\d{4}-\d{2}-\d{2}(?:T[\d:.]+Z?)?\b/g, '[DATE]');
}
