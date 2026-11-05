import type { Citation } from '../types';
import { CITATIONS } from '../clinical';

/**
 * Sources the visit checklists cite that are not in the clinical knowledge base.
 * The clinical CITATIONS table is reused for everything else.
 */
const list: Citation[] = [
  {
    id: 'who-pcpnc-2015',
    label: 'WHO Pregnancy, childbirth, postpartum and newborn care: a guide for essential practice, 3rd ed., 2015 (newborn examination, postpartum checks)',
    url: 'https://www.who.int/publications/i/item/9789241549356',
  },
  {
    id: 'who-motor-2006',
    label: 'WHO Multicentre Growth Reference Study Group: WHO Motor Development Study, windows of achievement for six gross motor milestones, Acta Paediatr 2006',
    url: 'https://pubmed.ncbi.nlm.nih.gov/16817682/',
  },
  {
    id: 'cdc-ltsae-2022',
    label: 'CDC "Learn the Signs. Act Early." developmental milestones, 2022 revision (milestones most children (75%) reach by each age)',
    url: 'https://www.cdc.gov/act-early/milestones/index.html',
  },
  {
    id: 'zubler-2022',
    label: 'Zubler et al., Pediatrics 2022;149(3):e2021052138: evidence-informed milestones for developmental surveillance tools (CDC/AAP)',
    url: 'https://pubmed.ncbi.nlm.nih.gov/35132439/',
  },
  {
    id: 'kramer-1969',
    label: 'Kramer LI, Am J Dis Child 1969: advancement of dermal icterus in the jaundiced newborn (Kramer zones 1 to 5)',
    url: 'https://pubmed.ncbi.nlm.nih.gov/?term=Kramer+advancement+of+dermal+icterus+jaundiced+newborn',
  },
  {
    id: 'who-imci-2014',
    label: 'WHO/UNICEF Integrated Management of Childhood Illness chart booklet, 2014 (general danger signs, fast breathing, MUAC)',
  },
  {
    id: 'who-newborn-2017',
    label: 'WHO recommendations on newborn health, 2017 (vitamin K 1 mg IM at birth, eye prophylaxis)',
  },
  {
    id: 'ponseti-global-help',
    label: 'Staheli L, Clubfoot: Ponseti management, 3rd ed., Global HELP 2009 (casting works best when started in the first weeks)',
  },
  {
    id: 'who-deworming-2017',
    label: 'WHO 2017 guideline: preventive chemotherapy for soil-transmitted helminths in children 12 to 59 months',
    url: 'https://www.who.int/publications/i/item/9789241550116',
  },
  {
    id: 'who-growth-standards-2006',
    label: 'WHO Child Growth Standards, 2006 (weight, length and head circumference monitoring)',
    url: 'https://www.who.int/tools/child-growth-standards',
  },
];

export const VISIT_CITATIONS: Record<string, Citation> = Object.fromEntries(list.map((c) => [c.id, c]));

/** Resolve citation ids from the visit list or the clinical knowledge base. Throws on an unknown id. */
export function src(...ids: string[]): Citation[] {
  return ids.map((id) => {
    const c = VISIT_CITATIONS[id] ?? CITATIONS[id];
    if (!c) throw new Error(`Unknown citation id: ${id}`);
    return c;
  });
}
