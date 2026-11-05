/**
 * The mother's side of a plan item or alert, inline: her language, plain words, the picture,
 * a confidence badge, and "Show to mother". The full dual view (clinical detail in English, back
 * translation, "I checked this") opens below on request, so the plan stays calm and scannable.
 *
 * Show to mother is a flip card (Animata, MIT): the front is for the worker (what this is, how
 * sure the translation is, in her own language); "Turn to her" flips it to the mother's side in
 * large type with the picture.
 */
import { useEffect, useRef, useState } from 'react';
import type { Alert, Mother, PlanItem } from '../types';
import { ConfidenceBadge, DualLanguageView, getPack, renderForBoth, t as packT, type PackCode } from '../i18n';
import { Pictogram, injectI18nStyles } from '../i18n/components';
import FlipCard from './animata/FlipCard';
import { useWorkerLang } from './i18n';
import { motherLanguageOf } from './patientLang';
import { IClose } from './icons';
import { cn } from './animata/cn';

function asPack(l: string): PackCode {
  try {
    return getPack(l as PackCode).code;
  } catch {
    return 'en';
  }
}

export function MotherLine({ item, alert, mother, workerId }: { item?: PlanItem; alert?: Alert; mother: Mother; workerId?: string }) {
  injectI18nStyles();
  const wl = asPack(useWorkerLang());
  const ml = motherLanguageOf(mother);
  const [showing, setShowing] = useState(false);
  const [detail, setDetail] = useState(false);
  const subject = alert ?? item;
  if (!subject) return null;
  const r = renderForBoth(subject, wl, ml);
  const m = r.mother;
  if (!m) return null;
  const first = mother.name.split(' ')[0];
  return (
    <div className="mother-line grid gap-1.5" data-testid="mother-line">
      <p className={cn('m-0 font-serif text-[1.02rem] leading-snug text-ink', alert && 'text-[1.05rem]')} lang={m.lang} dir={m.dir}>
        “{m.text}”
      </p>
      {r.showEnglishBeneath && m.lang !== 'en' ? (
        <p className="m-0 text-[0.82rem] leading-snug text-ink-2" lang="en">
          English: {m.english}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-[0.75rem] font-semibold text-ink-3">{getPack(m.lang).nativeName}</span>
        <ConfidenceBadge confidence={m.confidence} lang={wl} checked={m.checkedLocally} compact />
        <button type="button" className="link-btn inline-flex min-h-8 items-center" onClick={() => setShowing(true)} data-testid="show-to-mother">
          {packT('dual.show_to_mother', wl)}
        </button>
        <button type="button" className="link-btn inline-flex min-h-8 items-center" aria-expanded={detail} onClick={() => setDetail(!detail)}>
          {detail ? 'Hide both languages' : 'Both languages'}
        </button>
      </div>
      {detail ? (
        <div className="mt-1">
          <DualLanguageView item={item} alert={alert} workerLang={wl} motherLang={ml} motherName={first} workerId={workerId} hideShowToMother />
        </div>
      ) : null}
      {showing ? <ShowToMotherCard item={item} alert={alert} workerLang={wl} motherLang={ml} motherName={first} onClose={() => setShowing(false)} /> : null}
    </div>
  );
}

/** Full-screen Show to mother, as a flip card: the worker's side first, then hers. */
export function ShowToMotherCard({ item, alert, workerLang, motherLang, motherName, onClose }: { item?: PlanItem; alert?: Alert; workerLang: PackCode; motherLang: PackCode; motherName?: string; onClose: () => void }) {
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
  const note = m.confidence === 'reviewed' ? packT('conf.show_mother_note_reviewed', workerLang) : m.confidence === 'draft' ? packT('conf.show_mother_note_draft', workerLang) : packT('conf.show_mother_note_fallback', workerLang);
  const bar = level === 'emergency' ? 'border-t-[6px] border-red' : level === 'urgent' ? 'border-t-[6px] border-amber' : 'border-t-[6px] border-clay';

  return (
    <div className="fixed inset-0 z-[1000] grid bg-paper p-3 sm:p-6" role="dialog" aria-modal="true" aria-label={packT('dual.show_to_mother', workerLang)} data-testid="show-to-mother-card">
      <FlipCard flipped={flipped} className="mx-auto h-full w-full max-w-[720px]">
        <FlipCard.Front className={cn('flex flex-col gap-4 overflow-auto rounded-[var(--r-l)] bg-card p-5 shadow-soft sm:p-8', bar)} dir={wDir} lang={workerLang}>
          <div className="flex items-start justify-between gap-3">
            <span className="text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-ink-3">{packT('dual.worker_side', workerLang)}</span>
            <button type="button" className="btn icon ghost" onClick={onClose} aria-label={packT('dual.close', workerLang)}>
              <IClose />
            </button>
          </div>
          <h2 className="m-0 font-serif text-[1.5rem] leading-tight font-medium" lang="en" dir="ltr">
            {r.worker.title}
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[0.9rem] text-ink-2">{getPack(m.lang).nativeName}</span>
            <ConfidenceBadge confidence={m.confidence} lang={workerLang} checked={m.checkedLocally} />
          </div>
          <p className={cn('m-0 rounded-[var(--r-m)] p-3 text-[0.95rem] leading-snug', m.confidence === 'reviewed' ? 'bg-green-soft text-green' : 'bg-amber-soft text-ink')}>{note}</p>
          {m.lang !== 'en' ? (
            <p className="m-0 text-[0.92rem] leading-snug text-ink-2" lang="en" dir="ltr">
              <span className="font-semibold">{packT('dual.english_line', workerLang)}:</span> {m.english}
            </p>
          ) : null}
          <div className="mt-auto flex flex-wrap gap-2 pt-2">
            <button ref={turnRef} type="button" className="btn primary" onClick={() => setFlipped(true)} data-testid="turn-to-her">
              Turn to her
            </button>
            <button type="button" className="btn ghost" onClick={onClose}>
              {packT('dual.close', workerLang)}
            </button>
          </div>
        </FlipCard.Front>
        <FlipCard.Back className={cn('flex flex-col items-center gap-5 overflow-auto rounded-[var(--r-l)] bg-raised p-5 text-center shadow-soft sm:p-8', bar)}>
          <div className="flex w-full justify-end">
            <button ref={backRef} type="button" className="btn small ghost" onClick={() => setFlipped(false)} dir={wDir} lang={workerLang}>
              {packT('nav.back', workerLang)}
            </button>
          </div>
          <Pictogram k={r.illustration} size={168} title={m.english} />
          {motherName ? <div className="text-[1.1rem] font-semibold text-ink-2">{motherName}</div> : null}
          <p className="m-0 max-w-[28ch] font-serif text-[clamp(1.5rem,6vw,2.3rem)] leading-[1.32] font-medium text-ink" lang={m.lang} dir={m.dir} data-testid="mother-big-text">
            {m.text}
          </p>
          {r.showEnglishBeneath ? (
            <p className="m-0 max-w-[40ch] border-t border-line pt-3 text-[1rem] leading-snug text-ink-2" lang="en" dir="ltr">
              {m.english}
            </p>
          ) : null}
        </FlipCard.Back>
      </FlipCard>
    </div>
  );
}
