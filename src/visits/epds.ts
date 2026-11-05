/**
 * EPDS items for the in-visit screen. The UI module keeps its own copy (src/ui/epdsData.ts);
 * this one keeps the visits module self-contained. Cox, Holden & Sagovsky 1987; validated in
 * Nigerian women (Adewuya et al.).
 */
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
