import { useMemo, useState } from 'react';
import type { CarePlan, Channel, CountryCode, Mother } from '../types';
import { useApp, usePlans } from '../store';
import { COUNTRIES } from '../data';
import { saveFile } from './HandoutSheet';
import { useToast } from './components';
import { CHANNEL_LABELS, daysBetween, pct, STAGE_LABELS, usd } from './format';
import { IDownload } from './icons';
import { BentoCard, BentoGrid } from './animata/BentoGrid';
import BarChart from './animata/BarChart';

/** Recommended ANC contacts by gestational week (WHO 2016, 8 contacts). */
const ANC_WEEKS = [12, 20, 26, 30, 34, 36, 38, 40];

function expectedAnc(weeks?: number): number {
  if (weeks === undefined) return 0;
  return ANC_WEEKS.filter((w) => w <= weeks).length;
}

export interface Metrics {
  enrolled: number;
  byStage: Record<string, number>;
  highRisk: number;
  openAlerts: number;
  emergencyAlerts: number;
  referralsOpen: number;
  referralsDone: number;
  ancAttended: number;
  ancExpected: number;
  pncEligible: number;
  pnc48: number;
  ebfEligible: number;
  ebf: number;
  epdsEligible: number;
  epdsScreened: number;
  epdsPositive: number;
  immDue: number;
  immOnTime: number;
  messages: number;
  costByChannel: Record<string, { usd: number; count: number }>;
  costPerMotherMonthUSD: number;
  overrides: number;
  rulesLearned: number;
  proposalsOpen: number;
}

export function computeMetrics(mothers: Mother[], plans: Map<string, CarePlan>, ctx: { clock: string; outbound: { motherId: string; channel: Channel; estCostUSD: number; createdAt: string }[]; overrides: { motherId: string }[]; learnedRules: unknown[]; proposals: { status: string }[] }): Metrics {
  const ids = new Set(mothers.map((m) => m.id));
  const m: Metrics = {
    enrolled: mothers.length,
    byStage: { preconception: 0, pregnancy: 0, postpartum: 0, infant: 0 },
    highRisk: 0,
    openAlerts: 0,
    emergencyAlerts: 0,
    referralsOpen: 0,
    referralsDone: 0,
    ancAttended: 0,
    ancExpected: 0,
    pncEligible: 0,
    pnc48: 0,
    ebfEligible: 0,
    ebf: 0,
    epdsEligible: 0,
    epdsScreened: 0,
    epdsPositive: 0,
    immDue: 0,
    immOnTime: 0,
    messages: 0,
    costByChannel: {},
    costPerMotherMonthUSD: 0,
    overrides: ctx.overrides.filter((o) => ids.has(o.motherId)).length,
    rulesLearned: ctx.learnedRules.length,
    proposalsOpen: ctx.proposals.filter((p) => p.status === 'pending' || p.status === 'needs_evidence').length,
  };
  for (const mo of mothers) {
    const plan = plans.get(mo.id);
    if (!plan) continue;
    const s = plan.state;
    m.byStage[s.stage] = (m.byStage[s.stage] ?? 0) + 1;
    if (s.risks.some((r) => r.severity === 'high' || r.severity === 'urgent')) m.highRisk += 1;
    m.openAlerts += plan.alerts.length;
    m.emergencyAlerts += plan.alerts.filter((a) => a.level === 'emergency').length;
    for (const e of mo.events) {
      if (e.kind === 'referral') {
        if (e.status === 'completed' || e.status === 'arrived') m.referralsDone += 1;
        else if (e.status === 'open') m.referralsOpen += 1;
      }
    }
    if (s.stage === 'pregnancy') {
      m.ancAttended += Math.min(s.ancContactsAttended, 8);
      m.ancExpected += Math.max(expectedAnc(s.gestationalWeeks), Math.min(s.ancContactsAttended, 8));
    }
    if (mo.birth && (s.stage === 'postpartum' || s.stage === 'infant')) {
      const birthDate = mo.birth.date;
      if (daysBetween(birthDate, ctx.clock) >= 2) {
        m.pncEligible += 1;
        const ok = mo.events.some((e) => e.kind === 'visit' && e.visitType === 'pnc' && e.attended && daysBetween(birthDate, e.at) <= 2 && daysBetween(birthDate, e.at) >= 0);
        if (ok) m.pnc48 += 1;
      }
    }
    if (s.infant && (s.infantAgeDays ?? 999) < 183) {
      m.ebfEligible += 1;
      if (s.infant.feeding === 'exclusive_breastfeeding') m.ebf += 1;
    }
    if (s.stage === 'postpartum' || s.stage === 'infant' || (s.stage === 'pregnancy' && (s.gestationalWeeks ?? 0) >= 28)) {
      m.epdsEligible += 1;
      const sc = mo.events.filter((e) => e.kind === 'screening' && e.instrument === 'epds');
      if (sc.length) {
        m.epdsScreened += 1;
        const last = sc.sort((a, b) => (a.at < b.at ? 1 : -1))[0];
        if (last.kind === 'screening' && (last.score >= 13 || last.selfHarmFlag)) m.epdsPositive += 1;
      }
    }
    if (s.infant) {
      const age = s.infantAgeDays ?? 0;
      const given = mo.events.filter((e) => e.kind === 'immunisation').length;
      // Birth, 6, 10, 14 weeks, 9 months: count doses due by now.
      const due = [0, 42, 70, 98, 274].filter((d) => d + 14 <= age).length;
      if (due) {
        m.immDue += 1;
        if (given >= due) m.immOnTime += 1;
      }
    }
  }
  const msgs = ctx.outbound.filter((o) => ids.has(o.motherId));
  m.messages = msgs.length;
  for (const o of msgs) {
    const c = (m.costByChannel[o.channel] ??= { usd: 0, count: 0 });
    c.usd += o.estCostUSD;
    c.count += 1;
  }
  const totalUsd = msgs.reduce((s, o) => s + o.estCostUSD, 0);
  const first = msgs.reduce((a, o) => (o.createdAt < a ? o.createdAt : a), ctx.clock);
  const months = Math.max(1, daysBetween(first, ctx.clock) / 30.44);
  m.costPerMotherMonthUSD = mothers.length ? totalUsd / mothers.length / months : 0;
  return m;
}

function StageChart({ byStage }: { byStage: Record<string, number> }) {
  const rows = (['pregnancy', 'postpartum', 'infant', 'preconception'] as const).map((k) => [k, byStage[k] ?? 0] as const);
  const max = Math.max(1, ...rows.map((r) => r[1]));
  return (
    <div className="hbar" role="img" aria-label={rows.map(([k, v]) => `${STAGE_LABELS[k]} ${v}`).join(', ')}>
      {rows.map(([k, v]) => (
        <div className="hbar-row" key={k}>
          <span>{STAGE_LABELS[k]}</span>
          <span className="hbar-track">
            <i style={{ width: `${(v / max) * 100}%` }} />
          </span>
          <span className="num">{v}</span>
        </div>
      ))}
    </div>
  );
}

function PairBars({ rows, unit }: { rows: Array<{ label: string; a: number; b: number; aLabel: string; bLabel: string }>; unit?: string }) {
  const W = 320;
  const rowH = 46;
  const H = rows.length * rowH + 10;
  const max = Math.max(1, ...rows.flatMap((r) => [r.a, r.b]));
  const x = (v: number) => (v / max) * (W - 130);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={rows.map((r) => `${r.label}: ${r.a} ${r.aLabel}, ${r.b} ${r.bLabel}`).join('; ')}>
      {rows.map((r, i) => {
        const y = i * rowH + 4;
        return (
          <g key={r.label}>
            <text x={0} y={y + 14}>
              {r.label}
            </text>
            <rect x={90} y={y + 4} width={Math.max(2, x(r.b))} height={12} rx={3} fill="var(--line-2)" />
            <rect x={90} y={y + 20} width={Math.max(2, x(r.a))} height={12} rx={3} fill="var(--green)" />
            <text x={96 + x(r.b)} y={y + 14} className="val">
              {r.b}
              {unit ?? ''} {r.bLabel}
            </text>
            <text x={96 + x(r.a)} y={y + 30} className="val">
              {r.a}
              {unit ?? ''} {r.aLabel}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function Dashboard() {
  const { state, dispatch } = useApp();
  const plans = usePlans();
  const toast = useToast();
  const [showJson, setShowJson] = useState(false);
  const mothers = state.mothers.filter((m) => state.country === 'ALL' || m.country === state.country);
  const m = useMemo(() => computeMetrics(mothers, plans, state), [mothers, plans, state]);
  const pncRate = m.pncEligible ? m.pnc48 / m.pncEligible : 0;
  const share = (a: number, b: number) => (b ? (a / b) * 100 : 0);
  const care = [
    { label: 'Antenatal', progress: share(m.ancAttended, m.ancExpected), value: pct(m.ancAttended, m.ancExpected) },
    { label: 'Postnatal 48h', progress: share(m.pnc48, m.pncEligible), value: pct(m.pnc48, m.pncEligible) },
    { label: 'Breast milk only', progress: share(m.ebf, m.ebfEligible), value: pct(m.ebf, m.ebfEligible) },
    { label: 'Mood check', progress: share(m.epdsScreened, m.epdsEligible), value: pct(m.epdsScreened, m.epdsEligible) },
    { label: 'Vaccines on time', progress: share(m.immOnTime, m.immDue), value: pct(m.immOnTime, m.immDue) },
  ];

  const publicData = useMemo(
    () => ({
      publisher: 'Gaskin open data (synthetic demo)',
      generatedAt: state.clock,
      area: state.country === 'ALL' ? 'Nigeria, Kenya, Ghana' : COUNTRIES[state.country as CountryCode]?.name,
      deidentified: true,
      smallNumberSuppression: 'Counts under 5 shown as "<5" in production',
      metrics: {
        mothers_enrolled: m.enrolled,
        by_stage: m.byStage,
        high_risk_share: m.enrolled ? +(m.highRisk / m.enrolled).toFixed(3) : null,
        open_danger_alerts: m.openAlerts,
        referrals: { open: m.referralsOpen, completed: m.referralsDone },
        anc_contacts: { attended: m.ancAttended, expected: m.ancExpected },
        pnc_within_48h: { eligible: m.pncEligible, achieved: m.pnc48 },
        exclusive_breastfeeding_under_6m: { eligible: m.ebfEligible, achieved: m.ebf },
        epds: { eligible: m.epdsEligible, screened: m.epdsScreened, positive: m.epdsPositive },
        immunisation_on_time: { due: m.immDue, on_time: m.immOnTime },
        messages_sent: m.messages,
        cost_per_mother_per_month_usd: +m.costPerMotherMonthUSD.toFixed(4),
        expert_overrides: m.overrides,
        rules_learned: m.rulesLearned,
      },
    }),
    [m, state.clock, state.country],
  );
  const json = JSON.stringify(publicData, null, 2);

  return (
    <div className="page">
      <header className="today-head">
        <h1 className="t-display">Programme</h1>
        <p className="lede">For a state ministry or funder. Every figure is computed from the mothers on Gaskin by the same rules that build their plans.</p>
        <div className="filters">
          <div className="group">
            <span className="group-label">Country</span>
            {(['ALL', 'NG', 'KE', 'GH'] as const).map((c) => (
              <button key={c} className="filter-chip" aria-pressed={state.country === c} onClick={() => dispatch({ type: 'setCountry', country: c })}>
                {c === 'ALL' ? 'All three' : COUNTRIES[c]?.name ?? c}
              </button>
            ))}
          </div>
        </div>
      </header>

      <BentoGrid className="hero-metric-grid">
        <BentoCard tone="ink" className="hero-metric sm:col-span-2 lg:row-span-2" label="Primary outcome" figure={<span className="text-[clamp(3.2rem,9vw,5rem)] big">{m.pncEligible ? Math.round(pncRate * 100) : '–'}<small className="text-[0.45em] align-top">%</small></span>} note="of mothers had a postnatal check within 48 hours of birth">
          <p className="m-0 mt-2 max-w-[48ch] text-[0.88rem] leading-snug text-paper/80">
            {m.pnc48} of {m.pncEligible} mothers who gave birth more than two days ago. Most maternal and newborn deaths happen in the first 48 hours, which is why this is the number Gaskin is built to move.
          </p>
          <div className="mt-auto h-2 overflow-hidden rounded-full bg-paper/15" aria-hidden="true">
            <i className="block h-full rounded-full bg-clay transition-[width] duration-700 ease-out motion-reduce:transition-none" style={{ width: `${pncRate * 100}%` }} />
          </div>
          <span className="text-[0.75rem] text-paper/65">WHO recommends a check within 24 hours for facility births and within 48 hours for home births.</span>
        </BentoCard>
        <BentoCard label="Mothers enrolled" figure={m.enrolled} note={`${m.byStage.pregnancy} pregnant, ${(m.byStage.postpartum ?? 0) + (m.byStage.infant ?? 0)} with babies`} />
        <BentoCard tone={m.emergencyAlerts ? 'clay' : 'card'} label="Open danger alerts" figure={m.openAlerts} note={`${m.emergencyAlerts} emergency · ${m.referralsOpen} referrals open`} />
        <BentoCard className="sm:col-span-2" label="Care kept, as a share of care due" note="Antenatal contacts, postnatal checks, breast milk only, mood checks and vaccines">
          <BarChart
            height={128}
            summary={care.map((c) => `${c.label} ${c.value}`).join(', ')}
            items={care.map((c, i) => ({ ...c, className: i === 1 ? 'bg-clay' : 'bg-green' }))}
          />
        </BentoCard>
        <BentoCard tone="green" label="Messaging cost per mother a month" figure={usd(m.costPerMotherMonthUSD)} note={`${m.messages} messages, ${usd(Object.values(m.costByChannel).reduce((s, c) => s + c.usd, 0))} in total`} />
        <BentoCard label="High risk" figure={pct(m.highRisk, m.enrolled)} note={`${m.highRisk} mothers`} />
        <BentoCard label="Plan changes by workers" figure={m.overrides} note={`${m.proposalsOpen} ${m.proposalsOpen === 1 ? "proposal" : "proposals"} open for review`} />
        <BentoCard label="Rules learned from experts" figure={m.rulesLearned} note={`Released in library v${state.libraryVersion}`} />
      </BentoGrid>

      <div className="charts">
        <section className="chart">
          <h2 className="t-h3">Where mothers are in the 1,000 days</h2>
          <StageChart byStage={m.byStage} />
        </section>
        <section className="chart">
          <h2 className="t-h3">Care kept against care expected</h2>
          <PairBars
            rows={[
              { label: 'Antenatal', a: m.ancAttended, b: m.ancExpected, aLabel: 'kept', bLabel: 'expected' },
              { label: 'Postnatal 48h', a: m.pnc48, b: m.pncEligible, aLabel: 'checked', bLabel: 'births' },
              { label: 'Vaccines', a: m.immOnTime, b: m.immDue, aLabel: 'on time', bLabel: 'due' },
            ]}
          />
          <span className="tiny muted">Grey: expected. Green: done.</span>
        </section>
        <section className="chart">
          <h2 className="t-h3">Messaging cost by channel</h2>
          {Object.keys(m.costByChannel).length === 0 ? (
            <p className="small muted">No messages sent yet. Send one from a mother’s record.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Channel</th>
                  <th style={{ textAlign: 'right' }}>Messages</th>
                  <th style={{ textAlign: 'right' }}>Cost</th>
                  <th style={{ textAlign: 'right' }}>Each</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(m.costByChannel).map(([ch, c]) => (
                  <tr key={ch}>
                    <td>{CHANNEL_LABELS[ch] ?? ch}</td>
                    <td className="n">{c.count}</td>
                    <td className="n">{usd(c.usd)}</td>
                    <td className="n">{usd(c.usd / c.count)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      <section className="panel section">
        <div className="section-head">
          <h2 className="t-h2">Public data</h2>
          <div className="btn-row">
            <button className="btn small" onClick={() => setShowJson(!showJson)} aria-expanded={showJson}>
              {showJson ? 'Hide JSON' : 'Show JSON'}
            </button>
            <button
              className="btn small"
              onClick={async () => {
                const r = await saveFile(`gaskin-public-data-${state.clock.slice(0, 10)}.json`, json, 'application/json');
                toast(r === 'declined' ? 'Download cancelled.' : 'Public data ready to save.');
              }}
            >
              <IDownload /> Export JSON
            </button>
          </div>
        </div>
        <p className="small soft">
          These de-identified totals are what Gaskin publishes as open, real-time data. No names, phone numbers, villages or dates of birth leave the system. In production, any count under 5 is shown as “&lt;5”.
        </p>
        <ul className="small soft" style={{ margin: 0, paddingLeft: 18, columns: '3 200px', columnGap: 24, lineHeight: 1.8 }}>
          {Object.keys(publicData.metrics).map((k) => (
            <li key={k}>{k.replace(/_/g, ' ')}</li>
          ))}
        </ul>
        {showJson ? <pre className="code">{json}</pre> : null}
      </section>
    </div>
  );
}
