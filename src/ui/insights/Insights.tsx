/**
 * Insights: how care is going for the mothers the signed-in worker looks after. Scoped to her own
 * caseload; her facility when her role allows it; her area (state or county) for supervisors and
 * programme officers. Never another community. The hero figure is the postnatal check within 48
 * hours; then KPI tiles, the care cascade, caseload by stage, risk, referrals, messaging cost,
 * learning, and every published de-identified figure in a table with small numbers withheld.
 */
import { useMemo, useState } from 'react';
import { AlertTriangle, Building07, Coins01, Download01, GitBranch01, Lock01, MarkerPin01, MessageChatCircle, Repeat04, Users01 } from '@untitledui/icons';
import { useApp, usePlans, useWorker } from '../../store';
import { Button } from '../../components/base/buttons/button';
import { Badge } from '../../components/base/badges/badges';
import { AreaChart, BarChart, DonutChart, KpiTile, ProgressRing, StackedBar } from '../../components/viz';
import { cx } from '../../utils/cx';
import { saveFile } from '../HandoutSheet';
import { useToast } from '../components';
import { CHANNEL_LABELS, pct, STAGE_LABELS, usd } from '../format';
import { allowed, Card, PageHeader, Segmented } from '../messages/kit';
import { CareCascade, ReferralMeter } from './Charts';
import { computeMetrics, delta4, publicJSON, publicRows, SUPPRESS_BELOW, weeklyTrends } from './metrics';

export type InsightsScope = 'caseload' | 'facility' | 'area';

export function Insights() {
  const { state } = useApp();
  const plans = usePlans();
  const worker = useWorker();
  const toast = useToast();
  const [showJson, setShowJson] = useState(false);
  const facility = state.facilities.find((f) => f.id === worker?.facilityId);
  const canFacility = allowed(worker, 'view_facility');
  const canWider = allowed(worker, 'view_insights_wider');
  const canCommunity = allowed(worker, 'view_insights_community');
  const scopes: Array<{ id: InsightsScope; label: string }> = [
    ...(allowed(worker, 'view_own_caseload') ? [{ id: 'caseload' as const, label: 'My mothers' }] : []),
    ...(canFacility || canWider ? [{ id: 'facility' as const, label: facility ? facility.name.replace(/Primary Health Centre/i, 'PHC') : 'My facility' }] : []),
    ...(canWider && facility ? [{ id: 'area' as const, label: facility.region }] : []),
  ];
  const [scopeRaw, setScope] = useState<InsightsScope>('caseload');
  const scope = scopes.some((s) => s.id === scopeRaw) ? scopeRaw : (scopes[0]?.id ?? 'caseload');

  const mothers = useMemo(() => {
    if (!worker) return [];
    if (scope === 'area' && facility) {
      const inArea = new Set(state.facilities.filter((f) => f.country === facility.country && f.region === facility.region).map((f) => f.id));
      return state.mothers.filter((m) => inArea.has(m.facilityId));
    }
    if (scope === 'facility') return state.mothers.filter((m) => m.facilityId === worker.facilityId || m.assignedWorkerId === worker.id);
    return state.mothers.filter((m) => m.assignedWorkerId === worker.id);
  }, [worker, scope, facility, state.mothers, state.facilities]);

  const m = useMemo(() => computeMetrics(mothers, plans, state), [mothers, plans, state]);
  const trend = useMemo(() => weeklyTrends(mothers, state), [mothers, state]);
  const rows = useMemo(() => publicRows(m), [m]);
  const areaName = scope === 'area' ? `${facility?.region}, ${facility?.country}` : scope === 'facility' ? (facility?.name ?? 'Facility') : `Caseload of ${worker?.name ?? 'this worker'}`;
  const json = JSON.stringify(publicJSON(rows, { clock: state.clock, area: areaName }), null, 2);
  const pncRate = m.pncEligible ? Math.round((m.pnc48 / m.pncEligible) * 100) : null;
  const pncDelta = delta4(trend.pnc48);
  const scopeLine = scope === 'area' ? `every mother registered in ${facility?.region}` : scope === 'facility' ? `mothers at ${facility?.name ?? 'your facility'}` : 'the mothers in your caseload';

  if (!canCommunity) {
    return (
      <div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-8">
        <PageHeader title="Insights" />
        <Card>
          <p className="flex items-center gap-2 py-6 text-sm text-tertiary">
            <Lock01 className="size-4" aria-hidden="true" /> Your role does not include Insights. Ask a supervisor if you need them.
          </p>
        </Card>
      </div>
    );
  }

  const stageSlices = (['pregnancy', 'postpartum', 'infant', 'preconception'] as const).map((k) => ({ label: STAGE_LABELS[k], value: m.byStage[k] ?? 0 }));
  const channels = Object.entries(m.costByChannel).sort((a, b) => b[1].usd - a[1].usd);

  return (
    <div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-6 lg:gap-8" data-testid="insights">
      <PageHeader
        title="Insights"
        lede={`How care is going for ${scopeLine}. Every figure is worked out on this device by the same rules that build their plans.`}
        action={
          scopes.length > 1 ? (
            <Segmented label="Whose figures" value={scope} onChange={setScope} options={scopes} />
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-sm text-secondary ring-1 ring-secondary">
              <Users01 className="size-4" aria-hidden="true" /> {scopes[0]?.label ?? 'My mothers'}
            </span>
          )
        }
      />

      {/* Bento: hero plus tiles */}
      <section aria-label="Key figures" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-12">
        <div className="hero-metric relative min-w-0 overflow-hidden rounded-2xl bg-primary p-5 sm:p-6 shadow-xs ring-1 ring-secondary sm:col-span-2 lg:col-span-6 lg:row-span-2" data-testid="hero-metric">
          <p className="text-sm font-medium text-brand-secondary">Primary outcome</p>
          <h2 className="mt-1 text-lg font-semibold text-primary">Postnatal check within 48 hours of birth</h2>
          <div className="mt-5 flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:gap-6">
            <ProgressRing value={pncRate ?? 0} size={128} thickness={12} label="Postnatal check within 48 hours">
              <span className="text-display-sm font-semibold text-primary">{pncRate === null ? '–' : `${pncRate}%`}</span>
            </ProgressRing>
            <div className="min-w-0 flex-1">
              <p className="text-md text-secondary">
                <strong className="font-semibold text-primary tnum">{m.pnc48}</strong> of <strong className="font-semibold text-primary tnum">{m.pncEligible}</strong> mothers who gave birth more than two days ago.
              </p>
              {pncDelta ? (
                <p className={cx('mt-1 text-sm font-medium', pncDelta > 0 ? 'text-success-primary' : 'text-error-primary')}>
                  {pncDelta > 0 ? '+' : '−'}
                  {Math.abs(pncDelta)} points in four weeks
                </p>
              ) : null}
              <p className="mt-2 text-sm text-tertiary">Most maternal and newborn deaths happen in the first two days, which is why this is the number Gaskin is built to move.</p>
            </div>
          </div>
          <div className="mt-5">
            <AreaChart height={120} labels={trend.labels} series={[{ name: 'Within 48 hours', values: trend.pnc48 }]} unit="%" max={100} label="Postnatal checks within 48 hours, by week" labelEvery={3} />
          </div>
        </div>
        <KpiTile className="lg:col-span-3" label="Mothers" value={String(m.enrolled)} icon={<Users01 />} />
        <KpiTile className="lg:col-span-3" label="Open danger alerts" value={String(m.openAlerts)} icon={<AlertTriangle />} higherIsBetter={false} delta={m.emergencyAlerts} deltaUnit=" emergency" />
        <KpiTile className="lg:col-span-3" label="Antenatal contacts kept" value={pct(m.ancAttended, m.ancExpected)} icon={<Building07 />} trend={trend.ancContacts} delta={delta4(trend.ancContacts)} period="contacts vs 4 weeks ago" />
        <KpiTile className="lg:col-span-3" label="Messaging cost per mother a month" value={usd(m.costPerMotherMonthUSD)} icon={<Coins01 />} trend={trend.costPerMother} higherIsBetter={false} />
      </section>

      <div className="grid gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-8" title="Care cascade" action={<span className="text-xs text-tertiary">Among {m.cascade.delivered} births</span>}>
          {m.cascade.delivered ? (
            <CareCascade
              label="Care cascade"
              steps={[
                { label: 'Births', value: m.cascade.delivered, hint: 'Mothers who gave birth' },
                { label: 'Four antenatal contacts', value: m.cascade.anc4 },
                { label: 'Birth in a facility', value: m.cascade.facilityBirth },
                { label: 'Postnatal check in 48 hours', value: m.cascade.pnc48 },
                { label: 'Baby’s vaccines on time', value: m.cascade.immunised },
              ]}
            />
          ) : (
            <p className="py-10 text-center text-sm text-tertiary">No births yet among these mothers.</p>
          )}
        </Card>
        <Card className="lg:col-span-4" title="Caseload by stage">
          <DonutChart data={stageSlices} label="Mothers by stage" size={150} centerLabel="mothers" />
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-12">
        <Card className="lg:col-span-4" title="Risk">
          <StackedBar
            size="tall"
            label="Mothers by risk"
            parts={[
              { label: 'Danger now', value: m.risk.danger, tone: 'danger' },
              { label: 'High', value: m.risk.high, tone: 'warning' },
              { label: 'Moderate', value: m.risk.moderate, tone: 'brand' },
              { label: 'Low', value: m.risk.low, tone: 'neutral' },
            ]}
          />
        </Card>
        <Card className="lg:col-span-4" title="Referrals">
          <ReferralMeter open={m.referralsOpen} done={m.referralsDone} notDone={m.referralsNotCompleted} />
        </Card>
        <Card className="md:col-span-2 lg:col-span-4" title="Messaging cost by channel" action={<span className="text-xs text-tertiary tnum">{usd(m.costTotalUSD)} in total</span>}>
          {channels.length ? (
            <BarChart orientation="horizontal" unit="¢" label="Messaging cost by channel, US cents" data={channels.map(([ch, c]) => ({ label: `${CHANNEL_LABELS[ch] ?? ch} (${c.count})`, value: Math.round(c.usd * 1000) / 10 }))} />
          ) : (
            <p className="flex items-center gap-2 py-6 text-sm text-tertiary">
              <MessageChatCircle className="size-4" aria-hidden="true" /> No messages sent yet.
            </p>
          )}
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile label="Plan changes by workers" value={String(m.overrides)} icon={<Repeat04 />} trend={trend.overrides} />
        <KpiTile label="Rules learned from experts" value={String(m.rulesLearned)} icon={<GitBranch01 />} />
        <KpiTile label="Proposals open for review" value={String(m.proposalsOpen)} icon={<Repeat04 />} />
        <KpiTile label="Mood checks done" value={pct(m.epdsScreened, m.epdsEligible)} icon={<Users01 />} />
      </div>

      {/* Public data */}
      <Card
        id="public-data"
        title={
          <span className="inline-flex flex-wrap items-center gap-2">
            Public data
            <Badge size="sm" color="gray">
              De-identified
            </Badge>
          </span>
        }
        action={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" color="tertiary" onClick={() => setShowJson(!showJson)} aria-expanded={showJson}>
              {showJson ? 'Hide JSON' : 'Show JSON'}
            </Button>
            <Button
              size="sm"
              color="secondary"
              iconLeading={Download01}
              onClick={async () => {
                const r = await saveFile(`gaskin-public-data-${state.clock.slice(0, 10)}.json`, json, 'application/json');
                toast(r === 'declined' ? 'Download cancelled.' : 'Public data ready to save.');
              }}
            >
              Export JSON
            </Button>
          </div>
        }
      >
        <p className="-mt-2 mb-4 flex items-start gap-2 text-sm text-tertiary">
          <MarkerPin01 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          What Gaskin publishes for {areaName}. No names, phone numbers, villages or dates of birth. Counts from 1 to {SUPPRESS_BELOW - 1} are withheld, and so are rates that would reveal one.
        </p>
        <div className="-mx-5 overflow-x-auto">
          <table className="w-full text-sm sm:min-w-[520px]" data-testid="public-table">
            <thead>
              <tr className="border-y border-secondary bg-secondary text-start text-xs text-tertiary">
                <th scope="col" className="px-5 py-2.5 text-start font-medium">
                  Figure
                </th>
                <th scope="col" className="px-5 py-2.5 text-end font-medium">
                  Value
                </th>
                <th scope="col" className="hidden px-5 py-2.5 text-end font-medium sm:table-cell">
                  Out of
                </th>
              </tr>
            </thead>
            {Array.from(new Set(rows.map((r) => r.group))).map((g) => (
              <tbody key={g}>
                <tr>
                  <th scope="rowgroup" colSpan={3} className="px-5 pt-4 pb-1 text-start text-xs font-semibold tracking-wide text-quaternary uppercase">
                    {g}
                  </th>
                </tr>
                {rows
                  .filter((r) => r.group === g)
                  .map((r) => (
                    <tr key={r.key} className="border-b border-secondary last:border-0" data-suppressed={r.suppressed || undefined}>
                      <th scope="row" className="px-5 py-2.5 text-start font-normal text-secondary">
                        {r.label}
                      </th>
                      <td className="px-5 py-2.5 text-end">
                        {r.suppressed ? (
                          <span className="inline-flex items-center gap-1.5 text-tertiary" title={r.reason}>
                            <Lock01 className="size-3.5" aria-hidden="true" />
                            <span>Withheld</span>
                            <span className="sr-only">: {r.reason}</span>
                          </span>
                        ) : (
                          <span className="font-semibold text-primary tnum">{r.value}</span>
                        )}
                      </td>
                      <td className="hidden px-5 py-2.5 text-end text-tertiary tnum sm:table-cell">{r.denominator != null ? r.denominator : r.suppressed && r.reason ? <span className="text-xs">{r.reason}</span> : ''}</td>
                    </tr>
                  ))}
              </tbody>
            ))}
          </table>
        </div>
        {showJson ? <pre className="mt-4 max-h-80 overflow-auto rounded-lg bg-secondary p-3 font-mono text-xs text-secondary ring-1 ring-secondary">{json}</pre> : null}
      </Card>
    </div>
  );
}
