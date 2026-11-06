import { PhoneCall01 } from '@untitledui/icons';
import { cx } from '../../utils/cx';
import type { LegalFooterInfo } from './types';

/**
 * The persistent, quiet disclaimer for personal-use mode (a mother using Gaskin for herself).
 * One line, with the emergency number as a tappable tel: link. Content comes from src/legal.
 */
export function LegalFooter({ info, className }: { info: LegalFooterInfo; className?: string }) {
  return (
    <footer role="contentinfo" data-testid="legal-footer" className={cx('flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-2 text-center text-xs text-tertiary', className)}>
      <span>{info.disclaimer}</span>
      {info.emergencyNumber ? (
        <a
          href={`tel:${info.emergencyNumber.replace(/[^\d+]/g, '')}`}
          className="inline-flex items-center gap-1 rounded-md font-semibold text-error-primary outline-focus-ring hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <PhoneCall01 aria-hidden="true" className="size-3.5" />
          {info.emergencyLabel ?? 'Emergency'} {info.emergencyNumber}
        </a>
      ) : null}
      {info.onMore ? (
        <button type="button" onClick={info.onMore} className="cursor-pointer rounded-md underline underline-offset-2 outline-focus-ring hover:text-secondary focus-visible:outline-2">
          More
        </button>
      ) : null}
    </footer>
  );
}
