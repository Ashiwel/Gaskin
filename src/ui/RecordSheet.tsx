import { useMemo, useState, type ReactNode } from 'react';
import type {
  Birth,
  CarePlan,
  Child,
  ClinicalEvent,
  ExtractedFinding,
  FeedingEvent,
  LabTest,
  Mother,
  SymptomCode,
} from '../types';
import { stamp, uid, useApp, useWorker } from '../store';
import { IMMUNISATION_SCHEDULES, SYMPTOM_LABELS } from '../clinical';
import { Sheet, Thinking, useAbort, useToast } from './components';
import { AIBadge, getProvider, WhatAISees } from './ai';
import { IAlert, IBaby, IDrop, IEye, IHead, IHeart, IMoon, IThermo, IWind, IBolt, ISpark } from './icons';

import { EPDS, epdsScore } from './epdsData';

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
const BABY_SYMPTOMS: SymptomCode[] = [
  'baby_not_feeding',
  'baby_convulsions',
  'baby_fast_breathing',
  'baby_chest_indrawing',
  'baby_fever',
  'baby_cold',
  'baby_lethargic',
  'baby_yellow_skin',
  'baby_cord_redness',
  'baby_diarrhoea',
  'baby_vomiting_everything',
];
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

function symIcon(s: SymptomCode): ReactNode {
  if (s.includes('bleeding') || s === 'foul_discharge' || s === 'leaking_fluid') return <IDrop />;
  if (s.includes('headache') || s === 'low_mood' || s === 'anxiety' || s === 'thoughts_of_self_harm') return <IHead />;
  if (s === 'blurred_vision' || s === 'baby_yellow_skin') return <IEye />;
  if (s.includes('fever') || s === 'baby_cold') return <IThermo />;
  if (s.includes('breath') || s.includes('chest')) return <IWind />;
  if (s.includes('convulsions')) return <IBolt />;
  if (s === 'insomnia' || s === 'fatigue' || s === 'baby_lethargic') return <IMoon />;
  if (s.startsWith('baby_')) return <IBaby />;
  if (s.includes('breast') || s.includes('nipple') || s.includes('milk')) return <IHeart />;
  return <IAlert />;
}

const LABS: Array<{ test: LabTest; label: string; kind: 'num' | 'posneg' | 'plus' | 'text'; unit?: string }> = [
  { test: 'haemoglobin', label: 'Haemoglobin', kind: 'num', unit: 'g/dL' },
  { test: 'urine_protein', label: 'Urine protein', kind: 'plus' },
  { test: 'malaria_rdt', label: 'Malaria test', kind: 'posneg' },
  { test: 'hiv', label: 'HIV test', kind: 'posneg' },
  { test: 'syphilis', label: 'Syphilis test', kind: 'posneg' },
  { test: 'hepatitis_b', label: 'Hepatitis B', kind: 'posneg' },
  { test: 'blood_glucose_fasting', label: 'Fasting blood sugar', kind: 'num', unit: 'mmol/L' },
  { test: 'urine_glucose', label: 'Urine sugar', kind: 'plus' },
];

const SECTIONS = [
  ['vitals', 'Vitals'],
  ['symptoms', 'Symptoms'],
  ['labs', 'Tests'],
  ['epds', 'Mood check'],
  ['feeding', 'Feeding'],
  ['growth', 'Growth'],
  ['immunisations', 'Vaccines'],
  ['birth', 'Birth'],
  ['report', 'Doctor’s report'],
] as const;

const num = (s: string) => {
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : undefined;
};

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

// ---------- Component ----------

export function RecordSheet({ mother, plan, onClose, onSaved }: { mother: Mother; plan: CarePlan; onClose: () => void; onSaved: () => void }) {
  const { state, dispatch } = useApp();
  const worker = useWorker();
  const toast = useToast();
  const stage = plan.state.stage;
  const child = plan.state.infant ?? mother.children[mother.children.length - 1];

  const [visit, setVisit] = useState(true);
  const [v, setV] = useState({ systolic: '', diastolic: '', weightKg: '', temperatureC: '', pulse: '', fundalHeightCm: '', fetalHeartRate: '', muacCm: '' });
  const [symptoms, setSymptoms] = useState<SymptomCode[]>([]);
  const [labs, setLabs] = useState<Record<string, string>>({});
  const [epds, setEpds] = useState<Array<number | null>>(Array(10).fill(null));
  const [epdsOn, setEpdsOn] = useState(false);
  const [feeding, setFeeding] = useState<{ status: string; milkSupply: string; feedsPerDay: string; latch: boolean }>({ status: '', milkSupply: '', feedsPerDay: '', latch: false });
  const [growth, setGrowth] = useState({ weightKg: '', lengthCm: '', muacCm: '' });
  const [vaccines, setVaccines] = useState<string[]>([]);
  const [birthOn, setBirthOn] = useState(false);
  const [birth, setBirth] = useState({
    date: state.clock.slice(0, 10),
    mode: 'vaginal' as Birth['mode'],
    place: 'facility' as Birth['place'],
    complications: [] as Birth['complications'],
    bloodLossMl: '',
    name: '',
    sex: 'F' as Child['sex'],
    weight: '',
    weeks: '',
  });
  const [reportText, setReportText] = useState('');
  const [reportAuthor, setReportAuthor] = useState('');
  const [findings, setFindings] = useState<Array<ExtractedFinding & { keep: boolean }>>([]);
  const [extracting, setExtracting] = useState(false);
  const [extractNote, setExtractNote] = useState('');
  const { start, stop } = useAbort();

  const schedule = useMemo(() => (IMMUNISATION_SCHEDULES?.[mother.country] ?? []).filter((s) => !child || s.ageDays <= 730), [mother.country, child]);
  const allVaccines = useMemo(() => Array.from(new Set(schedule.flatMap((s) => s.vaccines))), [schedule]);
  const ep = epdsScore(epds);

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
      if (!signal.aborted) setExtractNote('The AI could not read the report just now. Save it as written, or type the readings above.');
    } finally {
      setExtracting(false);
    }
  };

  const buildEvents = (): ClinicalEvent[] => {
    const at = stamp(state.clock);
    const base = { at, recordedBy: worker.id };
    const out: ClinicalEvent[] = [];
    const vitals = {
      systolic: num(v.systolic),
      diastolic: num(v.diastolic),
      weightKg: num(v.weightKg),
      temperatureC: num(v.temperatureC),
      pulse: num(v.pulse),
      fundalHeightCm: num(v.fundalHeightCm),
      fetalHeartRate: num(v.fetalHeartRate),
      muacCm: num(v.muacCm),
    };
    const hasVitals = Object.values(vitals).some((x) => x !== undefined);
    if (visit && (hasVitals || symptoms.length || Object.keys(labs).length)) {
      const vt = stage === 'pregnancy' ? 'anc' : stage === 'postpartum' ? 'pnc' : stage === 'infant' ? 'child_health' : 'home_visit';
      out.push({ kind: 'visit', id: uid('ev'), ...base, visitType: vt, attended: true, facilityId: mother.facilityId, contactNumber: vt === 'anc' ? plan.state.ancContactsAttended + 1 : undefined });
    }
    if (hasVitals) out.push({ kind: 'vitals', id: uid('ev'), ...base, ...vitals });
    if (symptoms.length) {
      const m = symptoms.filter((s) => !s.startsWith('baby_'));
      const b = symptoms.filter((s) => s.startsWith('baby_'));
      if (m.length) out.push({ kind: 'symptom', id: uid('ev'), ...base, symptoms: m, via: 'visit' });
      if (b.length) out.push({ kind: 'symptom', id: uid('ev'), ...base, symptoms: b, via: 'visit', childId: child?.id });
    }
    for (const [test, val] of Object.entries(labs)) {
      if (val === '') continue;
      const def = LABS.find((l) => l.test === test);
      const value = def?.kind === 'num' || def?.kind === 'plus' ? (num(val) ?? val) : val;
      out.push({ kind: 'lab', id: uid('ev'), ...base, test: test as LabTest, value, unit: def?.unit });
    }
    if (epdsOn && ep.complete) out.push({ kind: 'screening', id: uid('ev'), ...base, instrument: 'epds', score: ep.score, selfHarmFlag: ep.selfHarm });
    if (feeding.status || feeding.milkSupply) {
      out.push({
        kind: 'feeding',
        id: uid('ev'),
        ...base,
        childId: child?.id,
        status: (feeding.status || child?.feeding || 'exclusive_breastfeeding') as FeedingEvent['status'],
        milkSupply: (feeding.milkSupply || undefined) as FeedingEvent['milkSupply'],
        feedsPerDay: num(feeding.feedsPerDay),
        latchProblem: feeding.latch || undefined,
      });
    }
    if (growth.weightKg || growth.lengthCm || growth.muacCm) {
      out.push({ kind: 'growth', id: uid('ev'), ...base, childId: child?.id, weightKg: num(growth.weightKg), lengthCm: num(growth.lengthCm), muacCm: num(growth.muacCm) });
    }
    if (vaccines.length) out.push({ kind: 'immunisation', id: uid('ev'), ...base, childId: child?.id, vaccines });
    if (birthOn && birth.weight) {
      const c: Child = {
        id: uid('child'),
        name: birth.name.trim() || `Baby ${mother.name.split(' ').slice(-1)[0]}`,
        sex: birth.sex,
        dob: birth.date,
        birthWeightKg: num(birth.weight) ?? 3,
        gestationAtBirthWeeks: num(birth.weeks) ?? plan.state.gestationalWeeks ?? 39,
        feeding: 'exclusive_breastfeeding',
      };
      const b: Birth = {
        date: birth.date,
        mode: birth.mode,
        place: birth.place,
        complications: birth.complications.length ? birth.complications : ['none'],
        bloodLossMl: num(birth.bloodLossMl),
      };
      out.push({ kind: 'birth', id: uid('ev'), ...base, at: `${birth.date}T${at.slice(11)}`, birth: b, child: c });
    }
    if (reportText.trim()) {
      const kept = findings.filter((f) => f.keep);
      out.push({
        kind: 'report',
        id: uid('ev'),
        ...base,
        author: reportAuthor.trim() || 'Doctor',
        text: reportText.trim(),
        extracted: kept.length ? kept.map(({ keep: _k, ...f }) => f) : undefined,
        extractionConfirmedBy: kept.length ? worker.id : undefined,
      });
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
  const showBaby = stage === 'postpartum' || stage === 'infant' || Boolean(child);
  const showBirth = stage === 'pregnancy' || (stage === 'postpartum' && !child);

  const sectionsShown = SECTIONS.filter(([k]) => {
    if (k === 'feeding' || k === 'growth' || k === 'immunisations') return showBaby;
    if (k === 'birth') return showBirth;
    return true;
  });

  return (
    <Sheet
      title={`Record for ${mother.name.split(' ')[0]}`}
      onClose={onClose}
      label="Record new information"
      footer={
        <>
          <span className="small muted" style={{ marginRight: 'auto', alignSelf: 'center' }}>
            {events.length ? `${events.length} thing${events.length === 1 ? '' : 's'} to save` : 'Nothing entered yet'}
          </span>
          <button className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" onClick={save} disabled={!events.length} data-testid="record-save">
            Save and update plan
          </button>
        </>
      }
    >
      <nav className="rec-nav" aria-label="Jump to section">
        {sectionsShown.map(([k, l]) => (
          <button
            key={k}
            className="filter-chip"
            onClick={() => document.getElementById(`rec-${k}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          >
            {l}
          </button>
        ))}
      </nav>

      <section className="rec-section" id="rec-vitals">
        <h3>Vitals</h3>
        <div className="grid2">
          <label className="field">
            <span>BP top number</span>
            <input className="input num" id="rec-sys" inputMode="numeric" placeholder="120" value={v.systolic} onChange={(e) => setV({ ...v, systolic: e.target.value })} />
          </label>
          <label className="field">
            <span>BP bottom number</span>
            <input className="input num" id="rec-dia" inputMode="numeric" placeholder="80" value={v.diastolic} onChange={(e) => setV({ ...v, diastolic: e.target.value })} />
          </label>
          <label className="field">
            <span>Weight, kg</span>
            <input className="input num" id="rec-wt" inputMode="decimal" value={v.weightKg} onChange={(e) => setV({ ...v, weightKg: e.target.value })} />
          </label>
          <label className="field">
            <span>Temperature, °C</span>
            <input className="input num" id="rec-temp" inputMode="decimal" value={v.temperatureC} onChange={(e) => setV({ ...v, temperatureC: e.target.value })} />
          </label>
          <label className="field">
            <span>Pulse</span>
            <input className="input num" id="rec-pulse" inputMode="numeric" value={v.pulse} onChange={(e) => setV({ ...v, pulse: e.target.value })} />
          </label>
          {stage === 'pregnancy' ? (
            <>
              <label className="field">
                <span>Fundal height, cm</span>
                <input className="input num" id="rec-fh" inputMode="numeric" value={v.fundalHeightCm} onChange={(e) => setV({ ...v, fundalHeightCm: e.target.value })} />
              </label>
              <label className="field">
                <span>Baby’s heartbeat</span>
                <input className="input num" id="rec-fhr" inputMode="numeric" value={v.fetalHeartRate} onChange={(e) => setV({ ...v, fetalHeartRate: e.target.value })} />
              </label>
            </>
          ) : null}
          <label className="field">
            <span>MUAC, cm</span>
            <input className="input num" id="rec-muac" inputMode="decimal" value={v.muacCm} onChange={(e) => setV({ ...v, muacCm: e.target.value })} />
          </label>
        </div>
        <label className="check">
          <input type="checkbox" checked={visit} onChange={(e) => setVisit(e.target.checked)} />
          Count this as a visit
        </label>
      </section>

      <section className="rec-section" id="rec-symptoms">
        <h3>Symptoms</h3>
        <p className="small muted">Red icons are danger signs.</p>
        <div className="symgrid" role="group" aria-label="Mother’s symptoms">
          {MOTHER_SYMPTOMS.filter((s) => {
            if (stage !== 'pregnancy' && (s === 'reduced_fetal_movement' || s === 'leaking_fluid')) return false;
            if (stage === 'pregnancy' && (s === 'heavy_postpartum_bleeding' || s === 'low_milk_supply' || s === 'cracked_nipples')) return false;
            return true;
          }).map((s) => (
            <label key={s} className={`sym-tile${DANGER.has(s) ? ' danger' : ''}`}>
              <input type="checkbox" checked={symptoms.includes(s)} onChange={() => toggleSym(s)} />
              {symIcon(s)}
              {SYMPTOM_LABELS[s] ?? s}
            </label>
          ))}
        </div>
        {showBaby ? (
          <>
            <p className="t-h3" style={{ marginTop: 6 }}>
              Baby
            </p>
            <div className="symgrid" role="group" aria-label="Baby’s symptoms">
              {BABY_SYMPTOMS.map((s) => (
                <label key={s} className={`sym-tile${DANGER.has(s) ? ' danger' : ''}`}>
                  <input type="checkbox" checked={symptoms.includes(s)} onChange={() => toggleSym(s)} />
                  {symIcon(s)}
                  {SYMPTOM_LABELS[s] ?? s}
                </label>
              ))}
            </div>
          </>
        ) : null}
      </section>

      <section className="rec-section" id="rec-labs">
        <h3>Tests</h3>
        <div className="grid2">
          {LABS.map((l) => (
            <label className="field" key={l.test}>
              <span>
                {l.label}
                {l.unit ? <span className="hint"> {l.unit}</span> : null}
              </span>
              {l.kind === 'num' ? (
                <input className="input num" id={`lab-${l.test}`} inputMode="decimal" value={labs[l.test] ?? ''} onChange={(e) => setLabs({ ...labs, [l.test]: e.target.value })} />
              ) : (
                <select className="select" id={`lab-${l.test}`} value={labs[l.test] ?? ''} onChange={(e) => setLabs({ ...labs, [l.test]: e.target.value })}>
                  <option value="">Not done</option>
                  {l.kind === 'posneg' ? (
                    <>
                      <option value="negative">Negative</option>
                      <option value="positive">Positive</option>
                    </>
                  ) : (
                    <>
                      <option value="0">None</option>
                      <option value="1">+</option>
                      <option value="2">++</option>
                      <option value="3">+++</option>
                    </>
                  )}
                </select>
              )}
            </label>
          ))}
        </div>
      </section>

      <section className="rec-section" id="rec-epds">
        <h3>Mood check (EPDS)</h3>
        <label className="switch">
          <input type="checkbox" checked={epdsOn} onChange={(e) => setEpdsOn(e.target.checked)} />
          Ask the 10 questions now
        </label>
        {epdsOn ? (
          <div className="epds">
            <p className="small muted">Ask about the past 7 days. Read each answer aloud and let her choose.</p>
            {EPDS.map((item, qi) => (
              <fieldset key={qi} className={`epds-q${qi === 9 ? ' flag' : ''}`} style={{ border: 0, margin: 0, padding: qi === 9 ? '0 0 12px 12px' : '0 0 12px' }}>
                <legend className="sr">Question {qi + 1}</legend>
                <p>
                  <span className="muted num">{qi + 1}.</span> {item.q}
                  {qi === 9 ? <span className="chip red" style={{ marginLeft: 8 }}>Safety question</span> : null}
                </p>
                <div className="epds-opts">
                  {item.opts.map(([label, score]) => (
                    <label key={label}>
                      <input type="radio" name={`epds-${qi}`} checked={epds[qi] === score} onChange={() => setEpds(epds.map((a, i) => (i === qi ? score : a)))} />
                      {label}
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
            <div className="epds-score">
              <span className="big num">{ep.score}</span>
              <span className="soft">
                {!ep.complete
                  ? `${epds.filter((a) => a === null).length} questions left`
                  : ep.score >= 13
                    ? 'Likely depression. Refer for support today.'
                    : ep.score >= 10
                      ? 'Possible depression. Repeat in 2 weeks and talk with her.'
                      : 'Below the cut-off.'}
              </span>
              {ep.selfHarm ? <span className="chip red">She answered yes to self-harm. Stay with her and get help today.</span> : null}
            </div>
          </div>
        ) : null}
      </section>

      {showBaby ? (
        <section className="rec-section" id="rec-feeding">
          <h3>Feeding and milk supply</h3>
          <div className="grid2">
            <label className="field">
              <span>How baby feeds</span>
              <select className="select" id="rec-feeding" value={feeding.status} onChange={(e) => setFeeding({ ...feeding, status: e.target.value })}>
                <option value="">No change</option>
                <option value="exclusive_breastfeeding">Breast milk only</option>
                <option value="mixed">Breast milk and formula</option>
                <option value="formula">Formula only</option>
                <option value="complementary_with_breastmilk">Family foods and breast milk</option>
                <option value="complementary_no_breastmilk">Family foods, no breast milk</option>
              </select>
            </label>
            <label className="field">
              <span>Milk supply</span>
              <select className="select" id="rec-milk" value={feeding.milkSupply} onChange={(e) => setFeeding({ ...feeding, milkSupply: e.target.value })}>
                <option value="">Not asked</option>
                <option value="good">Good</option>
                <option value="low">Low</option>
                <option value="very_low">Very low</option>
              </select>
            </label>
            <label className="field">
              <span>Feeds a day</span>
              <input className="input num" id="rec-feeds" inputMode="numeric" value={feeding.feedsPerDay} onChange={(e) => setFeeding({ ...feeding, feedsPerDay: e.target.value })} />
            </label>
          </div>
          <label className="check">
            <input type="checkbox" checked={feeding.latch} onChange={(e) => setFeeding({ ...feeding, latch: e.target.checked })} />
            Trouble with latch
          </label>
        </section>
      ) : null}

      {showBaby ? (
        <section className="rec-section" id="rec-growth">
          <h3>Baby’s growth</h3>
          <div className="grid2">
            <label className="field">
              <span>Weight, kg</span>
              <input className="input num" id="rec-bwt" inputMode="decimal" value={growth.weightKg} onChange={(e) => setGrowth({ ...growth, weightKg: e.target.value })} />
            </label>
            <label className="field">
              <span>Length, cm</span>
              <input className="input num" id="rec-blen" inputMode="decimal" value={growth.lengthCm} onChange={(e) => setGrowth({ ...growth, lengthCm: e.target.value })} />
            </label>
            <label className="field">
              <span>MUAC, cm</span>
              <input className="input num" id="rec-bmuac" inputMode="decimal" value={growth.muacCm} onChange={(e) => setGrowth({ ...growth, muacCm: e.target.value })} />
            </label>
          </div>
        </section>
      ) : null}

      {showBaby ? (
        <section className="rec-section" id="rec-immunisations">
          <h3>Vaccines given today</h3>
          <div className="chips">
            {allVaccines.map((vac) => (
              <button key={vac} type="button" className="filter-chip" aria-pressed={vaccines.includes(vac)} onClick={() => setVaccines((xs) => (xs.includes(vac) ? xs.filter((x) => x !== vac) : [...xs, vac]))}>
                {vac}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {showBirth ? (
        <section className="rec-section" id="rec-birth">
          <h3>Birth details</h3>
          <label className="switch">
            <input type="checkbox" checked={birthOn} onChange={(e) => setBirthOn(e.target.checked)} />
            She has given birth
          </label>
          {birthOn ? (
            <>
              <div className="grid2">
                <label className="field">
                  <span>Date</span>
                  <input className="input" type="date" id="rec-bdate" value={birth.date} onChange={(e) => setBirth({ ...birth, date: e.target.value })} />
                </label>
                <label className="field">
                  <span>How</span>
                  <select className="select" id="rec-bmode" value={birth.mode} onChange={(e) => setBirth({ ...birth, mode: e.target.value as Birth['mode'] })}>
                    <option value="vaginal">Vaginal</option>
                    <option value="assisted">Assisted</option>
                    <option value="caesarean">Caesarean</option>
                  </select>
                </label>
                <label className="field">
                  <span>Where</span>
                  <select className="select" id="rec-bplace" value={birth.place} onChange={(e) => setBirth({ ...birth, place: e.target.value as Birth['place'] })}>
                    <option value="facility">Facility</option>
                    <option value="home">Home</option>
                    <option value="tba">Traditional birth attendant</option>
                    <option value="in_transit">On the way</option>
                  </select>
                </label>
                <label className="field">
                  <span>Blood loss, ml</span>
                  <input className="input num" id="rec-bloss" inputMode="numeric" value={birth.bloodLossMl} onChange={(e) => setBirth({ ...birth, bloodLossMl: e.target.value })} />
                </label>
                <label className="field">
                  <span>Baby’s name</span>
                  <input className="input" id="rec-bname" value={birth.name} onChange={(e) => setBirth({ ...birth, name: e.target.value })} />
                </label>
                <label className="field">
                  <span>Sex</span>
                  <select className="select" id="rec-bsex" value={birth.sex} onChange={(e) => setBirth({ ...birth, sex: e.target.value as Child['sex'] })}>
                    <option value="F">Girl</option>
                    <option value="M">Boy</option>
                  </select>
                </label>
                <label className="field">
                  <span>Weight, kg</span>
                  <input className="input num" id="rec-bweight" inputMode="decimal" value={birth.weight} onChange={(e) => setBirth({ ...birth, weight: e.target.value })} />
                </label>
                <label className="field">
                  <span>Weeks at birth</span>
                  <input className="input num" id="rec-bweeks" inputMode="numeric" placeholder={String(plan.state.gestationalWeeks ?? '')} value={birth.weeks} onChange={(e) => setBirth({ ...birth, weeks: e.target.value })} />
                </label>
              </div>
              <div className="chips">
                {(['pph', 'pre_eclampsia', 'eclampsia', 'sepsis', 'obstructed_labour', 'perineal_tear', 'retained_placenta', 'preterm'] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    className="filter-chip"
                    aria-pressed={birth.complications.includes(c)}
                    onClick={() => setBirth({ ...birth, complications: birth.complications.includes(c) ? birth.complications.filter((x) => x !== c) : [...birth.complications, c] })}
                  >
                    {c === 'pph' ? 'Heavy bleeding' : c.replace(/_/g, ' ').replace(/^./, (x) => x.toUpperCase())}
                  </button>
                ))}
              </div>
              {!birth.weight ? <p className="small muted">Enter the baby’s weight to save the birth.</p> : null}
            </>
          ) : null}
        </section>
      ) : null}

      <section className="rec-section" id="rec-report">
        <div className="section-head">
          <h3 className="serif" style={{ fontSize: 19, fontWeight: 500 }}>
            Paste a doctor’s report
          </h3>
          <AIBadge />
        </div>
        <label className="field">
          <span>Written by</span>
          <input className="input" id="rec-rauthor" value={reportAuthor} onChange={(e) => setReportAuthor(e.target.value)} placeholder="For example: Dr Bello, General Hospital" />
        </label>
        <label className="field">
          <span>Report</span>
          <textarea
            className="textarea"
            id="rec-report-text"
            value={reportText}
            onChange={(e) => setReportText(e.target.value)}
            placeholder="Paste or type the doctor’s note. For example: BP 150/100, urine protein ++, Hb 9.8. Started methyldopa 250 mg twice daily. Review in 1 week."
          />
        </label>
        <div className="btn-row">
          {extracting ? (
            <Thinking label="Reading the report…" onStop={() => { stop(); setExtracting(false); }} />
          ) : (
            <button className="btn small" onClick={extract} disabled={!reportText.trim()}>
              <ISpark /> Find the readings
            </button>
          )}
        </div>
        {reportText.trim() ? <WhatAISees task="extract" args={{ text: reportText, mother, plan }} /> : null}
        {extractNote ? <p className="small muted">{extractNote}</p> : null}
        {findings.length ? (
          <div className="inline-form">
            <p className="small">Tick the findings that are right. Ticked readings become part of her record.</p>
            {findings.map((f, i) => (
              <label key={i} className="check">
                <input type="checkbox" checked={f.keep} onChange={() => setFindings(findings.map((x, j) => (j === i ? { ...x, keep: !x.keep } : x)))} />
                <span>
                  <strong>{f.field.replace(/_/g, ' ')}</strong>: {f.value}{' '}
                  <span className={`chip ${f.confidence === 'high' ? 'green' : f.confidence === 'medium' ? 'amber' : ''}`}>{f.confidence} confidence</span>
                </span>
              </label>
            ))}
          </div>
        ) : null}
      </section>
    </Sheet>
  );
}
