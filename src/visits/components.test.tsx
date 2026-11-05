import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { BirthEvent, Child } from '../types';
import { ev, makeMother } from '../engine/fixtures.test-helpers';
import { englishTemplate, renderMotherText } from '../i18n';
import { VisitChecklist } from './components/VisitChecklist';

const child: Child = { id: 'c1', name: 'Chidi', sex: 'M', dob: '2026-11-04', birthWeightKg: 3.1, gestationAtBirthWeeks: 39, feeding: 'exclusive_breastfeeding' };
const mother = makeMother({
  pregnancy: { lmp: '2026-01-25', fetuses: 1 },
  events: [ev<BirthEvent>({ kind: 'birth', at: '2026-11-04T06:00:00Z', birth: { date: '2026-11-04', mode: 'vaginal', place: 'facility', complications: ['none'] }, child })],
});

describe('VisitChecklist component (server render)', () => {
  it('renders the first section with steps, toggles and the why expander', () => {
    const html = renderToStaticMarkup(<VisitChecklist mother={mother} asOf="2026-11-05" workerLang="en" motherLang="en" onComplete={() => {}} onCancel={() => {}} />);
    expect(html).toContain('visit-root');
    expect(html).toContain('Postnatal check within 24 hours');
    expect(html).toContain('Check the baby');
    expect(html).toContain('Why this check');
    expect(html).toContain('visit-opt');
  });

  it('registers VISIT_TEXT with the language packs so mother lines render in her language or fall back to English', () => {
    renderToStaticMarkup(<VisitChecklist mother={mother} asOf="2026-11-05" workerLang="en" motherLang="sw" onComplete={() => {}} onCancel={() => {}} />);
    expect(englishTemplate('vt.finding.clubfoot')).toMatch(/foot/);
    const r = renderMotherText('vt.finding.clubfoot', { name: 'Chidi' }, 'sw');
    expect(r.text).toContain('Chidi');
    expect(['draft', 'fallback', 'reviewed']).toContain(r.confidence);
  });
});
