/**
 * Edinburgh Postnatal Depression Scale: 10 items, scored 0 to 3, total 0 to 30.
 *
 * `q` and `opts` are the validated wording (Cox, Holden & Sagovsky 1987). `ask` and `plain` are
 * the same questions as a health worker says them aloud, in simple words; the scores are the same,
 * in the same order. The visits module's EPDS_PLAIN (when present) is preferred over this copy.
 */

export interface EpdsItem {
  /** Validated wording */
  q: string;
  opts: Array<[string, number]>;
  /** The question as the worker asks it */
  ask: string;
  /** Plain answer labels, same order and scores as `opts` */
  plain: string[];
}

export const EPDS: EpdsItem[] = [
  { q: 'I have been able to laugh and see the funny side of things', opts: [['As much as I always could', 0], ['Not quite so much now', 1], ['Definitely not so much now', 2], ['Not at all', 3]], ask: 'In the last 7 days, have you been able to laugh and enjoy funny things?', plain: ['As much as before', 'A bit less', 'Much less', 'Not at all'] },
  { q: 'I have looked forward with enjoyment to things', opts: [['As much as I ever did', 0], ['Rather less than I used to', 1], ['Definitely less than I used to', 2], ['Hardly at all', 3]], ask: 'In the last 7 days, have you looked forward to things with happiness?', plain: ['As much as before', 'A bit less', 'Much less', 'Hardly at all'] },
  { q: 'I have blamed myself unnecessarily when things went wrong', opts: [['Yes, most of the time', 3], ['Yes, some of the time', 2], ['Not very often', 1], ['No, never', 0]], ask: 'In the last 7 days, when things went wrong, have you blamed yourself when it was not your fault?', plain: ['Yes, most of the time', 'Yes, sometimes', 'Not often', 'No, never'] },
  { q: 'I have been anxious or worried for no good reason', opts: [['No, not at all', 0], ['Hardly ever', 1], ['Yes, sometimes', 2], ['Yes, very often', 3]], ask: 'In the last 7 days, have you felt worried or nervous without a clear reason?', plain: ['No, not at all', 'Hardly ever', 'Yes, sometimes', 'Yes, very often'] },
  { q: 'I have felt scared or panicky for no very good reason', opts: [['Yes, quite a lot', 3], ['Yes, sometimes', 2], ['No, not much', 1], ['No, not at all', 0]], ask: 'In the last 7 days, have you felt scared or panicky without a clear reason?', plain: ['Yes, a lot', 'Yes, sometimes', 'No, not much', 'No, not at all'] },
  { q: 'Things have been getting on top of me', opts: [['Yes, most of the time I haven’t been able to cope at all', 3], ['Yes, sometimes I haven’t been coping as well as usual', 2], ['No, most of the time I have coped quite well', 1], ['No, I have been coping as well as ever', 0]], ask: 'In the last 7 days, have things felt like too much for you to manage?', plain: ['Yes, I could not cope most of the time', 'Yes, sometimes I coped less well', 'No, I mostly coped well', 'No, I coped as well as ever'] },
  { q: 'I have been so unhappy that I have had difficulty sleeping', opts: [['Yes, most of the time', 3], ['Yes, sometimes', 2], ['Not very often', 1], ['No, not at all', 0]], ask: 'In the last 7 days, have you been so unhappy that it was hard to sleep?', plain: ['Yes, most of the time', 'Yes, sometimes', 'Not often', 'No, not at all'] },
  { q: 'I have felt sad or miserable', opts: [['Yes, most of the time', 3], ['Yes, quite often', 2], ['Not very often', 1], ['No, not at all', 0]], ask: 'In the last 7 days, have you felt sad or very low?', plain: ['Yes, most of the time', 'Yes, quite often', 'Not often', 'No, not at all'] },
  { q: 'I have been so unhappy that I have been crying', opts: [['Yes, most of the time', 3], ['Yes, quite often', 2], ['Only occasionally', 1], ['No, never', 0]], ask: 'In the last 7 days, have you been so unhappy that you cried?', plain: ['Yes, most of the time', 'Yes, quite often', 'Only now and then', 'No, never'] },
  { q: 'The thought of harming myself has occurred to me', opts: [['Yes, quite often', 3], ['Sometimes', 2], ['Hardly ever', 1], ['Never', 0]], ask: 'In the last 7 days, have you had thoughts of hurting yourself?', plain: ['Yes, quite often', 'Sometimes', 'Hardly ever', 'Never'] },
];

export function epdsScore(answers: Array<number | null>): { score: number; complete: boolean; selfHarm: boolean } {
  const score = answers.reduce<number>((s, a) => s + (a ?? 0), 0);
  return { score, complete: answers.every((a) => a !== null), selfHarm: (answers[9] ?? 0) > 0 };
}

/** What a total means, in the worker's words. Cut-offs: 10 possible, 13 likely (WHO mhGAP; Adewuya et al. in Nigeria). */
export function epdsBand(score: number, selfHarm: boolean): { tone: 'success' | 'warning' | 'error'; word: string; todo: string } {
  if (selfHarm) return { tone: 'error', word: 'Safety concern', todo: 'She answered yes to hurting herself. Stay with her, ask about a plan, and get help today.' };
  if (score >= 13) return { tone: 'error', word: 'Likely depression', todo: 'Refer for support today, and offer Thinking Healthy sessions.' };
  if (score >= 10) return { tone: 'warning', word: 'Possible depression', todo: 'Talk with her, involve family support, and repeat the check in 2 weeks.' };
  return { tone: 'success', word: 'Below the cut-off', todo: 'Ask again at the next check.' };
}
