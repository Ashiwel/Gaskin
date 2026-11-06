/**
 * Her history as pictures first: pregnancies and births as a row of chips (one per pregnancy,
 * coloured by outcome), the key risk flags, then conditions, medicines, allergies, genotype and
 * blood group, traditional practices, and her circumstances.
 */
import { AlertTriangle, Droplets01, HeartRounded, MedicalCross, ShieldTick, Stars02, Users01 } from '@untitledui/icons';
import type { CarePlan, Mother } from '../types';
import { CONDITION_LABELS, TRADITIONAL_PRACTICES } from '../clinical';
import { LANGUAGE_NAMES } from '../data';
import { fmtDate } from './format';
import { cx } from '../utils/cx';
import { Card, Chip, IconTile, SectionTitle } from './patient/ui';
import { GradeBadge } from './PlanView';

const INCOME: Record<string, string> = { very_low: 'Very low', low: 'Low', middle: 'Middle', high: 'Higher' };
const LITERACY: Record<string, string> = { none: 'Does not read', basic: 'Reads a little', good: 'Reads well' };
const GENOTYPE_TONE: Record<string, 'error' | 'warning' | 'success' | 'gray'> = { SS: 'error', SC: 'error', AS: 'warning', AC: 'warning', AA: 'success', unknown: 'gray' };

export function History({ mother, plan }: { mother: Mother; plan: CarePlan }) {
  const practices = mother.practicesMentioned.map((id) => (TRADITIONAL_PRACTICES ?? []).find((p) => p.id === id)).filter(Boolean);
  const meds = mother.medications;
  const current = meds.filter((m) => !m.stoppedAt);
  const bmi = mother.heightCm && mother.prePregnancyWeightKg ? mother.prePregnancyWeightKg / (mother.heightCm / 100) ** 2 : undefined;

  // One chip per pregnancy: births (living children, older first), losses, the current one.
  const pregnant = plan.state.stage === 'pregnancy';
  const births = mother.parity;
  const losses = Math.max(0, mother.gravida - mother.parity - (pregnant ? 1 : 0));
  const kids = [...mother.children].sort((a, b) => (a.dob < b.dob ? -1 : 1));
  const chips: Array<{ key: string; label: string; sub?: string; tone: 'success' | 'gray' | 'brand' | 'warning' }> = [];
  for (let i = 0; i < births; i++) {
    const c = kids[i];
    chips.push({ key: `b${i}`, label: c ? c.name.split(' ')[0] : `Birth ${i + 1}`, sub: c ? fmtDate(c.dob, { year: true }) : undefined, tone: 'success' });
  }
  for (let i = 0; i < losses; i++) chips.push({ key: `l${i}`, label: 'Loss', tone: 'gray' });
  if (pregnant) chips.push({ key: 'now', label: 'Now', sub: plan.state.gestationalWeeks ? `${plan.state.gestationalWeeks} weeks` : undefined, tone: 'brand' });

  const flags: Array<{ on: boolean; label: string }> = [
    { on: mother.previousCaesarean, label: 'Previous caesarean' },
    { on: mother.previousStillbirth, label: 'Previous stillbirth' },
    { on: mother.previousPPH, label: 'Heavy bleeding after a birth' },
  ];

  return (
    <div className="grid grid-cols-1 gap-8">
      <section aria-labelledby="h-ob" className="grid grid-cols-1 gap-4">
        <SectionTitle id="h-ob" title="Pregnancies and births" lede={`G${mother.gravida} P${mother.parity}: ${mother.gravida} ${mother.gravida === 1 ? 'pregnancy' : 'pregnancies'}, ${mother.parity} ${mother.parity === 1 ? 'birth' : 'births'}`} />
        <Card className="grid grid-cols-1 gap-5">
          <ol aria-label="Each pregnancy" className="flex flex-wrap gap-2">
            {chips.map((c, i) => (
              <li key={c.key} className={cx('flex min-w-20 flex-col rounded-xl px-3 py-2 ring-1 ring-inset', c.tone === 'success' ? 'bg-success-primary ring-success_subtle' : c.tone === 'brand' ? 'bg-brand-primary ring-utility-brand-200' : 'bg-secondary ring-secondary')}>
                <span className="text-xs text-tertiary tnum">{i + 1}</span>
                <span className={cx('text-sm font-semibold', c.tone === 'success' ? 'text-success-primary' : c.tone === 'brand' ? 'text-brand-secondary' : 'text-secondary')}>{c.label}</span>
                {c.sub ? <span className="text-xs text-tertiary">{c.sub}</span> : null}
              </li>
            ))}
            {chips.length === 0 ? <li className="text-sm text-tertiary">First pregnancy not yet recorded.</li> : null}
          </ol>
          <ul className="flex flex-wrap gap-2">
            {flags.map((f) => (
              <li key={f.label}>
                <Chip tone={f.on ? 'error' : 'gray'} icon={f.on ? AlertTriangle : undefined}>
                  {f.label}: {f.on ? 'yes' : 'no'}
                </Chip>
              </li>
            ))}
          </ul>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-border-secondary">
              {mother.pregnancy ? (
                <>
                  <Row k="Last period" v={fmtDate(mother.pregnancy.lmp, { year: true })} />
                  <Row k="Due date" v={plan.state.edd ? fmtDate(plan.state.edd, { year: true }) : 'Not known'} />
                  <Row k="Babies" v={mother.pregnancy.fetuses === 2 ? 'Twins' : mother.pregnancy.fetuses > 2 ? String(mother.pregnancy.fetuses) : 'One'} />
                  <Row k="Plans to give birth" v={mother.pregnancy.plannedBirthPlace === 'facility' ? 'At a facility' : mother.pregnancy.plannedBirthPlace === 'tba' ? 'With a traditional birth attendant' : mother.pregnancy.plannedBirthPlace === 'home' ? 'At home' : 'Not decided'} />
                </>
              ) : null}
              {mother.birth ? (
                <Row
                  k="Latest birth"
                  v={`${fmtDate(mother.birth.date, { year: true })}, ${mother.birth.mode}, ${mother.birth.place.replace('_', ' ')}${mother.birth.bloodLossMl ? `, blood loss ${mother.birth.bloodLossMl} ml` : ''}${
                    mother.birth.complications.filter((c) => c !== 'none').length ? `, ${mother.birth.complications.filter((c) => c !== 'none').join(', ').replace(/_/g, ' ')}` : ''
                  }`}
                />
              ) : null}
              {plan.state.interpregnancyMonths !== undefined ? <Row k="Months since last birth" v={`${plan.state.interpregnancyMonths}${plan.state.interpregnancyMonths < 18 ? ' (short interval)' : ''}`} /> : null}
            </tbody>
          </table>
        </Card>
      </section>

      <section aria-labelledby="h-health" className="grid grid-cols-1 gap-4">
        <SectionTitle id="h-health" title="Health" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Tile icon={HeartRounded} title="Conditions" tone={mother.conditions.length ? 'warning' : 'success'}>
            {mother.conditions.length ? (
              <ul className="flex flex-wrap gap-1.5">
                {mother.conditions.map((c) => (
                  <li key={c}>
                    <Chip tone="warning">{CONDITION_LABELS[c] ?? c}</Chip>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-tertiary">None recorded</p>
            )}
          </Tile>
          <Tile icon={AlertTriangle} title="Allergies" tone={mother.allergies.length ? 'error' : 'success'}>
            {mother.allergies.length ? (
              <ul className="flex flex-wrap gap-1.5">
                {mother.allergies.map((a) => (
                  <li key={a}>
                    <Chip tone="error">{a}</Chip>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-tertiary">None known</p>
            )}
          </Tile>
          <Tile icon={Droplets01} title="Genotype and blood group" tone={GENOTYPE_TONE[mother.genotype] === 'error' ? 'error' : 'gray'}>
            <div className="flex items-baseline gap-3">
              <span className={cx('text-display-xs font-semibold tnum', GENOTYPE_TONE[mother.genotype] === 'error' ? 'text-error-primary' : 'text-primary')}>{mother.genotype === 'unknown' ? '?' : mother.genotype}</span>
              <span className="text-xl font-semibold text-secondary">{mother.bloodGroup ?? '?'}</span>
            </div>
            <p className="mt-1 text-xs text-tertiary">{mother.genotype === 'unknown' || !mother.bloodGroup ? 'Not yet tested: unknown, not normal' : 'Tested'}</p>
          </Tile>
          <Tile icon={Users01} title="Body" tone="gray">
            <p className="text-sm text-secondary">
              {mother.heightCm ? `${mother.heightCm} cm` : 'Height not recorded'}
              {mother.prePregnancyWeightKg ? ` · ${mother.prePregnancyWeightKg} kg before` : ''}
            </p>
            {bmi ? <p className="mt-1 text-xs text-tertiary tnum">BMI {bmi.toFixed(1)}</p> : null}
          </Tile>
        </div>
      </section>

      <section aria-labelledby="h-meds" className="grid grid-cols-1 gap-4">
        <SectionTitle id="h-meds" title="Medicines" lede={meds.length ? `${current.length} taking now, ${meds.length - current.length} stopped` : undefined} />
        {meds.length ? (
          <Card className="p-0 sm:p-0">
            <ul className="divide-y divide-border-secondary">
              {meds.map((m, i) => (
                <li key={i} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                  <IconTile icon={MedicalCross} tone={m.stoppedAt ? 'gray' : 'brand'} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-primary">{m.name}</p>
                    <p className="text-sm text-tertiary">{[m.dose, m.frequency].filter(Boolean).join(', ') || 'Dose not recorded'}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <Chip tone={m.stoppedAt ? 'gray' : 'success'}>{m.stoppedAt ? `Stopped ${fmtDate(m.stoppedAt)}` : 'Taking'}</Chip>
                    <p className="mt-1 text-xs text-quaternary">Since {fmtDate(m.startedAt, { year: true })}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        ) : (
          <p className="text-sm text-tertiary">No medicines recorded.</p>
        )}
      </section>

      <section aria-labelledby="h-trad" className="grid grid-cols-1 gap-4">
        <SectionTitle id="h-trad" title="Traditional practices" />
        {practices.length ? (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {practices.map((p) =>
              p ? (
                <li key={p.id}>
                  <Card className="grid grid-cols-1 h-full gap-2">
                    <div className="flex items-center gap-2">
                      <IconTile icon={Stars02} tone={p.grade === 'trad_harmful' ? 'error' : 'gray'} size="sm" />
                      <strong className="min-w-0 flex-1 text-sm font-semibold text-primary">{p.name}</strong>
                      <GradeBadge g={p.grade} />
                    </div>
                    <p className="text-sm text-secondary">{p.guidance}</p>
                  </Card>
                </li>
              ) : null,
            )}
          </ul>
        ) : (
          <p className="text-sm text-tertiary">None mentioned yet. Ask gently about what her family plans after the birth.</p>
        )}
      </section>

      <section aria-labelledby="h-life" className="grid grid-cols-1 gap-4">
        <SectionTitle id="h-life" title="Her circumstances" />
        <Card>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-border-secondary">
              <Row k="Language" v={LANGUAGE_NAMES[mother.language] ?? mother.language} />
              <Row k="Reading" v={LITERACY[mother.literacy]} />
              <Row k="Household income" v={INCOME[mother.incomeBand]} />
              {mother.occupation ? <Row k="Work" v={mother.occupation} /> : null}
              {mother.householdNotes ? <Row k="Household" v={mother.householdNotes} /> : null}
              <Row k="Enrolled" v={fmtDate(mother.enrolledAt, { year: true })} />
              <Row k="Consent" v={`${mother.consent.dataProcessing ? 'Records' : 'No records consent'}${mother.consent.messaging ? ', messages' : ''}${mother.consent.guardianInvolved ? ', guardian involved' : ''}, ${fmtDate(mother.consent.recordedAt, { year: true })}`} />
            </tbody>
          </table>
        </Card>
      </section>
      <p className="flex items-center gap-2 text-xs text-quaternary">
        <ShieldTick className="size-4" aria-hidden="true" />
        Her record stays on this device and your Gaskin store. AI only ever sees a de-identified summary.
      </p>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <tr>
      <th scope="row" className="w-2/5 py-2.5 pr-3 text-left align-top font-normal text-tertiary">
        {k}
      </th>
      <td className="py-2.5 text-secondary">{v}</td>
    </tr>
  );
}

function Tile({ icon, title, tone, children }: { icon: typeof HeartRounded; title: string; tone: 'error' | 'warning' | 'success' | 'gray'; children: React.ReactNode }) {
  return (
    <Card className="grid grid-cols-1 content-start gap-3">
      <div className="flex items-center gap-2">
        <IconTile icon={icon} tone={tone} size="sm" />
        <h3 className="text-sm font-semibold text-primary">{title}</h3>
      </div>
      {children}
    </Card>
  );
}
