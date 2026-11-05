import { useMemo } from 'react';
import type { IllustrationKey } from '../../types';
import { renderIllustration } from '../../illustrations';

/** Inline SVG pictogram from the illustrations module (trusted markup generated locally). */
export function Pictogram({ k, size = 96, title, className }: { k: IllustrationKey; size?: number; title?: string; className?: string }) {
  const html = useMemo(() => {
    try {
      return renderIllustration(k, { size, title });
    } catch {
      return '';
    }
  }, [k, size, title]);
  if (!html) return null;
  return <span className={`i18n-picto${className ? ` ${className}` : ''}`} style={{ width: size, height: size }} dangerouslySetInnerHTML={{ __html: html }} />;
}
