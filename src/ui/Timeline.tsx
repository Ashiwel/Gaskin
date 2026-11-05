import type { ReactNode } from 'react';
import type { ClinicalEvent, Mother } from '../types';
import { useApp } from '../store';
import { SYMPTOM_LABELS } from '../clinical';
import { Empty, Sparkline } from './components';
import { fmtDate, fmtTime, toDate, CHANNEL_LABELS } from './format';
import { IAlert, IBaby, IClipboard, IDrop, IFlask, IHeart, IMessage, IReferral, ISend, IStethoscope, ISyringe, IThermo } from './icons';
import { TRIAGE_LABELS } from '../store/triage';

interface FeedEntry {
  at: string;
  icon: ReactNode;
  tone?: 'red' | 'clay' | 'green';
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

function describe(e: ClinicalEvent, workers: { id: string; name: string }[]): FeedEntry {
  const by = `by ${workerName(e.recordedBy, workers)}`;
  switch (e.kind) {
    case 'visit':
      return {
        at: e.at,
        icon: <IStethoscope />,
        tone: e.attended ? 'green' : 'clay',
        title: `${VISIT_LABELS[e.visitType] ?? e.visitType}${e.contactNumber ? ` ${e.contactNumber}` : ''}${e.attended ? '' : ', missed'}`,
        sub: e.note ?? by,
      };
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
      const high = (e.systolic ?? 0) >= 140 || (e.diastolic ?? 0) >= 90;
      return { at: e.at, icon: <IHeart />, tone: high ? 'red' : undefined, title: parts.join(' · ') || 'Vitals', sub: by };
    }
    case 'lab':
      return { at: e.at, icon: <IFlask />, title: `${LAB_LABELS[e.test] ?? e.test}: ${e.value}${e.unit ? ` ${e.unit}` : ''}`, sub: by };
    case 'symptom':
      return {
        at: e.at,
        icon: <IAlert />,
        tone: 'red',
        title: e.symptoms.map((s) => SYMPTOM_LABELS[s] ?? s).join(', '),
        sub: `Reported ${e.via === 'visit' ? 'at a visit' : `by ${CHANNEL_LABELS[e.via] ?? e.via}`}${e.severity ? `, ${e.severity}` : ''}`,
      };
    case 'screening':
      return {
        at: e.at,
        icon: <IClipboard />,
        tone: e.selfHarmFlag || e.score >= 13 ? 'red' : undefined,
        title: `${e.instrument.toUpperCase()} mood check: ${e.score}${e.selfHarmFlag ? ', self-harm answer flagged' : ''}`,
        sub: by,
      };
    case 'birth':
      return {
        at: e.at,
        icon: <IBaby />,
        tone: 'green',
        title: `${e.child.name} born, ${e.child.birthWeightKg} kg, ${e.birth.mode} birth at ${e.birth.place.replace('_', ' ')}`,
        sub: e.birth.complications.filter((c) => c !== 'none').join(', ') || 'No complications recorded',
      };
    case 'feeding':
      return {
        at: e.at,
        icon: <IDrop />,
        title: `Feeding: ${e.status.replace(/_/g, ' ')}${e.milkSupply ? `, milk supply ${e.milkSupply.replace('_', ' ')}` : ''}`,
        sub: e.latchProblem ? 'Latch problem noted' : by,
      };
    case 'growth':
      return {
        at: e.at,
        icon: <IBaby />,
        title: `Growth: ${[e.weightKg ? `${e.weightKg} kg` : '', e.lengthCm ? `${e.lengthCm} cm` : '', e.muacCm ? `MUAC ${e.muacCm} cm` : ''].filter(Boolean).join(' · ')}`,
        sub: by,
      };
    case 'immunisation':
      return { at: e.at, icon: <ISyringe />, tone: 'green', title: `Vaccines given: ${e.vaccines.join(', ')}`, sub: by };
    case 'medication':
      return { at: e.at, icon: <IThermo />, title: `${e.action === 'start' ? 'Started' : 'Stopped'} ${e.medication.name}${e.medication.dose ? ` ${e.medication.dose}` : ''}`, sub: by };
    case 'report':
      return { at: e.at, icon: <IClipboard />, title: `Report from ${e.author}`, sub: e.text.length > 160 ? `${e.text.slice(0, 160)}…` : e.text };
    case 'referral':
      return {
        at: e.at,
        icon: <IReferral />,
        tone: e.urgency === 'emergency' ? 'red' : 'clay',
        title: `Referred (${e.urgency}): ${e.reason}`,
        sub: `Status: ${e.status.replace('_', ' ')}`,
      };
    default:
      return { at: (e as ClinicalEvent).at, icon: <IClipboard />, title: 'Event' };
  }
}

export function vitalSeries(m: Mother) {
  const vit = m.events.filter((e) => e.kind === 'vitals').sort((a, b) => (a.at < b.at ? -1 : 1));
  const sys = vit.filter((e) => e.kind === 'vitals' && e.systolic).map((e) => ({ x: toDate(e.at).getTime(), y: (e as { systolic: number }).systolic }));
  const dia = vit.filter((e) => e.kind === 'vitals' && e.diastolic).map((e) => ({ x: toDate(e.at).getTime(), y: (e as { diastolic: number }).diastolic }));
  const hb = m.events
    .filter((e) => e.kind === 'lab' && e.test === 'haemoglobin' && typeof e.value === 'number')
    .sort((a, b) => (a.at < b.at ? -1 : 1))
    .map((e) => ({ x: toDate(e.at).getTime(), y: (e as { value: number }).value }));
  return { sys, dia, hb };
}

export function Timeline({ mother }: { mother: Mother }) {
  const { state } = useApp();
  const entries: FeedEntry[] = mother.events.map((e) => describe(e, state.workers));
  for (const o of state.outbound.filter((x) => x.motherId === mother.id)) {
    entries.push({
      at: o.sentAt ?? o.createdAt,
      icon: <ISend />,
      title: `${CHANNEL_LABELS[o.channel] ?? o.channel} sent: ${o.body.slice(0, 90)}${o.body.length > 90 ? '…' : ''}`,
      sub: `${o.status}${o.aiAssisted ? ', written with AI and reviewed' : ''}`,
    });
  }
  for (const i of state.inbound.filter((x) => x.motherId === mother.id)) {
    const t = state.inboundTriage[i.id];
    entries.push({
      at: i.receivedAt,
      icon: <IMessage />,
      tone: t === 'emergency' ? 'red' : 'clay',
      title: `She wrote: “${i.body}”`,
      sub: t ? TRIAGE_LABELS[t] : undefined,
    });
  }
  entries.sort((a, b) => (a.at < b.at ? 1 : -1));
  const { sys, dia, hb } = vitalSeries(mother);
  const lastSys = sys[sys.length - 1]?.y;
  const lastDia = dia[dia.length - 1]?.y;
  const lastHb = hb[hb.length - 1]?.y;

  let day = '';
  return (
    <div className="section" style={{ gap: 22 }}>
      {sys.length || hb.length ? (
        <div className="trends">
          {sys.length ? (
            <div className="trend">
              <span className="t-label">Blood pressure</span>
              <span className="v num">
                {lastSys}/{lastDia}
                <small>mmHg</small>
              </span>
              <Sparkline
                points={sys}
                points2={dia}
                band={{ from: 140, to: Math.max(170, ...sys.map((p) => p.y)), tone: 'red' }}
                color="var(--red)"
                color2="var(--ink-3)"
                title={`Systolic readings ${sys.map((p) => p.y).join(', ')}; diastolic ${dia.map((p) => p.y).join(', ')}. Shaded area is 140 and above.`}
              />
              <span className="tiny muted">Top and bottom numbers over {sys.length} readings. Shaded: 140 or higher.</span>
            </div>
          ) : null}
          {hb.length ? (
            <div className="trend">
              <span className="t-label">Haemoglobin</span>
              <span className="v num">
                {lastHb}
                <small>g/dL</small>
              </span>
              <Sparkline
                points={hb}
                band={{ from: Math.min(7, ...hb.map((p) => p.y)), to: 11, tone: 'amber' }}
                color="var(--clay)"
                title={`Haemoglobin readings ${hb.map((p) => p.y).join(', ')}. Shaded area is below 11.`}
              />
              <span className="tiny muted">{hb.length} results. Shaded: below 11, anaemia in pregnancy.</span>
            </div>
          ) : null}
        </div>
      ) : null}

      {entries.length === 0 ? (
        <Empty art="calendar" title="Nothing recorded yet">
          Visits, readings and messages will appear here in order.
        </Empty>
      ) : (
        <ol className="feed">
          {entries.map((e, i) => {
            const d = fmtDate(e.at, { year: true });
            const head = d !== day;
            day = d;
            return (
              <li key={i}>
                {head ? <div className="feed-day">{d}</div> : null}
                <div className="feed-item">
                  <span className={`k ${e.tone ?? ''}`}>{e.icon}</span>
                  <span className="what">
                    {e.title}
                    {e.sub ? <div className="sub">{e.sub}</div> : null}
                  </span>
                  <time>{fmtTime(e.at)}</time>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
