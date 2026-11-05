import type { CarePlan, Mother } from '../types';
import { useApp } from '../store';
import { IMMUNISATION_SCHEDULES } from '../clinical';
import { Empty, Sparkline } from './components';
import { addDays, babyAge, daysBetween, fmtDate, toDate } from './format';

const FEEDING: Record<string, string> = {
  exclusive_breastfeeding: 'Breast milk only',
  mixed: 'Breast milk and formula',
  formula: 'Formula',
  complementary_with_breastmilk: 'Family foods and breast milk',
  complementary_no_breastmilk: 'Family foods, no breast milk',
};

export function BabyTab({ mother, plan, onRecord }: { mother: Mother; plan: CarePlan; onRecord: () => void }) {
  const { state } = useApp();
  const child = plan.state.infant ?? mother.children[mother.children.length - 1];
  if (!child) {
    return (
      <Empty art="skin_to_skin" title={plan.state.stage === 'pregnancy' ? 'Her baby is not born yet' : 'No baby recorded'}>
        {plan.state.stage === 'pregnancy' ? 'After the birth, record birth details and the baby’s page fills in.' : 'Record birth details to start the baby’s page.'}
        <div style={{ marginTop: 10 }}>
          <button className="btn small" onClick={onRecord}>
            Record birth details
          </button>
        </div>
      </Empty>
    );
  }
  const ageDays = daysBetween(child.dob, state.clock);
  const growth = mother.events
    .filter((e) => e.kind === 'growth' && (!e.childId || e.childId === child.id) && e.weightKg)
    .sort((a, b) => (a.at < b.at ? -1 : 1))
    .map((e) => ({ x: daysBetween(child.dob, e.at), y: (e as { weightKg: number }).weightKg }));
  const points = [{ x: 0, y: child.birthWeightKg }, ...growth.filter((g) => g.x > 0)];
  const latest = points[points.length - 1];
  const given = new Set(
    mother.events.filter((e) => e.kind === 'immunisation' && (!e.childId || e.childId === child.id)).flatMap((e) => (e.kind === 'immunisation' ? e.vaccines : [])),
  );
  const schedule = (IMMUNISATION_SCHEDULES?.[mother.country] ?? []).filter((s) => s.ageDays <= 730);

  // A rough reference: WHO median weight-for-age, sexes averaged, by day.
  const ref = [
    [0, 3.3],
    [30, 4.4],
    [61, 5.4],
    [91, 6.2],
    [122, 6.8],
    [183, 7.6],
    [274, 8.6],
    [365, 9.4],
    [548, 10.8],
    [730, 12.0],
  ].filter(([d]) => d <= Math.max(ageDays + 30, 120));

  return (
    <div className="section" style={{ gap: 30 }}>
      <section className="section">
        <h2 className="t-h2">{child.name}</h2>
        <dl className="kv">
          <dt>Age</dt>
          <dd>
            {babyAge(ageDays)}, born {fmtDate(child.dob, { year: true })}
          </dd>
          <dt>Sex</dt>
          <dd>{child.sex === 'F' ? 'Girl' : 'Boy'}</dd>
          <dt>Born at</dt>
          <dd>
            {child.gestationAtBirthWeeks} weeks, {child.birthWeightKg} kg
            {child.birthWeightKg < 2.5 ? ' (low birth weight)' : ''}
          </dd>
          <dt>Feeding</dt>
          <dd>{FEEDING[child.feeding] ?? child.feeding}</dd>
        </dl>
      </section>

      <section className="section">
        <div className="section-head">
          <h2 className="t-h2">Growth</h2>
          {latest ? <span className="small soft num">Latest {latest.y} kg</span> : null}
        </div>
        <div className="trend">
          <Sparkline
            points={points}
            points2={ref.map(([x, y]) => ({ x, y }))}
            height={90}
            color="var(--green)"
            color2="var(--line-2)"
            title={`Weight in kilograms by age in days: ${points.map((p) => `${p.y} at day ${p.x}`).join(', ')}. Grey line is the typical weight for age.`}
          />
          <span className="tiny muted">Green: her weight. Grey: typical weight for age (WHO median). {points.length < 2 ? 'Record a weight to see the curve.' : ''}</span>
        </div>
      </section>

      {(() => {
        const next = schedule.find((s) => !s.vaccines.every((v) => given.has(v)));
        if (!next) return null;
        const due = addDays(child.dob, next.ageDays);
        const MILESTONES: Array<[number, string]> = [
          [42, 'Smiles back at you'],
          [120, 'Holds head steady, reaches for things'],
          [183, 'Sits with support, starts family foods with breast milk'],
          [274, 'Sits alone, picks up small things'],
          [365, 'Stands holding on, says a first word'],
          [548, 'Walks alone, says several words'],
          [730, 'Runs, puts two words together'],
        ];
        const milestone = MILESTONES.find(([d]) => d >= ageDays);
        return (
          <section className="panel section" style={{ gap: 8 }} aria-label="Next visit">
            <span className="t-label">Next visit: {next.label.toLowerCase()}, {fmtDate(due, { weekday: true })}</span>
            <p>
              Vaccines due: <strong>{next.vaccines.join(', ')}</strong>
            </p>
            {milestone ? <p className="soft small">Check: {milestone[1].toLowerCase()} (by {babyAge(milestone[0])}).</p> : null}
          </section>
        );
      })()}

      <section className="section">
        <h2 className="t-h2">Immunisations</h2>
        {schedule.length ? (
          <ul className="imm">
            {schedule.map((s) => {
              const due = addDays(child.dob, s.ageDays);
              const done = s.vaccines.every((v) => given.has(v));
              const some = s.vaccines.some((v) => given.has(v));
              const late = !done && daysBetween(due, state.clock) > 14;
              const now = !done && !late && daysBetween(due, state.clock) >= -7;
              return (
                <li key={s.label}>
                  <span className="soft">{s.label}</span>
                  <span>
                    {s.vaccines.join(', ')}
                    <div className="tiny muted">{fmtDate(due, { year: true })}</div>
                  </span>
                  {done ? (
                    <span className="chip green">Given</span>
                  ) : late ? (
                    <span className="chip red">{some ? 'Partly given, overdue' : 'Overdue'}</span>
                  ) : now ? (
                    <span className="chip amber">Due now</span>
                  ) : toDate(due) > toDate(state.clock) ? (
                    <span className="chip outline">Later</span>
                  ) : (
                    <span className="chip amber">Due</span>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="soft">No schedule for this country yet.</p>
        )}
      </section>
    </div>
  );
}
