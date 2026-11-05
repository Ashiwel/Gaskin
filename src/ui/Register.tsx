import { useMemo, useState } from 'react';
import type { ConditionCode, CountryCode, Genotype, LanguageCode, Literacy, Mother, PhoneAccess } from '../types';
import { stamp, uid, useApp, useWorker } from '../store';
import { COUNTRIES, LANGUAGE_NAMES } from '../data';
import { CONDITION_LABELS } from '../clinical';
import { useNav } from './nav';
import { useToast } from './components';
import { addDays, gaskinId } from './format';
import { defaultLanguageFor } from './patientLang';

const CONDITIONS: ConditionCode[] = [
  'sickle_cell_disease',
  'hiv',
  'chronic_hypertension',
  'diabetes_preexisting',
  'pre_eclampsia_history',
  'anaemia',
  'asthma',
  'epilepsy',
  'hepatitis_b',
  'depression_history',
  'thyroid_disorder',
];

type Stage = 'pregnant' | 'baby' | 'planning';

const STEPS = ['About her', 'Her phone', 'Pregnancy or baby', 'Health history', 'Consent'] as const;

export function Register() {
  const { state, dispatch } = useApp();
  const worker = useWorker();
  const { go } = useNav();
  const toast = useToast();
  const country: CountryCode = state.country !== 'ALL' ? state.country : worker?.country ?? 'NG';
  const profile = COUNTRIES[country];
  const facility = state.facilities.find((f) => f.id === worker?.facilityId);
  const [step, setStep] = useState(0);
  const [f, setF] = useState({
    name: '',
    age: '',
    community: '',
    region: facility?.region ?? profile?.regions?.[0] ?? '',
    language: defaultLanguageFor({ country, region: facility?.region ?? profile?.regions?.[0] ?? '' }),
    literacy: 'basic' as Literacy,
    access: 'feature' as PhoneAccess,
    number: '',
    hasWhatsApp: false,
    stage: 'pregnant' as Stage,
    weeks: '',
    babyName: '',
    babyDob: state.clock.slice(0, 10),
    babySex: 'F' as 'F' | 'M',
    babyWeight: '',
    gravida: '1',
    parity: '0',
    previousCaesarean: false,
    previousStillbirth: false,
    previousPPH: false,
    conditions: [] as ConditionCode[],
    genotype: 'unknown' as Genotype,
    bloodGroup: '',
    consentData: false,
    consentMessages: false,
    guardian: false,
  });
  const [langTouched, setLangTouched] = useState(false);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const age = parseInt(f.age, 10);
  const minor = Number.isFinite(age) && age < 18;

  const valid = useMemo(() => {
    switch (step) {
      case 0:
        return f.name.trim().length > 1 && Number.isFinite(age) && age >= 10 && age <= 60 && f.community.trim().length > 0;
      case 1:
        return f.access === 'none' || f.access === 'shared' || f.number.trim().length >= 7;
      case 2:
        if (f.stage === 'pregnant') return parseInt(f.weeks, 10) >= 4 && parseInt(f.weeks, 10) <= 42;
        if (f.stage === 'baby') return Boolean(f.babyDob) && parseFloat(f.babyWeight) > 0.5;
        return true;
      case 4:
        return f.consentData && (!minor || f.guardian);
      default:
        return true;
    }
  }, [step, f, age, minor]);

  const create = () => {
    const now = stamp(state.clock);
    const id = uid('m');
    const weeks = parseInt(f.weeks, 10);
    const lmp = f.stage === 'pregnant' ? addDays(state.clock, -weeks * 7).slice(0, 10) : undefined;
    const childId = uid('child');
    const mother: Mother = {
      id,
      name: f.name.trim(),
      age,
      country,
      region: f.region,
      community: f.community.trim(),
      language: f.language,
      literacy: f.literacy,
      phone: { access: f.access, number: f.number.trim() || undefined, hasWhatsApp: f.access === 'smartphone' && f.hasWhatsApp },
      incomeBand: 'low',
      gravida: parseInt(f.gravida, 10) || 1,
      parity: parseInt(f.parity, 10) || 0,
      previousCaesarean: f.previousCaesarean,
      previousStillbirth: f.previousStillbirth,
      previousPPH: f.previousPPH,
      conditions: f.conditions,
      allergies: [],
      genotype: f.genotype,
      bloodGroup: f.bloodGroup || undefined,
      medications: [],
      pregnancy: lmp ? { lmp, fetuses: 1, plannedBirthPlace: 'facility' } : undefined,
      children:
        f.stage === 'baby'
          ? [{ id: childId, name: f.babyName.trim() || 'Baby', sex: f.babySex, dob: f.babyDob, birthWeightKg: parseFloat(f.babyWeight), gestationAtBirthWeeks: 39, feeding: 'exclusive_breastfeeding' }]
          : [],
      birth: f.stage === 'baby' ? { date: f.babyDob, mode: 'vaginal', place: 'facility', complications: ['none'] } : undefined,
      practicesMentioned: [],
      assignedWorkerId: worker.id,
      facilityId: worker.facilityId,
      enrolledAt: now,
      consent: { dataProcessing: f.consentData, messaging: f.consentMessages, guardianInvolved: minor ? f.guardian : undefined, recordedAt: now, recordedBy: worker.id },
      events: [{ kind: 'visit', id: uid('ev'), at: now, recordedBy: worker.id, visitType: f.stage === 'pregnant' ? 'anc' : f.stage === 'baby' ? 'child_health' : 'home_visit', attended: true, contactNumber: f.stage === 'pregnant' ? 1 : undefined, facilityId: worker.facilityId, note: 'Registered on Gaskin' }],
    };
    dispatch({ type: 'register', mother });
    toast(`${mother.name.split(' ')[0]} is registered. Gaskin ID ${gaskinId(mother)}.`);
    go({ name: 'patient', id, tab: 'plan' }, { replace: true });
  };

  const languages = Array.from(new Set<LanguageCode>([f.language, ...(profile?.languages ?? []), 'en']));

  return (
    <div className="page narrow">
      <header className="today-head">
        <h1 className="t-display">Register a mother</h1>
        <p className="lede">Five short steps. She gets a Gaskin ID that stays the same if she changes phone or SIM.</p>
      </header>
      <ol className="status-steps" aria-label="Steps" style={{ gridTemplateColumns: `repeat(${STEPS.length}, 1fr)` }}>
        {STEPS.map((s, i) => (
          <li key={s} className={i <= step ? 'on' : ''}>
            {s}
          </li>
        ))}
      </ol>

      <form
        className="section"
        onSubmit={(e) => {
          e.preventDefault();
          if (!valid) return;
          if (step < STEPS.length - 1) setStep(step + 1);
          else create();
        }}
      >
        {step === 0 ? (
          <div className="grid2">
            <label className="field" style={{ gridColumn: '1 / -1' }}>
              <span>Full name</span>
              <input className="input" id="reg-name" value={f.name} onChange={(e) => set('name', e.target.value)} autoFocus autoComplete="off" />
            </label>
            <label className="field">
              <span>Age</span>
              <input className="input num" id="reg-age" inputMode="numeric" value={f.age} onChange={(e) => set('age', e.target.value)} />
            </label>
            <label className="field">
              <span>Community or village</span>
              <input className="input" id="reg-community" value={f.community} onChange={(e) => set('community', e.target.value)} />
            </label>
            <label className="field">
              <span>{country === 'KE' ? 'County' : country === 'GH' ? 'Region' : 'State'}</span>
              <input
                className="input"
                id="reg-region"
                value={f.region}
                onChange={(e) => {
                  const region = e.target.value;
                  // Follow her location's language until the worker picks one herself
                  setF((x) => ({ ...x, region, language: langTouched ? x.language : defaultLanguageFor({ country, region }) }));
                }}
              />
            </label>
            <label className="field">
              <span>
                Her language <span className="hint">(for her messages and handouts)</span>
              </span>
              <select className="select" id="reg-lang" value={f.language} onChange={(e) => {
                  setLangTouched(true);
                  set('language', e.target.value as LanguageCode);
                }}>
                {languages.map((l) => (
                  <option key={l} value={l}>
                    {LANGUAGE_NAMES[l] ?? l}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Reading</span>
              <select className="select" id="reg-lit" value={f.literacy} onChange={(e) => set('literacy', e.target.value as Literacy)}>
                <option value="none">Does not read</option>
                <option value="basic">Reads a little</option>
                <option value="good">Reads well</option>
              </select>
            </label>
            {minor ? <p className="note amber" style={{ gridColumn: '1 / -1' }}>She is under 18. You will record a guardian’s involvement at the consent step.</p> : null}
          </div>
        ) : null}

        {step === 1 ? (
          <div className="section">
            <div className="seg" role="group" aria-label="Phone">
              {(
                [
                  ['smartphone', 'Smartphone'],
                  ['feature', 'Basic phone'],
                  ['shared', 'Shared phone'],
                  ['none', 'No phone'],
                ] as const
              ).map(([k, l]) => (
                <button type="button" key={k} aria-pressed={f.access === k} onClick={() => set('access', k)}>
                  {l}
                </button>
              ))}
            </div>
            {f.access !== 'none' ? (
              <label className="field">
                <span>Phone number {f.access === 'shared' ? <span className="hint">(whose phone it is goes in the note)</span> : null}</span>
                <input className="input num" id="reg-phone" inputMode="tel" value={f.number} onChange={(e) => set('number', e.target.value)} placeholder={country === 'NG' ? '0803 000 0000' : country === 'KE' ? '0712 000 000' : '024 000 0000'} />
              </label>
            ) : (
              <p className="soft">She will get printed handouts at each visit, and you can message a family carer.</p>
            )}
            {f.access === 'smartphone' ? (
              <label className="check">
                <input type="checkbox" checked={f.hasWhatsApp} onChange={(e) => set('hasWhatsApp', e.target.checked)} />
                She uses a chat app
              </label>
            ) : null}
          </div>
        ) : null}

        {step === 2 ? (
          <div className="section">
            <div className="seg" role="group" aria-label="Stage">
              {(
                [
                  ['pregnant', 'Pregnant'],
                  ['baby', 'Has a baby under 2'],
                  ['planning', 'Planning a pregnancy'],
                ] as const
              ).map(([k, l]) => (
                <button type="button" key={k} aria-pressed={f.stage === k} onClick={() => set('stage', k)}>
                  {l}
                </button>
              ))}
            </div>
            {f.stage === 'pregnant' ? (
              <label className="field" style={{ maxWidth: 240 }}>
                <span>Weeks pregnant</span>
                <input className="input num" id="reg-weeks" inputMode="numeric" value={f.weeks} onChange={(e) => set('weeks', e.target.value)} />
              </label>
            ) : null}
            {f.stage === 'baby' ? (
              <div className="grid2">
                <label className="field">
                  <span>Baby’s name</span>
                  <input className="input" id="reg-bname" value={f.babyName} onChange={(e) => set('babyName', e.target.value)} />
                </label>
                <label className="field">
                  <span>Date of birth</span>
                  <input className="input" type="date" id="reg-bdob" value={f.babyDob} onChange={(e) => set('babyDob', e.target.value)} />
                </label>
                <label className="field">
                  <span>Sex</span>
                  <select className="select" id="reg-bsex" value={f.babySex} onChange={(e) => set('babySex', e.target.value as 'F' | 'M')}>
                    <option value="F">Girl</option>
                    <option value="M">Boy</option>
                  </select>
                </label>
                <label className="field">
                  <span>Birth weight, kg</span>
                  <input className="input num" id="reg-bweight" inputMode="decimal" value={f.babyWeight} onChange={(e) => set('babyWeight', e.target.value)} />
                </label>
              </div>
            ) : null}
          </div>
        ) : null}

        {step === 3 ? (
          <div className="section">
            <div className="grid2">
              <label className="field">
                <span>Pregnancies, including this one</span>
                <input className="input num" id="reg-g" inputMode="numeric" value={f.gravida} onChange={(e) => set('gravida', e.target.value)} />
              </label>
              <label className="field">
                <span>Births</span>
                <input className="input num" id="reg-p" inputMode="numeric" value={f.parity} onChange={(e) => set('parity', e.target.value)} />
              </label>
              <label className="field">
                <span>Genotype</span>
                <select className="select" id="reg-geno" value={f.genotype} onChange={(e) => set('genotype', e.target.value as Genotype)}>
                  {(['unknown', 'AA', 'AS', 'SS', 'AC', 'SC'] as const).map((g) => (
                    <option key={g} value={g}>
                      {g === 'unknown' ? 'Not tested' : g}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Blood group</span>
                <input className="input" id="reg-bg" value={f.bloodGroup} onChange={(e) => set('bloodGroup', e.target.value)} placeholder="O+" />
              </label>
            </div>
            <div className="chips">
              {(
                [
                  ['previousCaesarean', 'Caesarean before'],
                  ['previousStillbirth', 'Stillbirth before'],
                  ['previousPPH', 'Heavy bleeding after a birth'],
                ] as const
              ).map(([k, l]) => (
                <button type="button" key={k} className="filter-chip" aria-pressed={f[k]} onClick={() => set(k, !f[k])}>
                  {l}
                </button>
              ))}
            </div>
            <span className="t-label">Conditions she knows about</span>
            <div className="chips">
              {CONDITIONS.map((c) => (
                <button
                  type="button"
                  key={c}
                  className="filter-chip"
                  aria-pressed={f.conditions.includes(c)}
                  onClick={() => set('conditions', f.conditions.includes(c) ? f.conditions.filter((x) => x !== c) : [...f.conditions, c])}
                >
                  {CONDITION_LABELS[c] ?? c}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="section">
            <p className="soft" style={{ maxWidth: '62ch' }}>
              Read this to her in {LANGUAGE_NAMES[f.language] ?? 'her language'}: “We will keep your health record on this phone and at the clinic to plan your care. Only health workers caring for you can see it. You can ask us to stop at any time.”
            </p>
            <label className="check">
              <input type="checkbox" checked={f.consentData} onChange={(e) => set('consentData', e.target.checked)} id="reg-consent-data" />
              She agrees to her record being kept
            </label>
            <label className="check">
              <input type="checkbox" checked={f.consentMessages} onChange={(e) => set('consentMessages', e.target.checked)} id="reg-consent-msg" />
              She agrees to receive messages {f.access === 'none' ? 'through a family carer' : 'on her phone'}
            </label>
            {minor ? (
              <label className="check">
                <input type="checkbox" checked={f.guardian} onChange={(e) => set('guardian', e.target.checked)} id="reg-guardian" />
                A parent or guardian was involved, as she is under 18
              </label>
            ) : null}
            <p className="tiny muted">Recorded under the NDPA 2023 (Nigeria), the Data Protection Act 2019 (Kenya) and Act 843 (Ghana).</p>
          </div>
        ) : null}

        <div className="btn-row">
          {step > 0 ? (
            <button type="button" className="btn ghost" onClick={() => setStep(step - 1)}>
              Back
            </button>
          ) : (
            <button type="button" className="btn ghost" onClick={() => go({ name: 'today' })}>
              Cancel
            </button>
          )}
          <button type="submit" className="btn primary" disabled={!valid} data-testid="reg-next">
            {step < STEPS.length - 1 ? 'Next' : 'Register her'}
          </button>
        </div>
      </form>
    </div>
  );
}
