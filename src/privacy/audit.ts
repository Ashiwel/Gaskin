/**
 * In-memory audit log of AI calls: when, which provider, which task, what
 * categories of data were sent and how many bytes. Never the content.
 * Cleared on reload; the UI can show it on the settings screen.
 */

export interface AIAuditEntry {
  id: string;
  at: string;
  provider: string;
  mode: string;
  task: string;
  /** Categories of data sent, e.g. 'age band', 'plan item text' */
  categories: string[];
  /** Categories of identifiers that were removed before sending */
  removed: string[];
  /** UTF-8 bytes of the prompt that left the device (0 when nothing was sent) */
  bytes: number;
  /** Where the data went */
  destination: 'cloud' | 'on_device' | 'artifact_host' | 'copy_paste' | 'none';
  /** True when the prompt was de-identified */
  deidentified: boolean;
  outcome: 'sent' | 'blocked' | 'error' | 'fallback';
  note?: string;
}

const MAX = 500;
const log: AIAuditEntry[] = [];
let n = 0;

export function recordAICall(e: Omit<AIAuditEntry, 'id' | 'at'> & { at?: string }): AIAuditEntry {
  const entry: AIAuditEntry = { ...e, id: `audit-${++n}`, at: e.at ?? new Date().toISOString() };
  log.push(entry);
  if (log.length > MAX) log.splice(0, log.length - MAX);
  return entry;
}

/** Copy of the audit log, oldest first. No prompt or reply content is stored. */
export function getAIAuditLog(): AIAuditEntry[] {
  return log.map((e) => ({ ...e, categories: [...e.categories], removed: [...e.removed] }));
}

export function clearAIAuditLog(): void {
  log.length = 0;
}

export function byteLength(s: string): number {
  return new TextEncoder().encode(s).length;
}
