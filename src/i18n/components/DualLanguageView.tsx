import { useState } from 'react';
import type { Alert, PlanItem } from '../../types';
import type { MotherRendering, PackCode } from '../types';
import { getPack } from '../registry';
import { renderForBoth, t } from '../render';
import { markChecked, unmarkChecked } from '../reviews';
import { backTranslate } from '../backTranslate';
import { ConfidenceBadge } from './ConfidenceBadge';
import { Pictogram } from './Pictogram';
import { useReviewVersion } from './hooks';
import { injectI18nStyles } from './styles';
import { ShowToMother } from './ShowToMother';

export interface DualLanguageViewProps {
  item?: PlanItem;
  alert?: Alert;
  workerLang: PackCode;
  motherLang: PackCode;
  /** Mother's first name, for the Show to mother card heading (kept on the device) */
  motherName?: string;
  /** Worker id, recorded with "I checked this" */
  workerId?: string;
  /** Hide the Show to mother button */
  hideShowToMother?: boolean;
  /** Offer "What does this say?" (needs a live AI provider; default true) */
  allowBackTranslate?: boolean;
}

/**
 * One plan item or alert in two languages at once: the worker's side with clinical detail, the
 * mother's side in plain words with its picture. Side by side on wide screens, stacked on phones.
 * Each line carries a confidence badge; danger lines in a draft or fallback language always show
 * the picture and the English line beneath.
 */
export function DualLanguageView({ item, alert, workerLang, motherLang, motherName, workerId, hideShowToMother, allowBackTranslate = true }: DualLanguageViewProps) {
  injectI18nStyles();
  useReviewVersion();
  const [showing, setShowing] = useState(false);
  const subject = alert ?? item;
  if (!subject) return null;
  const r = renderForBoth(subject, workerLang, motherLang);
  const w = r.worker;
  const m = r.mother;
  const motherPack = getPack(motherLang);
  const levelClass = r.level ? ` i18n-dual--${r.level}` : r.isDanger ? ' i18n-dual--danger' : '';

  return (
    <section className={`i18n-dual${levelClass}`} aria-label={w.title}>
      <div className="i18n-dual-side i18n-dual-worker" dir={w.dir} lang={workerLang}>
        <div className="i18n-dual-head">
          <span className="i18n-dual-kicker">{t('dual.worker_side', workerLang)}</span>
          <span className="i18n-dual-heading">{w.heading}</span>
          {w.headingConfidence !== 'reviewed' ? <ConfidenceBadge confidence={w.headingConfidence} lang={workerLang} compact /> : null}
        </div>
        <div className="i18n-dual-title" dir="ltr" lang="en">
          {w.title}
        </div>
        <details className="i18n-dual-detail" open={r.isDanger}>
          <summary>{t('dual.clinical_detail', workerLang)}</summary>
          <p dir="ltr" lang="en">
            {w.detail}
          </p>
        </details>
        {w.plain && workerLang !== motherLang ? (
          <div className="i18n-dual-plain">
            <div className="i18n-dual-kicker">{t('dual.plain_words', workerLang)}</div>
            <Line r={w.plain} workerLang={workerLang} workerId={workerId} allowCheck={false} />
          </div>
        ) : null}
      </div>

      {m ? (
        <div className="i18n-dual-side i18n-dual-mother">
          <div className="i18n-dual-head" dir={w.dir}>
            <span className="i18n-dual-kicker">{t('dual.mother_side', workerLang)}</span>
            <span className="i18n-dual-heading" lang={motherLang} dir={motherPack.direction}>
              {motherPack.nativeName}
            </span>
          </div>
          <div className="i18n-dual-mother-body">
            {r.showPictogram ? <Pictogram k={r.illustration} size={r.isDanger ? 104 : 80} title={m.english} /> : null}
            <div className="i18n-dual-mother-text">
              <Line r={m} workerLang={workerLang} workerId={workerId} allowCheck allowBackTranslate={allowBackTranslate} large />
              {r.showEnglishBeneath ? (
                <div className="i18n-dual-english" dir="ltr" lang="en">
                  <span className="i18n-dual-kicker">{t('dual.english_line', workerLang)}</span> {m.english}
                </div>
              ) : null}
              {r.isDanger && m.confidence !== 'reviewed' && motherLang !== 'en' ? (
                <p className="i18n-dual-note" dir={w.dir}>
                  {t('conf.danger_note', workerLang)}
                </p>
              ) : null}
            </div>
          </div>
          {!hideShowToMother ? (
            <button type="button" className="i18n-btn i18n-btn--primary" onClick={() => setShowing(true)}>
              {t('dual.show_to_mother', workerLang)}
            </button>
          ) : null}
        </div>
      ) : null}

      {showing ? <ShowToMother item={item} alert={alert} workerLang={workerLang} motherLang={motherLang} motherName={motherName} onClose={() => setShowing(false)} /> : null}
    </section>
  );
}

function Line({ r, workerLang, workerId, allowCheck, allowBackTranslate, large }: { r: MotherRendering; workerLang: PackCode; workerId?: string; allowCheck: boolean; allowBackTranslate?: boolean; large?: boolean }) {
  const [bt, setBt] = useState<{ state: 'idle' | 'loading' | 'done' | 'none'; text?: string }>({ state: 'idle' });
  const translated = r.lang !== 'en' && r.confidence !== 'fallback';
  const canCheck = allowCheck && translated && r.confidence !== 'reviewed' && !!r.key;
  const runBt = () => {
    setBt({ state: 'loading' });
    backTranslate({ key: r.key, text: r.text, from: r.lang, to: workerLang })
      .then((text) => setBt(text ? { state: 'done', text } : { state: 'none' }))
      .catch(() => setBt({ state: 'none' }));
  };
  return (
    <div className="i18n-line">
      <p className={`i18n-line-text${large ? ' i18n-line-text--large' : ''}`} dir={r.dir} lang={r.lang}>
        {r.text}
      </p>
      <div className="i18n-line-meta" dir={getPack(workerLang).direction}>
        <ConfidenceBadge confidence={r.confidence} lang={workerLang} checked={r.checkedLocally} />
        {canCheck ? (
          <button
            type="button"
            className="i18n-link"
            aria-pressed={r.checkedLocally}
            onClick={() => (r.checkedLocally ? unmarkChecked(r.lang, r.key!, r.text) : markChecked(r.lang, r.key!, r.text, { workerId }))}
          >
            {r.checkedLocally ? t('conf.uncheck', workerLang) : t('conf.check_this', workerLang)}
          </button>
        ) : null}
        {allowBackTranslate && translated && r.lang !== workerLang && bt.state === 'idle' ? (
          <button type="button" className="i18n-link" onClick={runBt}>
            {t('dual.back_translate', workerLang)}
          </button>
        ) : null}
      </div>
      {bt.state === 'loading' ? <p className="i18n-bt">{t('dual.back_translate_loading', workerLang)}</p> : null}
      {bt.state === 'none' ? <p className="i18n-bt">{t('dual.back_translate_unavailable', workerLang)}</p> : null}
      {bt.state === 'done' ? (
        <p className="i18n-bt" dir={getPack(workerLang).direction}>
          <span className="i18n-dual-kicker">{t('dual.what_it_says', workerLang)}</span> {bt.text}
        </p>
      ) : null}
    </div>
  );
}
