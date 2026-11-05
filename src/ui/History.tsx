import type { CarePlan, Mother } from '../types';
import { CONDITION_LABELS, TRADITIONAL_PRACTICES } from '../clinical';
import { Grade } from './components';
import { fmtDate } from './format';
import { LANGUAGE_NAMES } from '../data';

const INCOME: Record<string, string> = { very_low: 'Very low', low: 'Low', middle: 'Middle', high: 'Higher' };
const LITERACY: Record<string, string> = { none: 'Does not read', basic: 'Reads a little', good: 'Reads well' };

export function History({ mother, plan }: { mother: Mother; plan: CarePlan }) {
  const practices = mother.practicesMentioned.map((id) => (TRADITIONAL_PRACTICES ?? []).find((p) => p.id === id)).filter(Boolean);
  const meds = mother.medications;
  return (
    <div className="section" style={{ gap: 30 }}>
      <section className="section">
        <h2 className="t-h2">Pregnancies and births</h2>
        <dl className="kv">
          <dt>Pregnancies, births</dt>
          <dd>
            {mother.gravida} pregnancies, {mother.parity} births (G{mother.gravida}P{mother.parity})
          </dd>
          <dt>Previous caesarean</dt>
          <dd>{mother.previousCaesarean ? 'Yes' : 'No'}</dd>
          <dt>Previous stillbirth</dt>
          <dd>{mother.previousStillbirth ? 'Yes' : 'No'}</dd>
          <dt>Heavy bleeding after a birth</dt>
          <dd>{mother.previousPPH ? 'Yes' : 'No'}</dd>
          {mother.pregnancy ? (
            <>
              <dt>Last period</dt>
              <dd>{fmtDate(mother.pregnancy.lmp, { year: true })}</dd>
              <dt>Due date</dt>
              <dd>{plan.state.edd ? fmtDate(plan.state.edd, { year: true }) : 'Not known'}</dd>
              <dt>Babies</dt>
              <dd>{mother.pregnancy.fetuses === 2 ? 'Twins' : mother.pregnancy.fetuses > 2 ? `${mother.pregnancy.fetuses}` : 'One'}</dd>
              <dt>Plans to give birth</dt>
              <dd>{mother.pregnancy.plannedBirthPlace === 'facility' ? 'At a facility' : mother.pregnancy.plannedBirthPlace === 'tba' ? 'With a traditional birth attendant' : mother.pregnancy.plannedBirthPlace === 'home' ? 'At home' : 'Not decided'}</dd>
            </>
          ) : null}
          {mother.birth ? (
            <>
              <dt>Latest birth</dt>
              <dd>
                {fmtDate(mother.birth.date, { year: true })}, {mother.birth.mode}, {mother.birth.place.replace('_', ' ')}
                {mother.birth.bloodLossMl ? `, blood loss ${mother.birth.bloodLossMl} ml` : ''}
              </dd>
            </>
          ) : null}
        </dl>
      </section>

      <section className="section">
        <h2 className="t-h2">Health</h2>
        <dl className="kv">
          <dt>Conditions</dt>
          <dd>{mother.conditions.length ? mother.conditions.map((c) => CONDITION_LABELS[c] ?? c).join(', ') : 'None recorded'}</dd>
          <dt>Allergies</dt>
          <dd>{mother.allergies.length ? mother.allergies.join(', ') : 'None known'}</dd>
          <dt>Genotype</dt>
          <dd>{mother.genotype === 'unknown' ? 'Not yet tested' : mother.genotype}</dd>
          <dt>Blood group</dt>
          <dd>{mother.bloodGroup ?? 'Not yet tested'}</dd>
          <dt>Height, weight before</dt>
          <dd>
            {mother.heightCm ? `${mother.heightCm} cm` : 'height not recorded'}
            {mother.prePregnancyWeightKg ? `, ${mother.prePregnancyWeightKg} kg` : ''}
          </dd>
        </dl>
      </section>

      <section className="section">
        <h2 className="t-h2">Medicines</h2>
        {meds.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Medicine</th>
                  <th>Dose</th>
                  <th>Since</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {meds.map((m, i) => (
                  <tr key={i}>
                    <td>{m.name}</td>
                    <td>{[m.dose, m.frequency].filter(Boolean).join(', ') || '–'}</td>
                    <td>{fmtDate(m.startedAt, { year: true })}</td>
                    <td>{m.stoppedAt ? `Stopped ${fmtDate(m.stoppedAt)}` : 'Taking'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="soft">No medicines recorded.</p>
        )}
      </section>

      <section className="section">
        <h2 className="t-h2">Traditional practices</h2>
        {practices.length ? (
          <ul className="support">
            {practices.map((p) =>
              p ? (
                <li key={p.id}>
                  <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <Grade g={p.grade} /> <strong>{p.name}</strong>
                  </span>
                  <span className="soft">{p.guidance}</span>
                </li>
              ) : null,
            )}
          </ul>
        ) : (
          <p className="soft">None mentioned yet. Ask gently about what her family plans after the birth.</p>
        )}
      </section>

      <section className="section">
        <h2 className="t-h2">Her circumstances</h2>
        <dl className="kv">
          <dt>Language</dt>
          <dd>{LANGUAGE_NAMES[mother.language] ?? mother.language}</dd>
          <dt>Reading</dt>
          <dd>{LITERACY[mother.literacy]}</dd>
          <dt>Household income</dt>
          <dd>{INCOME[mother.incomeBand]}</dd>
          {mother.occupation ? (
            <>
              <dt>Work</dt>
              <dd>{mother.occupation}</dd>
            </>
          ) : null}
          {mother.householdNotes ? (
            <>
              <dt>Household</dt>
              <dd>{mother.householdNotes}</dd>
            </>
          ) : null}
          <dt>Enrolled</dt>
          <dd>{fmtDate(mother.enrolledAt, { year: true })}</dd>
        </dl>
      </section>
    </div>
  );
}
