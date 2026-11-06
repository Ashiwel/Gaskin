/**
 * Settings sections, part one: profile and facility, workers, appearance, language and region.
 */
import { useMemo, useState, useSyncExternalStore } from 'react';
import {
  Building02,
  Calendar,
  CheckCircle,
  Contrast01,
  Edit05,
  Globe02,
  Key01,
  Lock01,
  MarkerPin02,
  RefreshCw01,
  Rows03,
  Scales02,
  Thermometer01,
  Translate01,
  Type01,
  User01,
  UserCheck01,
  UserPlus01,
  UserX01,
  Users03,
  Coins03,
} from '@untitledui/icons';
import { Avatar } from '../../components/base/avatar/avatar';
import { ThemeSegmented, initials } from '../../components/shell';
import { useApp } from '../../store';
import { setupStore, useSetup } from '../../setup';
import { installPack, installedLanguages, isPackCode, packStore } from '../../i18n';
import { useToast } from '../components';
import { useWorkerLang } from '../i18n';
import { ChoosePin, Overlay, RecoveryCodeCard, openAddWorker } from '../accounts/Accounts';
import {
  ROLE_LABEL,
  can,
  changePin,
  resetPinBySupervisor,
  roleLabel,
  roleOf,
  setActive,
  setRole,
  updateProfile,
  useAccounts,
  type Profile,
  type RoleChoice,
} from '../accounts/auth';
import { SearchSheet, StepFrame, TextField } from '../onboarding/kit';
import { countryCurrency, countryName, flagOf, isLaunch, languageName, languagesFor, listCountries, listRegionsFor, regionWords, useDistricts } from '../onboarding/geo';
import { languageItems } from '../../setup/components/OnboardingWizard';
import { formatDatePref, formatMoney, formatTemperature, formatWeight, usePrefs, type DateFormat } from './prefs';
import { Callout, ConfirmDialog, Group, Row, SectionHeader, Segmented, SelectInline, SmallButton } from './parts';
import { cx } from '../../utils/cx';

// ---------------------------------------------------------------------------
// Profile and facility
// ---------------------------------------------------------------------------

export function ProfileSection() {
  const { state } = useApp();
  const { current } = useAccounts();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(current?.name ?? '');
  const [pinFlow, setPinFlow] = useState<'off' | 'current' | 'new' | 'code'>('off');
  const [curPin, setCurPin] = useState('');
  const [code, setCode] = useState<string | null>(null);
  const [pinErr, setPinErr] = useState<string | null>(null);
  const facility = state.facilities.find((f) => f.id === current?.facilityId);
  const worker = state.workers.find((w) => w.id === current?.id);
  const caseload = state.mothers.filter((m) => m.assignedWorkerId === current?.id || current?.caseloadMotherIds?.includes(m.id)).length;
  if (!current) return null;
  return (
    <div className="grid gap-6">
      <SectionHeader title={current.personal ? 'Your profile' : 'Profile and facility'} icon={User01} />
      <div className="flex items-center gap-4 rounded-2xl bg-secondary p-5 ring-1 ring-secondary ring-inset">
        <Avatar size="xl" initials={initials(current.name)} alt="" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-semibold text-primary">{current.name}</p>
          <p className="text-sm text-tertiary">
            {roleLabel(current)}
            {facility ? `, ${facility.name}` : ''}
          </p>
        </div>
        {!current.personal ? (
          <div className="hidden text-right sm:block">
            <p className="text-display-xs font-semibold text-primary tnum">{caseload}</p>
            <p className="text-xs text-tertiary">mothers in her care</p>
          </div>
        ) : null}
      </div>
      <Group title="About you">
        {editing ? (
          <div className="grid gap-3 p-4">
            <TextField label="Name" value={name} onChange={setName} autoFocus maxLength={80} />
            <div className="flex gap-2">
              <SmallButton
                tone="primary"
                onPress={async () => {
                  const e = await updateProfile(current.id, { name: name.trim() });
                  toast(e ?? 'Name saved.');
                  if (!e) setEditing(false);
                }}
                disabled={!name.trim()}
              >
                Save
              </SmallButton>
              <SmallButton onPress={() => (setEditing(false), setName(current.name))}>Cancel</SmallButton>
            </div>
          </div>
        ) : (
          <Row label="Name" hint={current.name} icon={Edit05} onPress={() => (setName(current.name), setEditing(true))} testId="edit-name" />
        )}
        {!current.personal ? <Row label="Work" hint={worker ? `${ROLE_WORD[worker.role] ?? worker.role}, ${worker.yearsExperience} years` : roleLabel(current)} icon={User01} /> : null}
        {facility ? <Row label="Facility" hint={`${facility.name}, ${facility.region}`} icon={Building02} /> : null}
        <Row label="Change my PIN" hint="You get a new recovery code too." icon={Key01} onPress={() => (setPinFlow('current'), setPinErr(null))} testId="change-pin" />
      </Group>
      {pinFlow === 'current' ? (
        <Overlay label="Change PIN">
          <ChoosePinCurrent
            onBack={() => setPinFlow('off')}
            error={pinErr}
            onDone={(p) => {
              setCurPin(p);
              setPinFlow('new');
            }}
          />
        </Overlay>
      ) : null}
      {pinFlow === 'new' ? (
        <Overlay label="New PIN">
          <ChoosePin
            title="Choose a new PIN"
            onBack={() => setPinFlow('current')}
            onDone={async (pin) => {
              const r = await changePin(current.id, curPin, pin);
              if (!r.ok) {
                setPinErr(r.message ?? 'Your current PIN is not right.');
                setPinFlow('current');
              } else {
                setCode(r.recoveryCode ?? '');
                setPinFlow('code');
              }
            }}
          />
        </Overlay>
      ) : null}
      {pinFlow === 'code' && code ? (
        <Overlay label="New recovery code">
          <StepFrame title="PIN changed" lede="Here is your new recovery code. The old one no longer works." icon={Key01}>
            <RecoveryCodeCard name={current.name} code={code} onDone={() => (setPinFlow('off'), setCode(null), toast('PIN changed.'))} doneLabel="Done" />
          </StepFrame>
        </Overlay>
      ) : null}
    </div>
  );
}

const ROLE_WORD: Record<string, string> = { midwife: 'Midwife', nurse: 'Nurse', chew: 'CHEW', jchew: 'Junior CHEW', chips_agent: 'CHIPS agent', chp: 'Community health promoter', cho: 'Community health officer', doctor: 'Doctor', obgyn: 'Obstetrician', paediatrician: 'Paediatrician' };

/** Enter her current PIN (no check here; the change call checks it). */
function ChoosePinCurrent({ onDone, onBack, error }: { onDone: (pin: string) => void; onBack: () => void; error: string | null }) {
  const [v, setV] = useState('');
  return (
    <StepFrame
      title="Type your current PIN"
      icon={Lock01}
      onBack={onBack}
      backLabel="Cancel"
      footer={
        <button type="button" disabled={v.length < 4} onClick={() => onDone(v)} className="inline-flex h-12 min-w-40 flex-1 cursor-pointer items-center justify-center rounded-xl bg-brand-solid px-6 text-md font-semibold text-on-fill disabled:opacity-50 sm:flex-none">
          Continue
        </button>
      }
    >
      <TextField label="Current PIN" type="password" inputMode="numeric" autoComplete="current-password" value={v} onChange={(x) => setV(x.replace(/\D/g, '').slice(0, 8))} autoFocus />
      {error ? (
        <p className="mt-3 text-sm text-error-primary" role="alert">
          {error}
        </p>
      ) : null}
    </StepFrame>
  );
}

// ---------------------------------------------------------------------------
// Workers (supervisors)
// ---------------------------------------------------------------------------

const ROLE_OPTIONS: RoleChoice[] = ['worker', 'supervisor', 'clinical_reviewer', 'programme_officer'];

export function WorkersSection() {
  const { state, dispatch } = useApp();
  const { all, current } = useAccounts();
  const toast = useToast();
  const [open, setOpen] = useState<string | null>(null);
  const [reset, setReset] = useState<Profile | null>(null);
  const [assign, setAssign] = useState<Profile | null>(null);
  const [confirmOff, setConfirmOff] = useState<Profile | null>(null);
  if (!current || !can(current, 'manage_workers')) return null;
  const mine = all.filter((p) => p.facilityId === current.facilityId || current.role === 'admin');
  const counts = (p: Profile) => state.mothers.filter((m) => m.assignedWorkerId === p.id || p.caseloadMotherIds?.includes(m.id)).length;
  const active = mine.filter((p) => p.active);
  const maxLoad = Math.max(1, ...active.map(counts));

  return (
    <div className="grid gap-6" data-testid="workers-section">
      <SectionHeader
        title="Workers on this device"
        lede="Each worker has her own PIN and sees her own mothers. You can add, deactivate, reset a PIN and share out mothers."
        icon={Users03}
        action={
          <SmallButton tone="primary" icon={UserPlus01} onPress={openAddWorker} testId="add-worker">
            Add a worker
          </SmallButton>
        }
      />
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Active workers" value={active.length} />
        <Stat label="Mothers shared out" value={state.mothers.filter((m) => active.some((p) => p.id === m.assignedWorkerId)).length} />
        <Stat label="Deactivated" value={mine.length - active.length} />
      </div>
      <Group title="Caseloads">
        {mine.map((p) => {
          const n = counts(p);
          const expanded = open === p.id;
          return (
            <div key={p.id} data-worker={p.id}>
              <button type="button" onClick={() => setOpen(expanded ? null : p.id)} aria-expanded={expanded} className="flex min-h-16 w-full cursor-pointer items-center gap-3 px-4 py-3 text-left outline-focus-ring hover:bg-primary_hover focus-visible:outline-2 focus-visible:-outline-offset-2">
                <Avatar size="md" initials={initials(p.name)} alt="" />
                <span className="min-w-0 flex-1">
                  <span className={cx('block truncate text-md font-medium', p.active ? 'text-primary' : 'text-quaternary line-through')}>
                    {p.name}
                    {p.id === current.id ? <span className="ml-2 text-sm font-normal text-tertiary no-underline">(you)</span> : null}
                  </span>
                  <span className="block text-sm text-tertiary">{p.active ? roleLabel(p) : 'Deactivated'}</span>
                </span>
                <span className="hidden w-32 shrink-0 sm:block" aria-hidden="true">
                  <span className="block h-2 overflow-hidden rounded-full bg-tertiary">
                    <span className="block h-full rounded-full bg-brand-solid" style={{ width: `${(n / maxLoad) * 100}%` }} />
                  </span>
                </span>
                <span className="w-10 shrink-0 text-right text-md font-semibold text-primary tnum" aria-label={`${n} mothers`}>
                  {n}
                </span>
              </button>
              {expanded ? (
                <div className="grid gap-4 bg-secondary px-4 py-4">
                  <div>
                    <p className="mb-2 text-sm font-medium text-secondary">Role</p>
                    <Segmented
                      label="Role"
                      value={roleOf(p) as RoleChoice}
                      options={ROLE_OPTIONS.map((r) => ({ id: r, label: ROLE_LABEL[r] }))}
                      onChange={async (r) => {
                        if (p.id === current.id) return toast('Ask another supervisor to change your own role.');
                        const e = await setRole(p.id, r);
                        toast(e ?? `${p.name} is now ${ROLE_LABEL[r].toLowerCase()}.`);
                      }}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <SmallButton icon={Users03} onPress={() => setAssign(p)} testId="assign-caseload">
                      Assign mothers
                    </SmallButton>
                    {p.id !== current.id ? (
                      <SmallButton icon={Key01} onPress={() => setReset(p)} testId="reset-pin">
                        Reset PIN
                      </SmallButton>
                    ) : null}
                    {p.id !== current.id ? (
                      p.active ? (
                        <SmallButton icon={UserX01} onPress={() => setConfirmOff(p)}>
                          Deactivate
                        </SmallButton>
                      ) : (
                        <SmallButton icon={UserCheck01} onPress={async () => toast((await setActive(p.id, true)) ?? `${p.name} can sign in again.`)}>
                          Reactivate
                        </SmallButton>
                      )
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </Group>
      <ConfirmDialog
        open={Boolean(confirmOff)}
        title={`Deactivate ${confirmOff?.name ?? ''}?`}
        confirmLabel="Deactivate"
        onCancel={() => setConfirmOff(null)}
        onConfirm={async () => {
          const p = confirmOff!;
          setConfirmOff(null);
          toast((await setActive(p.id, false)) ?? `${p.name} can no longer sign in. Her records stay.`);
        }}
      >
        <p>She will not be able to sign in on this device. Every record and note she made stays. Share out her mothers before you do this.</p>
      </ConfirmDialog>
      {reset ? <ResetPinFlow target={reset} supervisor={current} onClose={() => setReset(null)} /> : null}
      {assign ? (
        <AssignSheet
          worker={assign}
          onSave={async (ids) => {
            // Mothers she is given become hers; mothers taken off her go back to the supervisor.
            for (const m of state.mothers) {
              const has = m.assignedWorkerId === assign.id;
              const want = ids.includes(m.id);
              if (has !== want) dispatch({ type: 'updateMother', mother: { ...m, assignedWorkerId: want ? assign.id : current.id }, cause: want ? `Assigned to ${assign.name}` : `Moved from ${assign.name}` });
            }
            toast(`${assign.name} now looks after ${ids.length} mothers.`);
            setAssign(null);
          }}
        />
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0 rounded-2xl bg-primary p-3 ring-1 ring-secondary ring-inset sm:p-4">
      <p className="text-display-xs font-semibold text-primary tnum">{value}</p>
      <p className="mt-0.5 text-xs text-tertiary sm:text-sm">{label}</p>
    </div>
  );
}

function AssignSheet({ worker, onSave }: { worker: Profile; onSave: (ids: string[]) => void }) {
  const { state } = useApp();
  const facilityMothers = state.mothers.filter((m) => m.facilityId === worker.facilityId || m.assignedWorkerId === worker.id);
  const pool = facilityMothers.length ? facilityMothers : state.mothers;
  const [ids, setIds] = useState<string[]>(() => pool.filter((m) => m.assignedWorkerId === worker.id).map((m) => m.id));
  const nameOf = (id: string) => state.workers.find((w) => w.id === id)?.name ?? 'Unassigned';
  return (
    <SearchSheet
      open
      multi
      onClose={() => onSave(ids)}
      title={`Mothers for ${worker.name.split(' ')[0]}`}
      items={pool.map((m) => ({ id: m.id, label: m.name, detail: `${m.community}. Now with ${nameOf(m.assignedWorkerId)}`, keywords: m.community }))}
      selected={ids}
      onPick={(id) => setIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))}
      placeholder="Search by name or community"
      testId="assign-sheet"
    />
  );
}

function ResetPinFlow({ target, supervisor, onClose }: { target: Profile; supervisor: Profile; onClose: () => void }) {
  const [stage, setStage] = useState<'mine' | 'new' | 'code'>('mine');
  const [mine, setMine] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  if (stage === 'mine')
    return (
      <Overlay label="Reset PIN">
        <StepFrame
          title={`Reset ${target.name.split(' ')[0]}’s PIN`}
          lede="First, type your own PIN to confirm it is you."
          icon={Key01}
          onBack={onClose}
          backLabel="Cancel"
          testId="reset-pin-flow"
          footer={
            <button type="button" disabled={mine.length < 4} onClick={() => (setErr(null), setStage('new'))} className="inline-flex h-12 min-w-40 flex-1 cursor-pointer items-center justify-center rounded-xl bg-brand-solid px-6 text-md font-semibold text-on-fill disabled:opacity-50 sm:flex-none" data-testid="reset-mine-next">
              Continue
            </button>
          }
        >
          <TextField label={`Your PIN (${supervisor.name})`} type="password" inputMode="numeric" autoComplete="current-password" value={mine} onChange={(v) => setMine(v.replace(/\D/g, '').slice(0, 8))} autoFocus testId="supervisor-pin" />
          {err ? (
            <p className="mt-3 text-sm text-error-primary" role="alert">
              {err}
            </p>
          ) : null}
        </StepFrame>
      </Overlay>
    );
  if (stage === 'new')
    return (
      <Overlay label="New PIN">
        <ChoosePin
          title={`${target.name.split(' ')[0]} chooses a new PIN`}
          lede={`Hand the device to ${target.name.split(' ')[0]}.`}
          onBack={() => setStage('mine')}
          onDone={async (pin) => {
            const r = await resetPinBySupervisor(supervisor.id, mine, target.id, pin);
            if (!r.ok) {
              setErr(r.message ?? 'Your PIN was not accepted.');
              setMine('');
              setStage('mine');
            } else {
              setCode(r.recoveryCode ?? '');
              setStage('code');
            }
          }}
        />
      </Overlay>
    );
  return (
    <Overlay label="Recovery code">
      <StepFrame title="PIN reset" lede={`Give ${target.name.split(' ')[0]} her new recovery code.`} icon={CheckCircle}>
        {code ? <RecoveryCodeCard name={target.name} code={code} onDone={onClose} doneLabel="Done" /> : null}
      </StepFrame>
    </Overlay>
  );
}

// ---------------------------------------------------------------------------
// Appearance
// ---------------------------------------------------------------------------

export function AppearanceSection() {
  const [p, set] = usePrefs();
  return (
    <div className="grid gap-6" data-testid="appearance-section">
      <SectionHeader title="Appearance" lede="Changes apply at once and are kept on this device." icon={Contrast01} />
      <Group title="Theme">
        <Row label="Colours" hint="Automatic follows this device." icon={Contrast01} stack>
          <ThemeSegmented className="w-full sm:w-auto" />
        </Row>
      </Group>
      <Group title="Reading" note="Larger text helps in bright sun and for tired eyes.">
        <Row label="Text size" icon={Type01} stack>
          <Segmented
            label="Text size"
            wrap
            testId="text-size"
            value={p.textSize}
            onChange={(v) => set({ textSize: v })}
            options={[
              { id: 'small', label: 'Small' },
              { id: 'default', label: 'Standard' },
              { id: 'large', label: 'Large' },
              { id: 'largest', label: 'Largest' },
            ]}
          />
        </Row>
        <Row label="Motion" hint="Reduce turns off slides and fades." icon={RefreshCw01} stack>
          <Segmented
            label="Motion"
            testId="motion"
            value={p.motion}
            onChange={(v) => set({ motion: v })}
            options={[
              { id: 'system', label: 'Automatic' },
              { id: 'reduce', label: 'Reduce' },
              { id: 'full', label: 'Full' },
            ]}
          />
        </Row>
        <Row label="Density" hint="Compact fits more rows on a screen." icon={Rows03} stack>
          <Segmented
            label="Density"
            testId="density"
            value={p.density}
            onChange={(v) => set({ density: v })}
            options={[
              { id: 'comfortable', label: 'Comfortable' },
              { id: 'compact', label: 'Compact' },
            ]}
          />
        </Row>
      </Group>
      <div className="rounded-2xl bg-secondary p-5 ring-1 ring-secondary ring-inset" aria-label="Preview">
        <p className="text-xs font-semibold tracking-wide text-tertiary uppercase">Preview</p>
        <p className="mt-2 text-lg font-semibold text-primary">Adaeze Okafor, 34 weeks</p>
        <p className="text-md text-tertiary">Blood pressure check due on Thursday.</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Language and region

const CURRENCY: Record<string, { code: string; example: number }> = {
  NG: { code: 'NGN', example: 2.15 },
  KE: { code: 'KES', example: 0.52 },
  GH: { code: 'GHS', example: 0.05 },
  ZA: { code: 'ZAR', example: 0.3 },
};

/** Her country's currency for the money example (src/geo knows every country's currency). */
function currencyOf(country: string): { code: string; example: number } {
  const known = CURRENCY[country];
  if (known) return known;
  const fromGeo = countryCurrency(country);
  return { code: fromGeo ?? 'USD', example: 1 };
}
// ---------------------------------------------------------------------------

function setPlan(mut: (plan: NonNullable<ReturnType<typeof setupStore.get>>) => NonNullable<ReturnType<typeof setupStore.get>>) {
  const cur = setupStore.get();
  if (cur) setupStore.set(mut(cur));
}

export function LanguageRegionSection() {
  const saved = useSetup();
  const toast = useToast();
  const wl = useWorkerLang();
  const [p, set] = usePrefs();
  useSyncExternalStore(packStore.subscribe, packStore.getVersion, packStore.getVersion);
  const answers = (saved?.answers ?? {}) as { countryCode?: string; region?: string; district?: string };
  const country = answers.countryCode ?? (saved?.plan.country !== 'other' ? saved?.plan.country : undefined) ?? 'NG';
  const region = saved?.plan.region || answers.region || '';
  const district = saved?.plan.district || answers.district || '';
  const place = { country, region, district };
  const [sheet, setSheet] = useState<null | 'worker' | 'mother' | 'country' | 'region' | 'district'>(null);
  const words = regionWords(country);
  const regions = useMemo(() => listRegionsFor(country), [country]);
  const districts = useDistricts(country, region);
  const installed = installedLanguages();
  const local = languagesFor(place);
  const motherDefault = p.motherLanguage || local[0]?.code || 'en';
  const currency = currencyOf(country);

  const setWorkerLang = async (code: string) => {
    if (!isPackCode(code)) return toast('That language is coming soon. Gaskin stays in English for now.');
    if (!installed.includes(code)) await installPack(code, { durationMs: 400 }).catch(() => undefined);
    setPlan((c) => ({ ...c, plan: { ...c.plan, languages: { ...c.plan.languages, ui: code as never, worker: code as never } }, answers: { ...c.answers, workerLanguage: code as never } }));
    toast(`Gaskin is now in ${languageName(code)}.`);
  };
  const setPlace = (patch: { country?: string; region?: string; district?: string }) => {
    setPlan((c) => {
      const nextCountry = patch.country ?? (c.answers as { countryCode?: string }).countryCode ?? c.plan.country;
      const launch = isLaunch(nextCountry);
      return {
        ...c,
        plan: {
          ...c.plan,
          country: launch ? nextCountry : 'other',
          countryName: countryName(nextCountry),
          region: patch.country ? (patch.region ?? '') : (patch.region ?? c.plan.region),
          district: patch.country || patch.region !== undefined ? patch.district : (patch.district ?? c.plan.district),
        },
        answers: { ...c.answers, countryCode: nextCountry, country: launch ? nextCountry : 'other', region: patch.country ? (patch.region ?? '') : (patch.region ?? c.answers.region), district: patch.district } as never,
      };
    });
  };
  const dateFormats: Array<{ id: DateFormat; label: string }> = (['d_mon_yyyy', 'dd_mm_yyyy', 'mm_dd_yyyy', 'yyyy_mm_dd'] as DateFormat[]).map((id) => ({ id, label: formatDatePref('2026-11-09', id) }));

  return (
    <div className="grid gap-6" data-testid="language-section">
      <SectionHeader title="Language and region" lede="Your language runs every screen. Each mother keeps her own language for what she sees and hears." icon={Translate01} />
      {!saved ? <Callout tone="warning">Run setup first to choose your place and languages.</Callout> : null}
      <Group title="Languages">
        <Row label="My language" hint={`${languageName(wl, true)}${wl !== 'en' ? ' (draft: lines not yet translated show in English)' : ''}`} icon={Translate01} onPress={() => setSheet('worker')} testId="worker-language" />
        <Row label="Default for new mothers" hint={`${languageName(motherDefault, true)}. You can change it on each mother’s record.`} icon={Globe02} onPress={() => setSheet('mother')} testId="mother-language" />
      </Group>
      <Group title="Place" note="Plans use the foods, hospitals and malaria advice for this place.">
        <Row label="Country" hint={`${flagOf(country)} ${countryName(country)}`} icon={Globe02} onPress={() => setSheet('country')} testId="set-country" />
        <Row label={words.region} hint={region || 'Not set'} icon={MarkerPin02} onPress={() => (regions.length ? setSheet('region') : setSheet('region'))} testId="set-region" />
        <Row label={words.district} hint={district || 'Not set'} icon={MarkerPin02} onPress={() => setSheet('district')} testId="set-district" />
      </Group>
      <Group title="Formats">
        <Row label="Dates" icon={Calendar} stack>
          <SelectInline label="Date format" value={p.dateFormat} options={dateFormats} onChange={(v) => set({ dateFormat: v })} testId="date-format" />
        </Row>
        <Row label="Weight" hint={`Example: ${formatWeight(3.2, p.weight)}`} icon={Scales02}>
          <Segmented label="Weight" value={p.weight} onChange={(v) => set({ weight: v })} options={[{ id: 'kg', label: 'kg' }, { id: 'lb', label: 'lb' }]} testId="weight-unit" />
        </Row>
        <Row label="Temperature" hint={`Example: ${formatTemperature(38.2, p.temperature)}`} icon={Thermometer01}>
          <Segmented label="Temperature" value={p.temperature} onChange={(v) => set({ temperature: v })} options={[{ id: 'c', label: '°C' }, { id: 'f', label: '°F' }]} testId="temp-unit" />
        </Row>
        <Row label="Money" hint={`Example: ${formatMoney(currency.example, currency.code, 0.0016, p.currency)}`} icon={Coins03} stack>
          <Segmented
            label="Money"
            wrap
            value={p.currency}
            onChange={(v) => set({ currency: v })}
            options={[
              { id: 'local', label: 'Local' },
              { id: 'local_and_usd', label: 'Local and US$' },
              { id: 'usd', label: 'US$' },
            ]}
            testId="currency"
          />
        </Row>
      </Group>

      <SearchSheet
        open={sheet === 'worker'}
        onClose={() => setSheet(null)}
        title="My language"
        items={languageItems(place, { packOnly: true })}
        selected={[wl]}
        placeholder="Search by name, in any language"
        onPick={(id) => {
          setSheet(null);
          void setWorkerLang(id);
        }}
        testId="worker-language-sheet"
      />
      <SearchSheet
        open={sheet === 'mother'}
        onClose={() => setSheet(null)}
        title="Default language for new mothers"
        items={languageItems(place)}
        selected={[motherDefault]}
        placeholder="Search by name, in any language"
        onPick={(id) => {
          set({ motherLanguage: id });
          setPlan((c) => ({ ...c, plan: { ...c.plan, languages: { ...c.plan.languages, mothers: [id, ...c.plan.languages.mothers.filter((x) => x !== id)] as never } } }));
          setSheet(null);
          toast(`New mothers start in ${languageName(id)}.`);
        }}
      />
      <SearchSheet
        open={sheet === 'country'}
        onClose={() => setSheet(null)}
        title="Country"
        items={listCountries().map((c) => ({ id: c.code, label: c.name, glyph: flagOf(c.code), group: c.launch ? 'Where Gaskin has local data' : 'All countries' }))}
        selected={[country]}
        placeholder="Type a country"
        onPick={(id) => {
          setSheet(null);
          if (id !== country) {
            setPlace({ country: id, region: '', district: undefined });
            toast(`Place set to ${countryName(id)}. Choose the ${regionWords(id).region.toLowerCase()} next.`);
          }
        }}
      />
      <SearchSheet
        open={sheet === 'region'}
        onClose={() => setSheet(null)}
        title={words.region}
        items={regions.map((r) => ({ id: r, label: r }))}
        selected={region ? [region] : []}
        placeholder={regions.length ? 'Type to search' : 'Type its name'}
        allowFree={(t) => (setPlace({ region: t, district: undefined }), setSheet(null))}
        onPick={(id) => (setPlace({ region: id, district: undefined }), setSheet(null))}
      />
      <SearchSheet
        open={sheet === 'district'}
        onClose={() => setSheet(null)}
        title={words.district}
        items={districts.map((r) => ({ id: r, label: r }))}
        selected={district ? [district] : []}
        placeholder={districts.length ? 'Type to search' : 'Type its name'}
        allowFree={(t) => (setPlace({ district: t }), setSheet(null))}
        onPick={(id) => (setPlace({ district: id }), setSheet(null))}
      />
    </div>
  );
}

export { Lock01 };
