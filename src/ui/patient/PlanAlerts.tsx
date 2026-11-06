/**
 * Alerts pinned to the top of her plan. Error colour (never brand), acknowledge only (never
 * dismiss), and "Do now" first. Acknowledging records who did what; the alert stays until her
 * readings change.
 */
import { useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle, PhoneCall01 } from '@untitledui/icons';
import type { Alert, CarePlan, Mother } from '../../types';
import { stamp, useApp, useWorker } from '../../store';
import { useToast } from '../components';
import { useT } from '../i18n';
import { fmtTime } from '../format';
import { cx } from '../../utils/cx';
import AnimatedBorderTrail from '../animata/AnimatedBorderTrail';
import { MotherLineView } from './MotherSide';
import { can, emergencyShort } from './adapters';
import { Chip, Disclosure } from './ui';

const ORDER = { emergency: 0, urgent: 1, warning: 2 } as const;

export function sortAlerts(alerts: Alert[]): Alert[] {
  return [...alerts].sort((a, b) => ORDER[a.level] - ORDER[b.level]);
}

export function AlertStack({ mother, plan }: { mother: Mother; plan: CarePlan }) {
  const alerts = sortAlerts(plan.alerts);
  if (!alerts.length) return null;
  return (
    <section aria-label="Alerts" className="grid grid-cols-1 gap-3">
      {alerts.map((a) => (
        <AlertCard key={a.id} alert={a} mother={mother} />
      ))}
    </section>
  );
}

function AlertCard({ alert, mother }: { alert: Alert; mother: Mother }) {
  const { state, dispatch } = useApp();
  const worker = useWorker();
  const toast = useToast();
  const t = useT();
  const ack = state.alertAcks.find((a) => a.motherId === mother.id && a.alertId === alert.id);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const by = ack ? (state.workers.find((w) => w.id === ack.by)?.name ?? ack.by) : '';
  const child = alert.childId ? mother.children.find((c) => c.id === alert.childId) : undefined;
  const levelLabel = alert.level === 'emergency' ? t('alert.emergency', 'Emergency') : alert.level === 'urgent' ? t('alert.urgent', 'Urgent') : t('alert.warning', 'Warning');
  const danger = alert.level !== 'warning';
  const mayAck = can(worker, 'alert.ack');
  const Icon = danger ? AlertCircle : AlertTriangle;

  const card = (
    <article
      className={cx('gk-alert relative rounded-2xl p-4 ring-1 ring-inset sm:p-5', danger ? 'is-emergency bg-error-primary ring-error_subtle' : 'is-warning bg-warning-primary ring-warning_subtle')}
      role="alert"
      data-alert={alert.id}
    >
      <div className="flex gap-3">
        <span aria-hidden="true" className={cx('grid grid-cols-1 size-10 shrink-0 place-items-center rounded-full', danger ? 'bg-error-solid text-on-fill' : 'bg-warning-solid text-on-fill')}>
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cx('text-xs font-bold tracking-wide uppercase', danger ? 'text-error-primary' : 'text-warning-primary')}>{levelLabel}</span>
            {child ? <Chip tone={danger ? 'error' : 'warning'}>For {child.name.split(' ')[0]}</Chip> : alert.subject === 'child' ? <Chip tone={danger ? 'error' : 'warning'}>For the baby</Chip> : null}
          </div>
          <h3 className={cx('gk-alert-title mt-1 text-lg leading-snug font-semibold', danger ? 'text-error-primary' : 'text-warning-primary')}>{alert.title}</h3>
          <div className="mt-3 rounded-xl bg-primary p-3 ring-1 ring-secondary ring-inset">
            <p className="text-xs font-semibold tracking-wide text-tertiary uppercase">Do now</p>
            <p className="mt-1 text-md font-medium text-primary">{alert.action}</p>
          </div>
          <div className="mt-3 rounded-xl bg-primary/60 p-3">
            <p className="mb-1 text-xs font-semibold tracking-wide text-tertiary uppercase">{t('dual.mother_side', 'Tell her')}</p>
            <MotherLineView alert={alert} mother={mother} workerId={worker.id} />
          </div>
          <Disclosure summary="Why" className="mt-2">
            <p className="text-sm text-secondary">
              {alert.reason}
              {alert.sources.length ? <span className="text-tertiary"> ({alert.sources.map((s) => s.label).join('; ')})</span> : null}
            </p>
          </Disclosure>

          {ack ? (
            <p className="mt-2 flex items-start gap-2 text-sm text-secondary">
              <CheckCircle className="mt-0.5 size-4 shrink-0 text-fg-success-primary" aria-hidden="true" />
              <span>
                Acknowledged by {by}, {fmtTime(ack.at)}: “{ack.note}”. It stays here until her readings change.{' '}
                {mayAck ? (
                  <button type="button" className="font-semibold text-brand-secondary underline underline-offset-2" onClick={() => setOpen(true)}>
                    Add note
                  </button>
                ) : null}
              </span>
            </p>
          ) : null}
          {!ack && !open && mayAck ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => setOpen(true)} className={cx('min-h-11 cursor-pointer rounded-xl px-4 text-sm font-semibold text-on-fill', danger ? 'bg-error-solid hover:bg-error-solid_hover' : 'bg-warning-solid')}>
                {t('alert.acknowledge', 'Acknowledge with a note')}
              </button>
            </div>
          ) : null}
          {open ? (
            <form
              className="gk-ack-form mt-3 flex flex-wrap items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!note.trim()) return;
                dispatch({ type: 'ackAlert', ack: { motherId: mother.id, alertId: alert.id, note: note.trim(), by: worker.id, at: stamp(state.clock) } });
                setOpen(false);
                setNote('');
                toast('Alert acknowledged. It stays pinned until it is resolved.');
              }}
            >
              <input
                id={`ack-${alert.id}`}
                className="min-h-11 min-w-0 flex-1 basis-60 rounded-xl px-3 text-sm ring-1 ring-primary ring-inset outline-none focus:ring-2 focus:ring-brand"
                placeholder="What you did, for example: Referred, transport arranged"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                autoFocus
                aria-label="What you did"
              />
              <button type="submit" disabled={!note.trim()} className="min-h-11 cursor-pointer rounded-xl bg-primary-solid px-4 text-sm font-semibold text-on-fill disabled:opacity-50">
                Save note
              </button>
              <button type="button" onClick={() => setOpen(false)} className="min-h-11 cursor-pointer rounded-xl px-3 text-sm font-semibold text-secondary hover:bg-primary_hover">
                Cancel
              </button>
            </form>
          ) : null}
        </div>
      </div>
    </article>
  );
  return alert.level === 'emergency' ? (
    <AnimatedBorderTrail trailColor="var(--color-fg-error-secondary)" duration="5s" trailSize="md" data-testid="border-trail" contentClassName="[&>.gk-alert]:rounded-[calc(1rem-2px)]">
      {card}
    </AnimatedBorderTrail>
  ) : (
    card
  );
}

/** Personal mode: "Go to [facility] now" with the emergency number, in plain words. */
export function PersonalAlerts({ mother, plan }: { mother: Mother; plan: CarePlan }) {
  const { state } = useApp();
  const alerts = sortAlerts(plan.alerts);
  if (!alerts.length) return null;
  const facility = state.facilities.find((f) => f.id === mother.facilityId);
  const referral = facility?.referralFacilityId ? state.facilities.find((f) => f.id === facility.referralFacilityId) : undefined;
  const number = emergencyShort(mother.country);
  return (
    <section aria-label="Go now" className="grid grid-cols-1 gap-3">
      {alerts.map((a) => {
        const go = a.level === 'emergency' ? (referral ?? facility) : (facility ?? referral);
        return (
          <article key={a.id} role="alert" data-alert={a.id} className="rounded-2xl bg-error-primary p-5 ring-1 ring-error_subtle ring-inset">
            <h3 className="text-xl font-semibold text-error-primary">{/^Go to /.test(a.action) ? a.action.split('. ')[0] : go ? `Go to ${go.name} ${a.level === 'warning' ? 'today' : 'now'}` : 'Go to the nearest hospital now'}</h3>
            <div className="mt-2">
              <MotherLineView alert={a} mother={mother} compact />
            </div>
            <a href={`tel:${number}`} className="mt-4 flex min-h-12 items-center justify-center gap-2 rounded-xl bg-error-solid px-4 text-md font-semibold text-on-fill">
              <PhoneCall01 className="size-5" aria-hidden="true" /> Call {number}
            </a>
          </article>
        );
      })}
    </section>
  );
}
