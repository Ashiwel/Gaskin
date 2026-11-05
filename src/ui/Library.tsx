import { useMemo, useState } from 'react';
import type { EvidenceGrade, TraditionalPractice } from '../types';
import { useApp } from '../store';
import { CITATIONS, TRADITIONAL_PRACTICES } from '../clinical';
import { COUNTRIES, LANGUAGE_NAMES } from '../data';
import { useNav } from './nav';
import { Empty, Grade, gradeLabel } from './components';
import { ISearch } from './icons';

const TRAD_GRADES = ['trad_supported', 'trad_plausible', 'trad_neutral', 'trad_harmful'] as const;
const ALL_GRADES: EvidenceGrade[] = ['A', 'B', 'C', 'trad_supported', 'trad_plausible', 'trad_neutral', 'trad_harmful', 'expert'];

function HowDiagram() {
  // Three lanes: the rules engine decides safety, AI only words things, experts change the rules on a schedule.
  return (
    <div className="diagram">
      <svg viewBox="0 0 760 260" role="img" aria-label="How Gaskin decides: her records go to the rules engine which builds the plan and alerts. AI only rewrites wording and is checked. Expert changes feed back into the rules after review.">
        <defs>
          <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="var(--ink-3)" />
          </marker>
        </defs>
        <g fontSize="13" fill="var(--ink)">
          <rect x="10" y="90" width="140" height="70" rx="12" fill="var(--card)" stroke="var(--line-2)" />
          <text x="80" y="120" textAnchor="middle" fontWeight="600">
            Her records
          </text>
          <text x="80" y="140" textAnchor="middle" fill="var(--ink-3)" fontSize="11.5">
            visits, readings, replies
          </text>

          <rect x="220" y="80" width="190" height="90" rx="12" fill="var(--ink)" />
          <text x="315" y="114" textAnchor="middle" fontWeight="600" fill="var(--paper)">
            Rules engine
          </text>
          <text x="315" y="134" textAnchor="middle" fill="var(--paper)" fontSize="11.5" opacity="0.8">
            WHO and national guidelines
          </text>
          <text x="315" y="152" textAnchor="middle" fill="var(--paper)" fontSize="11.5" opacity="0.8">
            decides every safety item
          </text>

          <rect x="480" y="80" width="130" height="90" rx="12" fill="var(--card)" stroke="var(--clay)" strokeWidth="1.5" />
          <text x="545" y="118" textAnchor="middle" fontWeight="600">
            Her plan
          </text>
          <text x="545" y="138" textAnchor="middle" fill="var(--ink-3)" fontSize="11.5">
            and danger alerts
          </text>

          <rect x="640" y="20" width="110" height="64" rx="12" fill="var(--card)" stroke="var(--line-2)" />
          <text x="695" y="48" textAnchor="middle" fontWeight="600">
            AI
          </text>
          <text x="695" y="66" textAnchor="middle" fill="var(--ink-3)" fontSize="11.5">
            words, language
          </text>

          <rect x="640" y="170" width="110" height="64" rx="12" fill="var(--card)" stroke="var(--line-2)" />
          <text x="695" y="198" textAnchor="middle" fontWeight="600">
            Worker
          </text>
          <text x="695" y="216" textAnchor="middle" fill="var(--ink-3)" fontSize="11.5">
            reviews, sends
          </text>

          <rect x="190" y="196" width="250" height="56" rx="12" fill="var(--clay-soft)" stroke="var(--clay)" />
          <text x="315" y="219" textAnchor="middle" fontWeight="600">
            Expert review board
          </text>
          <text x="315" y="238" textAnchor="middle" fill="var(--ink-2)" fontSize="11.5">
            approves changes, released on a schedule
          </text>
        </g>
        <g stroke="var(--ink-3)" strokeWidth="1.5" fill="none" markerEnd="url(#arr)">
          <path d="M150 125 H216" />
          <path d="M410 125 H476" />
          <path d="M610 105 C625 95 630 70 636 60" />
          <path d="M695 84 V166" />
          <path d="M640 210 C580 226 500 228 444 226" />
          <path d="M315 196 V174" />
        </g>
        <text x="560" y="40" fontSize="11" fill="var(--ink-3)" textAnchor="end">
          checked by guardrails
        </text>
        <text x="610" y="252" fontSize="11" fill="var(--ink-3)" textAnchor="end">
          overrides with reasons
        </text>
      </svg>
    </div>
  );
}

function PracticeEntry({ p }: { p: TraditionalPractice }) {
  const local = p.localNames ? Object.entries(p.localNames) : [];
  return (
    <article className="entry" data-practice={p.id}>
      <div className="entry-head">
        <h3>{p.name}</h3>
        <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <Grade g={p.grade} />
          <span className="small soft">{gradeLabel(p.grade).label}</span>
        </span>
      </div>
      <p className="small muted">
        {p.countries.map((c) => COUNTRIES[c]?.name ?? c).join(', ')}
        {p.groups?.length ? ` · ${p.groups.join(', ')}` : ''}
        {local.length ? ` · ${local.map(([l, n]) => `${n} (${LANGUAGE_NAMES[l as keyof typeof LANGUAGE_NAMES] ?? l})`).join(', ')}` : ''}
      </p>
      <p className="soft" style={{ maxWidth: '70ch' }}>
        {p.description}
      </p>
      <details>
        <summary>What the evidence says and what to say</summary>
        <div className="body">
          <p>
            <strong>Evidence.</strong> {p.evidenceSummary}
          </p>
          <p>
            <strong>How to respond.</strong> {p.guidance}
          </p>
          <p className="serif" style={{ fontSize: 16, fontStyle: 'italic' }}>
            “{p.motherText}”
          </p>
          {p.sources.length ? (
            <p className="small">
              {p.sources.map((s, i) => (
                <span key={s.id}>
                  {i ? ' · ' : ''}
                  {s.url ? (
                    <a href={s.url} target="_blank" rel="noreferrer">
                      {s.label}
                    </a>
                  ) : (
                    s.label
                  )}
                </span>
              ))}
            </p>
          ) : null}
        </div>
      </details>
    </article>
  );
}

export function Library({ page = 'practices' }: { page?: 'practices' | 'how' | 'sources' }) {
  const { state } = useApp();
  const { go } = useNav();
  const [grade, setGrade] = useState<string>('all');
  const [q, setQ] = useState('');
  const practices = useMemo(
    () =>
      (TRADITIONAL_PRACTICES ?? []).filter((p) => {
        if (state.country !== 'ALL' && !p.countries.includes(state.country)) return false;
        if (grade !== 'all' && p.grade !== grade) return false;
        if (q.trim() && !`${p.name} ${p.description} ${Object.values(p.localNames ?? {}).join(' ')}`.toLowerCase().includes(q.trim().toLowerCase())) return false;
        return true;
      }),
    [state.country, grade, q],
  );
  const set = (p: 'practices' | 'how' | 'sources') => go({ name: 'library', page: p }, { replace: true });

  return (
    <div className="page narrow">
      <header className="today-head">
        <h1 className="t-display">Library</h1>
        <p className="lede">The knowledge Gaskin uses, open for anyone to read and challenge. Library v{state.libraryVersion}.</p>
      </header>
      <div className="tabs" role="tablist">
        {(
          [
            ['practices', 'Traditional practices'],
            ['how', 'How Gaskin decides'],
            ['sources', 'Evidence and sources'],
          ] as const
        ).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={page === k} onClick={() => set(k)}>
            {l}
          </button>
        ))}
      </div>

      {page === 'practices' ? (
        <section className="section">
          <p className="soft" style={{ maxWidth: '66ch' }}>
            Many families follow practices passed down through generations. Gaskin grades each one so you can affirm what helps, adapt what is unclear, and gently reframe what harms.
          </p>
          <label className="search">
            <ISearch />
            <span className="sr">Search practices</span>
            <input className="input" id="lib-search" placeholder="Search, for example omugwo or agbo" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <div className="filters">
            <div className="group">
              <button className="filter-chip" aria-pressed={grade === 'all'} onClick={() => setGrade('all')}>
                All grades
              </button>
              {TRAD_GRADES.map((g) => (
                <button key={g} className="filter-chip" aria-pressed={grade === g} onClick={() => setGrade(g)}>
                  {gradeLabel(g).label}
                </button>
              ))}
            </div>
          </div>
          {practices.length ? (
            <div className="entries">
              {practices.map((p) => (
                <PracticeEntry key={p.id} p={p} />
              ))}
            </div>
          ) : (
            <Empty art="family_support" title="No practices match">
              Try another grade or country.
            </Empty>
          )}
        </section>
      ) : null}

      {page === 'how' ? (
        <section className="section" style={{ gap: 22 }}>
          <HowDiagram />
          <div className="prose">
            <h3>Rules decide what is safe</h3>
            <p>
              Every item in a plan, and every danger alert, comes from written rules based on WHO guidance and the national guidelines of Nigeria, Kenya and Ghana. The same facts always give the same plan. Each item shows why it is there and where the advice comes from.
            </p>
            <h3>AI helps with words, never with safety</h3>
            <p>
              AI can turn a plan into a warm message in her language, explain a plan in plain words, read a doctor’s note, or suggest comfort and family support ideas. It cannot add or remove a safety item. Every AI message is checked for medicine doses, missing danger signs and personal details, and a health worker reads it before it is sent. Gaskin works fully with AI switched off.
            </p>
            <h3>Experts teach the system, slowly and in the open</h3>
            <p>
              When a midwife changes a plan, she gives a reason. If several workers make the same change for similar mothers, it becomes a proposal. A clinical reviewer approves, rejects or asks for evidence. Approved changes are released together in a numbered library version. Gaskin never retrains itself live.
            </p>
            <h3>Safety items are locked</h3>
            <p>Items marked with a lock, like danger signs and iron in pregnancy, cannot be removed by one person. A worker can send them for review, and they stay in the plan meanwhile.</p>
          </div>
        </section>
      ) : null}

      {page === 'sources' ? (
        <section className="section" style={{ gap: 24 }}>
          <div className="section">
            <h2 className="t-h2">Evidence grades</h2>
            <div className="legend">
              {ALL_GRADES.map((g) => (
                <div className="legend-row" key={g}>
                  <span>
                    <Grade g={g} /> <span className="small">{gradeLabel(g).label}</span>
                  </span>
                  <span className="small soft">{gradeLabel(g).description}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="section">
            <h2 className="t-h2">National guidelines</h2>
            {(['NG', 'KE', 'GH'] as const).map((c) => (
              <div key={c} style={{ display: 'grid', gap: 4 }}>
                <strong>{COUNTRIES[c]?.name}</strong>
                <ul className="small soft" style={{ margin: 0, paddingLeft: 18 }}>
                  {(COUNTRIES[c]?.guidelineSources ?? []).map((s) => (
                    <li key={s.id}>
                      {s.url ? (
                        <a href={s.url} target="_blank" rel="noreferrer">
                          {s.label}
                        </a>
                      ) : (
                        s.label
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="section">
            <h2 className="t-h2">All sources</h2>
            <ul className="small soft" style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 4 }}>
              {Object.values(CITATIONS ?? {}).map((s) => (
                <li key={s.id}>
                  {s.url ? (
                    <a href={s.url} target="_blank" rel="noreferrer">
                      {s.label}
                    </a>
                  ) : (
                    s.label
                  )}
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}
    </div>
  );
}
