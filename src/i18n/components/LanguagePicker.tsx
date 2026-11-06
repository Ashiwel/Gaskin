import { useMemo, useState } from 'react';
import type { PackCode, PackSummary } from '../types';
import { PACK_ORDER, formatBytes, installPack, installProgress, summarisePack, uninstallPack } from '../registry';
import { t } from '../render';
import { usePackVersion } from './hooks';
import { injectI18nStyles } from './styles';

export interface LanguagePickerProps {
  /** Language for the picker's own labels (the worker's) */
  uiLang: PackCode;
  /** Selected language(s). Single mode: one code; multi mode: a list */
  value: PackCode | PackCode[];
  onChange: (value: PackCode | PackCode[]) => void;
  /** Allow several (mothers' languages at onboarding) */
  multiple?: boolean;
  /** Limit the list, e.g. to a country's languages; English is always included */
  only?: PackCode[];
  /** Hide Pidgin unless already chosen (it is optional, never a default) */
  hidePidgin?: boolean;
  /** Install a pack automatically when it is selected (default true) */
  installOnSelect?: boolean;
  /** Simulated download time in ms, for tests and demos */
  downloadMs?: number;
  /** Heading shown above the list */
  label?: string;
  /** Called after a pack finishes downloading */
  onInstalled?: (code: PackCode) => void;
}

/**
 * Choose languages: search by English or native name, see each pack's status and size,
 * and download it once for offline use, with progress.
 */
export function LanguagePicker(props: LanguagePickerProps) {
  injectI18nStyles();
  const { uiLang, value, onChange, multiple, only, hidePidgin, installOnSelect = true, downloadMs, label, onInstalled } = props;
  const ver = usePackVersion();
  const [q, setQ] = useState('');
  const [errors, setErrors] = useState<Partial<Record<PackCode, string>>>({});
  const selected = Array.isArray(value) ? value : [value];

  const packs = useMemo(() => {
    const codes = PACK_ORDER.filter((c) => !only || c === 'en' || only.includes(c)).filter((c) => !(hidePidgin && c === 'pcm' && !selected.includes('pcm')));
    const needle = q.trim().toLowerCase();
    return codes.map(summarisePack).filter((p) => !needle || p.name.toLowerCase().includes(needle) || p.nativeName.toLowerCase().includes(needle) || p.code === needle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, only?.join(','), hidePidgin, selected.join(','), ver]);

  const install = (code: PackCode) => {
    setErrors((e) => ({ ...e, [code]: undefined }));
    installPack(code, { durationMs: downloadMs })
      .then(() => onInstalled?.(code))
      .catch(() => setErrors((e) => ({ ...e, [code]: t('pack.failed', uiLang) })));
  };

  const toggle = (code: PackCode) => {
    if (multiple) {
      const next = selected.includes(code) ? selected.filter((c) => c !== code) : [...selected, code];
      onChange(next);
    } else {
      onChange(code);
    }
    if (installOnSelect && !selected.includes(code)) install(code);
  };

  return (
    <div className="i18n-picker" dir={uiLang === 'ar' ? 'rtl' : 'ltr'}>
      {label ? <div className="i18n-picker-label">{label}</div> : null}
      <input
        className="i18n-picker-search"
        type="search"
        value={q}
        placeholder={t('pack.search', uiLang)}
        aria-label={t('pack.search', uiLang)}
        onChange={(e) => setQ(e.target.value)}
      />
      <p className="i18n-picker-hint">
        {t('pack.download_once', uiLang)} {t('pack.offline_ready', uiLang)}
      </p>
      <ul className="i18n-picker-list" role={multiple ? 'group' : 'radiogroup'} aria-label={label ?? t('common.language', uiLang)}>
        {packs.length === 0 ? <li className="i18n-picker-empty">{t('pack.no_results', uiLang)}</li> : null}
        {packs.map((p) => (
          <PackRow key={p.code} p={p} uiLang={uiLang} selected={selected.includes(p.code)} multiple={!!multiple} onToggle={() => toggle(p.code)} onInstall={() => install(p.code)} error={errors[p.code]} />
        ))}
      </ul>
    </div>
  );
}

function PackRow({ p, uiLang, selected, multiple, onToggle, onInstall, error }: { p: PackSummary; uiLang: PackCode; selected: boolean; multiple: boolean; onToggle: () => void; onInstall: () => void; error?: string }) {
  const progress = installProgress(p.code);
  const motherPct = Math.round(p.motherCoverage * 100);
  return (
    <li className={`i18n-pack${selected ? ' is-selected' : ''}`}>
      <button type="button" className="i18n-pack-main" role={multiple ? 'checkbox' : 'radio'} aria-checked={selected} onClick={onToggle}>
        <span className="i18n-pack-tick" aria-hidden="true">
          {selected ? (
            <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true">
              <path d="M2.5 6.2 5 8.5l4.5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : null}
        </span>
        <span className="i18n-pack-names">
          <span className="i18n-pack-native" dir={p.direction} lang={p.code}>
            {p.nativeName}
          </span>
          {p.nativeName !== p.name ? <span className="i18n-pack-english">{p.name}</span> : null}
        </span>
        <span className={`i18n-status i18n-status--${p.status}`}>{p.status === 'none' && p.code !== 'en' ? 'Coming soon' : t(`pack.status.${p.status}`, uiLang)}</span>
      </button>
      <div className="i18n-pack-meta">
        <span>{formatBytes(p.sizeBytes)}</span>
        {p.status === 'none' && p.code !== 'en' ? <span>{t('pack.status.none', uiLang)}</span> : p.code !== 'en' ? <span>{t('pack.coverage', uiLang, { pct: motherPct })}</span> : null}
        {p.direction === 'rtl' ? <span>{t('pack.rtl', uiLang)}</span> : null}
        <span className="i18n-pack-action">
          {progress !== undefined ? (
            <span className="i18n-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
              <span className="i18n-progress-bar" style={{ width: `${Math.round(progress * 100)}%` }} />
              <span className="i18n-progress-label">{t('pack.installing', uiLang, { pct: Math.round(progress * 100) })}</span>
            </span>
          ) : p.installed ? (
            <>
              <span className="i18n-installed">{t('pack.installed', uiLang)}</span>
              {p.code !== 'en' ? (
                <button type="button" className="i18n-link" onClick={() => uninstallPack(p.code)}>
                  {t('pack.remove', uiLang)}
                </button>
              ) : null}
            </>
          ) : (
            <button type="button" className="i18n-btn" onClick={onInstall}>
              {t('pack.install', uiLang)}
            </button>
          )}
        </span>
      </div>
      {error ? (
        <div className="i18n-pack-error" role="alert">
          {error}{' '}
          <button type="button" className="i18n-link" onClick={onInstall}>
            {t('pack.retry', uiLang)}
          </button>
        </div>
      ) : null}
      {p.status === 'machine_draft' || p.status === 'partial' ? <div className="i18n-pack-note">{t('pack.review_warning', uiLang)}</div> : null}
      {p.status === 'none' || p.status === 'partial' ? <div className="i18n-pack-help">{t('pack.help_build', uiLang)}</div> : null}
    </li>
  );
}
