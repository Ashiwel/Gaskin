/**
 * Her side of the screen: the inline mother line on plan cards, the language switcher used by
 * "Tell the mother" and the Next steps page, and Show to mother as a full-screen flip card (the
 * worker's side first, then hers in large type with the pictogram).
 */
import { useEffect, useRef, useState } from 'react';
import { FlipBackward, Translate01, XClose } from '@untitledui/icons';
import type { Alert, LanguageCode, Mother, PlanItem } from '../../types';
import { ConfidenceBadge, DualLanguageView, getPack, installPack, isInstalled, renderForBoth, t as packT, type PackCode } from '../../i18n';
import { usePackVersion } from '../../i18n/components/hooks';
import { Pictogram, injectI18nStyles } from '../../i18n/components';
import { COUNTRIES } from '../../data';
import FlipCard from '../animata/FlipCard';
import { useWorkerLang } from '../i18n';
import { motherLanguageOf } from '../patientLang';
import { cx } from '../../utils/cx';
import { languageOptions, nativeName } from './lang';

export function asPack(l: string): PackCode {
  try {
    return getPack(l as PackCode).code;
  } catch {
    return 'en';
  }
}

export function useLangs(mother: Pick<Mother, 'language' | 'country' | 'region'>) {
  return { wl: asPack(useWorkerLang()), ml: motherLanguageOf(mother) };
}

/** Her line under a plan item or alert: her language, a confidence badge, Show to mother, both languages. */
export function MotherLineView({ item, alert, mother, workerId, compact }: { item?: PlanItem; alert?: Alert; mother: Mother; workerId?: string; compact?: boolean }) {
  injectI18nStyles();
  const { wl, ml } = useLangs(mother);
  const [showing, setShowing] = useState(false);
  const [both, setBoth] = useState(false);
  const subject = alert ?? item;
  if (!subject) return null;
  const r = renderForBoth(subject, wl, ml);
  const m = r.mother;
  if (!m) return null;
  const first = mother.name.split(' ')[0];
  return (
    <div className="grid grid-cols-1 gap-1.5" data-testid="mother-line">
      <p className={cx('m-0 text-md leading-snug text-primary', compact && 'text-sm')} lang={m.lang} dir={m.dir}>
        {m.text}
      </p>
      {r.showEnglishBeneath && m.lang !== 'en' ? (
        <p className="m-0 text-sm leading-snug text-tertiary" lang="en">
          English: {m.english}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-xs font-medium text-tertiary">{getPack(m.lang).nativeName}</span>
        <ConfidenceBadge confidence={m.confidence} lang={wl} checked={m.checkedLocally} compact />
        <button type="button" className="min-h-8 cursor-pointer rounded-md text-sm font-semibold text-brand-secondary outline-focus-ring hover:text-brand-secondary_hover focus-visible:outline-2" onClick={() => setShowing(true)} data-testid="show-to-mother">
          {packT('dual.show_to_mother', wl)}
        </button>
        <button type="button" className="min-h-8 cursor-pointer rounded-md text-sm font-medium text-tertiary outline-focus-ring hover:text-secondary focus-visible:outline-2" aria-expanded={both} onClick={() => setBoth(!both)}>
          {both ? 'Hide both languages' : 'Both languages'}
        </button>
      </div>
      {both ? (
        <div className="mt-1">
          <DualLanguageView item={item} alert={alert} workerLang={wl} motherLang={ml} motherName={first} workerId={workerId} hideShowToMother />
        </div>
      ) : null}
      {showing ? <ShowToMotherCard item={item} alert={alert} workerLang={wl} motherLang={ml} motherName={first} onClose={() => setShowing(false)} /> : null}
    </div>
  );
}

/** Pick the language for her lines: her own first, installed packs, "Coming soon" for languages with no pack. */
export function LanguageSwitch({ value, onChange, motherLang, country, className, label = 'Her language' }: { value: string; onChange: (code: PackCode) => void; motherLang: LanguageCode | string; country: Mother['country']; className?: string; label?: string }) {
  usePackVersion();
  const opts = languageOptions(motherLang, COUNTRIES[country]?.languages ?? []);
  return (
    <label className={cx('inline-flex min-w-0 items-center gap-2 rounded-lg bg-primary px-2.5 py-1.5 text-sm ring-1 ring-primary ring-inset focus-within:ring-2 focus-within:ring-brand', className)}>
      <Translate01 aria-hidden="true" className="size-4 shrink-0 text-fg-quaternary" />
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => {
          const code = asPack(e.target.value);
          // Choosing a pack that is not on the device downloads it (bundled in the demo).
          if (!isInstalled(code)) void installPack(code, { durationMs: 0 }).catch(() => undefined);
          onChange(code);
        }} className="min-w-0 cursor-pointer bg-transparent pr-1 font-semibold text-primary outline-none" aria-label={label} data-testid="lang-switch">
        {opts.map((o) => (
          <option key={o.code} value={o.code} disabled={o.comingSoon}>
            {o.nativeName}
            {o.nativeName !== o.label ? ` (${o.label})` : ''}
            {o.comingSoon ? ', coming soon' : o.notInstalled ? ', tap to download' : o.code === String(motherLang) ? ', her language' : ''}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Full-screen Show to mother, as a flip card: the worker's side first, then hers. */
export function ShowToMotherCard({ item, alert, workerLang, motherLang, motherName, onClose }: { item?: PlanItem; alert?: Alert; workerLang: PackCode; motherLang: PackCode; motherName?: string; onClose: () => void }) {
  injectI18nStyles();
  const [flipped, setFlipped] = useState(false);
  const turnRef = useRef<HTMLButtonElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    (flipped ? backRef : turnRef).current?.focus();
  }, [flipped]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);
  const subject = alert ?? item;
  if (!subject) return null;
  const r = renderForBoth(subject, workerLang, motherLang);
  const m = r.mother;
  if (!m) return null;
  const wDir = getPack(workerLang).direction;
  const level = r.level ?? (r.isDanger ? 'emergency' : undefined);
  const danger = level === 'emergency' || level === 'urgent';
  const note = m.confidence === 'reviewed' ? packT('conf.show_mother_note_reviewed', workerLang) : m.confidence === 'draft' ? packT('conf.show_mother_note_draft', workerLang) : packT('conf.show_mother_note_fallback', workerLang);
  const band = danger ? 'bg-error-solid' : level === 'warning' ? 'bg-warning-solid' : 'bg-brand-solid';

  return (
    <div className="fixed inset-0 z-[1000] flex flex-col bg-secondary p-3 sm:p-8" role="dialog" aria-modal="true" aria-label={packT('dual.show_to_mother', workerLang)} data-testid="show-to-mother-card">
      <FlipCard flipped={flipped} className="mx-auto h-full max-h-full min-h-0 w-full max-w-[720px] [&>div]:h-full">
        <FlipCard.Front className="flex max-h-full min-h-0 flex-col overflow-hidden rounded-3xl bg-primary shadow-xl ring-1 ring-secondary" dir={wDir} lang={workerLang}>
          <div className={cx('h-2 w-full shrink-0', band)} />
          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-auto p-5 sm:p-8">
            <div className="flex items-start justify-between gap-3">
              <span className="text-xs font-semibold tracking-wide text-tertiary uppercase">{packT('dual.worker_side', workerLang)}</span>
              <button type="button" className="grid grid-cols-1 size-10 cursor-pointer place-items-center rounded-lg text-fg-quaternary hover:bg-primary_hover" onClick={onClose} aria-label={packT('dual.close', workerLang)}>
                <XClose className="size-5" aria-hidden="true" />
              </button>
            </div>
            <div className="flex items-center gap-4">
              <Pictogram k={r.illustration} size={88} title={m.english} />
              <h2 className="m-0 text-display-xs font-semibold text-primary" lang="en" dir="ltr">
                {r.worker.title}
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-secondary">{getPack(m.lang).nativeName}</span>
              <ConfidenceBadge confidence={m.confidence} lang={workerLang} checked={m.checkedLocally} />
            </div>
            <p className={cx('m-0 rounded-xl p-3 text-sm leading-snug ring-1 ring-inset', m.confidence === 'reviewed' ? 'bg-success-primary text-success-primary ring-success_subtle' : 'bg-warning-primary text-warning-primary ring-warning_subtle')}>{note}</p>
            {m.lang !== 'en' ? (
              <p className="m-0 text-sm leading-snug text-secondary" lang="en" dir="ltr">
                <span className="font-semibold">{packT('dual.english_line', workerLang)}:</span> {m.english}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-wrap gap-2 border-t border-secondary p-4 sm:px-8">
              <button ref={turnRef} type="button" className="inline-flex min-h-12 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl bg-brand-solid px-5 text-md font-semibold text-on-fill outline-focus-ring hover:bg-brand-solid_hover focus-visible:outline-2 focus-visible:outline-offset-2 sm:flex-none" onClick={() => setFlipped(true)} data-testid="turn-to-her">
                <FlipBackward className="size-5" aria-hidden="true" /> Turn to her
              </button>
              <button type="button" className="min-h-12 cursor-pointer rounded-xl px-5 text-md font-semibold text-secondary ring-1 ring-primary ring-inset hover:bg-primary_hover" onClick={onClose}>
                {packT('dual.close', workerLang)}
              </button>
          </div>
        </FlipCard.Front>
        <FlipCard.Back className="flex max-h-full min-h-0 flex-col overflow-hidden rounded-3xl bg-primary shadow-xl ring-1 ring-secondary">
          <div className={cx('h-2 w-full shrink-0', band)} />
          <div className="flex justify-end p-3">
            <button ref={backRef} type="button" className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-tertiary hover:bg-primary_hover" onClick={() => setFlipped(false)} dir={wDir} lang={workerLang}>
              <FlipBackward className="size-4" aria-hidden="true" /> {packT('nav.back', workerLang)}
            </button>
          </div>
          <div className="flex flex-1 flex-col items-center justify-center gap-6 overflow-auto px-6 pb-10 text-center">
            <div className="rounded-[2rem] bg-secondary p-5">
              <Pictogram k={r.illustration} size={176} title={m.english} />
            </div>
            {motherName ? <div className="text-lg font-semibold text-tertiary">{motherName}</div> : null}
            <p className="m-0 max-w-[24ch] text-[clamp(1.6rem,6.5vw,2.5rem)] leading-[1.25] font-semibold text-primary" lang={m.lang} dir={m.dir} data-testid="mother-big-text">
              {m.text}
            </p>
            {r.showEnglishBeneath ? (
              <p className="m-0 max-w-[40ch] border-t border-secondary pt-4 text-md leading-snug text-tertiary" lang="en" dir="ltr">
                {m.english}
              </p>
            ) : null}
          </div>
        </FlipCard.Back>
      </FlipCard>
    </div>
  );
}

/** Short label for a language, used in chips. */
export function langLabel(code: string): string {
  return nativeName(code);
}
