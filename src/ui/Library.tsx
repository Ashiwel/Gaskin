/**
 * Library: the knowledge Gaskin uses, open to read and challenge. Traditional practices as a
 * filterable grid of cards with grade badges and pictograms; guideline sources by country; the
 * evidence legend; and how Gaskin builds a plan, as a diagram. Links render only for http(s).
 */
import { useMemo, useState } from 'react';
import { BookOpen01, ChevronDown, SearchLg } from '@untitledui/icons';
import type { EvidenceGrade, IllustrationKey, JourneyStage, TraditionalPractice } from '../types';
import { useApp, useWorker } from '../store';
import { CITATIONS, TRADITIONAL_PRACTICES } from '../clinical';
import { COUNTRIES, LANGUAGE_NAMES } from '../data';
import { Badge } from '../components/base/badges/badges';
import { cx } from '../utils/cx';
import { useNav } from './nav';
import { Grade, gradeLabel, Illustration } from './components';
import { STAGE_LABELS } from './format';
import { Card, PageHeader, SafeLink, Segmented } from './messages/kit';
import { HowGaskinBuildsAPlan } from './review/HowDiagram';

const TRAD_GRADES = ['trad_supported', 'trad_plausible', 'trad_neutral', 'trad_harmful'] as const;
const ALL_GRADES: EvidenceGrade[] = ['A', 'B', 'C', 'expert', 'trad_supported', 'trad_plausible', 'trad_neutral', 'trad_harmful'];

/** What to do with each grade, as one word the worker can act on. */
const STANCE: Record<string, { word: string; tone: 'success' | 'brand' | 'gray' | 'error' }> = {
  trad_supported: { word: 'Affirm', tone: 'success' },
  trad_plausible: { word: 'Adapt', tone: 'brand' },
  trad_neutral: { word: 'Respect', tone: 'gray' },
  trad_harmful: { word: 'Reframe', tone: 'error' },
};

/** A pictogram for each practice, from its id and words (the drawings are shared with handouts). */
function pictogramFor(p: TraditionalPractice): IllustrationKey {
  const t = `${p.id} ${p.name}`.toLowerCase();
  if (/bleed/.test(t)) return 'danger_bleeding';
  if (/cord/.test(t)) return 'cord_care';
  if (/colostrum|prelacteal|breast|galactagogue|milk/.test(t)) return 'breastfeeding';
  if (/complementary/.test(t)) return 'complementary_food';
  if (/hot_water|compress|wankan|bath/.test(t)) return 'warm_baby';
  if (/pap|ogi|kunu|pepper|soup|moringa|food|eating|taboo|ginger|nzu|clay/.test(t)) return /taboo|protein/.test(t) ? 'protein_foods' : 'balanced_plate';
  if (/agbo|herb/.test(t)) return 'medicine';
  if (/massage|shea/.test(t)) return 'skin_to_skin';
  if (/omugwo|confinement|family|back_carrying/.test(t)) return 'family_support';
  if (/binder|uvul/.test(t)) return 'danger_breathing';
  if (/tba|birth/.test(t)) return 'clinic_visit';
  return 'family_support';
}

function PracticeCard({ p }: { p: TraditionalPractice }) {
  const [open, setOpen] = useState(false);
  const local = p.localNames ? Object.entries(p.localNames) : [];
  const stance = STANCE[p.grade];
  return (
    <article data-practice={p.id} className={cx('flex min-w-0 flex-col rounded-2xl bg-primary shadow-xs ring-1', p.grade === 'trad_harmful' ? 'ring-error_subtle' : 'ring-secondary')}>
      <div className="flex items-start gap-4 p-5">
        <div className="flex size-16 shrink-0 items-center justify-center rounded-xl bg-secondary ring-1 ring-secondary">
          <Illustration k={pictogramFor(p)} size={52} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            <Badge size="sm" color={stance.tone} type="pill-color">
              {stance.word}
            </Badge>
            <span className="inline-flex items-center gap-1 text-xs text-tertiary">
              <Grade g={p.grade} /> {gradeLabel(p.grade).label.replace(/^Tradition: /, '')}
            </span>
          </div>
          <h3 className="text-md font-semibold text-primary">{p.name}</h3>
          {local.length ? (
            <p className="mt-0.5 truncate text-sm text-tertiary">
              {local.map(([l, n]) => `${n} (${LANGUAGE_NAMES[l as keyof typeof LANGUAGE_NAMES] ?? l})`).join(' · ')}
            </p>
          ) : null}
        </div>
      </div>
      <p className="line-clamp-3 px-5 text-sm text-secondary">{p.description}</p>
      <div className="mt-3 flex flex-wrap gap-1 px-5">
        {p.stage.map((s: JourneyStage) => (
          <Badge key={s} size="sm" color="gray">
            {STAGE_LABELS[s]}
          </Badge>
        ))}
        {p.countries.map((c) => (
          <Badge key={c} size="sm" color="gray">
            {COUNTRIES[c]?.name ?? c}
          </Badge>
        ))}
      </div>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="mt-auto flex min-h-11 cursor-pointer items-center justify-between gap-2 border-t border-secondary px-5 py-3 text-sm font-semibold text-brand-secondary hover:bg-primary_hover">
        What the evidence says and what to say
        <ChevronDown aria-hidden="true" className={cx('size-4 transition', open && 'rotate-180')} />
      </button>
      {open ? (
        <div className="grid gap-3 border-t border-secondary px-5 py-4 text-sm">
          <p className="text-secondary">
            <strong className="font-semibold text-primary">Evidence. </strong>
            {p.evidenceSummary}
          </p>
          <p className="text-secondary">
            <strong className="font-semibold text-primary">How to respond. </strong>
            {p.guidance}
          </p>
          <blockquote className="rounded-lg bg-brand-primary p-3 text-md text-primary ring-1 ring-brand">“{p.motherText}”</blockquote>
          {p.sources.length ? (
            <ul className="grid gap-1">
              {p.sources.map((s) => (
                <li key={s.id} className="flex items-start gap-1.5 text-xs">
                  <BookOpen01 className="mt-0.5 size-3.5 shrink-0 text-fg-quaternary" aria-hidden="true" />
                  <SafeLink href={s.url}>{s.label}</SafeLink>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

export function Library({ page = 'practices' }: { page?: 'practices' | 'how' | 'sources' }) {
  const { state } = useApp();
  const worker = useWorker();
  const { go } = useNav();
  const [grade, setGrade] = useState<string>('all');
  const [stage, setStage] = useState<string>('all');
  const [q, setQ] = useState('');
  // Practices from the worker's own country first; the place is set at onboarding, not filtered here.
  const country = worker?.country;
  const practices = useMemo(
    () =>
      (TRADITIONAL_PRACTICES ?? [])
        .filter((p) => {
          if (grade !== 'all' && p.grade !== grade) return false;
          if (stage !== 'all' && !p.stage.includes(stage as JourneyStage)) return false;
          if (q.trim() && !`${p.name} ${p.description} ${Object.values(p.localNames ?? {}).join(' ')}`.toLowerCase().includes(q.trim().toLowerCase())) return false;
          return true;
        })
        .sort((a, b) => Number(!!country && b.countries.includes(country)) - Number(!!country && a.countries.includes(country)) || TRAD_GRADES.indexOf(a.grade) - TRAD_GRADES.indexOf(b.grade)),
    [grade, stage, q, country],
  );
  const counts = useMemo(() => Object.fromEntries(TRAD_GRADES.map((g) => [g, (TRADITIONAL_PRACTICES ?? []).filter((p) => p.grade === g).length])), []);
  const set = (p: 'practices' | 'how' | 'sources') => go({ name: 'library', page: p }, { replace: true });

  return (
    <div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-8">
      <PageHeader title="Library" lede={`The knowledge Gaskin uses, open for anyone to read and challenge. Library v${state.libraryVersion}.`} />
      <Segmented
        label="Library sections"
        value={page}
        onChange={set}
        options={[
          { id: 'practices', label: 'Traditional practices', count: TRADITIONAL_PRACTICES.length },
          { id: 'how', label: 'How Gaskin builds a plan' },
          { id: 'sources', label: 'Evidence and sources' },
        ]}
      />

      {page === 'practices' ? (
        <section className="grid gap-5">
          {/* Summary first: how the practices split by grade */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {TRAD_GRADES.map((g) => (
              <button
                key={g}
                type="button"
                aria-pressed={grade === g}
                onClick={() => setGrade(grade === g ? 'all' : g)}
                className={cx('flex cursor-pointer items-center gap-3 rounded-xl p-4 text-start ring-1 transition', grade === g ? 'bg-brand-primary ring-brand' : 'bg-primary ring-secondary hover:bg-primary_hover')}
              >
                <Grade g={g} />
                <span className="min-w-0">
                  <span className="block text-display-xs leading-none font-semibold text-primary tnum">{counts[g]}</span>
                  <span className="block text-sm text-tertiary">
                    {STANCE[g].word}: {gradeLabel(g).label.replace(/^Tradition: /, '').toLowerCase()}
                  </span>
                </span>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="relative min-w-[220px] flex-1">
              <span className="sr-only">Search practices</span>
              <SearchLg aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-quaternary" />
              <input
                id="lib-search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search, for example omugwo or agbo"
                className="h-11 w-full rounded-lg bg-primary pr-3 pl-9 text-md text-primary shadow-xs ring-1 ring-primary outline-none ring-inset placeholder:text-placeholder focus-visible:ring-2 focus-visible:ring-brand"
              />
            </label>
            <Segmented
              size="sm"
              label="Stage"
              value={stage}
              onChange={setStage}
              options={[
                { id: 'all', label: 'All stages' },
                { id: 'pregnancy', label: STAGE_LABELS.pregnancy },
                { id: 'postpartum', label: STAGE_LABELS.postpartum },
                { id: 'infant', label: STAGE_LABELS.infant },
              ]}
            />
          </div>
          {practices.length ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" data-testid="practice-grid">
              {practices.map((p) => (
                <PracticeCard key={p.id} p={p} />
              ))}
            </div>
          ) : (
            <Card>
              <p className="py-8 text-center text-sm text-tertiary">No practices match. Try another grade or stage.</p>
            </Card>
          )}
        </section>
      ) : null}

      {page === 'how' ? (
        <section className="grid gap-6">
          <Card className="p-4 sm:p-6">
            <HowGaskinBuildsAPlan />
          </Card>
          <div className="grid gap-4 md:grid-cols-2">
            {[
              ['Rules decide what is safe', 'Every item in a plan, and every danger alert, comes from written rules based on WHO guidance and national guidelines. The same facts always give the same plan, and each item shows why it is there and where the advice comes from.'],
              ['AI helps with words, never with safety', 'AI can turn a plan into a warm message in her language, explain a plan in plain words or read a doctor’s note. It cannot add or remove a safety item. Every AI message is checked, and a health worker reads it before it is sent. Gaskin works fully with AI switched off.'],
              ['Experts teach the system, slowly and in the open', 'When a midwife changes a plan she gives a reason. If several workers make the same change for similar mothers, it becomes a proposal. A clinical reviewer decides, and approved changes go out together in a numbered library release.'],
              ['Safety items are locked', 'Items marked with a lock, like danger signs and iron in pregnancy, cannot be removed by one person. A worker can send them for review, and they stay in the plan meanwhile.'],
            ].map(([h, b]) => (
              <Card key={h}>
                <h3 className="text-md font-semibold text-primary">{h}</h3>
                <p className="mt-1 text-sm text-secondary">{b}</p>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      {page === 'sources' ? (
        <section className="grid gap-6">
          <Card title="Evidence grades">
            <ul className="grid gap-3 sm:grid-cols-2" data-testid="evidence-legend">
              {ALL_GRADES.map((g) => (
                <li key={g} className="flex items-start gap-3 rounded-lg bg-secondary p-3">
                  <Grade g={g} />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-primary">{gradeLabel(g).label}</span>
                    <span className="block text-sm text-tertiary">{gradeLabel(g).description}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Card>
          <div className="grid gap-4 lg:grid-cols-3">
            {(Object.keys(COUNTRIES) as Array<keyof typeof COUNTRIES>).map((c) => (
              <Card key={c} title={`${COUNTRIES[c]?.name}: national guidelines`}>
                <ul className="grid gap-2">
                  {(COUNTRIES[c]?.guidelineSources ?? []).map((s) => (
                    <li key={s.id} className="flex items-start gap-2 text-sm">
                      <BookOpen01 className="mt-0.5 size-4 shrink-0 text-fg-quaternary" aria-hidden="true" />
                      <SafeLink href={s.url}>{s.label}</SafeLink>
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
          <Card title={`All sources (${Object.keys(CITATIONS ?? {}).length})`}>
            <ul className="grid gap-x-6 gap-y-2 text-sm md:grid-cols-2">
              {Object.values(CITATIONS ?? {}).map((s) => (
                <li key={s.id} className="min-w-0 break-words">
                  <SafeLink href={s.url}>{s.label}</SafeLink>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : null}
    </div>
  );
}
