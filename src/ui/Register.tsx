/**
 * Register a mother: a guided form, one short step at a time, with her card building alongside
 * (desktop). Place comes from setup and src/geo (country, state or county, LGA or district), her
 * language from the place with "Coming soon" for languages without a pack, a guardian step for
 * adolescents, and pregnancy and any number of children in the same step.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, Check, ChevronDown, Plus, Trash01, UserPlus01 } from '@untitledui/icons';
import type { Child, ConditionCode, CountryCode, Genotype, LanguageCode, Literacy, Mother, PhoneAccess } from '../types';
import { stamp, uid, useApp, useWorker } from '../store';
import { COUNTRIES, LANGUAGE_NAMES } from '../data';
import { CONDITION_LABELS } from '../clinical';
import { getSetupPlan } from '../setup';
import { Button } from '../components/base/buttons/button';
import { Input } from '../components/base/input/input';
import { Select } from '../components/base/select/select';
import { Checkbox } from '../components/base/checkbox/checkbox';
import { cx } from '../utils/cx';
import { useNav } from './nav';
import { useToast } from './components';
import { addDays, daysBetween, gaskinId, shortAge } from './format';
import { defaultLanguageFor } from './patientLang';
import { areaOptionsSync, areaWord, can, languageOptions, loadAreaOptions, regionOptions, regionWord, type PlaceOption } from './today/access';
import { Chip, MotherAvatar } from './today/parts';

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

type StepId = 'about' | 'language' | 'phone' | 'guardian' | 'journey' | 'history' | 'consent';
const STEP_TITLE: Record<StepId, string> = {
  about: 'About her',
  language: 'Her language',
  phone: 'Her phone',
  guardian: 'Her guardian',
  journey: 'Pregnancy and children',
  history: 'Health history',
  consent: 'Consent',
};

interface ChildDraft {
  key: string;
  name: string;
  dob: string;
  sex: 'F' | 'M';
  weight: string;
  early: boolean;
}

const SUPPORTED = Object.keys(COUNTRIES) as CountryCode[];

export function Register() {
  const { state, dispatch } = useApp();
  const worker = useWorker();
  const { go } = useNav();
  const toast = useToast();
  const setup = getSetupPlan();
  const facility = state.facilities.find((f) => f.id === worker?.facilityId);
  // The place is the setup country (onboarding or Settings). Without a setup on this device, use
  // the acting worker's or facility's country, then the mothers already here. Nothing is assumed:
  // if none of these exist, the worker picks the country below.
  const known = (c?: string): CountryCode | undefined => (c && SUPPORTED.includes(c as CountryCode) ? (c as CountryCode) : undefined);
  const setupCountry = known(setup?.countryCode) ?? known(setup?.country);
  const fallbackCountry = known(worker?.country) ?? known(facility?.country) ?? known(state.mothers[0]?.country);
  const startCountry: CountryCode = setupCountry ?? fallbackCountry ?? SUPPORTED[0];
  const startRegion = (setupCountry === startCountry ? setup?.region : undefined) ?? facility?.region ?? COUNTRIES[startCountry]?.regions?.[0] ?? '';
  const startArea = setupCountry === startCountry && setup?.region === startRegion ? (setup?.district ?? '') : '';

  const [step, setStep] = useState(0);
  const [tried, setTried] = useState(false);
  const [f, setF] = useState({
    name: '',
    age: '',
    community: '',
    country: startCountry,
    region: startRegion,
    area: startArea,
    language: defaultLanguageFor({ country: startCountry, region: startRegion }) as string,
    literacy: 'basic' as Literacy,
    access: 'feature' as PhoneAccess,
    number: '',
    hasWhatsApp: false,
    guardianName: '',
    guardianRelation: 'Mother',
    guardianNumber: '',
    guardianPresent: false,
    pregnant: true,
    weeks: '',
    twins: false,
    gravida: '',
    parity: '',
    previousCaesarean: false,
    previousStillbirth: false,
    previousPPH: false,
    conditions: [] as ConditionCode[],
    genotype: 'unknown' as Genotype,
    bloodGroup: '',
    consentData: false,
    consentMessages: false,
  });
  const [children, setChildren] = useState<ChildDraft[]>([]);
  const [langTouched, setLangTouched] = useState(false);
  const [moreLangs, setMoreLangs] = useState(false);
  // With no known country, the country choice is open from the start rather than silently assumed.
  const [changeCountry, setChangeCountry] = useState(!setupCountry && !fallbackCountry);
  const [areas, setAreas] = useState<PlaceOption[] | null>(() => areaOptionsSync(startCountry, startRegion));
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));

  const age = parseInt(f.age, 10);
  const minor = Number.isFinite(age) && age < 18;
  const steps: StepId[] = ['about', 'language', 'phone', ...(minor ? (['guardian'] as const) : []), 'journey', 'history', 'consent'];
  const id = steps[Math.min(step, steps.length - 1)];
  const regions = useMemo(() => regionOptions(f.country), [f.country]);
  const langs = useMemo(() => languageOptions(f.country, f.region, f.area), [f.country, f.region, f.area]);

  useEffect(() => {
    let live = true;
    const sync = areaOptionsSync(f.country, f.region);
    setAreas(sync);
    if (sync === null) void loadAreaOptions(f.country, f.region).then((a) => live && setAreas(a));
    return () => {
      live = false;
    };
  }, [f.country, f.region]);

  const setPlace = (patch: Partial<Pick<typeof f, 'country' | 'region' | 'area'>>) =>
    setF((x) => {
      const next = { ...x, ...patch };
      if (!langTouched) next.language = defaultLanguageFor({ country: next.country, region: next.region });
      return next;
    });

  const childIssues = (c: ChildDraft): string | null => {
    if (!c.dob) return 'Add the date of birth.';
    const d = daysBetween(c.dob, state.clock);
    if (d < 0) return 'The date of birth is in the future.';
    if (!(parseFloat(c.weight) > 0.4 && parseFloat(c.weight) < 7)) return 'Add the birth weight in kg (for example 3.1).';
    return null;
  };

  const problems: Partial<Record<string, string>> = {};
  if (id === 'about') {
    if (f.name.trim().length < 2) problems.name = 'Write her full name.';
    if (!(Number.isFinite(age) && age >= 10 && age <= 60)) problems.age = 'Her age in years, between 10 and 60.';
    if (!f.community.trim()) problems.community = 'Where she lives, so you can find her.';
    if (!f.region) problems.region = `Choose her ${regionWord(f.country).toLowerCase()}.`;
  }
  if (id === 'phone' && (f.access === 'feature' || f.access === 'smartphone') && f.number.replace(/\D/g, '').length < 7) problems.number = 'A phone number has at least 7 digits.';
  if (id === 'guardian' && !f.guardianName.trim()) problems.guardianName = 'Her parent or guardian’s name.';
  if (id === 'journey') {
    const w = parseInt(f.weeks, 10);
    if (f.pregnant && !(w >= 4 && w <= 42)) problems.weeks = 'Weeks pregnant, between 4 and 42.';
    children.forEach((c) => {
      const p = childIssues(c);
      if (p) problems[`child-${c.key}`] = p;
    });
  }
  if (id === 'consent') {
    if (!f.consentData) problems.consentData = 'She needs to agree before her record is kept.';
    if (minor && !f.guardianPresent) problems.guardian = 'Record that her guardian was involved.';
  }
  const valid = Object.keys(problems).length === 0;
  const show = (k: string) => (tried ? problems[k] : undefined);

  const next = () => {
    if (!valid) {
      setTried(true);
      return;
    }
    setTried(false);
    if (id === 'journey') {
      // Sensible history defaults from what she just told us; the worker can change them.
      const born = children.length;
      setF((x) => ({
        ...x,
        parity: x.parity || String(born),
        gravida: x.gravida || String(born + (x.pregnant ? 1 : 0) || 1),
      }));
    }
    if (step < steps.length - 1) setStep(step + 1);
    else create();
  };

  const create = () => {
    const now = stamp(state.clock);
    const mid = uid('m');
    const weeks = parseInt(f.weeks, 10);
    const lmp = f.pregnant ? addDays(state.clock, -weeks * 7).slice(0, 10) : undefined;
    const kids: Child[] = children
      .map((c) => {
        const d = daysBetween(c.dob, state.clock);
        return {
          id: uid('child'),
          name: c.name.trim() || 'Baby',
          sex: c.sex,
          dob: c.dob,
          birthWeightKg: parseFloat(c.weight),
          gestationAtBirthWeeks: c.early ? 35 : 39,
          feeding: d < 183 ? 'exclusive_breastfeeding' : 'complementary_with_breastmilk',
        } as Child;
      })
      .sort((a, b) => a.dob.localeCompare(b.dob));
    const youngest = kids[kids.length - 1];
    const stageVisit = f.pregnant ? 'anc' : youngest ? 'child_health' : 'home_visit';
    const community = f.area && !f.community.toLowerCase().includes(f.area.toLowerCase()) ? `${f.community.trim()} (${f.area})` : f.community.trim();
    const mother: Mother = {
      id: mid,
      name: f.name.trim(),
      age,
      country: f.country,
      region: f.region,
      community,
      language: f.language as LanguageCode,
      literacy: f.literacy,
      phone: { access: f.access, number: f.number.trim() || undefined, hasWhatsApp: f.access === 'smartphone' && f.hasWhatsApp },
      incomeBand: 'low',
      gravida: Math.max(parseInt(f.gravida, 10) || 1, kids.length + (f.pregnant ? 1 : 0)),
      parity: Math.max(parseInt(f.parity, 10) || 0, kids.length),
      previousCaesarean: f.previousCaesarean,
      previousStillbirth: f.previousStillbirth,
      previousPPH: f.previousPPH,
      conditions: f.conditions,
      allergies: [],
      genotype: f.genotype,
      bloodGroup: f.bloodGroup || undefined,
      medications: [],
      pregnancy: lmp ? { lmp, fetuses: f.twins ? 2 : 1, plannedBirthPlace: 'facility' } : undefined,
      children: kids,
      birth: youngest ? { date: youngest.dob, mode: f.previousCaesarean ? 'caesarean' : 'vaginal', place: 'facility', complications: [youngest.gestationAtBirthWeeks < 37 ? 'preterm' : 'none'] } : undefined,
      practicesMentioned: [],
      assignedWorkerId: worker.id,
      facilityId: worker.facilityId,
      enrolledAt: now,
      consent: { dataProcessing: f.consentData, messaging: f.consentMessages, guardianInvolved: minor ? f.guardianPresent : undefined, recordedAt: now, recordedBy: worker.id },
      events: [
        {
          kind: 'visit',
          id: uid('ev'),
          at: now,
          recordedBy: worker.id,
          visitType: stageVisit,
          attended: true,
          contactNumber: f.pregnant ? 1 : undefined,
          facilityId: worker.facilityId,
          note: 'Registered on Gaskin',
        },
      ],
    };
    dispatch({ type: 'register', mother });
    if (minor && f.guardianName.trim()) dispatch({ type: 'setCarer', motherId: mid, carer: { name: f.guardianName.trim(), relation: f.guardianRelation, number: f.guardianNumber.trim() || undefined } });
    toast(`${mother.name.split(' ')[0]} is registered. Gaskin ID ${gaskinId(mother)}.`);
    go({ name: 'patient', id: mid, tab: 'plan' }, { replace: true });
  };

  if (!can(worker, 'mothers.register')) {
    return (
      <div className="mx-auto max-w-[640px] py-16 text-center" data-testid="register">
        <h1 className="text-display-xs font-semibold text-primary">Registering mothers needs a health worker’s profile</h1>
        <p className="mt-2 text-md text-tertiary">Ask a supervisor to register her, or switch to your own profile.</p>
      </div>
    );
  }

  const localLangs = langs.filter((l) => l.local);
  const otherLangs = langs.filter((l) => !l.local).sort((a, b) => Number(b.hasPack) - Number(a.hasPack) || a.name.localeCompare(b.name));
  const chosenLang = langs.find((l) => l.code === f.language);
  const placeLine = [f.area, f.region, COUNTRIES[f.country]?.name].filter(Boolean).join(', ');

  return (
    <div className="mx-auto grid max-w-[1120px] grid-cols-1 gap-8" data-testid="register">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-display-xs font-semibold text-primary lg:text-display-sm">Register a mother</h1>
          <p className="mt-1 text-md text-tertiary">Her Gaskin ID stays the same if she changes phone or SIM.</p>
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-12 lg:gap-10">
        <form
          className="grid content-start gap-6 lg:col-span-8"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            next();
          }}
        >
          {/* Progress */}
          <div>
            <p className="text-sm font-medium text-brand-secondary">
              Step {step + 1} of {steps.length}
            </p>
            <ol className="mt-2 flex gap-1.5" aria-label="Steps">
              {steps.map((s, i) => (
                <li key={s} className="flex-1" aria-current={i === step ? 'step' : undefined}>
                  <span className={cx('block h-1.5 rounded-full transition-colors duration-200', i < step ? 'bg-brand-solid' : i === step ? 'bg-brand-solid' : 'bg-tertiary')} />
                  <span className="sr-only">
                    {STEP_TITLE[s]}
                    {i < step ? ', done' : ''}
                  </span>
                </li>
              ))}
            </ol>
            <h2 className="mt-4 text-xl font-semibold text-primary">{STEP_TITLE[id]}</h2>
          </div>

          {id === 'about' ? (
            <div className="grid gap-5 sm:grid-cols-6">
              <Input className="sm:col-span-4" id="reg-name" label="Full name" placeholder="As she says it" value={f.name} onChange={(v) => set('name', v)} autoFocus isRequired isInvalid={!!show('name')} hint={show('name')} autoComplete="off" />
              <Input className="sm:col-span-2" id="reg-age" label="Age" placeholder="Years" inputMode="numeric" value={f.age} onChange={(v) => set('age', v.replace(/\D/g, '').slice(0, 2))} isRequired isInvalid={!!show('age')} hint={show('age') ?? (minor ? 'Under 18: you will add her guardian next.' : undefined)} />
              <Input className="sm:col-span-6" id="reg-community" label="Community or village" placeholder="For example, Aguda" value={f.community} onChange={(v) => set('community', v)} isRequired isInvalid={!!show('community')} hint={show('community')} />
              <div className="sm:col-span-3">
                <Select.ComboBox
                  label={regionWord(f.country)}
                  placeholder="Search"
                  shortcut={false}
                  items={regions}
                  selectedKey={f.region || null}
                  onSelectionChange={(k) => k && setPlace({ region: String(k), area: '' })}
                  isInvalid={!!show('region')}
                  hint={show('region')}
                  aria-label={regionWord(f.country)}
                >
                  {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
                </Select.ComboBox>
              </div>
              <div className="sm:col-span-3">
                {areas && areas.length ? (
                  <Select.ComboBox
                    label={areaWord(f.country)}
                    placeholder="Search"
                    shortcut={false}
                    items={areas.map((a) => ({ id: a.label, label: a.label }))}
                    allowsCustomValue
                    inputValue={f.area}
                    onInputChange={(v) => set('area', v)}
                    onSelectionChange={(k) => k && set('area', String(k))}
                    hint="Optional"
                  >
                    {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
                  </Select.ComboBox>
                ) : (
                  <Input label={areaWord(f.country)} placeholder={areas === null ? 'Loading…' : 'Optional'} value={f.area} onChange={(v) => set('area', v)} hint="Optional" />
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-tertiary sm:col-span-6">
                <span>Country: {COUNTRIES[f.country]?.name}</span>
                {SUPPORTED.length > 1 ? (
                  changeCountry ? (
                    <span className="flex flex-wrap gap-2" role="radiogroup" aria-label="Country">
                      {SUPPORTED.map((c) => (
                        <ChoiceChip
                          key={c}
                          selected={f.country === c}
                          onClick={() => {
                            const region = COUNTRIES[c].regions[0] ?? '';
                            setPlace({ country: c, region, area: '' });
                            setChangeCountry(false);
                          }}
                        >
                          {COUNTRIES[c].name}
                        </ChoiceChip>
                      ))}
                    </span>
                  ) : (
                    <Button color="link-color" size="sm" onClick={() => setChangeCountry(true)}>
                      She lives in another country
                    </Button>
                  )
                ) : null}
              </div>
            </div>
          ) : null}

          {id === 'language' ? (
            <div className="grid gap-5">
              <fieldset className="grid gap-3">
                <legend className="mb-1 text-sm font-medium text-secondary">For her messages, handouts and Show to mother</legend>
                <div role="radiogroup" aria-label="Her language" className="grid grid-cols-2 gap-2 sm:grid-cols-3" id="reg-lang">
                  {localLangs.map((l) => (
                    <LangCard
                      key={l.code}
                      name={l.name}
                      selected={f.language === l.code}
                      disabled={!l.hasPack}
                      onClick={() => {
                        setLangTouched(true);
                        set('language', l.code);
                      }}
                    />
                  ))}
                </div>
                {otherLangs.length ? (
                  <div>
                    <Button color="link-color" size="sm" iconTrailing={<ChevronDown className={cx('size-4 transition-transform', moreLangs && 'rotate-180')} aria-hidden="true" />} onClick={() => setMoreLangs(!moreLangs)} aria-expanded={moreLangs}>
                      {moreLangs ? 'Fewer languages' : 'More languages'}
                    </Button>
                    {moreLangs ? (
                      <div role="radiogroup" aria-label="More languages" className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {otherLangs.map((l) => (
                          <LangCard
                            key={l.code}
                            name={l.name}
                            selected={f.language === l.code}
                            disabled={!l.hasPack}
                            onClick={() => {
                              setLangTouched(true);
                              set('language', l.code);
                            }}
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
                <p className="text-sm text-tertiary">Languages marked “Coming soon” have no pack yet. Choose the one she reads or hears best for now.</p>
              </fieldset>
              <fieldset className="grid gap-2">
                <legend className="mb-1 text-sm font-medium text-secondary">Reading</legend>
                <div role="radiogroup" aria-label="Reading" className="grid grid-cols-3 gap-2">
                  {(
                    [
                      ['none', 'Does not read'],
                      ['basic', 'Reads a little'],
                      ['good', 'Reads well'],
                    ] as const
                  ).map(([k, l]) => (
                    <ChoiceCard key={k} selected={f.literacy === k} onClick={() => set('literacy', k)}>
                      {l}
                    </ChoiceCard>
                  ))}
                </div>
                {f.literacy === 'none' ? <p className="text-sm text-tertiary">Gaskin will lead with pictures and offer voice calls.</p> : null}
              </fieldset>
            </div>
          ) : null}

          {id === 'phone' ? (
            <div className="grid gap-5">
              <div role="radiogroup" aria-label="Phone" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {(
                  [
                    ['smartphone', 'Smartphone'],
                    ['feature', 'Basic phone'],
                    ['shared', 'Shared phone'],
                    ['none', 'No phone'],
                  ] as const
                ).map(([k, l]) => (
                  <ChoiceCard key={k} selected={f.access === k} onClick={() => set('access', k)}>
                    {l}
                  </ChoiceCard>
                ))}
              </div>
              {f.access !== 'none' ? (
                <Input
                  id="reg-phone"
                  label={f.access === 'shared' ? 'Number of the shared phone' : 'Phone number'}
                  inputMode="tel"
                  placeholder={f.country === 'NG' ? '0803 000 0000' : f.country === 'KE' ? '0712 000 000' : '024 000 0000'}
                  value={f.number}
                  onChange={(v) => set('number', v)}
                  isInvalid={!!show('number')}
                  hint={show('number') ?? (f.access === 'shared' ? 'Optional. Note whose phone it is on her record.' : undefined)}
                />
              ) : (
                <p className="rounded-xl bg-secondary p-4 text-sm text-secondary">She will get printed handouts at each visit, and you can message a family carer.</p>
              )}
              {f.access === 'smartphone' ? <Checkbox label="She uses a chat app such as WhatsApp" isSelected={f.hasWhatsApp} onChange={(v) => set('hasWhatsApp', v)} /> : null}
            </div>
          ) : null}

          {id === 'guardian' ? (
            <div className="grid gap-5 sm:grid-cols-2">
              <p className="rounded-xl bg-brand-primary p-4 text-sm text-brand-secondary sm:col-span-2">She is {age}. A parent or guardian should be involved in her care and her consent.</p>
              <Input id="reg-guardian-name" label="Guardian’s name" value={f.guardianName} onChange={(v) => set('guardianName', v)} isInvalid={!!show('guardianName')} hint={show('guardianName')} />
              <Select label="Relationship" selectedKey={f.guardianRelation} onSelectionChange={(k) => set('guardianRelation', String(k))} items={['Mother', 'Father', 'Aunt', 'Grandmother', 'Husband', 'Other'].map((x) => ({ id: x, label: x }))}>
                {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
              </Select>
              <Input id="reg-guardian-phone" label="Guardian’s phone" inputMode="tel" value={f.guardianNumber} onChange={(v) => set('guardianNumber', v)} hint="Optional" className="sm:col-span-2" />
            </div>
          ) : null}

          {id === 'journey' ? (
            <div className="grid gap-6">
              <section className="grid gap-3 rounded-2xl bg-secondary p-4">
                <Checkbox size="md" label="She is pregnant now" isSelected={f.pregnant} onChange={(v) => set('pregnant', v)} />
                {f.pregnant ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input id="reg-weeks" label="Weeks pregnant" inputMode="numeric" placeholder="For example, 22" value={f.weeks} onChange={(v) => set('weeks', v.replace(/\D/g, '').slice(0, 2))} isInvalid={!!show('weeks')} hint={show('weeks')} />
                    <div className="flex items-end pb-2.5">
                      <Checkbox label="Twins or more" isSelected={f.twins} onChange={(v) => set('twins', v)} />
                    </div>
                  </div>
                ) : null}
              </section>

              <section className="grid gap-3" aria-labelledby="kids-h">
                <div className="flex items-center justify-between gap-3">
                  <h3 id="kids-h" className="text-md font-semibold text-primary">
                    Her children under 3
                  </h3>
                  <Button
                    color="secondary"
                    size="sm"
                    iconLeading={Plus}
                    data-testid="reg-add-child"
                    onClick={() => setChildren((c) => [...c, { key: uid('k'), name: '', dob: '', sex: 'F', weight: '', early: false }])}
                  >
                    Add a child
                  </Button>
                </div>
                {children.length === 0 ? <p className="text-sm text-tertiary">{f.pregnant ? 'Add any baby or toddler she is caring for, so their vaccines and checks are planned too.' : 'Add her baby, or leave this empty if she is planning a pregnancy.'}</p> : null}
                <ul className="grid gap-3">
                  {children.map((c, i) => {
                    const upd = (patch: Partial<ChildDraft>) => setChildren((all) => all.map((x) => (x.key === c.key ? { ...x, ...patch } : x)));
                    const err = show(`child-${c.key}`);
                    return (
                      <li key={c.key} className={cx('grid gap-4 rounded-2xl bg-primary p-4 shadow-xs ring-1 ring-secondary ring-inset sm:grid-cols-6', err && 'ring-error_subtle')}>
                        <div className="flex items-center justify-between sm:col-span-6">
                          <span className="text-sm font-semibold text-secondary">Child {i + 1}</span>
                          <Button color="tertiary" size="sm" iconLeading={Trash01} aria-label={`Remove child ${i + 1}`} onClick={() => setChildren((all) => all.filter((x) => x.key !== c.key))} />
                        </div>
                        <Input id={`reg-child-name-${i}`} className="sm:col-span-3" label="Name" placeholder="Optional" value={c.name} onChange={(v) => upd({ name: v })} />
                        <Input id={`reg-child-dob-${i}`} className="sm:col-span-3" label="Date of birth" type="date" value={c.dob} onChange={(v) => upd({ dob: v })} />
                        <div className="sm:col-span-2">
                          <span className="mb-1.5 block text-sm font-medium text-secondary">Sex</span>
                          <div role="radiogroup" aria-label="Sex" className="grid grid-cols-2 gap-2">
                            <ChoiceCard compact selected={c.sex === 'F'} onClick={() => upd({ sex: 'F' })}>
                              Girl
                            </ChoiceCard>
                            <ChoiceCard compact selected={c.sex === 'M'} onClick={() => upd({ sex: 'M' })}>
                              Boy
                            </ChoiceCard>
                          </div>
                        </div>
                        <Input id={`reg-child-weight-${i}`} className="sm:col-span-2" label="Birth weight, kg" inputMode="decimal" placeholder="3.1" value={c.weight} onChange={(v) => upd({ weight: v.replace(/[^\d.]/g, '') })} />
                        <div className="flex items-end pb-2.5 sm:col-span-2">
                          <Checkbox label="Born early" isSelected={c.early} onChange={(v) => upd({ early: v })} />
                        </div>
                        {err ? <p className="text-sm text-error-primary sm:col-span-6">{err}</p> : null}
                      </li>
                    );
                  })}
                </ul>
              </section>
            </div>
          ) : null}

          {id === 'history' ? (
            <div className="grid gap-6">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Input id="reg-g" label="Pregnancies" hint="Including this one" inputMode="numeric" value={f.gravida} onChange={(v) => set('gravida', v.replace(/\D/g, ''))} />
                <Input id="reg-p" label="Births" inputMode="numeric" value={f.parity} onChange={(v) => set('parity', v.replace(/\D/g, ''))} />
                <Select label="Genotype" selectedKey={f.genotype} onSelectionChange={(k) => set('genotype', k as Genotype)} items={(['unknown', 'AA', 'AS', 'SS', 'AC', 'SC'] as const).map((g) => ({ id: g, label: g === 'unknown' ? 'Not tested' : g }))}>
                  {(item) => <Select.Item id={item.id}>{item.label}</Select.Item>}
                </Select>
                <Input id="reg-bg" label="Blood group" placeholder="O+" value={f.bloodGroup} onChange={(v) => set('bloodGroup', v.toUpperCase().slice(0, 3))} />
              </div>
              <fieldset className="grid gap-2">
                <legend className="mb-1 text-sm font-medium text-secondary">Before</legend>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      ['previousCaesarean', 'Caesarean'],
                      ['previousStillbirth', 'Stillbirth'],
                      ['previousPPH', 'Heavy bleeding after a birth'],
                    ] as const
                  ).map(([k, l]) => (
                    <ChoiceChip key={k} selected={f[k]} onClick={() => set(k, !f[k])} multi>
                      {l}
                    </ChoiceChip>
                  ))}
                </div>
              </fieldset>
              <fieldset className="grid gap-2">
                <legend className="mb-1 text-sm font-medium text-secondary">Conditions she knows about</legend>
                <div className="flex flex-wrap gap-2">
                  {CONDITIONS.map((c) => (
                    <ChoiceChip key={c} multi selected={f.conditions.includes(c)} onClick={() => set('conditions', f.conditions.includes(c) ? f.conditions.filter((x) => x !== c) : [...f.conditions, c])}>
                      {CONDITION_LABELS[c] ?? c}
                    </ChoiceChip>
                  ))}
                </div>
              </fieldset>
            </div>
          ) : null}

          {id === 'consent' ? (
            <div className="grid gap-5">
              <blockquote className="rounded-2xl bg-secondary p-5 text-md text-primary">
                <p className="mb-2 text-sm font-medium text-tertiary">Read this to her in {chosenLang?.name ?? LANGUAGE_NAMES[f.language as LanguageCode] ?? 'her language'}</p>
                “We will keep your health record on this phone and at the clinic to plan your care. Only health workers caring for you can see it. You can ask us to stop at any time.”
              </blockquote>
              <div className="grid gap-4">
                <Checkbox id="reg-consent-data" size="md" label="She agrees to her record being kept" isSelected={f.consentData} onChange={(v) => set('consentData', v)} hint={show('consentData')} />
                <Checkbox id="reg-consent-msg" size="md" label={`She agrees to receive messages ${f.access === 'none' ? 'through a family carer' : 'on her phone'}`} isSelected={f.consentMessages} onChange={(v) => set('consentMessages', v)} />
                {minor ? (
                  <Checkbox id="reg-guardian" size="md" label={`${f.guardianName.trim() || 'Her guardian'} was involved, as she is under 18`} isSelected={f.guardianPresent} onChange={(v) => set('guardianPresent', v)} hint={show('guardian')} />
                ) : null}
              </div>
              <p className="text-xs text-quaternary">Recorded by {worker.name}. Kept under the NDPA 2023 (Nigeria), the Data Protection Act 2019 (Kenya) and Act 843 (Ghana).</p>
            </div>
          ) : null}

          {tried && !valid ? (
            <p role="alert" className="text-sm font-medium text-error-primary">
              {Object.values(problems)[0]}
            </p>
          ) : null}

          <div className="flex items-center justify-between gap-3 border-t border-secondary pt-5">
            {step > 0 ? (
              <Button color="tertiary" size="lg" iconLeading={ArrowLeft} onClick={() => (setTried(false), setStep(step - 1))}>
                Back
              </Button>
            ) : (
              <Button color="tertiary" size="lg" onClick={() => go({ name: 'mothers' })}>
                Cancel
              </Button>
            )}
            <Button type="submit" color="primary" size="lg" iconTrailing={step < steps.length - 1 ? ArrowRight : undefined} iconLeading={step === steps.length - 1 ? UserPlus01 : undefined} data-testid="reg-next">
              {step < steps.length - 1 ? 'Next' : 'Register her'}
            </Button>
          </div>
        </form>

        {/* Her card, building as the worker fills the form */}
        <aside className="hidden lg:col-span-4 lg:block" aria-label="Her card">
          <div className="sticky top-24 grid gap-4 rounded-2xl bg-primary p-5 shadow-xs ring-1 ring-secondary ring-inset">
            <div className="flex items-center gap-3">
              <MotherAvatar name={f.name.trim() || '?'} size="lg" />
              <div className="min-w-0">
                <p className="truncate text-md font-semibold text-primary">{f.name.trim() || 'New mother'}</p>
                <p className="truncate text-sm text-tertiary">{[Number.isFinite(age) ? `${age} years` : '', f.community].filter(Boolean).join(' · ') || 'Age and community'}</p>
              </div>
            </div>
            <dl className="grid gap-3 text-sm">
              <Row label="Place">{placeLine || '–'}</Row>
              <Row label="Language">{chosenLang?.name ?? '–'}</Row>
              <Row label="Phone">{f.access === 'none' ? 'No phone' : f.number || (f.access === 'shared' ? 'Shared phone' : '–')}</Row>
              {minor ? <Row label="Guardian">{f.guardianName || '–'}</Row> : null}
              <Row label="Now">
                <span className="flex flex-wrap gap-1">
                  {f.pregnant ? <Chip color="brand">{f.weeks ? `${f.weeks} wks` : 'Pregnant'}</Chip> : null}
                  {children.map((c, i) => (
                    <Chip key={c.key} color="blue">
                      {(c.name.trim() || `Child ${i + 1}`).split(' ')[0]}
                      {c.dob ? ` ${shortAge(daysBetween(c.dob, state.clock))}` : ''}
                    </Chip>
                  ))}
                  {!f.pregnant && !children.length ? <Chip>Planning</Chip> : null}
                </span>
              </Row>
            </dl>
            <ol className="grid gap-1.5 border-t border-secondary pt-4">
              {steps.map((s, i) => (
                <li key={s} className={cx('flex items-center gap-2 text-sm', i === step ? 'font-semibold text-primary' : i < step ? 'text-secondary' : 'text-quaternary')}>
                  <span aria-hidden="true" className={cx('flex size-5 items-center justify-center rounded-full text-[11px]', i < step ? 'bg-brand-solid text-on-fill' : i === step ? 'ring-2 ring-brand' : 'ring-1 ring-secondary')}>
                    {i < step ? <Check className="size-3" /> : i + 1}
                  </span>
                  {STEP_TITLE[s]}
                </li>
              ))}
            </ol>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-2">
      <dt className="text-tertiary">{label}</dt>
      <dd className="min-w-0 truncate text-secondary">{children}</dd>
    </div>
  );
}

function ChoiceCard({ selected, onClick, children, compact }: { selected: boolean; onClick: () => void; children: ReactNode; compact?: boolean }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={cx(
        'flex cursor-pointer items-center justify-center rounded-xl px-3 text-center text-sm font-semibold transition duration-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring',
        compact ? 'h-11' : 'min-h-14 py-2',
        selected ? 'bg-brand-primary text-brand-secondary ring-2 ring-brand ring-inset' : 'bg-primary text-secondary ring-1 ring-primary ring-inset hover:bg-primary_hover',
      )}
    >
      {children}
    </button>
  );
}

function ChoiceChip({ selected, onClick, children, multi }: { selected: boolean; onClick: () => void; children: ReactNode; multi?: boolean }) {
  return (
    <button
      type="button"
      role={multi ? 'checkbox' : 'radio'}
      aria-checked={selected}
      onClick={onClick}
      className={cx(
        'inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-sm font-medium ring-inset focus-visible:outline-2 focus-visible:outline-focus-ring',
        selected ? 'bg-brand-primary text-brand-secondary ring-2 ring-brand' : 'bg-primary text-secondary ring-1 ring-primary hover:bg-primary_hover',
      )}
    >
      {selected && multi ? <Check className="size-4" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

function LangCard({ name, selected, disabled, onClick }: { name: string; selected: boolean; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-disabled={disabled || undefined}
      onClick={disabled ? undefined : onClick}
      className={cx(
        'flex min-h-14 flex-col items-start justify-center rounded-xl px-3 py-2 text-left ring-inset focus-visible:outline-2 focus-visible:outline-focus-ring',
        disabled ? 'cursor-not-allowed bg-secondary ring-1 ring-secondary' : 'cursor-pointer',
        !disabled && (selected ? 'bg-brand-primary ring-2 ring-brand' : 'bg-primary ring-1 ring-primary hover:bg-primary_hover'),
      )}
    >
      <span className={cx('text-sm font-semibold', disabled ? 'text-quaternary' : selected ? 'text-brand-secondary' : 'text-secondary')}>{name}</span>
      {disabled ? <span className="text-xs text-quaternary">Coming soon</span> : null}
    </button>
  );
}
