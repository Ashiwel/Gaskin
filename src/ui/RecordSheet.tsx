/**
 * Record new information: a fast, sectioned sheet. Section chips at the top jump to each part;
 * readings use steppers (with the zone named as you go), tests use segmented controls, symptoms
 * are icon toggles with danger signs in red, the mood check is the EPDS stepper (one question at
 * a time, progress ring, score bar), and a doctor's report can be read by AI. The footer counts
 * what will be saved.
 */
import { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Droplets01,
  Eye,
  FaceFrown,
  FaceSmile,
  HeartRounded,
  Lightning01,
  Moon01,
  Stars02,
  Thermometer01,
  User01,
  Wind01,
} from '@untitledui/icons';
import type { Birth, CarePlan, Child, ClinicalEvent, ExtractedFinding, FeedingEvent, LabTest, Mother, SymptomCode } from '../types';
import { stamp, uid, useApp, useWorker } from '../store';
import { IMMUNISATION_SCHEDULES, SYMPTOM_LABELS } from '../clinical';
import { bpZone } from '../components/viz';
import { Button } from '../components/base/buttons/button';
import { Thinking, useAbort, useToast } from './components';
import { AIBadge, getProvider, WhatAISees } from './ai';
import { cx } from '../utils/cx';
import { EPDS, epdsScore } from './epdsData';
import { EpdsStepper, type EpdsQuestion } from '../visits/components/EpdsStepper';
import { Chip, IconToggle, Segmented, SideSheet, Stepper, type IconType } from './patient/ui';
import { epdsPlain } from './patient/adapters';

// ---------- Symptoms ----------

const MOTHER_SYMPTOMS: SymptomCode[] = [
  'vaginal_bleeding',
  'severe_headache',
  'blurred_vision',
  'convulsions',
  'swelling_face_hands',
  'severe_abdominal_pain',
  'reduced_fetal_movement',
  'fever',
  'breathlessness',
  'leaking_fluid',
  'heavy_postpartum_bleeding',
  'foul_discharge',
  'calf_pain_swelling',
  'painful_urination',
  'breast_pain_redness',
  'cracked_nipples',
  'low_milk_supply',
  'nausea_vomiting',
  'heartburn',
  'back_pain',
  'leg_cramps',
  'constipation',
  'fatigue',
  'insomnia',
  'low_mood',
  'anxiety',
  'thoughts_of_self_harm',
];
const BABY_SYMPTOMS: SymptomCode[] = ['baby_not_feeding', 'baby_convulsions', 'baby_fast_breathing', 'baby_chest_indrawing', 'baby_fever', 'baby_cold', 'baby_lethargic', 'baby_yellow_skin', 'baby_cord_redness', 'baby_diarrhoea', 'baby_vomiting_everything'];
const DANGER = new Set<SymptomCode>([
  'vaginal_bleeding',
  'severe_headache',
  'blurred_vision',
  'convulsions',
  'severe_abdominal_pain',
  'reduced_fetal_movement',
  'breathlessness',
  'heavy_postpartum_bleeding',
  'thoughts_of_self_harm',
  'calf_pain_swelling',
  'leaking_fluid',
  'baby_not_feeding',
  'baby_convulsions',
  'baby_fast_breathing',
  'baby_chest_indrawing',
  'baby_cold',
  'baby_lethargic',
  'baby_vomiting_everything',
]);

function symIcon(s: SymptomCode): IconType {
  if (s.includes('bleeding') || s === 'foul_discharge' || s === 'leaking_fluid') return Droplets01;
  if (s === 'low_mood' || s === 'anxiety' || s === 'thoughts_of_self_harm') return FaceFrown;
  if (s.includes('headache')) return AlertTriangle;
  if (s === 'blurred_vision' || s === 'baby_yellow_skin') return Eye;
  if (s.includes('fever') || s === 'baby_cold') return Thermometer01;
  if (s.includes('breath') || s.includes('chest')) return Wind01;
  if (s.includes('convulsions')) return Lightning01;
  if (s === 'insomnia' || s === 'fatigue' || s === 'baby_lethargic') return Moon01;
  if (s.includes('breast') || s.includes('nipple') || s.includes('milk')) return HeartRounded;
  if (s.startsWith('baby_')) return User01;
  return Activity;
}

const LABS: Array<{ test: LabTest; label: string; kind: 'num' | 'posneg' | 'plus'; unit?: string; min?: number; max?: number; step?: number }> = [
  { test: 'haemoglobin', label: 'Haemoglobin', kind: 'num', unit: 'g/dL', min: 3, max: 20, step: 0.1 },
  { test: 'blood_glucose_fasting', label: 'Fasting blood sugar', kind: 'num', unit: 'mmol/L', min: 1, max: 30, step: 0.1 },
  { test: 'urine_protein', label: 'Urine protein', kind: 'plus' },
  { test: 'urine_glucose', label: 'Urine sugar', kind: 'plus' },
  { test: 'malaria_rdt', label: 'Malaria test', kind: 'posneg' },
  { test: 'hiv', label: 'HIV test', kind: 'posneg' },
  { test: 'syphilis', label: 'Syphilis test', kind: 'posneg' },
  { test: 'hepatitis_b', label: 'Hepatitis B', kind: 'posneg' },
];

type SectionId = 'vitals' | 'symptoms' | 'labs' | 'epds' | 'feeding' | 'growth' | 'immunisations' | 'birth' | 'report';
const SECTIONS: Array<[SectionId, string]> = [
  ['vitals', 'Readings'],
  ['symptoms', 'Symptoms'],
  ['labs', 'Tests'],
  ['epds', 'Mood check'],
  ['feeding', 'Feeding'],
  ['growth', 'Growth'],
  ['immunisations', 'Vaccines'],
  ['birth', 'Birth'],
  ['report', 'Doctor’s report'],
];

// ---------- Report extraction ----------

function findingToEvents(f: ExtractedFinding, base: { at: string; recordedBy: string }): ClinicalEvent[] {
  const field = f.field.toLowerCase();
  const v = f.value;
  const n = parseFloat(v);
  if ((field === 'systolic' || field === 'blood_pressure' || field === 'bp') && v.includes('/')) {
    const [s, d] = v.split('/').map((x) => parseFloat(x));
    if (Number.isFinite(s) && Number.isFinite(d)) return [{ kind: 'vitals', id: uid('ev'), ...base, systolic: s, diastolic: d, note: 'From doctor’s report' }];
  }
  if (field === 'systolic' && Number.isFinite(n)) return [{ kind: 'vitals', id: uid('ev'), ...base, systolic: n, note: 'From doctor’s report' }];
  if (field === 'diastolic' && Number.isFinite(n)) return [{ kind: 'vitals', id: uid('ev'), ...base, diastolic: n, note: 'From doctor’s report' }];
  if (field === 'temperature' && Number.isFinite(n)) return [{ kind: 'vitals', id: uid('ev'), ...base, temperatureC: n }];
  if (field === 'weight' && Number.isFinite(n)) return [{ kind: 'vitals', id: uid('ev'), ...base, weightKg: n }];
  if (field === 'haemoglobin' && Number.isFinite(n)) return [{ kind: 'lab', id: uid('ev'), ...base, test: 'haemoglobin', value: n, unit: 'g/dL' }];
  if (field === 'urine_protein') {
    const plus = (v.match(/\+/g) ?? []).length;
    return [{ kind: 'lab', id: uid('ev'), ...base, test: 'urine_protein', value: plus || (Number.isFinite(n) ? n : 0) }];
  }
  return [];
}

type Vitals = { systolic?: number; diastolic?: number; weightKg?: number; temperatureC?: number; pulse?: number; fundalHeightCm?: number; fetalHeartRate?: number; muacCm?: number };

// ---------- Component ----------

export function RecordSheet({ mother, plan, onClose, onSaved }: { mother: Mother; plan: CarePlan; onClose: () => void; onSaved: () => void }) {
  const { state, dispatch } = useApp();
  const worker = useWorker();
  const toast = useToast();
  const stage = plan.state.stage;
  const kids = mother.children.filter((c) => c.dob <= state.clock.slice(0, 10)).sort((a, b) => (a.dob < b.dob ? -1 : 1));
  const [childId, setChildId] = useState<string | undefined>(plan.state.infant?.id ?? kids[kids.length - 1]?.id);
  const child = kids.find((c) => c.id === childId);

  const [visit, setVisit] = useState(true);
  const [v, setV] = useState<Vitals>({});
  const [symptoms, setSymptoms] = useState<SymptomCode[]>([]);
  const [labs, setLabs] = useState<Record<string, string>>({});
  const [epds, setEpds] = useState<Array<number | null>>(Array(10).fill(null));
  const [epdsOn, setEpdsOn] = useState(false);
  const [feeding, setFeeding] = useState<{ status: string; milkSupply: string; feedsPerDay?: number; latch: boolean }>({ status: '', milkSupply: '', latch: false });
  const [growth, setGrowth] = useState<{ weightKg?: number; lengthCm?: number; muacCm?: number }>({});
  const [vaccines, setVaccines] = useState<string[]>([]);
  const [birthOn, setBirthOn] = useState(false);
  const [birth, setBirth] = useState({ date: state.clock.slice(0, 10), mode: 'vaginal' as Birth['mode'], place: 'facility' as Birth['place'], complications: [] as Birth['complications'], bloodLossMl: undefined as number | undefined, name: '', sex: 'F' as Child['sex'], weight: undefined as number | undefined, weeks: undefined as number | undefined });
  const [reportText, setReportText] = useState('');
  const [reportAuthor, setReportAuthor] = useState('');
  const [findings, setFindings] = useState<Array<ExtractedFinding & { keep: boolean }>>([]);
  const [extracting, setExtracting] = useState(false);
  const [extractNote, setExtractNote] = useState('');
  const { start, stop } = useAbort();

  const schedule = useMemo(() => (IMMUNISATION_SCHEDULES?.[mother.country] ?? []).filter((s) => s.ageDays <= 730), [mother.country]);
  const allVaccines = useMemo(() => Array.from(new Set(schedule.flatMap((s) => s.vaccines))), [schedule]);
  const ep = epdsScore(epds);
  const questions: EpdsQuestion[] = useMemo(() => epdsPlain() ?? EPDS.map((q) => ({ ask: q.ask, standard: q.q, opts: q.opts.map(([, s], i) => [q.plain[i], s] as [string, number]), standardOpts: q.opts })), []);

  const extract = async () => {
    const signal = start();
    setExtracting(true);
    setExtractNote('');
    setFindings([]);
    try {
      const p = await getProvider();
      const out = await p.extractFindings({ text: reportText, signal, mother, plan });
      if (!signal.aborted) {
        setFindings(out.map((f) => ({ ...f, keep: f.confidence !== 'low' })));
        if (!out.length) setExtractNote('No findings were recognised. You can still save the report as written.');
      }
    } catch {
      if (!signal.aborted) setExtractNote('The AI could not read the report just now. Save it as written, or enter the readings above.');
    } finally {
      setExtracting(false);
    }
  };

  const buildEvents = (): ClinicalEvent[] => {
    const at = stamp(state.clock);
    const base = { at, recordedBy: worker.id };
    const out: ClinicalEvent[] = [];
    const hasVitals = Object.values(v).some((x) => x !== undefined);
    if (visit && (hasVitals || symptoms.length || Object.values(labs).some(Boolean))) {
      const vt = stage === 'pregnancy' ? 'anc' : stage === 'postpartum' ? 'pnc' : stage === 'infant' ? 'child_health' : 'home_visit';
      out.push({ kind: 'visit', id: uid('ev'), ...base, visitType: vt, attended: true, facilityId: mother.facilityId, contactNumber: vt === 'anc' ? plan.state.ancContactsAttended + 1 : undefined });
    }
    if (hasVitals) out.push({ kind: 'vitals', id: uid('ev'), ...base, ...v });
    if (symptoms.length) {
      const m = symptoms.filter((s) => !s.startsWith('baby_'));
      const b = symptoms.filter((s) => s.startsWith('baby_'));
      if (m.length) out.push({ kind: 'symptom', id: uid('ev'), ...base, symptoms: m, via: 'visit' });
      if (b.length) out.push({ kind: 'symptom', id: uid('ev'), ...base, symptoms: b, via: 'visit', childId: child?.id });
    }
    for (const [test, val] of Object.entries(labs)) {
      if (val === '' || val === undefined) continue;
      const def = LABS.find((l) => l.test === test);
      const n = parseFloat(val);
      const value = (def?.kind === 'num' || def?.kind === 'plus') && Number.isFinite(n) ? n : val;
      out.push({ kind: 'lab', id: uid('ev'), ...base, test: test as LabTest, value, unit: def?.unit });
    }
    if (epdsOn && ep.complete) out.push({ kind: 'screening', id: uid('ev'), ...base, instrument: 'epds', score: ep.score, selfHarmFlag: ep.selfHarm });
    if (feeding.status || feeding.milkSupply || feeding.feedsPerDay || feeding.latch) {
      out.push({
        kind: 'feeding',
        id: uid('ev'),
        ...base,
        childId: child?.id,
        status: (feeding.status || child?.feeding || 'exclusive_breastfeeding') as FeedingEvent['status'],
        milkSupply: (feeding.milkSupply || undefined) as FeedingEvent['milkSupply'],
        feedsPerDay: feeding.feedsPerDay,
        latchProblem: feeding.latch || undefined,
      });
    }
    if (growth.weightKg || growth.lengthCm || growth.muacCm) out.push({ kind: 'growth', id: uid('ev'), ...base, childId: child?.id, ...growth });
    if (vaccines.length) out.push({ kind: 'immunisation', id: uid('ev'), ...base, childId: child?.id, vaccines });
    if (birthOn && birth.weight) {
      const c: Child = { id: uid('child'), name: birth.name.trim() || `Baby ${mother.name.split(' ').slice(-1)[0]}`, sex: birth.sex, dob: birth.date, birthWeightKg: birth.weight, gestationAtBirthWeeks: birth.weeks ?? plan.state.gestationalWeeks ?? 39, feeding: 'exclusive_breastfeeding' };
      const b: Birth = { date: birth.date, mode: birth.mode, place: birth.place, complications: birth.complications.length ? birth.complications : ['none'], bloodLossMl: birth.bloodLossMl };
      out.push({ kind: 'birth', id: uid('ev'), ...base, at: `${birth.date}T${at.slice(11)}`, birth: b, child: c });
    }
    if (reportText.trim()) {
      const kept = findings.filter((f) => f.keep);
      out.push({ kind: 'report', id: uid('ev'), ...base, author: reportAuthor.trim() || 'Doctor', text: reportText.trim(), extracted: kept.length ? kept.map(({ keep: _k, ...f }) => f) : undefined, extractionConfirmedBy: kept.length ? worker.id : undefined });
      for (const f of kept) out.push(...findingToEvents(f, base));
    }
    return out;
  };

  const events = buildEvents();
  const save = () => {
    const evs = buildEvents();
    if (!evs.length) return;
    dispatch({ type: 'addEvents', motherId: mother.id, events: evs, cause: 'New information recorded' });
    toast('Saved. Her plan has been updated.');
    onSaved();
  };

  const toggleSym = (s: SymptomCode) => setSymptoms((xs) => (xs.includes(s) ? xs.filter((x) => x !== s) : [...xs, s]));
  const showBaby = stage === 'postpartum' || stage === 'infant' || kids.length > 0;
  const showBirth = stage === 'pregnancy' || (stage === 'postpartum' && !kids.length);
  const sectionsShown = SECTIONS.filter(([k]) => (k === 'feeding' || k === 'growth' || k === 'immunisations' ? showBaby : k === 'birth' ? showBirth : true));
  const zone = v.systolic && v.diastolic ? bpZone({ label: '', systolic: v.systolic, diastolic: v.diastolic }) : undefined;
  const dangerPicked = symptoms.filter((s) => DANGER.has(s)).length;
  const kinds = new Set(events.map((e) => e.kind));
  const counts: Record<SectionId, boolean> = {
    vitals: kinds.has('vitals'),
    symptoms: kinds.has('symptom'),
    labs: kinds.has('lab'),
    epds: kinds.has('screening'),
    feeding: kinds.has('feeding'),
    growth: kinds.has('growth'),
    immunisations: kinds.has('immunisation'),
    birth: kinds.has('birth'),
    report: kinds.has('report'),
  };

  return (
    <SideSheet
      title={`Record for ${mother.name.split(' ')[0]}`}
      subtitle={`Recording as ${worker.name}`}
      onClose={onClose}
      width="lg"
      label="Record new information"
      testId="record-sheet"
      footer={
        <>
          <span className="mr-auto text-sm text-tertiary">{events.length ? `${events.length} thing${events.length === 1 ? '' : 's'} to save` : 'Nothing entered yet'}</span>
          <Button size="md" color="tertiary" onClick={onClose}>
            Cancel
          </Button>
          <Button size="md" color="primary" onClick={save} isDisabled={!events.length} data-testid="record-save">
            Save and update plan
          </Button>
        </>
      }
    >
      <nav aria-label="Jump to section" className="sticky -top-5 z-10 -mx-4 mb-4 flex gap-1.5 overflow-x-auto bg-primary px-4 py-2 sm:-mx-6 sm:px-6">
        {sectionsShown.map(([k, l]) => (
          <button
            key={k}
            type="button"
            onClick={() => document.getElementById(`rec-${k}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className={cx('inline-flex min-h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3 text-sm font-medium ring-1 ring-inset', counts[k] ? 'bg-brand-primary text-brand-secondary ring-utility-brand-200' : 'bg-primary text-secondary ring-secondary hover:bg-primary_hover')}
          >
            {counts[k] ? <span aria-hidden="true" className="size-1.5 rounded-full bg-fg-brand-secondary" /> : null}
            {l}
          </button>
        ))}
      </nav>

      <div className="grid grid-cols-1 gap-8">
        <Section id="vitals" title="Readings">
          <div className="grid grid-cols-2 gap-3">
            <Stepper id="rec-sys" label="BP top" unit="mmHg" value={v.systolic} start={120} step={2} min={50} max={260} onChange={(x) => setV({ ...v, systolic: x })} status={zone ? { tone: zone === 'severe' ? 'error' : zone === 'raised' ? 'warning' : 'success', word: zone === 'severe' ? 'Severe' : zone === 'raised' ? 'Raised' : 'Normal' } : undefined} />
            <Stepper id="rec-dia" label="BP bottom" unit="mmHg" value={v.diastolic} start={80} step={2} min={30} max={160} onChange={(x) => setV({ ...v, diastolic: x })} />
            <Stepper id="rec-wt" label="Weight" unit="kg" value={v.weightKg} start={plan.state.latest.weightKg ?? mother.prePregnancyWeightKg ?? 60} step={0.5} min={25} max={200} decimals={1} onChange={(x) => setV({ ...v, weightKg: x })} />
            <Stepper id="rec-temp" label="Temperature" unit="°C" value={v.temperatureC} start={36.6} step={0.1} min={30} max={43} decimals={1} onChange={(x) => setV({ ...v, temperatureC: x })} status={v.temperatureC !== undefined && v.temperatureC >= 38 ? { tone: 'error', word: 'Fever' } : undefined} />
            <Stepper id="rec-pulse" label="Pulse" unit="/min" value={v.pulse} start={80} step={2} min={30} max={220} onChange={(x) => setV({ ...v, pulse: x })} />
            <Stepper id="rec-muac" label="MUAC" unit="cm" value={v.muacCm} start={25} step={0.5} min={10} max={50} decimals={1} onChange={(x) => setV({ ...v, muacCm: x })} status={v.muacCm !== undefined && v.muacCm < 23 ? { tone: 'warning', word: 'Low' } : undefined} />
            {stage === 'pregnancy' ? (
              <>
                <Stepper id="rec-fh" label="Fundal height" unit="cm" value={v.fundalHeightCm} start={plan.state.gestationalWeeks ?? 24} step={1} min={5} max={50} onChange={(x) => setV({ ...v, fundalHeightCm: x })} />
                <Stepper id="rec-fhr" label="Baby’s heartbeat" unit="/min" value={v.fetalHeartRate} start={140} step={2} min={60} max={220} onChange={(x) => setV({ ...v, fetalHeartRate: x })} status={v.fetalHeartRate !== undefined && (v.fetalHeartRate < 110 || v.fetalHeartRate > 160) ? { tone: 'error', word: 'Abnormal' } : undefined} />
              </>
            ) : null}
          </div>
          <label className="mt-3 flex min-h-10 cursor-pointer items-center gap-2 text-sm text-secondary">
            <input type="checkbox" className="size-4" checked={visit} onChange={(e) => setVisit(e.target.checked)} />
            Count this as a visit
          </label>
        </Section>

        <Section id="symptoms" title="Symptoms" aside={dangerPicked ? <Chip tone="error">{dangerPicked} danger sign{dangerPicked === 1 ? '' : 's'}</Chip> : <span className="text-xs text-tertiary">Red edges are danger signs</span>}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="group" aria-label="Mother’s symptoms">
            {MOTHER_SYMPTOMS.filter((s) => {
              if (stage !== 'pregnancy' && (s === 'reduced_fetal_movement' || s === 'leaking_fluid')) return false;
              if (stage === 'pregnancy' && (s === 'heavy_postpartum_bleeding' || s === 'low_milk_supply' || s === 'cracked_nipples')) return false;
              return true;
            })
              .sort((a, b) => Number(DANGER.has(b)) - Number(DANGER.has(a)))
              .map((s) => (
                <IconToggle key={s} on={symptoms.includes(s)} onChange={() => toggleSym(s)} icon={symIcon(s)} label={SYMPTOM_LABELS[s] ?? s} danger={DANGER.has(s)} className={cx(DANGER.has(s) && !symptoms.includes(s) && 'ring-error_subtle')} />
              ))}
          </div>
          {showBaby ? (
            <>
              <p className="mt-5 mb-2 text-sm font-semibold text-primary">{child ? child.name.split(' ')[0] : 'Baby'}</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="group" aria-label="Baby’s symptoms">
                {BABY_SYMPTOMS.map((s) => (
                  <IconToggle key={s} on={symptoms.includes(s)} onChange={() => toggleSym(s)} icon={symIcon(s)} label={SYMPTOM_LABELS[s] ?? s} danger={DANGER.has(s)} className={cx(DANGER.has(s) && !symptoms.includes(s) && 'ring-error_subtle')} />
                ))}
              </div>
            </>
          ) : null}
        </Section>

        <Section id="labs" title="Tests" aside={<span className="text-xs text-tertiary">Leave blank if not done: blank is unknown, never normal</span>}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {LABS.map((l) =>
              l.kind === 'num' ? (
                <Stepper
                  key={l.test}
                  id={`lab-${l.test}`}
                  label={l.label}
                  unit={l.unit}
                  value={labs[l.test] ? parseFloat(labs[l.test]) : undefined}
                  start={l.test === 'haemoglobin' ? (plan.state.latest.haemoglobin ?? 11) : 5}
                  step={l.step}
                  min={l.min}
                  max={l.max}
                  decimals={1}
                  onChange={(x) => setLabs({ ...labs, [l.test]: x === undefined ? '' : String(x) })}
                  status={l.test === 'haemoglobin' && labs[l.test] ? (parseFloat(labs[l.test]) < 7 ? { tone: 'error', word: 'Severe' } : parseFloat(labs[l.test]) < 11 ? { tone: 'warning', word: 'Low' } : { tone: 'success', word: 'Normal' }) : undefined}
                />
              ) : (
                <div key={l.test} className="grid grid-cols-1 gap-1.5">
                  <span className="text-sm font-medium text-secondary">{l.label}</span>
                  <Segmented
                    label={l.label}
                    size="sm"
                    clearable
                    value={labs[l.test] || null}
                    onChange={(x) => setLabs({ ...labs, [l.test]: x ?? '' })}
                    options={
                      l.kind === 'posneg'
                        ? [
                            { value: 'negative', label: 'Negative', tone: 'ok' },
                            { value: 'positive', label: 'Positive', tone: 'bad' },
                          ]
                        : [
                            { value: '0', label: 'None', tone: 'ok' },
                            { value: '1', label: '+' },
                            { value: '2', label: '++', tone: 'bad' },
                            { value: '3', label: '+++', tone: 'bad' },
                          ]
                    }
                  />
                </div>
              ),
            )}
          </div>
        </Section>

        <Section id="epds" title="Mood check" aside={!epdsOn ? undefined : <Chip tone="brand">EPDS</Chip>}>
          {epdsOn ? (
            <EpdsStepper questions={questions} answers={epds} onChange={setEpds} />
          ) : (
            <button type="button" onClick={() => setEpdsOn(true)} className="flex w-full cursor-pointer items-center gap-3 rounded-2xl p-4 text-left ring-1 ring-secondary ring-inset hover:bg-primary_hover">
              <span className="grid grid-cols-1 size-10 place-items-center rounded-full bg-brand-primary text-fg-brand-primary">
                <FaceSmile className="size-5" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-primary">Ask the 10 questions now</span>
                <span className="block text-sm text-tertiary">About 3 minutes, one question at a time</span>
              </span>
            </button>
          )}
        </Section>

        {showBaby ? (
          <>
            {kids.length > 1 ? (
              <div className="grid grid-cols-1 gap-1.5">
                <span className="text-sm font-medium text-secondary">Which child</span>
                <Segmented label="Which child" value={childId} onChange={(x) => x && setChildId(x)} options={kids.map((c) => ({ value: c.id, label: c.name.split(' ')[0] }))} wrap />
              </div>
            ) : null}
            <Section id="feeding" title="Feeding">
              <div className="grid grid-cols-1 gap-4">
                <div className="grid grid-cols-1 gap-1.5">
                  <span className="text-sm font-medium text-secondary">How {child ? child.name.split(' ')[0] : 'the baby'} feeds</span>
                  <Segmented
                    label="How the baby feeds"
                    size="sm"
                    wrap
                    clearable
                    value={feeding.status || null}
                    onChange={(x) => setFeeding({ ...feeding, status: x ?? '' })}
                    options={[
                      { value: 'exclusive_breastfeeding', label: 'Breast milk only' },
                      { value: 'mixed', label: 'Breast and formula' },
                      { value: 'formula', label: 'Formula' },
                      { value: 'complementary_with_breastmilk', label: 'Foods and breast milk' },
                      { value: 'complementary_no_breastmilk', label: 'Foods only' },
                    ]}
                  />
                </div>
                <div className="grid grid-cols-1 gap-1.5">
                  <span className="text-sm font-medium text-secondary">Milk supply</span>
                  <Segmented
                    label="Milk supply"
                    size="sm"
                    clearable
                    value={feeding.milkSupply || null}
                    onChange={(x) => setFeeding({ ...feeding, milkSupply: x ?? '' })}
                    options={[
                      { value: 'good', label: 'Good', tone: 'ok' },
                      { value: 'low', label: 'Low' },
                      { value: 'very_low', label: 'Very low', tone: 'bad' },
                    ]}
                  />
                </div>
                <div className="grid grid-cols-2 items-end gap-3">
                  <Stepper id="rec-feeds" label="Feeds a day" value={feeding.feedsPerDay} start={8} min={0} max={30} onChange={(x) => setFeeding({ ...feeding, feedsPerDay: x })} />
                  <IconToggle on={feeding.latch} onChange={(x) => setFeeding({ ...feeding, latch: x })} icon={AlertTriangle} label="Trouble with latch" />
                </div>
              </div>
            </Section>

            <Section id="growth" title="Growth">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Stepper id="rec-bwt" label="Weight" unit="kg" value={growth.weightKg} start={plan.state.latest.infantWeightKg ?? child?.birthWeightKg ?? 3.2} step={0.05} min={0.5} max={30} decimals={2} onChange={(x) => setGrowth({ ...growth, weightKg: x })} />
                <Stepper id="rec-blen" label="Length" unit="cm" value={growth.lengthCm} start={55} step={0.5} min={30} max={110} decimals={1} onChange={(x) => setGrowth({ ...growth, lengthCm: x })} />
                <Stepper id="rec-bmuac" label="MUAC" unit="cm" value={growth.muacCm} start={13} step={0.1} min={6} max={25} decimals={1} onChange={(x) => setGrowth({ ...growth, muacCm: x })} status={growth.muacCm !== undefined && growth.muacCm < 11.5 ? { tone: 'error', word: 'Severe' } : growth.muacCm !== undefined && growth.muacCm < 12.5 ? { tone: 'warning', word: 'Moderate' } : undefined} />
              </div>
            </Section>

            <Section id="immunisations" title="Vaccines given today">
              <div className="grid grid-cols-1 gap-3">
                {schedule.map((row) => (
                  <div key={row.label} className="flex flex-wrap items-center gap-2">
                    <span className="w-20 shrink-0 text-xs text-tertiary">{row.label}</span>
                    {row.vaccines.map((vac) => {
                      const on = vaccines.includes(vac);
                      return (
                        <button
                          key={vac}
                          type="button"
                          aria-pressed={on}
                          onClick={() => setVaccines((xs) => (xs.includes(vac) ? xs.filter((x) => x !== vac) : [...xs, vac]))}
                          className={cx('min-h-9 cursor-pointer rounded-full px-3 text-sm font-medium ring-1 ring-inset', on ? 'bg-success-solid text-on-fill ring-transparent' : 'bg-primary text-secondary ring-secondary hover:bg-primary_hover')}
                        >
                          {vac}
                        </button>
                      );
                    })}
                  </div>
                ))}
                {!allVaccines.length ? <p className="text-sm text-tertiary">No schedule for this country yet.</p> : null}
              </div>
            </Section>
          </>
        ) : null}

        {showBirth ? (
          <Section id="birth" title="Birth details">
            <IconToggle on={birthOn} onChange={setBirthOn} icon={Stars02} label="She has given birth" />
            {birthOn ? (
              <div className="mt-4 grid grid-cols-1 gap-4">
                <div className="grid grid-cols-2 gap-3">
                  <label className="grid grid-cols-1 gap-1.5 text-sm font-medium text-secondary">
                    Date
                    <input type="date" id="rec-bdate" className="min-h-11 rounded-xl px-3 ring-1 ring-primary ring-inset" value={birth.date} onChange={(e) => setBirth({ ...birth, date: e.target.value })} />
                  </label>
                  <label className="grid grid-cols-1 gap-1.5 text-sm font-medium text-secondary">
                    Baby’s name
                    <input id="rec-bname" className="min-h-11 rounded-xl px-3 ring-1 ring-primary ring-inset" value={birth.name} onChange={(e) => setBirth({ ...birth, name: e.target.value })} />
                  </label>
                </div>
                <Segmented label="How" value={birth.mode} onChange={(x) => x && setBirth({ ...birth, mode: x })} options={[{ value: 'vaginal', label: 'Vaginal' }, { value: 'assisted', label: 'Assisted' }, { value: 'caesarean', label: 'Caesarean' }]} />
                <Segmented label="Where" size="sm" wrap value={birth.place} onChange={(x) => x && setBirth({ ...birth, place: x })} options={[{ value: 'facility', label: 'Facility' }, { value: 'home', label: 'Home' }, { value: 'tba', label: 'Birth attendant' }, { value: 'in_transit', label: 'On the way' }]} />
                <Segmented label="Sex" value={birth.sex} onChange={(x) => x && setBirth({ ...birth, sex: x })} options={[{ value: 'F', label: 'Girl' }, { value: 'M', label: 'Boy' }]} />
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <Stepper id="rec-bweight" label="Weight" unit="kg" value={birth.weight} start={3.2} step={0.05} min={0.4} max={6} decimals={2} onChange={(x) => setBirth({ ...birth, weight: x })} status={birth.weight !== undefined && birth.weight < 2.5 ? { tone: 'warning', word: 'Low' } : undefined} />
                  <Stepper id="rec-bweeks" label="Weeks at birth" value={birth.weeks} start={plan.state.gestationalWeeks ?? 39} min={22} max={44} onChange={(x) => setBirth({ ...birth, weeks: x })} />
                  <Stepper id="rec-bloss" label="Blood loss" unit="ml" value={birth.bloodLossMl} start={300} step={50} min={0} max={5000} onChange={(x) => setBirth({ ...birth, bloodLossMl: x })} status={birth.bloodLossMl !== undefined && birth.bloodLossMl >= 500 ? { tone: 'error', word: 'PPH' } : undefined} />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(['pph', 'pre_eclampsia', 'eclampsia', 'sepsis', 'obstructed_labour', 'perineal_tear', 'retained_placenta', 'preterm'] as const).map((c) => {
                    const on = birth.complications.includes(c);
                    return (
                      <button key={c} type="button" aria-pressed={on} onClick={() => setBirth({ ...birth, complications: on ? birth.complications.filter((x) => x !== c) : [...birth.complications, c] })} className={cx('min-h-9 cursor-pointer rounded-full px-3 text-sm ring-1 ring-inset', on ? 'bg-error-solid font-semibold text-on-fill ring-transparent' : 'bg-primary text-secondary ring-secondary hover:bg-primary_hover')}>
                        {c === 'pph' ? 'Heavy bleeding' : c.replace(/_/g, ' ').replace(/^./, (x) => x.toUpperCase())}
                      </button>
                    );
                  })}
                </div>
                {!birth.weight ? <p className="text-sm text-tertiary">Enter the baby’s weight to save the birth.</p> : null}
              </div>
            ) : null}
          </Section>
        ) : null}

        <Section id="report" title="Paste a doctor’s report" aside={<AIBadge />}>
          <div className="grid grid-cols-1 gap-3">
            <input id="rec-rauthor" className="min-h-11 rounded-xl px-3 text-sm ring-1 ring-primary ring-inset" value={reportAuthor} onChange={(e) => setReportAuthor(e.target.value)} placeholder="Written by, for example: Dr Bello, General Hospital" aria-label="Written by" />
            <textarea
              id="rec-report-text"
              className="min-h-28 rounded-xl px-3 py-2.5 text-sm ring-1 ring-primary ring-inset"
              value={reportText}
              onChange={(e) => setReportText(e.target.value)}
              aria-label="Report"
              placeholder="Paste or type the doctor’s note. For example: BP 150/100, urine protein ++, Hb 9.8. Started methyldopa 250 mg twice daily. Review in 1 week."
            />
            <div>
              {extracting ? (
                <Thinking label="Reading the report…" onStop={() => { stop(); setExtracting(false); }} />
              ) : (
                <Button size="sm" color="secondary" iconLeading={Stars02} onClick={extract} isDisabled={!reportText.trim()}>
                  Find the readings
                </Button>
              )}
            </div>
            {reportText.trim() ? <WhatAISees task="extract" args={{ text: reportText, mother, plan }} /> : null}
            {extractNote ? <p className="text-sm text-tertiary">{extractNote}</p> : null}
            {findings.length ? (
              <div className="grid grid-cols-1 gap-2 rounded-xl bg-secondary p-3">
                <p className="text-sm text-secondary">Tick the findings that are right. Ticked readings become part of her record.</p>
                {findings.map((f, i) => (
                  <label key={i} className="flex min-h-10 cursor-pointer items-center gap-2 text-sm">
                    <input type="checkbox" className="size-4" checked={f.keep} onChange={() => setFindings(findings.map((x, j) => (j === i ? { ...x, keep: !x.keep } : x)))} />
                    <span className="font-semibold text-primary">{f.field.replace(/_/g, ' ')}</span>
                    <span className="text-secondary">{f.value}</span>
                    <Chip tone={f.confidence === 'high' ? 'success' : f.confidence === 'medium' ? 'warning' : 'gray'}>{f.confidence}</Chip>
                  </label>
                ))}
              </div>
            ) : null}
          </div>
        </Section>
      </div>
    </SideSheet>
  );
}

function Section({ id, title, aside, children }: { id: SectionId; title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section id={`rec-${id}`} aria-labelledby={`rec-${id}-h`} className="scroll-mt-16">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 id={`rec-${id}-h`} className="text-md font-semibold text-primary">
          {title}
        </h3>
        {aside}
      </div>
      {children}
    </section>
  );
}
