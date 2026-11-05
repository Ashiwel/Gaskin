import type { Confidence, PackCode } from '../types';
import { t } from '../render';

export interface ConfidenceBadgeProps {
  confidence: Confidence;
  /** Language the badge text is written in (the worker's) */
  lang: PackCode;
  /** A worker on this device checked this line */
  checked?: boolean;
  compact?: boolean;
}

/** Small label saying how far to trust a line: Reviewed, Draft, or English (fallback). */
export function ConfidenceBadge({ confidence, lang, checked, compact }: ConfidenceBadgeProps) {
  const label = t(`conf.${confidence}`, lang);
  const help = t(`conf.${confidence}_help`, lang);
  return (
    <span className={`i18n-badge i18n-badge--${confidence}${compact ? ' i18n-badge--compact' : ''}`} title={help} aria-label={`${label}. ${help}`}>
      <span className="i18n-badge-dot" aria-hidden="true" />
      {label}
      {checked ? <span className="i18n-badge-checked"> · {t('conf.checked', lang)}</span> : null}
    </span>
  );
}
