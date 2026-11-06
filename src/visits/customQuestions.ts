/**
 * Custom questions: a health worker (or a facility) adds a question to the Ask step of a visit
 * type, and it appears on every later visit of that type until someone deletes it in Settings.
 *
 * Stored in browser storage under `gaskin.customQuestions.v1` (memory fallback when storage is
 * blocked), keyed by owner: `worker:<id>` for a personal question or `facility:<id>` for one the
 * whole facility sees. Synchronous so the checklist can read it while rendering; `subscribe`
 * lets Settings and open visits refresh when the list changes.
 */
import { readJSON, writeJSON } from '../i18n/storage';

export const CUSTOM_QUESTIONS_KEY = 'gaskin.customQuestions.v1';

export interface CustomQuestion {
  id: string;
  /** The question as the worker reads it aloud */
  text: string;
  /** Visit template id (e.g. 'anc3', 'pnc_6wk'), or a visit type ('anc', 'pnc', 'child_health') for every visit of that type */
  visitType: string;
  /** Answer shape */
  answer: 'yes_no' | 'text';
  scope: 'worker' | 'facility';
  /** Worker id or facility id */
  ownerId: string;
  createdBy: string;
  createdAt: string;
}

export interface CustomQuestionFilter {
  workerId?: string;
  facilityId?: string;
  /** Template id and/or visit type: a question matches either */
  visitType?: string;
  templateId?: string;
}

const listeners = new Set<() => void>();
let version = 0;

function all(): CustomQuestion[] {
  const v = readJSON<CustomQuestion[]>(CUSTOM_QUESTIONS_KEY, []);
  return Array.isArray(v) ? v.filter((q) => q && typeof q.text === 'string' && typeof q.id === 'string') : [];
}

function save(list: CustomQuestion[]) {
  writeJSON(CUSTOM_QUESTIONS_KEY, list);
  version++;
  for (const fn of listeners) {
    try {
      fn();
    } catch {
      /* a listener's problem is not ours */
    }
  }
}

/** Questions visible to this worker (their own plus their facility's), optionally for one visit. Oldest first. */
export function listCustomQuestions(filter: CustomQuestionFilter = {}): CustomQuestion[] {
  return all()
    .filter((q) => {
      if (filter.workerId || filter.facilityId) {
        const mine = (q.scope === 'worker' && q.ownerId === filter.workerId) || (q.scope === 'facility' && q.ownerId === filter.facilityId);
        if (!mine) return false;
      }
      if (filter.visitType || filter.templateId) return q.visitType === filter.visitType || q.visitType === filter.templateId;
      return true;
    })
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
}

export function addCustomQuestion(input: Omit<CustomQuestion, 'id' | 'createdAt'> & { createdAt?: string }): CustomQuestion {
  const text = input.text.trim().replace(/\s+/g, ' ');
  if (!text) throw new Error('Write the question first.');
  const q: CustomQuestion = {
    ...input,
    text: text.length > 240 ? text.slice(0, 240) : text,
    id: `cq-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
  save([...all(), q]);
  return q;
}

export function deleteCustomQuestion(id: string): boolean {
  const list = all();
  const next = list.filter((q) => q.id !== id);
  if (next.length === list.length) return false;
  save(next);
  return true;
}

export const customQuestionStore = {
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  getVersion: () => version,
};

/** Answers are written into the visit event's note as `cq:<id>=<answer>` pairs (URL-encoded). */
export function encodeCustomAnswers(answers: Array<{ question: CustomQuestion; answer: string }>): string {
  return answers
    .filter((a) => a.answer.trim())
    .map((a) => `cq:${a.question.id}=${encodeURIComponent(`${a.question.text} -> ${a.answer.trim()}`)}`)
    .join('|');
}

export function decodeCustomAnswers(note: string | undefined): Array<{ id: string; question: string; answer: string }> {
  if (!note) return [];
  const out: Array<{ id: string; question: string; answer: string }> = [];
  for (const part of note.split('|')) {
    const m = part.match(/^cq:([^=]+)=(.*)$/);
    if (!m) continue;
    let text = m[2];
    try {
      text = decodeURIComponent(text);
    } catch {
      /* keep raw */
    }
    const [question, answer] = text.split(' -> ');
    out.push({ id: m[1], question: question ?? '', answer: answer ?? '' });
  }
  return out;
}
