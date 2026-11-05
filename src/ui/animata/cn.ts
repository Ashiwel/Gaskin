/** Join class names, skipping empty values (stands in for Animata's `cn` without clsx/tailwind-merge). */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
