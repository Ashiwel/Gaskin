/**
 * EPDS (Edinburgh Postnatal Depression Scale; Cox, Holden and Sagovsky 1987), validated in Nigerian
 * women (Adewuya et al.).
 *
 * Two wordings:
 * - `ask` and `plain`: plain-language questions for the worker to read aloud, addressed to the mother
 *   ("In the last 7 days, have you..."), with simple answer labels. Scores are unchanged.
 * - `standard` and `standardOpts`: the published item text, kept for fidelity and for anyone who must
 *   use the validated form word for word.
 *
 * EPDS_WORDING_NOTE explains the trade-off; show it beside the "Standard wording" switch.
 */
export interface EpdsPlainItem {
  /** Plain question, read aloud to the mother */
  ask: string;
  /** Plain answer labels with their scores, in the standard order */
  opts: Array<[string, number]>;
  /** Standard (validated) item text */
  standard: string;
  standardOpts: Array<[string, number]>;
}

/** The standard items (first-person statements), unchanged. Kept for backwards compatibility. */
export const EPDS_ITEMS: Array<{ q: string; opts: Array<[string, number]> }> = [
  { q: 'I have been able to laugh and see the funny side of things', opts: [['As much as I always could', 0], ['Not quite so much now', 1], ['Definitely not so much now', 2], ['Not at all', 3]] },
  { q: 'I have looked forward with enjoyment to things', opts: [['As much as I ever did', 0], ['Rather less than I used to', 1], ['Definitely less than I used to', 2], ['Hardly at all', 3]] },
  { q: 'I have blamed myself unnecessarily when things went wrong', opts: [['Yes, most of the time', 3], ['Yes, some of the time', 2], ['Not very often', 1], ['No, never', 0]] },
  { q: 'I have been anxious or worried for no good reason', opts: [['No, not at all', 0], ['Hardly ever', 1], ['Yes, sometimes', 2], ['Yes, very often', 3]] },
  { q: 'I have felt scared or panicky for no very good reason', opts: [['Yes, quite a lot', 3], ['Yes, sometimes', 2], ['No, not much', 1], ['No, not at all', 0]] },
  { q: 'Things have been getting on top of me', opts: [['Yes, most of the time I haven’t been able to cope at all', 3], ['Yes, sometimes I haven’t been coping as well as usual', 2], ['No, most of the time I have coped quite well', 1], ['No, I have been coping as well as ever', 0]] },
  { q: 'I have been so unhappy that I have had difficulty sleeping', opts: [['Yes, most of the time', 3], ['Yes, sometimes', 2], ['Not very often', 1], ['No, not at all', 0]] },
  { q: 'I have felt sad or miserable', opts: [['Yes, most of the time', 3], ['Yes, quite often', 2], ['Not very often', 1], ['No, not at all', 0]] },
  { q: 'I have been so unhappy that I have been crying', opts: [['Yes, most of the time', 3], ['Yes, quite often', 2], ['Only occasionally', 1], ['No, never', 0]] },
  { q: 'The thought of harming myself has occurred to me', opts: [['Yes, quite often', 3], ['Sometimes', 2], ['Hardly ever', 1], ['Never', 0]] },
];

const PLAIN: Array<[string, string[]]> = [
  ['In the last 7 days, have you been able to laugh and enjoy funny things?', ['As much as before', 'A bit less than before', 'Much less than before', 'Not at all']],
  ['In the last 7 days, have you looked forward to things and felt happy about them?', ['As much as before', 'A bit less than before', 'Much less than before', 'Hardly at all']],
  ['In the last 7 days, when something went wrong, have you blamed yourself when it was not your fault?', ['Yes, most of the time', 'Yes, sometimes', 'Not often', 'No, never']],
  ['In the last 7 days, have you felt worried or nervous without a clear reason?', ['No, not at all', 'Hardly ever', 'Yes, sometimes', 'Yes, very often']],
  ['In the last 7 days, have you felt scared or panicky without a clear reason?', ['Yes, a lot', 'Yes, sometimes', 'No, not much', 'No, not at all']],
  ['In the last 7 days, have things felt like too much for you to manage?', ['Yes, most of the time I could not cope', 'Yes, sometimes I coped less well than usual', 'No, most of the time I coped well', 'No, I coped as well as ever']],
  ['In the last 7 days, have you been so unhappy that it was hard to sleep?', ['Yes, most of the time', 'Yes, sometimes', 'Not often', 'No, not at all']],
  ['In the last 7 days, have you felt sad or very low?', ['Yes, most of the time', 'Yes, quite often', 'Not often', 'No, not at all']],
  ['In the last 7 days, have you been so unhappy that you cried?', ['Yes, most of the time', 'Yes, quite often', 'Only now and then', 'No, never']],
  ['In the last 7 days, have you had thoughts of hurting yourself?', ['Yes, quite often', 'Sometimes', 'Hardly ever', 'Never']],
];

export const EPDS_PLAIN: EpdsPlainItem[] = EPDS_ITEMS.map((it, i) => ({
  ask: PLAIN[i][0],
  opts: it.opts.map(([, score], j) => [PLAIN[i][1][j], score] as [string, number]),
  standard: it.q,
  standardOpts: it.opts,
}));

export const EPDS_WORDING_NOTE =
  'The plain questions keep the meaning and the scores of the standard EPDS, but any change of wording can change how women answer, so the validated cut-offs may not hold exactly. The Nigerian validation (Adewuya et al.) used translated versions of the standard items. Use "Standard wording" where a study, audit or referral requires the validated form, and refer on clinical concern whatever the score.';

export function epdsScore(answers: Array<number | null>): { score: number; complete: boolean; selfHarm: boolean } {
  const score = answers.reduce<number>((s, a) => s + (a ?? 0), 0);
  return { score, complete: answers.every((a) => a !== null), selfHarm: (answers[9] ?? 0) > 0 };
}
