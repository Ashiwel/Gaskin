/**
 * The first 1,000 days for every child and any current pregnancy, on one calendar track.
 *
 * Each pregnancy or child is a lane from conception to day 1,000, drawn against real dates so
 * siblings close together sit one above the other and their overlap is plain to see. Twins share
 * a lane. Contacts are markers: done (green, filled), due (brand), overdue (red with a halo),
 * missed (amber) and upcoming (hollow). Today is one vertical rule across every lane.
 */
import type { Child, Mother } from '../../types';
import { IMMUNISATION_SCHEDULES } from '../../clinical';
import { SURFACE, TONE, useWidth } from '../../components/viz/shared';
import { addDays, daysBetween, fmtDate } from '../format';
import { cx } from '../../utils/cx';

export type ContactState = 'done' | 'due' | 'overdue' | 'missed' | 'upcoming';

export interface LaneContact {
  date: string;
  label: string;
  state: ContactState;
}

export interface Lane {
  id: string;
  /** "Chidera, 2 years" or "This pregnancy" */
  label: string;
  /** Conception date (ISO) */
  start: string;
  /** Birth date, actual or expected */
  birth: string;
  kind: 'pregnancy' | 'child';
  twins?: boolean;
  contacts: LaneContact[];
}

const ANC_WEEKS = [12, 20, 26, 30, 34, 36, 38, 40];
const PNC_DAYS: Array<[number, number, string]> = [
  [0, 1, 'Postnatal check, first day'],
  [2, 3, 'Postnatal check, day 3'],
  [7, 14, 'Postnatal check, week 2'],
  [42, 49, 'Postnatal check, 6 weeks'],
];

const COLOR: Record<ContactState, string> = {
  done: TONE.success,
  due: TONE.brand,
  overdue: TONE.danger,
  missed: TONE.warning,
  upcoming: 'var(--color-fg-quaternary)',
};
export const CONTACT_WORD: Record<ContactState, string> = { done: 'Done', due: 'Due', overdue: 'Overdue', missed: 'Missed', upcoming: 'Upcoming' };

function stateFor(due: string, windowEnd: string, done: boolean, today: string): ContactState {
  if (done) return 'done';
  if (daysBetween(today, due) > 7) return 'upcoming';
  if (daysBetween(windowEnd, today) <= 0) return 'due';
  return 'overdue';
}

/** Build the lanes from her record: one per birth date (twins share), plus the current pregnancy. */
export function buildLanes(mother: Mother, today: string, edd?: string, lmp?: string): Lane[] {
  const lanes: Lane[] = [];
  const visits = mother.events.filter((e) => e.kind === 'visit' && e.attended);
  const kids = mother.children.filter((c) => daysBetween(c.dob, today) <= 1000 - 266 + 30 && daysBetween(c.dob, today) >= 0);
  const byDob = new Map<string, Child[]>();
  for (const c of kids) {
    const k = c.dob.slice(0, 10);
    byDob.set(k, [...(byDob.get(k) ?? []), c]);
  }
  const sched = IMMUNISATION_SCHEDULES[mother.country] ?? [];
  for (const [dob, group] of [...byDob.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    const ids = new Set(group.map((c) => c.id));
    const onlyChild = mother.children.length === 1;
    const mine = (e: { childId?: string }) => (e.childId ? ids.has(e.childId) : onlyChild);
    const given = new Set(mother.events.filter((e) => e.kind === 'immunisation' && mine(e)).flatMap((e) => (e.kind === 'immunisation' ? e.vaccines : [])));
    const contacts: LaneContact[] = [];
    for (const [from, to, label] of PNC_DAYS) {
      const due = addDays(dob, from);
      const end = addDays(dob, to + 3);
      const done = visits.some((v) => daysBetween(due, v.at) >= -1 && daysBetween(v.at, end) >= 0);
      const st = stateFor(due, end, done, today);
      // PNC contacts long past and not done are missed, not overdue: nothing to catch up.
      contacts.push({ date: due, label, state: st === 'overdue' && daysBetween(end, today) > 14 ? 'missed' : st });
    }
    for (const row of sched) {
      if (row.ageDays === 0 || row.ageDays > 730) continue;
      const due = addDays(dob, row.ageDays);
      const done = row.vaccines.every((v) => given.has(v));
      contacts.push({ date: due, label: `${row.label} vaccines`, state: stateFor(due, addDays(due, 14), done, today) });
    }
    const names = group.map((c) => c.name.split(' ')[0]);
    lanes.push({
      id: `child-${dob}`,
      label: group.length > 1 ? `${names.join(' and ')}, twins` : names[0],
      start: addDays(dob, -266),
      birth: dob,
      kind: 'child',
      twins: group.length > 1,
      contacts: contacts.sort((a, b) => (a.date < b.date ? -1 : 1)),
    });
  }
  if (lmp && edd) {
    const contacts: LaneContact[] = [];
    const anc = visits.filter((v) => v.kind === 'visit' && v.visitType === 'anc' && v.at >= lmp).map((v) => v.at.slice(0, 10));
    for (const w of ANC_WEEKS) {
      const due = addDays(lmp, w * 7);
      const done = anc.some((d) => Math.abs(daysBetween(due, d)) <= 17);
      contacts.push({ date: due, label: `Antenatal contact at ${w} weeks`, state: stateFor(due, addDays(due, 14), done, today) });
    }
    // A contact missed long ago is "missed"; only the most recent unmet one is "overdue".
    let seenOverdue = false;
    for (let i = contacts.length - 1; i >= 0; i--) {
      if (contacts[i].state !== 'overdue') continue;
      if (seenOverdue) contacts[i].state = 'missed';
      seenOverdue = true;
    }
    lanes.push({ id: 'pregnancy', label: 'This pregnancy', start: addDays(lmp, 14), birth: edd, kind: 'pregnancy', contacts });
  }
  return lanes;
}

function dayOf(lane: Lane, today: string): number {
  return Math.max(0, Math.min(1000, daysBetween(lane.start, today)));
}

/**
 * The journey track. With one lane it reads as "Day 412 of 1,000" on a single line with stage
 * names; with several, lanes stack on a shared calendar axis.
 */
export function JourneyTrack({ lanes, today, motherName, className }: { lanes: Lane[]; today: string; motherName: string; className?: string }) {
  const [ref, width] = useWidth<HTMLDivElement>(640);
  if (!lanes.length) return null;
  const single = lanes.length === 1;
  const phone = width < 560;
  const labelW = single || phone ? 0 : 168;
  const padX = 10;
  const w = Math.max(120, width - labelW - padX * 2);
  // Axis: single lane = that lane's 1,000 days; several = the calendar span of every lane.
  const t0 = single ? lanes[0].start : lanes.reduce((m, l) => (l.start < m ? l.start : m), lanes[0].start);
  const t1 = single ? addDays(lanes[0].start, 1000) : lanes.reduce((m, l) => (addDays(l.start, 1000) > m ? addDays(l.start, 1000) : m), addDays(lanes[0].start, 1000));
  const span = Math.max(1, daysBetween(t0, t1));
  const x = (iso: string) => labelW + padX + (Math.max(0, Math.min(span, daysBetween(t0, iso))) / span) * w;
  const laneGap = phone && !single ? 44 : 36;
  const top = phone && !single ? 22 : 14;
  const height = top + lanes.length * laneGap + (single ? 26 : 22);
  const counts = lanes.flatMap((l) => l.contacts).reduce<Record<string, number>>((a, c) => ((a[c.state] = (a[c.state] ?? 0) + 1), a), {});
  const summary = `${motherName}'s first 1,000 days. ${lanes
    .map((l) => `${l.label}: day ${dayOf(l, today)} of 1,000${l.kind === 'pregnancy' ? `, due ${fmtDate(l.birth)}` : `, born ${fmtDate(l.birth)}`}`)
    .join('. ')}. Contacts: ${Object.entries(counts)
    .map(([k, n]) => `${n} ${CONTACT_WORD[k as ContactState].toLowerCase()}`)
    .join(', ')}.`;
  const tx = x(today);
  const years: string[] = [];
  if (!single) {
    const y0 = Number(t0.slice(0, 4)) + 1;
    const y1 = Number(t1.slice(0, 4));
    for (let y = y0; y <= y1; y++) years.push(`${y}-01-01`);
  }
  return (
    <div ref={ref} className={cx('w-full', className)}>
      <svg role="img" aria-label={summary} width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="block overflow-visible">
        {years.map((y) => (
          <g key={y}>
            <line x1={x(y)} x2={x(y)} y1={top - 8} y2={height - 18} stroke="var(--color-chart-grid)" strokeWidth={1} />
            <text x={x(y)} y={height - 4} textAnchor="middle" fontSize={11} fill="var(--color-chart-axis)" className="tnum">
              {y.slice(0, 4)}
            </text>
          </g>
        ))}
        {lanes.map((l, i) => {
          const y = top + i * laneGap + (phone && !single ? 12 : 8);
          const end = addDays(l.start, 1000);
          return (
            <g key={l.id}>
              {!single ? (
                phone ? (
                  <text x={padX} y={y - 13} fontSize={12} fontWeight={600} fill="var(--color-text-secondary)">
                    {l.label} <tspan fill="var(--color-text-tertiary)" fontWeight={400}>· day {dayOf(l, today)}</tspan>
                  </text>
                ) : (
                  <>
                    <text x={0} y={y - 2} fontSize={12} fontWeight={600} fill="var(--color-text-secondary)">
                      {l.label.length > 24 ? `${l.label.slice(0, 23)}…` : l.label}
                    </text>
                    <text x={0} y={y + 12} fontSize={11} fill="var(--color-text-tertiary)" className="tnum">
                      Day {dayOf(l, today).toLocaleString('en-GB')} of 1,000
                    </text>
                  </>
                )
              ) : null}
              {/* pregnancy segment, then the first two years */}
              <line x1={x(l.start)} x2={x(l.birth) - 3} y1={y} y2={y} stroke="var(--color-chart-band-strong)" strokeWidth={6} strokeLinecap="round" />
              <line x1={x(l.birth) + 3} x2={x(end)} y1={y} y2={y} stroke="var(--color-chart-track)" strokeWidth={6} strokeLinecap="round" />
              <line x1={x(l.start)} x2={Math.min(tx, x(end))} y1={y} y2={y} stroke={TONE.brand} strokeWidth={6} strokeLinecap="round" opacity={0.85} />
              <line x1={x(l.birth)} x2={x(l.birth)} y1={y - 9} y2={y + 9} stroke="var(--color-fg-tertiary)" strokeWidth={1.5}>
                <title>{l.kind === 'pregnancy' ? `Due ${fmtDate(l.birth, { year: true })}` : `Born ${fmtDate(l.birth, { year: true })}`}</title>
              </line>
              {l.contacts.map((c, j) => {
                const cx0 = x(c.date);
                const color = COLOR[c.state];
                const hollow = c.state === 'upcoming';
                return (
                  <g key={`${c.date}-${j}`}>
                    {c.state === 'overdue' ? <circle cx={cx0} cy={y} r={9} fill={color} opacity={0.22} /> : null}
                    <circle cx={cx0} cy={y} r={c.state === 'due' || c.state === 'overdue' ? 5.5 : 4.5} fill={hollow ? SURFACE : color} stroke={hollow ? color : SURFACE} strokeWidth={2}>
                      <title>{`${c.label}, ${fmtDate(c.date, { year: true })}: ${CONTACT_WORD[c.state].toLowerCase()}`}</title>
                    </circle>
                  </g>
                );
              })}
            </g>
          );
        })}
        {/* today, across every lane */}
        <line x1={tx} x2={tx} y1={top - 10} y2={height - (single ? 24 : 20)} stroke="var(--color-fg-primary)" strokeWidth={1.5} strokeDasharray={single ? undefined : '3 3'} />
        <circle cx={tx} cy={top - 10} r={3} fill="var(--color-fg-primary)" />
        {single ? (
          <g fontSize={11} fill="var(--color-chart-axis)">
            <text x={x(lanes[0].start)} y={height - 4}>
              Conception
            </text>
            <text x={x(lanes[0].birth)} y={height - 4} textAnchor="middle" fontWeight={600} fill="var(--color-text-secondary)">
              {lanes[0].kind === 'pregnancy' ? 'Due' : 'Birth'}
            </text>
            {width > 420 ? (
              <text x={x(addDays(lanes[0].birth, 365))} y={height - 4} textAnchor="middle">
                1 year
              </text>
            ) : null}
            <text x={x(addDays(lanes[0].start, 1000))} y={height - 4} textAnchor="end">
              Day 1,000
            </text>
          </g>
        ) : null}
      </svg>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-tertiary" aria-hidden="true">
        {(['done', 'due', 'overdue', 'missed', 'upcoming'] as ContactState[])
          .filter((s) => counts[s])
          .map((s) => (
            <li key={s} className="flex items-center gap-1.5">
              <span className={cx('size-2.5 rounded-full', s === 'upcoming' && 'ring-2 ring-fg-quaternary ring-inset')} style={s === 'upcoming' ? undefined : { background: COLOR[s] }} />
              {CONTACT_WORD[s]} <span className="tnum text-quaternary">{counts[s]}</span>
            </li>
          ))}
        <li className="flex items-center gap-1.5">
          <span className="h-3 w-0.5 rounded-full bg-fg-primary" /> Today
        </li>
      </ul>
    </div>
  );
}
