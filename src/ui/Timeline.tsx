/**
 * Her timeline: the readings that matter as pictures first (blood pressure over the normal,
 * raised and severe zones; haemoglobin against the anaemia line), then every event in date order
 * with an icon per kind, filterable by kind.
 */
import { useMemo, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  Beaker02,
  CalendarCheck01,
  ClipboardCheck,
  Droplets01,
  FaceSmile,
  File06,
  HeartRounded,
  MedicalCross,
  MessageChatCircle,
  Ruler,
  Send01,
  ShieldTick,
  SlashCircle01,
  Star01,
  Truck01,
} from '@untitledui/icons';
import type { ClinicalEvent, Mother } from '../types';
import { useApp } from '../store';
import { SYMPTOM_LABELS } from '../clinical';
import { BPChart, bpZone } from '../components/viz';
import { SURFACE, TONE, useWidth } from '../components/viz/shared';
import { fmtDate, fmtTime, toDate, CHANNEL_LABELS } from './format';
import { TRIAGE_LABELS } from '../store/triage';
import { cx } from '../utils/cx';
import { Card, Chip, IconTile, Segmented, type ChipTone, type IconType } from './patient/ui';
import { REASON_WORD } from './patient/Constraint';
import { decodeCustomAnswers } from '../visits/customQuestions';

type Kind = 'visits' | 'readings' | 'symptoms' | 'messages' | 'child';

interface FeedEntry {
  at: string;
  icon: IconType;
  tone: ChipTone;
  kind: Kind;
  title: ReactNode;
  sub?: ReactNode;
}

const VISIT_LABELS: Record<string, string> = {
  anc: 'Antenatal visit',
  pnc: 'Postnatal check',
  child_health: 'Child health visit',
  home_visit: 'Home visit',
  remote_checkin: 'Phone check-in',
  emergency: 'Emergency visit',
};

const LAB_LABELS: Record<string, string> = {
  haemoglobin: 'Haemoglobin',
  hiv: 'HIV test',
  syphilis: 'Syphilis test',
  hepatitis_b: 'Hepatitis B test',
  malaria_rdt: 'Malaria test',
  urine_protein: 'Urine protein',
  urine_glucose: 'Urine sugar',
  blood_glucose_fasting: 'Fasting blood sugar',
  ogtt_2h: 'Sugar test (2 hours)',
  genotype: 'Genotype',
  blood_group: 'Blood group',
  ultrasound: 'Scan',
};

export function workerName(id: string, workers: { id: string; name: string }[]): string {
  if (id === 'mother') return 'her, by message';
  if (id === 'system') return 'Gaskin';
  return workers.find((w) => w.id === id)?.name ?? id;
}

function childName(m: Mother, id?: string): string | undefined {
  return id ? m.children.find((c) => c.id === id)?.name.split(' ')[0] : undefined;
}

function itemLabel(id: string): string {
  return id
    .replace(/^(med|test|imm|untested|alt)\./, '')
    .replace(/@.*$/, '')
    .replace(/[._]/g, ' ')
    .replace(/^./, (c) => c.toUpperCase());
}

function describe(e: ClinicalEvent, m: Mother, workers: { id: string; name: string }[]): FeedEntry {
  const by = `by ${workerName(e.recordedBy, workers)}`;
  const kid = childName(m, e.childId);
  const forKid = kid ? `${kid}: ` : '';
  switch (e.kind) {
    case 'visit': {
      const custom = decodeCustomAnswers(e.note);
      return {
        at: e.at,
        icon: CalendarCheck01,
        tone: e.attended ? 'success' : 'warning',
        kind: 'visits',
        title: `${VISIT_LABELS[e.visitType] ?? e.visitType}${e.contactNumber ? ` ${e.contactNumber}` : ''}${e.attended ? '' : ', missed'}`,
        sub: custom.length ? `${by}. ${custom.map((c) => `${c.question}: ${c.answer}`).join('; ')}` : e.note && !e.note.includes('|') && !e.note.startsWith('checklist:') ? e.note : by,
      };
    }
    case 'vitals': {
      const parts = [
        e.systolic && e.diastolic ? `BP ${e.systolic}/${e.diastolic}` : '',
        e.weightKg ? `${e.weightKg} kg` : '',
        e.temperatureC ? `${e.temperatureC}°C` : '',
        e.pulse ? `pulse ${e.pulse}` : '',
        e.fundalHeightCm ? `fundal height ${e.fundalHeightCm} cm` : '',
        e.fetalHeartRate ? `baby's heart ${e.fetalHeartRate}` : '',
        e.muacCm ? `MUAC ${e.muacCm} cm` : '',
      ].filter(Boolean);
      const z = e.systolic && e.diastolic ? bpZone({ label: '', systolic: e.systolic, diastolic: e.diastolic }) : 'normal';
      return { at: e.at, icon: HeartRounded, tone: z === 'severe' ? 'error' : z === 'raised' ? 'warning' : 'gray', kind: 'readings', title: forKid + (parts.join(' · ') || 'Vitals'), sub: by };
    }
    case 'lab': {
      const low = e.test === 'haemoglobin' && typeof e.value === 'number' && e.value < 11;
      const pos = e.value === 'positive';
      return { at: e.at, icon: Beaker02, tone: low || pos ? 'warning' : 'brand', kind: 'readings', title: `${forKid}${LAB_LABELS[e.test] ?? e.test}: ${e.value}${e.unit ? ` ${e.unit}` : ''}`, sub: by };
    }
    case 'symptom':
      return {
        at: e.at,
        icon: AlertTriangle,
        tone: 'error',
        kind: 'symptoms',
        title: forKid + e.symptoms.map((s) => SYMPTOM_LABELS[s] ?? s).join(', '),
        sub: `Reported ${e.via === 'visit' ? 'at a visit' : `by ${CHANNEL_LABELS[e.via] ?? e.via}`}${e.severity ? `, ${e.severity}` : ''}`,
      };
    case 'screening':
      return {
        at: e.at,
        icon: FaceSmile,
        tone: e.selfHarmFlag || e.score >= 13 ? 'error' : e.score >= 10 ? 'warning' : 'success',
        kind: 'symptoms',
        title: `Mood check: ${e.score} of 30${e.selfHarmFlag ? ', self-harm answer flagged' : ''}`,
        sub: by,
      };
    case 'birth':
      return {
        at: e.at,
        icon: Star01,
        tone: 'success',
        kind: 'child',
        title: `${e.child.name} born, ${e.child.birthWeightKg} kg, ${e.birth.mode} birth at ${e.birth.place.replace('_', ' ')}`,
        sub: e.birth.complications.filter((c) => c !== 'none').join(', ') || 'No complications recorded',
      };
    case 'feeding':
      return {
        at: e.at,
        icon: Droplets01,
        tone: e.milkSupply === 'very_low' || e.latchProblem ? 'warning' : 'gray',
        kind: 'child',
        title: `${forKid}Feeding: ${e.status.replace(/_/g, ' ')}${e.milkSupply ? `, milk supply ${e.milkSupply.replace('_', ' ')}` : ''}`,
        sub: e.latchProblem ? 'Latch problem noted' : by,
      };
    case 'growth':
      return {
        at: e.at,
        icon: Ruler,
        tone: 'gray',
        kind: 'child',
        title: `${forKid}Growth: ${[e.weightKg ? `${e.weightKg} kg` : '', e.lengthCm ? `${e.lengthCm} cm` : '', e.muacCm ? `MUAC ${e.muacCm} cm` : ''].filter(Boolean).join(' · ')}`,
        sub: by,
      };
    case 'immunisation':
      return { at: e.at, icon: ShieldTick, tone: 'success', kind: 'child', title: `${forKid}Vaccines given: ${e.vaccines.join(', ')}`, sub: by };
    case 'medication':
      return { at: e.at, icon: MedicalCross, tone: 'brand', kind: 'readings', title: `${e.action === 'start' ? 'Started' : 'Stopped'} ${e.medication.name}${e.medication.dose ? ` ${e.medication.dose}` : ''}`, sub: by };
    case 'report':
      return { at: e.at, icon: File06, tone: 'gray', kind: 'readings', title: `Report from ${e.author}`, sub: e.text.length > 160 ? `${e.text.slice(0, 160)}…` : e.text };
    case 'referral':
      return { at: e.at, icon: Truck01, tone: e.urgency === 'emergency' ? 'error' : 'warning', kind: 'visits', title: `${forKid}Referred (${e.urgency}): ${e.reason}`, sub: `Status: ${e.status.replace('_', ' ')}` };
    case 'constraint':
      return {
        at: e.at,
        icon: SlashCircle01,
        tone: 'warning',
        kind: 'visits',
        title: `${forKid}Could not: ${itemLabel(e.itemId)} (${e.temporary ? 'not done today' : REASON_WORD[e.reason]})`,
        sub: by,
      };
    default:
      return { at: (e as ClinicalEvent).at, icon: ClipboardCheck, tone: 'gray', kind: 'visits', title: 'Event' };
  }
}

export function vitalSeries(m: Mother) {
  const vit = m.events.filter((e) => e.kind === 'vitals' && !e.childId).sort((a, b) => (a.at < b.at ? -1 : 1));
  const sys = vit.filter((e) => e.kind === 'vitals' && e.systolic).map((e) => ({ x: toDate(e.at).getTime(), y: (e as { systolic: number }).systolic }));
  const dia = vit.filter((e) => e.kind === 'vitals' && e.diastolic).map((e) => ({ x: toDate(e.at).getTime(), y: (e as { diastolic: number }).diastolic }));
  const hb = m.events
    .filter((e) => e.kind === 'lab' && e.test === 'haemoglobin' && typeof e.value === 'number' && !e.childId)
    .sort((a, b) => (a.at < b.at ? -1 : 1))
    .map((e) => ({ x: toDate(e.at).getTime(), y: (e as { value: number }).value }));
  return { sys, dia, hb };
}

const KIND_LABEL: Record<Kind | 'all', string> = { all: 'All', visits: 'Visits', readings: 'Readings', symptoms: 'Symptoms', messages: 'Messages', child: 'Children' };

export function Timeline({ mother }: { mother: Mother }) {
  const { state } = useApp();
  const [kind, setKind] = useState<Kind | 'all'>('all');
  const entries = useMemo(() => {
    const out: FeedEntry[] = mother.events.map((e) => describe(e, mother, state.workers));
    for (const o of state.outbound.filter((x) => x.motherId === mother.id)) {
      out.push({ at: o.sentAt ?? o.createdAt, icon: Send01, tone: 'brand', kind: 'messages', title: `${CHANNEL_LABELS[o.channel] ?? o.channel} sent: ${o.body.slice(0, 90)}${o.body.length > 90 ? '…' : ''}`, sub: `${o.status}${o.aiAssisted ? ', written with AI and reviewed' : ''}` });
    }
    for (const i of state.inbound.filter((x) => x.motherId === mother.id)) {
      const t = state.inboundTriage[i.id];
      out.push({ at: i.receivedAt, icon: MessageChatCircle, tone: t === 'emergency' ? 'error' : 'gray', kind: 'messages', title: `She wrote: “${i.body}”`, sub: t ? TRIAGE_LABELS[t] : undefined });
    }
    return out.sort((a, b) => (a.at < b.at ? 1 : -1));
  }, [mother, state.workers, state.outbound, state.inbound, state.inboundTriage]);

  const vit = mother.events.filter((e) => e.kind === 'vitals' && !e.childId && e.systolic && e.diastolic).sort((a, b) => (a.at < b.at ? -1 : 1));
  const readings = vit.map((e) => ({ label: fmtDate(e.at), systolic: (e as { systolic: number }).systolic, diastolic: (e as { diastolic: number }).diastolic })).slice(-12);
  const { hb } = vitalSeries(mother);
  const lastHb = hb[hb.length - 1]?.y;
  const counts = entries.reduce<Record<string, number>>((a, e) => ((a[e.kind] = (a[e.kind] ?? 0) + 1), a), {});
  const shown = kind === 'all' ? entries : entries.filter((e) => e.kind === kind);

  let day = '';
  return (
    <div className="grid grid-cols-1 gap-8">
      {readings.length || hb.length ? (
        <section aria-label="Trends" className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {readings.length ? (
            <Card className={hb.length ? 'lg:col-span-8' : 'lg:col-span-12'}>
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-sm font-semibold text-primary">Blood pressure</h2>
                <span className="text-sm text-tertiary">
                  Latest <span className="font-semibold text-primary tnum">{readings[readings.length - 1].systolic}/{readings[readings.length - 1].diastolic}</span> mmHg
                </span>
              </div>
              <BPChart readings={readings} label={`${mother.name}'s blood pressure`} height={220} />
            </Card>
          ) : null}
          {hb.length ? (
            <Card className={readings.length ? 'lg:col-span-4' : 'lg:col-span-12'}>
              <h2 className="text-sm font-semibold text-primary">Haemoglobin</h2>
              <p className="mt-2 flex items-baseline gap-1.5">
                <span className="text-display-sm font-semibold text-primary tnum">{lastHb}</span>
                <span className="text-sm text-tertiary">g/dL</span>
                {lastHb !== undefined ? <Chip tone={lastHb < 7 ? 'error' : lastHb < 11 ? 'warning' : 'success'} className="ml-auto">{lastHb < 7 ? 'Severe anaemia' : lastHb < 11 ? 'Anaemia' : 'Normal'}</Chip> : null}
              </p>
              <HbTrend values={hb.map((p) => p.y)} />
              <p className="mt-2 text-xs text-tertiary">{hb.length} result{hb.length === 1 ? '' : 's'}. The dashed line is 11 g/dL; below it is anaemia in pregnancy.</p>
            </Card>
          ) : null}
        </section>
      ) : null}

      <section aria-labelledby="feed-h" className="grid grid-cols-1 gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="feed-h" className="text-lg font-semibold text-primary">
            Everything recorded
          </h2>
          <Segmented
            label="Show"
            size="sm"
            value={kind}
            onChange={(v) => setKind(v ?? 'all')}
            options={(['all', 'visits', 'readings', 'symptoms', 'child', 'messages'] as const).filter((k) => k === 'all' || counts[k]).map((k) => ({ value: k, label: KIND_LABEL[k] }))}
            className="max-w-full"
          />
        </div>
        {shown.length === 0 ? (
          <Card className="py-10 text-center">
            <p className="text-md font-semibold text-primary">Nothing recorded yet</p>
            <p className="mt-1 text-sm text-tertiary">Visits, readings and messages will appear here in order.</p>
          </Card>
        ) : (
          <ol className="gk-feed relative grid grid-cols-1">
            {shown.map((e, i) => {
              const d = fmtDate(e.at, { year: true });
              const head = d !== day;
              day = d;
              return (
                <li key={i} className="grid grid-cols-1">
                  {head ? <div className="gk-feed-day sticky top-0 z-[1] bg-primary py-2 text-xs font-semibold tracking-wide text-tertiary uppercase">{d}</div> : null}
                  <div className="gk-feed-item relative flex gap-3 pb-4 pl-0">
                    <span aria-hidden="true" className="absolute top-10 bottom-0 left-[19px] w-px bg-border-secondary" />
                    <IconTile icon={e.icon} tone={e.tone} className="relative" />
                    <div className="min-w-0 flex-1 pt-0.5">
                      <p className={cx('text-sm leading-snug font-medium', e.tone === 'error' ? 'text-error-primary' : 'text-primary')}>{e.title}</p>
                      {e.sub ? <p className="mt-0.5 text-sm text-tertiary">{e.sub}</p> : null}
                    </div>
                    <time className="shrink-0 pt-0.5 text-xs text-quaternary tnum">{fmtTime(e.at)}</time>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}

/** Haemoglobin over time on a fixed scale, with the 11 g/dL anaemia line and the 7 g/dL severe line marked. */
function HbTrend({ values }: { values: number[] }) {
  const [ref, width] = useWidth<HTMLDivElement>(260);
  const h = 88;
  const pad = { l: 26, r: 10, t: 8, b: 8 };
  const lo = Math.min(6, ...values) - 0.5;
  const hi = Math.max(14, ...values) + 0.5;
  const w = Math.max(60, width - pad.l - pad.r);
  const x = (i: number) => pad.l + (values.length < 2 ? w / 2 : (i / (values.length - 1)) * w);
  const y = (v: number) => pad.t + (1 - (v - lo) / (hi - lo)) * (h - pad.t - pad.b);
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join('');
  return (
    <div ref={ref} className="mt-3">
      <svg width={width} height={h} viewBox={`0 0 ${width} ${h}`} role="img" aria-label={`Haemoglobin ${values.join(', ')} g/dL. Anaemia below 11.`} className="block">
        <rect x={pad.l} y={y(11)} width={w} height={y(lo) - y(11)} fill="var(--color-bg-warning-primary)" />
        <rect x={pad.l} y={y(7)} width={w} height={y(lo) - y(7)} fill="var(--color-bg-error-primary)" />
        {[7, 11].map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={pad.l + w} y1={y(v)} y2={y(v)} stroke={v === 7 ? TONE.danger : TONE.warning} strokeDasharray="4 3" strokeWidth={1} />
            <text x={pad.l - 6} y={y(v)} dy="0.32em" textAnchor="end" fontSize={10} fill="var(--color-chart-axis)" className="tnum">
              {v}
            </text>
          </g>
        ))}
        {values.length > 1 ? <path d={d} fill="none" stroke="var(--color-fg-secondary)" strokeWidth={2} strokeLinejoin="round" /> : null}
        {values.map((v, i) => (
          <circle key={i} cx={x(i)} cy={y(v)} r={4} fill={v < 7 ? TONE.danger : v < 11 ? TONE.warning : TONE.success} stroke={SURFACE} strokeWidth={2}>
            <title>{`${v} g/dL`}</title>
          </circle>
        ))}
      </svg>
    </div>
  );
}
