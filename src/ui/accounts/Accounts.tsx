/**
 * Worker accounts on a shared device:
 *  - NewWorkerFlow: the first worker after setup (and "Add a worker"): name, role, PIN, then the
 *    one-time recovery code.
 *  - RecoveryCodeCard: the code, shown once, with copy, download and a printable card.
 *  - LockScreen: the shell's PinLock wired to src/auth, with attempts left, a countdown when
 *    locked, and "Forgot PIN?" (use the recovery code, or ask a supervisor).
 *  - ProfilePicker: who is using Gaskin now (after log out).
 *  - AccountGate: shows the right one of these over the app, keeps the acting worker in step,
 *    and auto-locks after the time in Settings.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Copy01, Download01, HeartHand, Key01, Lock01, Printer, ShieldTick, UserPlus01, Users03, UsersRight } from '@untitledui/icons';
import { Avatar } from '../../components/base/avatar/avatar';
import { PinLock, initials } from '../../components/shell';
import { useApp } from '../../store';
import { useSetup } from '../../setup';
import { saveFile } from '../HandoutSheet';
import { personalMother, type PersonalAnswers } from './personalRecord';
import { Choice, ChoiceList, PrimaryButton, SecondaryButton, StepFrame, TextField, type IconType } from '../onboarding/kit';
import {
  DEMO_PIN,
  ROLE_HINT,
  ROLE_LABEL,
  createProfile,
  isDemoProfile,
  lockNow,
  logOut,
  pinLengthOf,
  pinProblem,
  requestSwitch,
  resetPinWithRecoveryCode,
  signInAfterRecovery,
  roleLabel,
  switchTarget,
  unlockStatus,
  updateProfile,
  useAccounts,
  useAutoLock,
  verifyPin,
  waitWords,
  type Profile,
  type RoleChoice,
} from './auth';
import { cx } from '../../utils/cx';

// ---------------------------------------------------------------------------
// Recovery code
// ---------------------------------------------------------------------------

function cardHtml(name: string, code: string): string {
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
  const made = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><title>Gaskin recovery code</title>
<style>body{font-family:Inter,system-ui,sans-serif;margin:40px}div{border:2px dashed;border-radius:16px;padding:24px;max-width:440px}h1{font-size:18px;margin:0 0 8px}p{margin:6px 0;font-size:14px}code{display:block;font-size:26px;letter-spacing:2px;margin:16px 0;font-weight:700}</style></head>
<body onload="window.print()"><div><h1>Gaskin recovery code for ${esc(name)}</h1><code>${esc(code)}</code>
<p>Use it once to set a new PIN if you forget yours. You will then get a new code.</p><p>Keep this card somewhere safe and private. Anyone with it can open Gaskin as you.</p>
<p>Made on ${made}.</p></div></body></html>`;
}

export function RecoveryCodeCard({ name, code, onDone, doneLabel = 'Continue' }: { name: string; code: string; onDone: () => void; doneLabel?: string }) {
  const [copied, setCopied] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const download = () => void saveFile('gaskin-recovery-code.html', cardHtml(name, code), 'text/html');
  const print = () => {
    try {
      const url = URL.createObjectURL(new Blob([cardHtml(name, code)], { type: 'text/html' }));
      const w = window.open(url, '_blank');
      if (!w) download();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      download();
    }
  };
  return (
    <div className="grid gap-5" data-testid="recovery-code">
      <div className="rounded-2xl border-2 border-dashed border-brand bg-brand-primary p-6 text-center">
        <p className="text-sm font-medium text-brand-secondary">Recovery code for {name}</p>
        <p className="mt-3 font-mono text-xl font-semibold tracking-wider break-all text-primary select-all sm:text-display-xs" data-testid="recovery-code-text">
          {code}
        </p>
        <p className="mt-3 text-sm text-tertiary">Shown only this once.</p>
      </div>
      <ul className="grid gap-3 text-md text-secondary">
        <li className="flex gap-3">
          <Key01 aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-fg-brand-primary" />
          <span>If the PIN is forgotten, this code sets a new one. It works once, then a new code is given.</span>
        </li>
        <li className="flex gap-3">
          <Lock01 aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-fg-brand-primary" />
          <span>Write it on paper and keep it somewhere private, away from the phone.</span>
        </li>
      </ul>
      <div className="flex flex-wrap gap-3">
        <SecondaryButton icon={Copy01} onPress={() => void navigator.clipboard?.writeText(code).then(() => setCopied(true), () => undefined)}>
          {copied ? 'Copied' : 'Copy'}
        </SecondaryButton>
        <SecondaryButton icon={Printer} onPress={print}>
          Print a card
        </SecondaryButton>
        <SecondaryButton icon={Download01} onPress={download}>
          Download
        </SecondaryButton>
      </div>
      <Choice multi size="md" label="I have written down the recovery code" selected={confirmed} onPress={() => setConfirmed((c) => !c)} testId="recovery-confirm" />
      <div className="flex">
        <PrimaryButton onPress={onDone} disabled={!confirmed} testId="recovery-done">
          {doneLabel}
        </PrimaryButton>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Choosing a PIN
// ---------------------------------------------------------------------------

function PinPad({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col items-center">
      <div className="flex h-4 gap-3" role="status" aria-label={`${value.length} digits entered`}>
        {Array.from({ length: Math.max(4, value.length) }, (_, i) => (
          <span key={i} className={cx('size-4 rounded-full transition duration-100', i < value.length ? 'bg-fg-primary' : 'ring-1 ring-primary ring-inset')} />
        ))}
      </div>
      <div className="mt-6 grid grid-cols-3 gap-3">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'].map((k, i) =>
          k === '' ? (
            <span key={i} />
          ) : (
            <button
              key={k}
              type="button"
              data-key={k}
              aria-label={k === 'del' ? 'Delete last digit' : k}
              onClick={() => onChange(k === 'del' ? value.slice(0, -1) : (value + k).slice(0, 8))}
              className={cx(
                'grid size-16 cursor-pointer place-items-center rounded-full font-medium text-primary outline-focus-ring select-none focus-visible:outline-2',
                k === 'del' ? 'text-sm text-tertiary hover:bg-primary_hover' : 'bg-secondary text-display-xs hover:bg-secondary_hover active:bg-tertiary',
              )}
            >
              {k === 'del' ? 'Delete' : k}
            </button>
          ),
        )}
      </div>
    </div>
  );
}

/** Choose a PIN, then type it again. */
export function ChoosePin({ onDone, title = 'Choose a PIN', lede, onBack, error }: { onDone: (pin: string) => void | Promise<void>; title?: string; lede?: ReactNode; onBack?: () => void; error?: string | null }) {
  const [first, setFirst] = useState('');
  const [second, setSecond] = useState('');
  const [stage, setStage] = useState<'first' | 'second'>('first');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const val = stage === 'first' ? first : second;
  const setVal = stage === 'first' ? setFirst : setSecond;
  useEffect(() => {
    if (error) {
      setErr(error);
      setStage('first');
      setFirst('');
      setSecond('');
    }
  }, [error]);
  const go = async () => {
    if (stage === 'first') {
      const p = pinProblem(first);
      if (p) return setErr(p);
      setErr(null);
      setStage('second');
    } else if (second !== first) {
      setErr('The two PINs are different. Try again.');
      setSecond('');
    } else {
      setBusy(true);
      try {
        await onDone(first);
      } finally {
        setBusy(false);
      }
    }
  };
  return (
    <StepFrame
      title={stage === 'first' ? title : 'Type the PIN again'}
      lede={stage === 'first' ? (lede ?? '4 to 8 digits, not 1234 or 1111. You type it each time you open Gaskin.') : 'To be sure it is right.'}
      icon={Lock01}
      onBack={stage === 'second' ? () => (setStage('first'), setSecond(''), setErr(null)) : onBack}
      testId="choose-pin"
      footer={
        <PrimaryButton disabled={val.length < 4} loading={busy} testId="pin-next" onPress={go}>
          {stage === 'first' ? 'Continue' : 'Save PIN'}
        </PrimaryButton>
      }
    >
      <div
        tabIndex={-1}
        onKeyDown={(e) => {
          if (/^\d$/.test(e.key)) setVal((val + e.key).slice(0, 8));
          else if (e.key === 'Backspace') setVal(val.slice(0, -1));
          else if (e.key === 'Enter' && val.length >= 4) void go();
        }}
        className="outline-hidden"
      >
        <PinPad value={val} onChange={(v) => (setErr(null), setVal(v))} />
        <p className="mt-4 min-h-5 text-center text-sm text-error-primary" role="alert">
          {err}
        </p>
      </div>
    </StepFrame>
  );
}

// ---------------------------------------------------------------------------
// New worker
// ---------------------------------------------------------------------------

const ROLE_ICON: Record<RoleChoice, IconType> = { worker: HeartHand, supervisor: UsersRight, clinical_reviewer: ShieldTick, programme_officer: Users03, personal: HeartHand };

export interface NewWorkerFlowProps {
  first?: boolean;
  roles: RoleChoice[];
  defaultName?: string;
  /** Use this clinical worker id so her caseload follows */
  id?: string;
  cadre?: Profile['cadre'];
  facilityId?: string;
  country?: Profile['country'];
  onDone: (p: Profile) => void;
  onCancel?: () => void;
}

export function NewWorkerFlow({ first, roles, defaultName, id, cadre, facilityId, country, onDone, onCancel }: NewWorkerFlowProps) {
  const [stage, setStage] = useState<'name' | 'role' | 'pin' | 'code'>('name');
  const [name, setName] = useState(defaultName ?? '');
  const [role, setRole] = useState<RoleChoice>(roles[0]);
  const [made, setMade] = useState<{ profile: Profile; code: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const personal = roles.length === 1 && roles[0] === 'personal';
  const firstName = name.trim().split(/\s+/)[0] || 'her';

  if (stage === 'name')
    return (
      <StepFrame
        title={first ? (personal ? 'What should Gaskin call you?' : 'Add yourself as the first worker') : 'Add a worker to this device'}
        lede={first ? (personal ? 'Then choose a PIN, so nobody else can open your notes.' : 'Everyone who shares this device has her own name and PIN, so Gaskin always shows who did what.') : 'She will choose her own PIN next.'}
        icon={UserPlus01}
        onBack={onCancel}
        backLabel="Cancel"
        testId="new-worker-name"
        footer={
          <PrimaryButton disabled={!name.trim()} onPress={() => setStage(roles.length === 1 ? 'pin' : 'role')} testId="worker-name-next">
            Continue
          </PrimaryButton>
        }
      >
        <TextField label={personal ? 'Your name' : 'Full name'} value={name} onChange={setName} autoFocus autoComplete="name" testId="worker-name" maxLength={80} />
      </StepFrame>
    );
  if (stage === 'role')
    return (
      <StepFrame title={first ? 'What is your work?' : `What does ${firstName} do?`} lede="This decides what can be seen and changed." icon={Users03} onBack={() => setStage('name')} testId="new-worker-role">
        <ChoiceList label="Role">
          {roles.map((r) => (
            <Choice key={r} label={ROLE_LABEL[r]} hint={ROLE_HINT[r]} icon={ROLE_ICON[r]} selected={role === r} onPress={() => (setRole(r), setStage('pin'))} testId={`role-${r}`} />
          ))}
        </ChoiceList>
      </StepFrame>
    );
  if (stage === 'pin')
    return (
      <ChoosePin
        title={first ? 'Choose your PIN' : `${firstName} chooses a PIN`}
        lede={first ? undefined : `Hand the device to ${firstName}. 4 to 8 digits, not 1234 or 1111.`}
        onBack={() => setStage(roles.length === 1 ? 'name' : 'role')}
        error={err}
        onDone={async (pin) => {
          setErr(null);
          try {
            const r = await createProfile({ name, role, pin, id, cadre, facilityId, country, signIn: first });
            setMade({ profile: r.profile, code: r.recoveryCode });
            setStage('code');
          } catch (e) {
            setErr((e as Error).message);
          }
        }}
      />
    );
  return (
    <StepFrame title="Write down the recovery code" lede="It is the way back in if the PIN is forgotten." icon={Key01} testId="new-worker-code">
      {made ? <RecoveryCodeCard name={made.profile.name} code={made.code} onDone={() => onDone(made.profile)} doneLabel={first ? 'Open Gaskin' : 'Done'} /> : null}
    </StepFrame>
  );
}

// ---------------------------------------------------------------------------
// Lock screen with "Forgot PIN?"
// ---------------------------------------------------------------------------

export function Overlay({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <div role="dialog" aria-modal="true" aria-label={label} className="fixed inset-0 z-[100] overflow-y-auto bg-primary">
      {children}
    </div>
  );
}

export function LockScreen({ profile, onSwitch, onCancel }: { profile: Profile; onSwitch?: () => void; onCancel?: () => void }) {
  const [mode, setMode] = useState<'pin' | 'forgot' | 'code' | 'newpin' | 'newcode'>('pin');
  const [status, setStatus] = useState(() => unlockStatus(profile.id));
  const [code, setCode] = useState('');
  const [fresh, setFresh] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (!status.locked) return undefined;
    const t = window.setInterval(() => setStatus(unlockStatus(profile.id)), 1000);
    return () => window.clearInterval(t);
  }, [status.locked, profile.id]);

  if (mode === 'forgot')
    return (
      <Overlay label="Forgot PIN">
        <StepFrame title="Forgot your PIN?" lede="There are two ways back in. Your records are safe either way." icon={Key01} onBack={() => setMode('pin')} testId="forgot-pin">
          <ChoiceList label="Forgot PIN">
            <Choice icon={Key01} label="Use my recovery code" hint="The code you wrote down when you chose your PIN." onPress={() => setMode('code')} testId="use-recovery" />
            {!profile.personal ? <Choice icon={UsersRight} label="Ask your supervisor" hint="She opens Settings, then Workers, types her own PIN and sets a new one for you." onPress={() => setMode('pin')} /> : null}
          </ChoiceList>
          {isDemoProfile(profile.id) ? <p className="mt-6 text-sm text-tertiary">This is a demo profile. Its PIN is {DEMO_PIN}.</p> : null}
        </StepFrame>
      </Overlay>
    );
  if (mode === 'code')
    return (
      <Overlay label="Recovery code">
        <StepFrame
          title="Type your recovery code"
          lede="Letters and numbers, as written on your card. Dashes do not matter."
          icon={Key01}
          onBack={() => setMode('forgot')}
          testId="recovery-entry"
          footer={
            <PrimaryButton disabled={code.replace(/[^A-Za-z0-9]/g, '').length < 12} onPress={() => (setErr(null), setMode('newpin'))} testId="recovery-continue">
              Continue
            </PrimaryButton>
          }
        >
          <TextField label="Recovery code" value={code} onChange={(v) => setCode(v.toUpperCase())} placeholder="ABCD-EFGH-JKMN-PQRS" autoFocus autoComplete="off" testId="recovery-input" />
          {err ? (
            <p className="mt-3 text-sm text-error-primary" role="alert">
              {err}
            </p>
          ) : null}
        </StepFrame>
      </Overlay>
    );
  if (mode === 'newpin')
    return (
      <Overlay label="New PIN">
        <ChoosePin
          title="Choose a new PIN"
          onBack={() => setMode('code')}
          onDone={async (pin) => {
            const r = await resetPinWithRecoveryCode(profile.id, code, pin, { signInNow: false });
            if (!r.ok) {
              setErr(r.message ?? 'That code is not right.');
              setMode('code');
            } else {
              setFresh(r.recoveryCode ?? '');
              setMode('newcode');
            }
          }}
        />
      </Overlay>
    );
  if (mode === 'newcode' && fresh)
    return (
      <Overlay label="New recovery code">
        <StepFrame title="Your new recovery code" lede="The old one no longer works." icon={Key01} testId="recovery-new">
          <RecoveryCodeCard name={profile.name} code={fresh} onDone={() => void signInAfterRecovery().then(() => setFresh(null))} doneLabel="Open Gaskin" />
        </StepFrame>
      </Overlay>
    );

  const hint = status.locked
    ? `Locked for now. Try again in ${waitWords(status.secondsLeft)}.`
    : status.attemptsLeft < 5
      ? `${status.attemptsLeft} ${status.attemptsLeft === 1 ? 'try' : 'tries'} left. After that, a ${status.nextLockMinutes}-minute wait.`
      : isDemoProfile(profile.id)
        ? `Demo profile: the PIN is ${DEMO_PIN}.`
        : undefined;
  return (
    <div data-testid="lock-screen" className="fixed inset-0 z-[100]">
      <PinLock
        worker={{ id: profile.id, name: profile.name, role: roleLabel(profile) }}
        length={pinLengthOf(profile.id)}
        lockedForSeconds={status.locked ? status.secondsLeft : 0}
        onSubmit={async (pin) => {
          const r = await verifyPin(profile.id, pin);
          setStatus(r.status);
          return r.ok ? true : (r.message ?? 'That PIN is not right.');
        }}
        onSwitchWorker={onSwitch}
        forgotHint={hint}
      />
      <div className="fixed inset-x-0 bottom-0 z-[101] flex justify-center gap-2 pb-[max(16px,env(safe-area-inset-bottom))]">
        <button type="button" onClick={() => setMode('forgot')} className="h-11 cursor-pointer rounded-lg px-4 text-sm font-semibold text-brand-secondary outline-focus-ring hover:bg-primary_hover focus-visible:outline-2" data-testid="forgot-pin-link">
          Forgot PIN?
        </button>
        {onCancel ? (
          <button type="button" onClick={onCancel} className="h-11 cursor-pointer rounded-lg px-4 text-sm font-semibold text-tertiary outline-focus-ring hover:bg-primary_hover focus-visible:outline-2" data-testid="lock-cancel">
            Cancel
          </button>
        ) : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Profile picker
// ---------------------------------------------------------------------------

export function ProfilePicker({ onPick, onAdd, title = 'Who is using Gaskin?', onBack }: { onPick: (p: Profile) => void; onAdd?: () => void; title?: string; onBack?: () => void }) {
  const { profiles } = useAccounts();
  return (
    <Overlay label={title}>
      <StepFrame title={title} lede="Choose your name, then type your PIN." icon={Users03} onBack={onBack} backLabel="Cancel" testId="profile-picker">
        <ul className="grid gap-3 sm:grid-cols-2">
          {profiles.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onPick(p)}
                data-profile={p.id}
                className="flex min-h-20 w-full cursor-pointer items-center gap-4 rounded-2xl bg-primary p-4 text-left ring-1 ring-secondary outline-focus-ring ring-inset hover:bg-primary_hover focus-visible:outline-2"
              >
                <Avatar size="lg" initials={initials(p.name)} alt="" />
                <span className="min-w-0">
                  <span className="block truncate text-lg font-semibold text-primary">{p.name}</span>
                  <span className="block text-sm text-tertiary">{roleLabel(p)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        {onAdd ? (
          <div className="mt-6 flex">
            <SecondaryButton icon={UserPlus01} onPress={onAdd}>
              Add a worker
            </SecondaryButton>
          </div>
        ) : null}
      </StepFrame>
    </Overlay>
  );
}

// ---------------------------------------------------------------------------
// The gate
// ---------------------------------------------------------------------------

const addListeners = new Set<() => void>();
/** Open "Add a worker" over the app (worker menu, Settings > Workers). */
export function openAddWorker(): void {
  for (const l of addListeners) l();
}

function firstRoles(audience?: string, role?: string): RoleChoice[] {
  if (audience === 'personal' || role === 'personal') return ['personal'];
  if (audience === 'supervisor' || role === 'supervisor') return ['supervisor', 'programme_officer'];
  return ['worker', 'supervisor', 'clinical_reviewer'];
}

/**
 * Over the app: the first worker after setup, the profile picker after log out, her PIN screen
 * after a lock or time-out, and a colleague's PIN screen when switching worker.
 */
export function AccountGate({ children }: { children: ReactNode }) {
  const { state, dispatch } = useApp();
  const saved = useSetup();
  const { ready, profiles, current, lockedProfile } = useAccounts();
  const [picked, setPicked] = useState<Profile | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  // The first worker's flow stays up until she has seen her recovery code, even after sign-in.
  const [firstRun, setFirstRun] = useState(false);
  const switchTo = switchTarget();
  useAutoLock();
  useEffect(() => {
    const l = () => setAdding(true);
    addListeners.add(l);
    return () => void addListeners.delete(l);
  }, []);
  const answers = (saved?.answers ?? {}) as { audience?: string; role?: string };
  const seed = state.workers.find((w) => w.id === state.currentWorkerId) ?? state.workers[0];

  // The acting worker in the records follows the signed-in profile.
  useEffect(() => {
    if (current && current.id !== state.currentWorkerId && state.workers.some((w) => w.id === current.id)) dispatch({ type: 'setWorker', workerId: current.id });
  }, [current, state.currentWorkerId, state.workers, dispatch]);

  const roles = firstRoles(answers.audience, answers.role);
  const facilityId = current?.facilityId ?? seed?.facilityId;
  // A colleague at the same facility who has no profile yet: a new worker on the device acts as her.
  const unused = useMemo(() => state.workers.find((w) => w.facilityId === facilityId && !profiles.some((p) => p.id === w.id)), [state.workers, facilityId, profiles]);

  if (!saved) return <>{children}</>;
  // Never show records before we know who is signed in.
  if (!ready) return <div className="min-h-dvh bg-primary" aria-busy="true" />;

  if (!profiles.length || firstRun) {
    if (!firstRun) queueMicrotask(() => setFirstRun(true));
    return (
      <Overlay label="First worker">
        <NewWorkerFlow
          first
          roles={roles}
          id={roles[0] === 'personal' ? undefined : seed?.id}
          cadre={roles[0] === 'personal' ? 'self' : seed?.role}
          facilityId={seed?.facilityId}
          country={seed?.country}
          onDone={(p) => {
            // A woman using Gaskin for herself gets her own record, linked to her profile.
            if (p.personal) {
              const me = personalMother(p.id, p.name, (saved?.answers ?? {}) as PersonalAnswers, state.clock);
              if (me && !state.mothers.some((m) => m.id === me.id)) {
                dispatch({ type: 'register', mother: me });
                void updateProfile(p.id, { caseloadMotherIds: [me.id] });
              }
            }
            setFirstRun(false);
          }}
        />
      </Overlay>
    );
  }

  if (adding) {
    return (
      <Overlay label="Add a worker">
        <NewWorkerFlow
          roles={['worker', 'supervisor', 'clinical_reviewer', 'programme_officer']}
          defaultName={unused?.name}
          id={unused?.id}
          cadre={unused?.role}
          facilityId={facilityId}
          country={current?.country}
          onCancel={() => setAdding(false)}
          onDone={() => setAdding(false)}
        />
      </Overlay>
    );
  }

  if (current && switchTo && switchTo.id !== current.id) {
    return (
      <>
        {children}
        <Overlay label="Switch worker">
          <LockScreen key={switchTo.id} profile={switchTo} onSwitch={() => requestSwitch(null)} onCancel={() => requestSwitch(null)} />
        </Overlay>
      </>
    );
  }

  if (!current) {
    const who = picked ?? lockedProfile;
    if (pickerOpen || !who)
      return (
        <ProfilePicker
          title={who ? 'Switch worker' : 'Who is using Gaskin?'}
          onBack={who ? () => setPickerOpen(false) : undefined}
          onPick={(p) => {
            setPicked(p);
            setPickerOpen(false);
          }}
        />
      );
    return <LockScreen key={who.id} profile={who} onSwitch={profiles.length > 1 ? () => setPickerOpen(true) : undefined} />;
  }

  return <>{children}</>;
}

/** The worker-menu callbacks for AppShell. */
export function useWorkerMenuActions() {
  const { profiles, current } = useAccounts();
  return {
    others: profiles.filter((p) => p.id !== current?.id).map((p) => ({ id: p.id, name: p.name, subtitle: roleLabel(p) })),
    onSwitch: (id: string) => requestSwitch(id),
    onAddWorker: current && !current.personal && (current.role === 'supervisor' || current.isSupervisor || current.role === 'admin') ? openAddWorker : undefined,
    onLock: current ? () => lockNow() : undefined,
    onLogOut: current ? () => logOut() : undefined,
  };
}

/** The signed-in profile for the shell's worker card. */
export function useShellWorker(fallback?: { id: string; name: string; role?: string; subtitle?: string }) {
  const { current } = useAccounts();
  if (!current) return fallback;
  return { id: current.id, name: current.name, role: roleLabel(current), subtitle: fallback?.subtitle };
}
