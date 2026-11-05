import { useEffect, useRef } from 'react';
import type { Alert, PlanItem } from '../../types';
import type { PackCode } from '../types';
import { getPack } from '../registry';
import { renderForBoth, t } from '../render';
import { Pictogram } from './Pictogram';
import { injectI18nStyles } from './styles';

export interface ShowToMotherProps {
  item?: PlanItem;
  alert?: Alert;
  workerLang: PackCode;
  motherLang: PackCode;
  /** Her first name, shown as a greeting line (stays on the device) */
  motherName?: string;
  onClose: () => void;
}

/**
 * Full-screen, large-type card in the mother's language with the picture, for the worker to turn
 * her phone round. The confidence note is in the worker's language only, in a strip she can read
 * before turning the phone. Danger lines that are not reviewed carry the English line beneath.
 */
export function ShowToMother({ item, alert, workerLang, motherLang, motherName, onClose }: ShowToMotherProps) {
  injectI18nStyles();
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const subject = alert ?? item;
  if (!subject) return null;
  const r = renderForBoth(subject, workerLang, motherLang);
  const m = r.mother;
  if (!m) return null;
  const note = m.confidence === 'reviewed' ? t('conf.show_mother_note_reviewed', workerLang) : m.confidence === 'draft' ? t('conf.show_mother_note_draft', workerLang) : t('conf.show_mother_note_fallback', workerLang);
  const workerDir = getPack(workerLang).direction;
  const level = r.level ?? (r.isDanger ? 'emergency' : 'info');

  return (
    <div className={`i18n-show i18n-show--${level}`} role="dialog" aria-modal="true" aria-label={t('dual.show_to_mother', workerLang)}>
      <div className={`i18n-show-worker i18n-show-worker--${m.confidence}`} dir={workerDir} lang={workerLang}>
        <span>{note}</span>
        <button ref={closeRef} type="button" className="i18n-btn" onClick={onClose}>
          {t('dual.close', workerLang)}
        </button>
      </div>
      <div className="i18n-show-card" dir={m.dir} lang={m.lang}>
        <Pictogram k={r.illustration} size={180} title={m.english} className="i18n-show-picto" />
        {motherName ? <div className="i18n-show-name">{motherName}</div> : null}
        <p className="i18n-show-text">{m.text}</p>
        {r.showEnglishBeneath ? (
          <p className="i18n-show-english" dir="ltr" lang="en">
            {m.english}
          </p>
        ) : null}
      </div>
    </div>
  );
}
