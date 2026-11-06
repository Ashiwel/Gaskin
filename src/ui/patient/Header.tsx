/**
 * The patient header: who she is (avatar, name, age, Gaskin ID), how to reach her (language with
 * pack status, phone access, consent), where she is in the first 1,000 days (every child and any
 * pregnancy on one track), her risks as chips, and the primary actions.
 */
import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle, ClipboardCheck as ClipboardIcon, Copy01, Plus as PlusIcon, DotsHorizontal, File06, Lock01, MessageChatCircle, Phone01, PhoneCall01, Printer, ShieldTick, Translate01, Users01 } from '@untitledui/icons';
import type { CarePlan, LanguageCode, Mother } from '../../types';
import { Avatar } from '../../components/base/avatar/avatar';
import { Button } from '../../components/base/buttons/button';
import { Dropdown } from '../../components/base/dropdown/dropdown';
import { COUNTRIES, LANGUAGE_NAMES } from '../../data';
import { installPack, installProgress, isInstalled, isPackCode, summarisePack } from '../../i18n';
import { usePackVersion } from '../../i18n/components/hooks';
import { useApp } from '../../store';
import { cx } from '../../utils/cx';
import { fmtDate, gaskinId, initials, PHONE_ACCESS_LABELS, place } from '../format';
import { buildLanes, JourneyTrack } from './Journey';
import { Chip, type ChipTone, type IconType } from './ui';
import { childrenOf } from './adapters';

const SEVERITY_TONE: Record<string, ChipTone> = { urgent: 'error', high: 'error', moderate: 'warning', low: 'gray' };

/** Pack state in plain words: Reviewed, Draft, Coming soon, Not downloaded. */
export function packState(code: LanguageCode): { word: string; tone: ChipTone; download?: boolean } {
  if (code === 'en') return { word: 'Ready', tone: 'success' };
  if (!isPackCode(code)) return { word: 'Coming soon', tone: 'gray' };
  const s = summarisePack(code);
  if (s.status === 'none') return { word: 'Coming soon', tone: 'gray' };
  if (installProgress(code) !== undefined) return { word: 'Downloading…', tone: 'brand' };
  if (!s.installed) return { word: 'Download', tone: 'brand', download: true };
  return s.status === 'reviewed' ? { word: 'Ready', tone: 'success' } : { word: 'Draft', tone: 'warning' };
}

/**
 * Her pack is bundled in the demo, so it is installed as soon as her record opens (the same as at
 * registration). A pack that is genuinely missing stays a one-tap Download.
 */
export function useHerPack(code: LanguageCode) {
  usePackVersion();
  useEffect(() => {
    if (code === 'en' || !isPackCode(code)) return;
    try {
      if (!isInstalled(code) && summarisePack(code).status !== 'none') void installPack(code, { durationMs: 0 }).catch(() => undefined);
    } catch {
      /* stays a Download button */
    }
  }, [code]);
}

export function PatientHeader({
  mother,
  plan,
  canVisit,
  canMessage,
  onStartVisit,
  onMessage,
  onShowToMother,
  onHandout,
  onRecord,
  onPhone,
  canEdit,
}: {
  mother: Mother;
  plan: CarePlan;
  canVisit: boolean;
  canMessage: boolean;
  canEdit: boolean;
  onStartVisit: () => void;
  onMessage: () => void;
  onShowToMother?: () => void;
  onHandout: () => void;
  onRecord: () => void;
  onPhone: () => void;
}) {
  const { state, dispatch } = useApp();
  const s = plan.state;
  const facility = state.facilities.find((f) => f.id === mother.facilityId);
  const kids = childrenOf(mother, plan, state.clock);
  const lanes = buildLanes(mother, state.clock.slice(0, 10), s.stage === 'pregnancy' ? s.edd : undefined, s.stage === 'pregnancy' ? mother.pregnancy?.lmp : undefined);
  const consentOk = mother.consent.dataProcessing && mother.consent.messaging;
  useHerPack(mother.language);
  const pack = packState(mother.language);
  const risks = [...s.risks].sort((a, b) => ['urgent', 'high', 'moderate', 'low'].indexOf(a.severity) - ['urgent', 'high', 'moderate', 'low'].indexOf(b.severity));
  const [copied, setCopied] = useState(false);
  const gid = gaskinId(mother);
  const where = s.stage === 'pregnancy' ? `${s.gestationalWeeks ?? '?'} weeks pregnant${s.edd ? `, due ${fmtDate(s.edd)}` : ''}` : s.stage === 'preconception' ? 'Planning a pregnancy' : s.stage === 'postpartum' ? `Day ${s.daysPostpartum ?? 0} after birth` : 'Caring for a young child';
  const langOptions = Array.from(new Set<LanguageCode>([mother.language, ...(COUNTRIES[mother.country]?.languages ?? []), 'en']));

  return (
    <header className="patient-head grid grid-cols-1 gap-6" data-testid="patient-head">
      <div className="flex flex-wrap items-start gap-4">
        <Avatar size="xl" initials={initials(mother.name)} alt={mother.name} className="shrink-0" />
        <div className="min-w-0 flex-1">
          <h1 className="text-display-xs font-semibold text-primary lg:text-display-sm">{mother.name}</h1>
          <p className="mt-1 text-md text-tertiary">
            {mother.age} years · {where}
            {kids.length ? ` · ${kids.length} ${kids.length === 1 ? 'child' : 'children'} under 2` : ''}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-secondary">
            <button
              type="button"
              className="inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-md font-mono text-sm text-secondary outline-focus-ring hover:text-primary focus-visible:outline-2"
              title="Stays the same if she changes SIM or phone number"
              onClick={() => {
                try {
                  void navigator.clipboard?.writeText(gid);
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 1500);
                } catch {
                  /* clipboard blocked */
                }
              }}
              aria-label={`Gaskin ID ${gid}. Copy`}
            >
              {gid}
              {copied ? <CheckCircle className="size-3.5 text-fg-success-primary" aria-hidden="true" /> : <Copy01 className="size-3.5 text-fg-quaternary" aria-hidden="true" />}
            </button>
            <Meta icon={Translate01}>
              <label className="inline-flex items-center gap-1.5">
                <span className="sr-only">Her language, for messages, handouts and Show to mother</span>
                <select
                  id="mother-lang"
                  className="cursor-pointer rounded-md bg-transparent font-semibold text-primary outline-focus-ring focus-visible:outline-2 disabled:cursor-default"
                  value={mother.language}
                  disabled={!canEdit}
                  onChange={(e) => dispatch({ type: 'updateMother', mother: { ...mother, language: e.target.value as LanguageCode }, cause: 'Her language changed' })}
                  aria-label="Her language, for messages, handouts and Show to mother"
                >
                  {langOptions.map((l) => (
                    <option key={l} value={l}>
                      {LANGUAGE_NAMES[l] ?? l}
                    </option>
                  ))}
                </select>
              </label>
              {pack.download && isPackCode(mother.language) ? (
                <button type="button" onClick={() => void installPack(mother.language as never).catch(() => undefined)} className="inline-flex min-h-8 cursor-pointer items-center rounded-full bg-brand-solid px-2.5 text-xs font-semibold text-on-fill hover:bg-brand-solid_hover" data-testid="pack-download">
                  Download
                </button>
              ) : (
                <Chip tone={pack.tone}>{pack.word}</Chip>
              )}
            </Meta>
            <Meta icon={mother.phone.access === 'none' ? Users01 : Phone01}>
              {PHONE_ACCESS_LABELS[mother.phone.access]}
              {mother.phone.hasWhatsApp ? ', chat app' : ''}
            </Meta>
            <Meta icon={consentOk ? ShieldTick : Lock01} tone={consentOk ? 'success' : 'warning'}>
              {consentOk ? 'Consent given' : mother.consent.dataProcessing ? 'Records only, no messages' : 'Consent not recorded'}
              {mother.consent.guardianInvolved ? ', guardian involved' : ''}
            </Meta>
            <span className="hidden text-tertiary sm:inline">{facility ? `${facility.name} · ` : ''}{place(mother)}</span>
          </div>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:justify-end">
          {canVisit ? (
            <Button size="lg" color="primary" onClick={onStartVisit} data-testid="start-visit" className="flex-1 sm:flex-none" iconLeading={ClipboardIcon}>
              Start visit
            </Button>
          ) : null}
          {canMessage ? (
            <Button size="lg" color="secondary" onClick={onMessage} iconLeading={MessageChatCircle} className="flex-1 sm:flex-none">
              Message
            </Button>
          ) : null}
          {onShowToMother ? (
            <Button size="lg" color="secondary" onClick={onShowToMother} iconLeading={File06} className="hidden sm:inline-flex" data-testid="header-show-to-mother">
              Show to mother
            </Button>
          ) : null}
          <Dropdown.Root>
            <Button size="lg" color="secondary" iconLeading={DotsHorizontal} aria-label="More actions" />
            <Dropdown.Popover placement="bottom end">
              <Dropdown.Menu
                onAction={(k) => {
                  if (k === 'record') onRecord();
                  if (k === 'handout') onHandout();
                  if (k === 'show') onShowToMother?.();
                  if (k === 'phone') onPhone();
                }}
              >
                {canVisit ? <Dropdown.Item id="record" label="Record new information" icon={PlusIcon} /> : null}
                {onShowToMother ? <Dropdown.Item id="show" label="Show to mother" icon={File06} /> : null}
                <Dropdown.Item id="handout" label="Printable handout" icon={Printer} />
                <Dropdown.Item id="phone" label="See her phone" icon={PhoneCall01} />
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown.Root>
        </div>
      </div>

      <section aria-label="First 1,000 days" className="rounded-2xl bg-primary p-4 ring-1 ring-secondary ring-inset sm:p-5">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold text-primary">First 1,000 days</h2>
          {plan.nextContact ? (
            <p className="text-sm text-tertiary">
              Next: <span className="font-medium text-secondary">{plan.nextContact.label}</span>, {fmtDate(plan.nextContact.date, { weekday: true })}
            </p>
          ) : null}
        </div>
        {lanes.length ? (
          <JourneyTrack lanes={lanes} today={state.clock.slice(0, 10)} motherName={mother.name} />
        ) : (
          <p className="text-sm text-tertiary">Her journey starts at conception. Record a pregnancy to see her contacts here.</p>
        )}
      </section>

      {risks.length || plan.alerts.length ? (
        <ul aria-label="Risks" className="-mt-2 flex flex-wrap gap-1.5">
          {plan.alerts.length ? (
            <li>
              <Chip tone="error" icon={AlertTriangle}>
                {plan.alerts.length} {plan.alerts.length === 1 ? 'alert' : 'alerts'}
              </Chip>
            </li>
          ) : null}
          {risks.slice(0, 8).map((r) => (
            <li key={r.code}>
              <Chip tone={SEVERITY_TONE[r.severity] ?? 'gray'} dot title={r.reason}>
                {r.label}
              </Chip>
            </li>
          ))}
          {risks.length > 8 ? (
            <li>
              <Chip>+{risks.length - 8} more</Chip>
            </li>
          ) : null}
        </ul>
      ) : null}
    </header>
  );
}

function Meta({ icon: Icon, children, tone }: { icon: IconType; children: React.ReactNode; tone?: 'success' | 'warning' }) {
  return (
    <span className={cx('inline-flex min-h-8 items-center gap-1.5', tone === 'success' ? 'text-success-primary' : tone === 'warning' ? 'text-warning-primary' : undefined)}>
      <Icon aria-hidden="true" className={cx('size-4 shrink-0', tone ? 'text-current' : 'text-fg-quaternary')} />
      {children}
    </span>
  );
}
