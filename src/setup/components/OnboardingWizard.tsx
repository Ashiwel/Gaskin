/**
 * Guided onboarding: one calm question per screen with large options, a progress bar, back and
 * skip, then "Here is your setup" as a set of visual cards and one button that applies it.
 *
 * Order: who will use Gaskin, country, area, language (worked out from the place, so a worker in
 * South Africa never sees Nigerian languages), then the device and work questions for health
 * workers, or a short, kind branch for a mother using Gaskin for herself (not a doctor, consent,
 * register at a clinic, the emergency number for her country).
 *
 * The root keeps the `setup-root` class for the walk-through; styling is Tailwind on theme tokens.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Building02,
  CheckCircle,
  Database02,
  Globe02,
  Heart,
  HeartHand,
  Home03,
  Lock01,
  MarkerPin02,
  MessageChatSquare,
  PhoneCall01,
  Printer,
  RefreshCw01,
  ShieldTick,
  Stars02,
  Translate01,
  UsersRight,
  Laptop02,
  Phone01,
  Monitor04,
  Clock,
} from '@untitledui/icons';
import { nearestRegion } from '../../location';
import { saveAISettings, type KeyPersistence } from '../../ai';
import { getAppStore, passphraseProblem } from '../../storage';
import { applySetupPlan, type ApplyOptions, type ApplyProgress, type ApplyStepId } from '../apply';
import { connectAssistant, type AssistantConnection } from '../assistant';
import { detectSetupEnvironment, requestPosition } from '../env';
import { visibleQuestions, type Question, type QuestionOption } from '../questions';
import { recommendSetup } from '../recommend';
import { langTag, st, type SetupKey } from '../strings';
import type { SetupAnswers, SetupEnvironment, SetupPlan, WorkerLanguage } from '../types';
import { Choice, ChoiceList, ComingSoon, DraftBadge, PickerField, PrimaryButton, SearchSheet, SecondaryButton, StepFrame, TextField, type IconType, type PickItem } from '../../ui/onboarding/kit';
import { SETUP_ICONS } from '../../ui/onboarding/icons';
import {
  CONSENT_VERSION,
  allLanguages,
  consentLines,
  countryName,
  dialable,
  emergencyFor,
  flagOf,
  isLaunch,
  languageName,
  languagesFor,
  listCountries,
  useDistricts,
  listRegionsFor,
  personalDisclaimers,
  regionWords,
  saveConsent,
  type PersonalConsent,
  type PlaceLanguage,
} from '../../ui/onboarding/geo';
import { cx } from '../../utils/cx';

export interface OnboardingWizardProps {
  /** Called after the plan is applied; the app should land on the caseload */
  onComplete: (plan: SetupPlan, answers: SetupAnswers) => void;
  /** Start from earlier answers (e.g. "Change my answers" from Settings) */
  initialAnswers?: SetupAnswers;
  /** Override detected device facts (demo controls, tests) */
  env?: SetupEnvironment;
  /** Shows a quiet "Look around first" link on the first screen */
  onSkipAll?: () => void;
  /** Passed to applySetupPlan (tests, pack download speed) */
  applyOptions?: Omit<ApplyOptions, 'apiKey' | 'onProgress'>;
  /** Shown under the first question (the reviewer presets) */
  firstStepExtra?: ReactNode;
}

export type Audience = 'health_worker' | 'supervisor' | 'personal';

/** Answers plus the onboarding's own fields (kept with the saved setup). */
export type WizardAnswers = SetupAnswers & {
  audience?: Audience;
  /** ISO code for any country (SetupAnswers.country is 'other' outside the launch countries) */
  countryCode?: string;
  consent?: PersonalConsent;
};

type StepId = 'who' | 'country' | 'place' | 'language' | 'mothers' | 'not_doctor' | 'consent' | 'clinic' | `q:${string}`;

const WORK_QUESTIONS = ['role', 'devices', 'computerOs', 'internet', 'dataBudget', 'electricity', 'printer', 'aiApps', 'aiPay', 'caseload', 'setupBy', 'techComfort'];

function stepsFor(a: WizardAnswers): StepId[] {
  const base: StepId[] = ['who', 'country', 'place', 'language'];
  if (a.audience === 'personal') return [...base, 'not_doctor', 'consent', 'clinic'];
  const visible = new Set(visibleQuestions(a).map((q) => q.id as string));
  const work = WORK_QUESTIONS.filter((id) => visible.has(id) && !(id === 'role' && a.audience === 'supervisor')).map((id) => `q:${id}` as StepId);
  return [...base, 'mothers', ...work];
}

type Phase = 'questions' | 'summary' | 'applying';

export function OnboardingWizard({ onComplete, initialAnswers, env: envProp, onSkipAll, applyOptions, firstStepExtra }: OnboardingWizardProps) {
  const [answers, setAnswers] = useState<WizardAnswers>(() => ({ ...(initialAnswers ?? {}) }) as WizardAnswers);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('questions');
  const env = useMemo(() => envProp ?? detectSetupEnvironment(), [envProp]);
  const lang: WorkerLanguage = answers.workerLanguage ?? 'en';
  const T = (k: SetupKey, p?: Record<string, string | number>, en?: string) => st(k, lang, p, en);
  const steps = stepsFor(answers);
  const step = steps[Math.min(index, steps.length - 1)];
  const total = steps.length + 1;
  const set = (patch: Partial<WizardAnswers>) => setAnswers((a) => ({ ...a, ...patch }));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);
  useEffect(() => {
    try {
      window.scrollTo({ top: 0 });
    } catch {
      /* jsdom */
    }
  }, [index, phase]);

  const next = () => {
    if (timer.current) clearTimeout(timer.current);
    const s = stepsFor(answers);
    if (index + 1 >= s.length) setPhase('summary');
    else setIndex(index + 1);
  };
  /** Single choice: show the tick, then move on. */
  const pickThenNext = (patch: Partial<WizardAnswers>) => {
    setAnswers((a) => {
      const nextA = { ...a, ...patch };
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        const s = stepsFor(nextA);
        setIndex((i) => {
          if (i + 1 >= s.length) {
            setPhase('summary');
            return i;
          }
          return i + 1;
        });
      }, 260);
      return nextA;
    });
  };
  const back = () => {
    if (phase === 'summary') {
      setPhase('questions');
      setIndex(stepsFor(answers).length - 1);
    } else if (index > 0) setIndex(index - 1);
  };

  const common = {
    progress: phase === 'questions' ? (index + 1) / total : 1,
    stepLabel: phase === 'questions' ? `${index + 1} of ${total}` : undefined,
    onBack: index > 0 || phase !== 'questions' ? back : undefined,
    backLabel: T('back'),
  };

  return (
    <div className="setup-root min-h-dvh bg-primary text-primary" lang={langTag(lang)} data-step={phase === 'questions' ? step : phase}>
      {phase === 'questions' ? (
        <StepScreen key={step} step={step} answers={answers} set={set} pickThenNext={pickThenNext} next={next} T={T} common={common} env={env} onSkipAll={onSkipAll} firstStepExtra={firstStepExtra} />
      ) : answers.audience === 'personal' ? (
        <PersonalReady answers={answers} common={common} applying={phase === 'applying'} onApply={async () => {
          setPhase('applying');
          const plan = personalPlan(answers, env);
          await applySetupPlan(plan, answers, { ...applyOptions });
          onComplete(plan, answers);
        }} />
      ) : (
        <Summary
          answers={answers}
          env={env}
          T={T}
          common={common}
          applying={phase === 'applying'}
          onApply={async (plan, extras, onProgress) => {
            setPhase('applying');
            const r = await applySetupPlan(plan, answers, { ...applyOptions, apiKey: extras.apiKey, onProgress });
            if (extras.apiKey) saveAISettings(r.aiSettings, extras.keyPersistence);
            if (extras.passphrase) {
              try {
                const store = await getAppStore();
                await store.enableEncryption(extras.passphrase);
              } catch {
                /* the Privacy settings say how to turn it on later */
              }
            }
            onComplete(plan, answers);
          }}
        />
      )}
    </div>
  );
}

/** A mother's own setup: her phone, her language, no AI unless she agreed to it. */
function personalPlan(a: WizardAnswers, env: SetupEnvironment): SetupPlan {
  const plan = recommendSetup({ ...a, role: 'other', devices: a.devices ?? ['android_phone'], mothersLanguages: a.workerLanguage && a.workerLanguage !== 'other' ? [a.workerLanguage as never] : ['en'] }, env);
  const ai = a.consent?.aiAllowed ? plan.ai : { ...plan.ai, mode: 'none' as const, settings: { mode: 'none' as const }, label: 'No AI', reason: 'You chose not to use smart help. You can switch it on in Settings.' };
  return { ...plan, ai, firstTenMinutes: ['Add your due date or your baby’s birthday.', 'Read your plan for this week.', 'Save the emergency number in your phone.'] };
}

// ---------------------------------------------------------------------------
// One step
// ---------------------------------------------------------------------------

type TFn = (k: SetupKey, p?: Record<string, string | number>, en?: string) => string;
interface Common {
  progress: number;
  stepLabel?: string;
  onBack?: () => void;
  backLabel: string;
}

interface StepProps {
  step: StepId;
  answers: WizardAnswers;
  set: (p: Partial<WizardAnswers>) => void;
  pickThenNext: (p: Partial<WizardAnswers>) => void;
  next: () => void;
  T: TFn;
  common: Common;
  env: SetupEnvironment;
  onSkipAll?: () => void;
  firstStepExtra?: ReactNode;
}

function StepScreen(p: StepProps) {
  switch (p.step) {
    case 'who':
      return <WhoStep {...p} />;
    case 'country':
      return <CountryStep {...p} />;
    case 'place':
      return <PlaceStep {...p} />;
    case 'language':
      return <LanguageStep {...p} />;
    case 'mothers':
      return <MothersStep {...p} />;
    case 'not_doctor':
      return <NotDoctorStep {...p} />;
    case 'consent':
      return <ConsentStep {...p} />;
    case 'clinic':
      return <ClinicStep {...p} />;
    default:
      return <QuestionStep {...p} />;
  }
}

function WhoStep({ answers, pickThenNext, common, onSkipAll, firstStepExtra }: StepProps) {
  const opts: Array<{ id: Audience; label: string; hint: string; icon: IconType }> = [
    { id: 'health_worker', label: 'A health worker', hint: 'Midwife, nurse, CHEW, CHP, CHO or doctor', icon: HeartHand },
    { id: 'supervisor', label: 'A supervisor or programme officer', hint: 'You look after health workers or the numbers for an area', icon: UsersRight },
    { id: 'personal', label: 'Myself or my family', hint: 'You are pregnant, or caring for a baby or young child', icon: Home03 },
  ];
  return (
    <StepFrame {...common} onBack={undefined} title="Who will use Gaskin?" lede="Gaskin sets itself up around the answer. It takes about three minutes." icon={Heart} testId="step-who">
      <ChoiceList label="Who will use Gaskin?">
        {opts.map((o) => (
          <Choice
            key={o.id}
            label={o.label}
            hint={o.hint}
            icon={o.icon}
            selected={answers.audience === o.id}
            testId={`who-${o.id}`}
            onPress={() =>
              pickThenNext({
                audience: o.id,
                role: o.id === 'personal' ? ('personal' as never) : o.id === 'supervisor' ? 'supervisor' : answers.role === 'supervisor' || (answers.role as string) === 'personal' ? undefined : answers.role,
              })
            }
          />
        ))}
      </ChoiceList>
      {onSkipAll ? (
        <p className="mt-6 text-center">
          <button type="button" onClick={onSkipAll} className="inline-flex h-11 cursor-pointer items-center rounded-lg px-3 text-sm font-semibold text-tertiary outline-focus-ring hover:text-secondary focus-visible:outline-2" data-testid="skip-all">
            Look around the demo first
          </button>
        </p>
      ) : null}
      {firstStepExtra}
    </StepFrame>
  );
}

function CountryStep({ answers, set, pickThenNext, next, common }: StepProps) {
  const [open, setOpen] = useState(false);
  const countries = useMemo(() => listCountries(), []);
  const code = answers.countryCode ?? (isLaunch(answers.country as string) ? (answers.country as string) : undefined);
  const choose = (c: string, advance = true) => {
    const changed = c !== code;
    const patch: Partial<WizardAnswers> = {
      countryCode: c,
      country: isLaunch(c) ? c : 'other',
      countryOther: isLaunch(c) ? undefined : countryName(c),
      ...(changed ? { region: undefined, district: undefined, geo: undefined, workerLanguage: undefined, mothersLanguages: undefined } : {}),
    };
    if (advance) pickThenNext(patch);
    else set(patch);
  };
  const items: PickItem[] = countries.map((c) => ({ id: c.code, label: c.name, glyph: flagOf(c.code), group: c.launch ? 'Where Gaskin has local data' : 'All countries', keywords: c.code }));
  return (
    <StepFrame {...common} title="Which country are you in?" lede="This sets the languages, the emergency number and the health advice for your area." icon={Globe02} testId="step-country"
      footer={code ? <PrimaryButton onPress={next}>Continue</PrimaryButton> : undefined}>
      <ChoiceList label="Country">
        {['NG', 'GH', 'KE'].map((c) => (
          <Choice key={c} label={countryName(c)} glyph={flagOf(c)} selected={code === c} onPress={() => choose(c)} testId={`country-${c}`} />
        ))}
      </ChoiceList>
      <div className="mt-6">
        <PickerField label="Somewhere else" value={code && !isLaunch(code) ? countryName(code) : undefined} glyph={code && !isLaunch(code) ? flagOf(code) : undefined} placeholder="Search all countries" onOpen={() => setOpen(true)} testId="country-picker" />
      </div>
      <SearchSheet
        open={open}
        onClose={() => setOpen(false)}
        title="Choose your country"
        items={items}
        selected={code ? [code] : []}
        placeholder="Type a country"
        testId="country-sheet"
        onPick={(id) => {
          setOpen(false);
          choose(id, false);
        }}
      />
    </StepFrame>
  );
}

function PlaceStep({ answers, set, next, T, common }: StepProps) {
  const code = answers.countryCode ?? (answers.country as string);
  const regions = useMemo(() => listRegionsFor(code), [code]);
  const districts = useDistricts(code, answers.region);
  const words = regionWords(code);
  const [sheet, setSheet] = useState<'region' | 'district' | null>(null);
  const [geo, setGeo] = useState<'idle' | 'asking' | 'found' | 'failed'>(answers.geo ? 'found' : 'idle');
  const region = answers.region && answers.region !== 'not_sure' ? answers.region : '';
  const personal = answers.audience === 'personal';

  const useMine = async () => {
    setGeo('asking');
    const pos = await requestPosition();
    if (!pos) return setGeo('failed');
    const near = nearestRegion(pos.lat, pos.lon);
    if (near && near.country === code) {
      set({ geo: pos, region: near.region, district: undefined });
      setGeo('found');
    } else {
      set({ geo: pos });
      setGeo('failed');
    }
  };

  return (
    <StepFrame
      {...common}
      title={personal ? 'Where do you live?' : 'Where do you work?'}
      lede={`In ${countryName(code)}. This brings in local foods, nearby hospitals and the languages people speak.`}
      icon={MarkerPin02}
      onSkip={next}
      skipLabel={T('skip')}
      testId="step-place"
      footer={<PrimaryButton onPress={next} testId="place-continue">Continue</PrimaryButton>}
    >
      <div className="grid gap-5">
        {isLaunch(code) ? (
          <button
            type="button"
            onClick={useMine}
            disabled={geo === 'asking'}
            className="flex min-h-16 w-full cursor-pointer items-center gap-4 rounded-2xl border border-dashed border-primary bg-primary p-4 text-left outline-focus-ring hover:bg-primary_hover focus-visible:outline-2 disabled:opacity-60"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-primary text-fg-brand-primary">
              <MarkerPin02 aria-hidden="true" className="size-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-md font-semibold text-primary">{geo === 'asking' ? 'Finding you…' : T('use_location')}</span>
              <span className="block text-sm text-tertiary">Asked once. Kept only on this device.</span>
            </span>
          </button>
        ) : null}
        {geo === 'found' && region ? <p className="flex items-center gap-2 text-sm text-success-primary"><CheckCircle aria-hidden="true" className="size-4" />Found: {region}</p> : null}
        {geo === 'failed' ? <p className="text-sm text-tertiary">{T('location_failed')}</p> : null}

        {regions.length ? (
          <PickerField label={words.region} value={region || undefined} placeholder={`Choose a ${words.region.toLowerCase()}`} onOpen={() => setSheet('region')} testId="region-picker" />
        ) : (
          <TextField label={words.region} value={region} onChange={(v) => set({ region: v, district: undefined })} placeholder="Type its name" testId="region-text" />
        )}
        {region ? (
          districts.length ? (
            <PickerField label={`${words.district} (optional)`} value={answers.district} placeholder={`Choose a ${words.district.toLowerCase()}`} onOpen={() => setSheet('district')} testId="district-picker" />
          ) : (
            <TextField label={`${words.district} (optional)`} value={answers.district ?? ''} onChange={(v) => set({ district: v })} placeholder="Type its name" testId="district-text" />
          )
        ) : null}
      </div>
      <SearchSheet
        open={sheet === 'region'}
        onClose={() => setSheet(null)}
        title={`Choose your ${words.region.toLowerCase()}`}
        items={regions.map((r) => ({ id: r, label: r }))}
        selected={region ? [region] : []}
        placeholder="Type to search"
        testId="region-sheet"
        allowFree={(t) => {
          set({ region: t, district: undefined });
          setSheet(null);
        }}
        onPick={(id) => {
          set({ region: id, district: id === region ? answers.district : undefined });
          setSheet(null);
        }}
      />
      <SearchSheet
        open={sheet === 'district'}
        onClose={() => setSheet(null)}
        title={`Choose your ${words.district.toLowerCase()}`}
        items={districts.map((d) => ({ id: d, label: d }))}
        selected={answers.district ? [answers.district] : []}
        placeholder="Type to search"
        allowFree={(t) => {
          set({ district: t });
          setSheet(null);
        }}
        onPick={(id) => {
          set({ district: id });
          setSheet(null);
        }}
      />
    </StepFrame>
  );
}

function statusBadge(l: PlaceLanguage) {
  if (!l.hasPack) return <ComingSoon />;
  if (l.status && l.status !== 'reviewed') return <DraftBadge />;
  return null;
}

/** Language items for the "More languages" sheet: this place first, then every other. */
export function languageItems(place: { country?: string; region?: string }, opts: { packOnly?: boolean } = {}): PickItem[] {
  const local = new Set(languagesFor(place).map((l) => l.code));
  return allLanguages(place).map((l) => ({
    id: l.code,
    label: l.nativeName,
    detail: l.nativeName !== l.name ? l.name : undefined,
    keywords: `${l.name} ${l.code}`,
    group: local.has(l.code) ? 'Spoken here' : 'Other languages',
    badge: statusBadge(l),
    disabled: opts.packOnly ? !l.hasPack : false,
    lang: l.code,
  }));
}

function LanguageStep({ answers, pickThenNext, set, next, common }: StepProps) {
  const code = answers.countryCode ?? (answers.country as string);
  const place = { country: code, region: answers.region, district: answers.district };
  const suggestions = useMemo(() => {
    // The place's own languages first (packless ones show "Coming soon"), and English always.
    const l = languagesFor(place);
    const top = l.slice(0, 4);
    return top.some((x) => x.code === 'en') ? top : [...top.slice(0, 3), ...languagesFor({ country: 'GB' }).filter((x) => x.code === 'en')];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, answers.region, answers.district]);
  const [open, setOpen] = useState(false);
  const cur = answers.workerLanguage;
  const extraChosen = cur && !suggestions.some((s) => s.code === cur);
  const personal = answers.audience === 'personal';
  return (
    <StepFrame
      {...common}
      title={personal ? 'Which language do you read best?' : 'Which language do you want Gaskin in?'}
      lede={`Suggested for ${answers.region ? `${answers.region}, ` : ''}${countryName(code)}. You can change it any time.`}
      icon={Translate01}
      testId="step-language"
      footer={cur ? <PrimaryButton onPress={next}>Continue</PrimaryButton> : undefined}
    >
      <ChoiceList label="Language" columns={2}>
        {suggestions.map((l) => (
          <Choice
            key={l.code}
            label={l.nativeName}
            hint={l.nativeName !== l.name ? l.name : undefined}
            glyph={l.code.slice(0, 2).toUpperCase()}
            lang={l.code}
            selected={cur === l.code}
            badge={statusBadge(l)}
            disabled={!l.hasPack}
            testId={`lang-${l.code}`}
            onPress={() => pickThenNext({ workerLanguage: l.code as WorkerLanguage })}
          />
        ))}
        {extraChosen ? <Choice label={languageName(cur!, true)} hint={languageName(cur!)} glyph={cur!.slice(0, 2).toUpperCase()} selected onPress={() => setOpen(true)} /> : null}
      </ChoiceList>
      <div className="mt-4">
        <SecondaryButton onPress={() => setOpen(true)} icon={Globe02} testId="more-languages">
          More languages
        </SecondaryButton>
      </div>
      <SearchSheet
        open={open}
        onClose={() => setOpen(false)}
        title="All languages"
        items={languageItems(place, { packOnly: true })}
        selected={cur ? [cur] : []}
        placeholder="Search by name, in any language"
        testId="language-sheet"
        onPick={(id) => {
          set({ workerLanguage: id as WorkerLanguage });
          setOpen(false);
        }}
      />
    </StepFrame>
  );
}

function MothersStep({ answers, set, next, T, common }: StepProps) {
  const code = answers.countryCode ?? (answers.country as string);
  const place = { country: code, region: answers.region, district: answers.district };
  const suggestions = useMemo(() => languagesFor(place).slice(0, 6), [code, answers.region, answers.district]); // eslint-disable-line react-hooks/exhaustive-deps
  const [open, setOpen] = useState(false);
  const chosen = (answers.mothersLanguages ?? []).filter((x) => x !== 'not_sure') as string[];
  const toggle = (c: string) => set({ mothersLanguages: (chosen.includes(c) ? chosen.filter((x) => x !== c) : [...chosen, c]) as never });
  const extras = chosen.filter((c) => !suggestions.some((s) => s.code === c));
  return (
    <StepFrame
      {...common}
      title="Which languages do the mothers speak?"
      lede="Pick all that apply. Messages and picture cards are made ready in these. Languages marked Coming soon use English for now."
      icon={MessageChatSquare}
      onSkip={() => {
        // Not sure: the place's three most spoken languages, never another country's.
        set({ mothersLanguages: (isLaunch(code) ? ['not_sure'] : suggestions.slice(0, 3).map((l) => l.code)) as never });
        next();
      }}
      skipLabel={T('skip')}
      testId="step-mothers"
      footer={<PrimaryButton onPress={next} disabled={!chosen.length}>Continue</PrimaryButton>}
    >
      <ChoiceList label="Mothers’ languages" multi columns={2}>
        {[...suggestions, ...extras.map((c) => languagesFor({ country: code }).find((l) => l.code === c) ?? { code: c, name: languageName(c), nativeName: languageName(c, true), hasPack: false })].map((l) => (
          <Choice key={l.code} multi label={l.nativeName} hint={l.nativeName !== l.name ? l.name : undefined} glyph={l.code.slice(0, 2).toUpperCase()} lang={l.code} selected={chosen.includes(l.code)} badge={statusBadge(l)} onPress={() => toggle(l.code)} testId={`mlang-${l.code}`} />
        ))}
      </ChoiceList>
      <div className="mt-4">
        <SecondaryButton onPress={() => setOpen(true)} icon={Globe02}>
          More languages
        </SecondaryButton>
      </div>
      <SearchSheet open={open} onClose={() => setOpen(false)} title="Mothers’ languages" multi items={languageItems(place)} selected={chosen} placeholder="Search by name, in any language" onPick={toggle} />
    </StepFrame>
  );
}

/** The device and work questions, drawn from src/setup/questions with big icons. */
function QuestionStep({ step, answers, set, pickThenNext, next, T, common }: StepProps) {
  const id = step.slice(2);
  const q = visibleQuestions(answers).find((x) => x.id === id) as Question | undefined;
  if (!q) return null;
  const key = q.id as keyof SetupAnswers;
  const value = answers[key] as unknown;
  const opts = q.options(answers);
  const title = T(`q.${q.id}` as SetupKey, undefined, q.title);
  const label = (o: QuestionOption) => (o.value === 'not_sure' ? T('not_sure') : o.label);
  const skip = q.skippable
    ? () => {
        if (answers[key] === undefined) set({ [key]: q.kind === 'multi' ? ['not_sure'] : 'not_sure' } as Partial<WizardAnswers>);
        next();
      }
    : undefined;
  if (q.kind === 'multi') {
    const arr = (Array.isArray(value) ? value : []) as Array<string | number>;
    const toggle = (o: QuestionOption) => {
      let n: Array<string | number>;
      if (arr.includes(o.value)) n = arr.filter((x) => x !== o.value);
      else if (o.exclusive) n = [o.value];
      else n = [...arr.filter((x) => !opts.find((p) => p.value === x)?.exclusive), o.value];
      set({ [key]: n } as Partial<WizardAnswers>);
    };
    return (
      <StepFrame {...common} title={title} lede={q.help ?? T('pick_all')} onSkip={skip} skipLabel={T('skip')} testId={`step-${q.id}`} footer={<PrimaryButton onPress={next} disabled={!arr.length}>{T('continue')}</PrimaryButton>}>
        <ChoiceList label={title} multi columns={opts.length > 5 ? 2 : 1}>
          {opts.map((o) => (
            <Choice key={String(o.value)} multi label={label(o)} hint={o.hint} icon={SETUP_ICONS[o.icon]} selected={arr.includes(o.value)} onPress={() => toggle(o)} size={opts.length > 6 ? 'md' : 'lg'} />
          ))}
        </ChoiceList>
      </StepFrame>
    );
  }
  return (
    <StepFrame {...common} title={title} lede={q.help} onSkip={skip} skipLabel={T('skip')} testId={`step-${q.id}`}>
      <ChoiceList label={title} columns={opts.length > 5 ? 2 : 1}>
        {opts.map((o) => (
          <Choice key={String(o.value)} label={label(o)} hint={o.hint} icon={SETUP_ICONS[o.icon]} selected={value === o.value} onPress={() => pickThenNext({ [key]: o.value } as Partial<WizardAnswers>)} size={opts.length > 6 ? 'md' : 'lg'} />
        ))}
      </ChoiceList>
    </StepFrame>
  );
}

// ---------------------------------------------------------------------------
// Personal branch
// ---------------------------------------------------------------------------

function NotDoctorStep({ answers, next, common }: StepProps) {
  const code = answers.countryCode ?? (answers.country as string);
  const lines = personalDisclaimers(code);
  return (
    <StepFrame {...common} title="Gaskin is not a doctor" lede="It helps you plan and remember what to do for you and your baby. It cannot see or examine you." icon={HeartHand} testId="step-not-doctor" footer={<PrimaryButton onPress={next}>I understand</PrimaryButton>}>
      <ul className="grid gap-3">
        {lines.map((l, i) => (
          <li key={l.id} className={cx('flex gap-3 rounded-2xl p-4 ring-1 ring-inset', l.id.endsWith('emergency') || l.id.endsWith('danger') ? 'bg-error-primary ring-error_subtle' : 'bg-secondary ring-secondary')}>
            <span aria-hidden="true" className={cx('grid size-8 shrink-0 place-items-center rounded-full text-sm font-semibold', l.id.endsWith('emergency') || l.id.endsWith('danger') ? 'bg-error-solid text-on-fill' : 'bg-primary text-secondary ring-1 ring-secondary')}>
              {l.id.endsWith('emergency') || l.id.endsWith('danger') ? <AlertTriangle className="size-4" /> : i + 1}
            </span>
            <span className={cx('text-md', l.id.endsWith('emergency') || l.id.endsWith('danger') ? 'font-medium text-error-primary' : 'text-secondary')}>{l.text}</span>
          </li>
        ))}
      </ul>
    </StepFrame>
  );
}

function ConsentStep({ answers, set, next, common }: StepProps) {
  const code = answers.countryCode ?? (answers.country as string);
  const lines = consentLines(code);
  const [ticked, setTicked] = useState<Record<string, boolean>>(() => {
    const c = answers.consent;
    const r: Record<string, boolean> = {};
    if (c) {
      r['legal.consent.understand'] = c.understandsNotDoctor;
      r['legal.consent.emergency'] = c.knowsEmergency;
      r['legal.consent.store'] = c.storeOnDevice;
      r['legal.consent.ai'] = c.aiAllowed;
      r['legal.consent.age'] = c.adultOrGuardian;
    }
    return r;
  });
  const ready = lines.filter((l) => l.required).every((l) => ticked[l.key]);
  const agree = () => {
    const c: PersonalConsent = {
      version: CONSENT_VERSION,
      agreedAt: new Date().toISOString(),
      understandsNotDoctor: Boolean(ticked['legal.consent.understand']),
      knowsEmergency: Boolean(ticked['legal.consent.emergency']),
      storeOnDevice: Boolean(ticked['legal.consent.store']),
      aiAllowed: Boolean(ticked['legal.consent.ai']),
      adultOrGuardian: Boolean(ticked['legal.consent.age']),
    };
    saveConsent(c);
    set({ consent: c });
    next();
  };
  return (
    <StepFrame {...common} title="Your agreement" lede="Tick each line you agree with. The last but one is your choice." icon={ShieldTick} testId="step-consent" footer={<PrimaryButton onPress={agree} disabled={!ready} testId="consent-agree">I agree</PrimaryButton>}>
      <ChoiceList label="Your agreement" multi>
        {lines.map((l) => (
          <Choice key={l.key} multi size="md" label={l.text} hint={l.required ? undefined : 'Optional'} selected={Boolean(ticked[l.key])} onPress={() => setTicked((t) => ({ ...t, [l.key]: !t[l.key] }))} testId={`consent-${l.key.split('.').pop()}`} />
        ))}
      </ChoiceList>
    </StepFrame>
  );
}

function EmergencyCard({ country }: { country?: string }) {
  const e = emergencyFor(country);
  return (
    <a href={`tel:${dialable(e.number)}`} className="flex items-center gap-4 rounded-2xl bg-error-primary p-5 ring-1 ring-error_subtle outline-focus-ring ring-inset focus-visible:outline-2" data-testid="emergency-card">
      <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-error-solid text-on-fill">
        <PhoneCall01 aria-hidden="true" className="size-6" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-error-primary">Emergency in {countryName(country) || 'your country'}</span>
        <span className="block text-display-xs font-semibold text-error-primary tnum">{e.number}</span>
        {!e.verified ? <span className="block text-xs text-error-primary">Check this number locally. Gaskin could not confirm it.</span> : null}
      </span>
    </a>
  );
}

function ClinicStep({ answers, next, common, env }: StepProps) {
  const code = answers.countryCode ?? (answers.country as string);
  const facilities = useMemo(() => {
    try {
      return (recommendSetup({ ...answers, audience: 'personal' } as SetupAnswers, env) as SetupPlan & { personal?: { nearestFacilities?: Array<{ name: string; town: string }> } }).personal?.nearestFacilities ?? [];
    } catch {
      return [];
    }
  }, [answers, env]);
  return (
    <StepFrame {...common} title="Register at a clinic too" lede="Gaskin works best alongside a midwife or nurse who knows you. Take your plan to every visit and show it to them." icon={Building02} testId="step-clinic" footer={<PrimaryButton onPress={next}>Continue</PrimaryButton>}>
      <div className="grid gap-4">
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { icon: Building02, t: 'Book your first check', d: 'At a health centre, as early as you can.' },
            { icon: Phone01, t: 'Show them Gaskin', d: 'They can check your plan and add to it.' },
            { icon: Clock, t: 'Go to every visit', d: 'At least 8 checks before birth.' },
          ].map((x) => (
            <div key={x.t} className="flex gap-3 rounded-2xl bg-secondary p-4 ring-1 ring-secondary ring-inset sm:flex-col">
              <x.icon aria-hidden="true" className="size-6 shrink-0 text-fg-brand-primary" />
              <div>
                <p className="text-md font-semibold text-primary">{x.t}</p>
                <p className="mt-0.5 text-sm text-tertiary">{x.d}</p>
              </div>
            </div>
          ))}
        </div>
        {facilities.length ? (
          <div className="rounded-2xl bg-primary p-4 ring-1 ring-secondary ring-inset">
            <p className="text-sm font-medium text-tertiary">Hospitals near you</p>
            <ul className="mt-2 grid gap-1.5">
              {facilities.map((f) => (
                <li key={f.name} className="flex items-center gap-2 text-md text-primary">
                  <Building02 aria-hidden="true" className="size-4 shrink-0 text-fg-quaternary" />
                  <span className="min-w-0 truncate">
                    {f.name}
                    {f.town ? <span className="text-tertiary">, {f.town}</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <p className="mt-2 text-md font-semibold text-primary">Save this number in your phone</p>
        <EmergencyCard country={code} />
      </div>
    </StepFrame>
  );
}

function PersonalReady({ answers, common, applying, onApply }: { answers: WizardAnswers; common: Common; applying: boolean; onApply: () => void }) {
  const code = answers.countryCode ?? (answers.country as string);
  return (
    <StepFrame {...common} title="You are ready" lede="Here is what Gaskin will do for you." icon={CheckCircle} testId="step-ready" footer={<PrimaryButton onPress={onApply} loading={applying} testId="apply-setup">{applying ? 'Getting ready…' : 'Open my plan'}</PrimaryButton>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <SummaryCard icon={Translate01} title="Language" value={languageName(answers.workerLanguage ?? 'en', true)} detail={answers.workerLanguage && answers.workerLanguage !== 'en' ? 'Lines not yet translated show in English.' : undefined} />
        <SummaryCard icon={MarkerPin02} title="Your area" value={answers.region ? `${answers.region}, ${countryName(code)}` : countryName(code)} detail="Local foods and nearby hospitals in your plan." />
        <SummaryCard icon={Lock01} title="Your records" value="Kept on this phone" detail="Nothing is sent anywhere unless you choose to." />
        <SummaryCard icon={Stars02} title="Smart help" value={answers.consent?.aiAllowed ? 'On, with names removed' : 'Off'} detail="Change it in Settings." />
      </div>
      <div className="mt-6">
        <EmergencyCard country={code} />
      </div>
    </StepFrame>
  );
}

// ---------------------------------------------------------------------------
// Here is your setup
// ---------------------------------------------------------------------------

function SummaryCard({ icon: Icon, title, value, detail, children, tone = 'brand', testId }: { icon: IconType; title: string; value: ReactNode; detail?: ReactNode; children?: ReactNode; tone?: 'brand' | 'success'; testId?: string }) {
  return (
    <section className="flex min-w-0 flex-col rounded-2xl bg-primary p-5 shadow-xs ring-1 ring-secondary ring-inset" data-testid={testId}>
      <div className="flex items-center gap-3">
        <span className={cx('grid size-10 shrink-0 place-items-center rounded-xl', tone === 'success' ? 'bg-success-primary text-fg-success-primary' : 'bg-brand-primary text-fg-brand-primary')}>
          <Icon aria-hidden="true" className="size-5" />
        </span>
        <h2 className="text-sm font-medium text-tertiary">{title}</h2>
      </div>
      <p className="mt-3 text-lg font-semibold text-primary">{value}</p>
      {detail ? <p className="mt-1 text-sm text-tertiary">{detail}</p> : null}
      {children ? <div className="mt-3">{children}</div> : null}
    </section>
  );
}

const CHANNEL_LABEL: Record<string, string> = { sms: 'SMS', whatsapp: 'WhatsApp', voice: 'Voice', print: 'Picture cards', email: 'Email' };
const STEP_ORDER: ApplyStepId[] = ['storage', 'languages', 'ai', 'place'];
const STEP_KEY: Record<ApplyStepId, SetupKey> = { storage: 'step_storage', languages: 'step_lang', ai: 'step_ai', place: 'step_place' };

interface Extras {
  apiKey?: string;
  keyPersistence: KeyPersistence;
  passphrase?: string;
}

function Summary({ answers, env, T, common, applying, onApply }: { answers: WizardAnswers; env: SetupEnvironment; T: TFn; common: Common; applying: boolean; onApply: (plan: SetupPlan, extras: Extras, onProgress: (p: ApplyProgress) => void) => Promise<void> }) {
  const plan = useMemo(() => recommendSetup(answers, env), [answers, env]);
  const [apiKey, setApiKey] = useState('');
  const [keyPersistence, setKeyPersistence] = useState<KeyPersistence>('session');
  const [protect, setProtect] = useState(false);
  const [pass, setPass] = useState('');
  const [progress, setProgress] = useState<Partial<Record<ApplyStepId, ApplyProgress>>>({});
  const [assistant, setAssistant] = useState<AssistantConnection | null>(null);
  useEffect(() => {
    if (plan.ai.mode === 'connect_assistant' && plan.ai.assistant) void connectAssistant(plan.ai.assistant).then(setAssistant);
  }, [plan.ai.mode, plan.ai.assistant]);
  const RunIcon = plan.run.where === 'phone_app' ? Phone01 : plan.run.where === 'facility_hub' ? Monitor04 : Laptop02;
  const passProblem = protect && pass ? passphraseProblem(pass) : null;
  const canApply = !protect || (pass.length > 0 && !passProblem);
  const usbOrFolder = plan.storage.mode === 'folder' || plan.run.where === 'laptop_usb';
  const channels = [...plan.channels].sort((a, b) => Number(b.primary) - Number(a.primary));

  return (
    <StepFrame
      {...common}
      wide
      backLabel={T('change_answers')}
      title={T('summary_title')}
      lede={T('summary_intro')}
      icon={CheckCircle}
      testId="setup-summary"
      footer={
        <PrimaryButton onPress={() => onApply(plan, { apiKey: apiKey.trim() || undefined, keyPersistence, passphrase: protect && pass ? pass : undefined }, (p) => setProgress((c) => ({ ...c, [p.step]: p })))} disabled={!canApply} loading={applying} testId="apply-setup">
          {applying ? T('applying') : T('apply')}
        </PrimaryButton>
      }
    >
      <div className="grid items-start gap-4 md:grid-cols-2">
        <SummaryCard icon={RunIcon} title={T('card_run')} value={plan.run.label} detail={plan.run.reason} testId="card-run" />
        <SummaryCard icon={Translate01} title={T('card_languages')} value={`${languageName(plan.languages.ui, true)} for you`} testId="card-languages">
          <div className="flex flex-wrap gap-1.5">
            {plan.languages.mothers.map((l) => (
              <span key={l} className="rounded-full bg-secondary px-2.5 py-1 text-sm font-medium text-secondary ring-1 ring-secondary ring-inset">
                {languageName(l)}
              </span>
            ))}
          </div>
          {plan.languages.notes[0] ? <p className="mt-2 text-sm text-tertiary">{plan.languages.notes[0]}</p> : null}
        </SummaryCard>
        <SummaryCard icon={Stars02} title={T('card_ai')} value={plan.ai.label} detail={plan.ai.reason} testId="card-ai">
          {plan.ai.mode !== 'none' ? (
            <p className="flex items-center gap-2 text-sm text-success-primary">
              <ShieldTick aria-hidden="true" className="size-4 shrink-0" />
              {T('privacy_on')}
            </p>
          ) : null}
          {plan.ai.needsKey ? (
            <div className="mt-3 grid gap-3">
              <TextField label={T('key_label', { service: plan.ai.needsKey.service })} type="password" autoComplete="off" value={apiKey} onChange={setApiKey} hint={T('key_hint')} />
              {apiKey ? (
                <fieldset>
                  <legend className="mb-1.5 text-sm font-medium text-secondary">Keep the key</legend>
                  <div className="grid gap-2">
                    {(
                      [
                        ['session', 'Until I close Gaskin', 'Best on a shared phone or computer.'],
                        ['device', 'Remember on this device', 'Anyone who can open this browser could find it.'],
                        ['memory', 'Ask me every time', 'Never saved anywhere.'],
                      ] as Array<[KeyPersistence, string, string]>
                    ).map(([id, l, h]) => (
                      <Choice key={id} size="md" label={l} hint={h} selected={keyPersistence === id} onPress={() => setKeyPersistence(id)} />
                    ))}
                  </div>
                </fieldset>
              ) : null}
            </div>
          ) : null}
          {assistant ? (
            <div className="mt-3 grid gap-2 text-sm text-secondary">
              <ol className="grid list-decimal gap-1 pl-5">
                {assistant.steps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
              {assistant.kind === 'download' && assistant.downloadUrl ? (
                <a className="inline-flex h-11 w-max items-center rounded-lg px-3 font-semibold text-brand-secondary ring-1 ring-primary ring-inset hover:bg-primary_hover" href={assistant.downloadUrl} download={assistant.fileName}>
                  Download Gaskin for Claude
                </a>
              ) : null}
            </div>
          ) : null}
        </SummaryCard>
        <SummaryCard icon={MessageChatSquare} title={T('card_messages')} value={channels.filter((c) => c.primary).map((c) => CHANNEL_LABEL[c.channel]).join(' and ') || 'SMS'} testId="card-channels">
          <ul className="grid gap-2">
            {channels.map((c) => (
              <li key={c.channel} className="flex items-start gap-2 text-sm">
                <span className={cx('mt-0.5 shrink-0 rounded-md px-1.5 py-0.5 text-xs font-semibold ring-1 ring-inset', c.primary ? 'bg-brand-primary text-brand-secondary ring-brand' : 'bg-secondary text-tertiary ring-secondary')}>{CHANNEL_LABEL[c.channel]}</span>
                <span className="text-tertiary">{c.reason}</span>
              </li>
            ))}
          </ul>
        </SummaryCard>
        <SummaryCard icon={Printer} title={T('card_print')} value={plan.printing.where === 'none' ? 'No printer for now' : plan.printing.where === 'own' ? 'Your printer' : plan.printing.where === 'facility' ? 'At your facility' : 'At the district office'} detail={plan.printing.routine} testId="card-print" />
        <SummaryCard icon={Database02} title={T('card_storage')} value={plan.storage.label} detail={plan.storage.reason} testId="card-storage">
          <div className="flex items-center gap-2 text-sm text-tertiary">
            <RefreshCw01 aria-hidden="true" className="size-4" />
            Backup every {plan.storage.backupEveryDays === 1 ? 'day' : `${plan.storage.backupEveryDays} days`}
          </div>
          <div className="mt-3">
            <Choice
              multi
              size="md"
              icon={Lock01}
              label="Protect records with a passphrase"
              hint={usbOrFolder ? 'Recommended: a lost USB stick or laptop cannot be read without it.' : 'Optional on a phone with a screen lock.'}
              selected={protect}
              onPress={() => setProtect((x) => !x)}
              testId="protect-records"
            />
            {protect ? (
              <div className="mt-3 grid gap-2">
                <TextField label="Passphrase" type="password" autoComplete="new-password" value={pass} onChange={setPass} hint={passProblem ?? 'Three or four ordinary words work well.'} />
                <p className="rounded-xl bg-warning-primary p-3 text-sm text-warning-primary ring-1 ring-border-warning_subtle ring-inset">
                  If you forget it, nobody can open the records, not even your supervisor. Write it down and keep it with your PIN recovery code, somewhere locked.
                </p>
              </div>
            ) : null}
          </div>
        </SummaryCard>
        <section className="rounded-2xl bg-secondary p-5 ring-1 ring-secondary ring-inset md:col-span-2" data-testid="card-first">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-primary text-fg-brand-primary ring-1 ring-secondary">
              <Clock aria-hidden="true" className="size-5" />
            </span>
            <h2 className="text-md font-semibold text-primary">{T('card_first')}</h2>
          </div>
          <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {plan.firstTenMinutes.map((s, i) => (
              <li key={s} className="flex gap-3 rounded-xl bg-primary p-3 ring-1 ring-secondary ring-inset">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-solid text-sm font-semibold text-on-fill tnum">{i + 1}</span>
                <span className="text-sm text-secondary">{s}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>

      {applying ? (
        <ol className="mt-6 grid gap-2" aria-live="polite" data-testid="apply-progress">
          {STEP_ORDER.map((id) => {
            const p = progress[id];
            const state = p?.state ?? 'waiting';
            return (
              <li key={id} className="flex items-center gap-3 text-md">
                <span
                  aria-hidden="true"
                  className={cx(
                    'grid size-7 shrink-0 place-items-center rounded-full',
                    state === 'done' || state === 'skipped' ? 'bg-success-solid text-on-fill' : state === 'fallback' ? 'bg-warning-solid text-on-fill' : state === 'running' ? 'ring-2 ring-brand' : 'ring-1 ring-secondary',
                  )}
                >
                  {state === 'done' || state === 'skipped' ? <CheckCircle className="size-4" /> : state === 'fallback' ? '!' : null}
                </span>
                <span className="min-w-0 text-secondary">
                  {T(STEP_KEY[id])}
                  {id === 'languages' && p?.progress !== undefined && state === 'running' ? ` ${Math.round(p.progress * 100)}%` : ''}
                  {p?.note && state !== 'running' ? <span className="block text-sm text-tertiary">{p.note}</span> : null}
                </span>
              </li>
            );
          })}
        </ol>
      ) : null}
      <p className="mt-6 flex items-center gap-2 text-sm text-tertiary">
        <ArrowRight aria-hidden="true" className="size-4" />
        Next, you will add yourself as the first worker on this device and choose a PIN.
      </p>
    </StepFrame>
  );
}
