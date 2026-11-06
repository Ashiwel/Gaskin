/**
 * Her plan. Alerts first (error colour, acknowledge only, with what to do now), then "What
 * changed" as a visual diff, then the plan as calm cards grouped by category: icon or pictogram,
 * evidence grade, lock, timing, a child tag, her line in her language, "How" and "Why". Worker
 * controls (edit, remove with a reason, propose for every mother like her) sit in one menu per
 * card. In personal mode the same plan reads as "My plan" in plain words.
 */
import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  DotsVertical,
  Edit03,
  Lock01,
  Minus,
  Plus,
  Printer,
  Send01,
  Stars02,
  Trash01,
  Users01,
} from '@untitledui/icons';
import type { CarePlan, Mother, Override, PlanCategory, PlanItem, TraditionalPractice } from '../types';
import { planLocationFor, stamp, uid, useApp, useWorker } from '../store';
import { buildPlan } from '../engine';
import { CATEGORY_LABELS, TRADITIONAL_PRACTICES } from '../clinical';
import { Illustration, Thinking, useAbort, useToast, gradeLabel, GRADE_SHORT } from './components';
import { AIBadge, getProvider, WhatAISees } from './ai';
import { fmtDate, relDay } from './format';
import { useT } from './i18n';
import { Button } from '../components/base/buttons/button';
import { Dropdown } from '../components/base/dropdown/dropdown';
import { cx } from '../utils/cx';
import { AlertStack, PersonalAlerts } from './patient/PlanAlerts';
import { MotherLineView, useLangs } from './patient/MotherSide';
import { HowToBody, GuideSheet } from './patient/HowTo';
import { CATEGORY_ICON, CATEGORY_TONE, Card, Chip, Disclosure, IconTile, SectionTitle, Segmented, SideSheet, type ChipTone } from './patient/ui';
import { can, DISCLAIMER_LINES, emergencyShort, legalFor, usePersonalMode } from './patient/adapters';
import { ConstraintControl, kindForItem, REASON_WORD, toConstraint, type ConstraintValue } from './patient/Constraint';
import { lineFor } from './patient/lang';

const CAT_ORDER: PlanCategory[] = [
  'danger_signs',
  'visits',
  'tests',
  'medication',
  'nutrition',
  'mental_health',
  'breastfeeding',
  'baby_care',
  'immunisation',
  'rest_and_sleep',
  'activity',
  'birth_preparedness',
  'family_support',
  'family_planning',
  'traditional_practice',
  'education',
];

const ALL_GRADES = ['A', 'B', 'C', 'trad_supported', 'trad_plausible', 'trad_neutral', 'trad_harmful', 'expert'] as const;

const GRADE_TONE: Record<string, ChipTone> = { A: 'success', B: 'brand', C: 'gray', trad_supported: 'success', trad_plausible: 'brand', trad_neutral: 'gray', trad_harmful: 'error', expert: 'brand' };

export function GradeBadge({ g }: { g: PlanItem['evidence'] }) {
  const { label, description } = gradeLabel(g);
  return (
    <span title={`${label}. ${description}`} aria-label={`Evidence: ${label}`} className={cx('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold ring-1 ring-inset', GRADE_TONE[g] === 'success' ? 'bg-success-primary text-success-primary ring-success_subtle' : GRADE_TONE[g] === 'error' ? 'bg-error-primary text-error-primary ring-error_subtle' : GRADE_TONE[g] === 'brand' ? 'bg-brand-primary text-brand-secondary ring-utility-brand-200' : 'bg-secondary text-secondary ring-secondary')}>
      <span className="tnum">{GRADE_SHORT[g]}</span>
      <span className="hidden font-medium sm:inline">{label}</span>
    </span>
  );
}

// ---------- What changed ----------

export function WhatChanged({ mother, plan }: { mother: Mother; plan: CarePlan }) {
  const { state, dispatch } = useApp();
  const t = useT();
  const rec = state.lastChanges[mother.id];
  if (!rec) return null;
  const d = rec.diff;
  const title = (id: string) => plan.items.find((i) => i.id === id)?.title ?? id.replace(/^[a-z]+\./, '').replace(/[._]/g, ' ');
  const alertTitle = (id: string) => plan.alerts.find((a) => a.id === id)?.title ?? id;
  const groups: Array<{ key: string; sym: typeof Plus; label: string; tone: ChipTone; items: string[] }> = [
    { key: 'al', sym: AlertTriangle, label: 'New alerts', tone: 'error' as ChipTone, items: d.newAlerts.map(alertTitle) },
    { key: 'add', sym: Plus, label: 'Added', tone: 'success' as ChipTone, items: d.added.map(title) },
    { key: 'chg', sym: Edit03, label: 'Changed', tone: 'warning' as ChipTone, items: d.changed.map(title) },
    { key: 'rem', sym: Minus, label: 'Removed', tone: 'gray' as ChipTone, items: d.removed.map(title) },
  ].filter((g) => g.items.length);
  if (!groups.length) return null;
  const total = groups.reduce((n, g) => n + g.items.length, 0);
  return (
    <Card as="section" aria-label="What changed" data-testid="what-changed" className="p-0 sm:p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4 sm:px-5">
        <div className="min-w-0">
          <h2 className="text-md font-semibold text-primary">{t('plan.whatChanged', 'What changed in her plan')}</h2>
          <p className="text-sm text-tertiary">
            {rec.cause} · version {rec.version} · {fmtDate(rec.at)}
          </p>
        </div>
        <Button size="sm" color="secondary" iconLeading={Check} onClick={() => dispatch({ type: 'dismissChanges', motherId: mother.id })}>
          Got it
        </Button>
      </div>
      {/* the proportion of each kind of change, at a glance */}
      <div className="mx-4 mt-4 flex h-2 overflow-hidden rounded-full sm:mx-5" aria-hidden="true">
        {groups.map((g) => (
          <span key={g.key} style={{ width: `${(g.items.length / total) * 100}%` }} className={cx('h-full', g.tone === 'error' ? 'bg-fg-error-secondary' : g.tone === 'success' ? 'bg-fg-success-secondary' : g.tone === 'warning' ? 'bg-fg-warning-secondary' : 'bg-fg-quaternary')} />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-b-2xl pt-4 sm:grid-cols-2">
        {groups.map((g) => (
          <div key={g.key} className="border-t border-secondary px-4 py-3 sm:px-5">
            <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-tertiary uppercase">
              <IconTile icon={g.sym} tone={g.tone} size="sm" className="size-6 rounded-md [&>svg]:size-3.5" />
              {g.label} <span className="tnum text-quaternary">{g.items.length}</span>
            </p>
            <ul className="mt-2 space-y-1">
              {g.items.map((x, i) => (
                <li key={i} className={cx('text-sm', g.key === 'rem' ? 'text-tertiary line-through' : 'text-secondary')}>
                  {x}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ---------- Item card ----------

type FormKind = 'remove' | 'edit' | 'propose' | null;

function ItemCard({ item, mother, selected, onToggle, fresh, edited, onGuide }: { item: PlanItem; mother: Mother; selected: boolean; onToggle: () => void; fresh: boolean; edited: boolean; onGuide: (id: string) => void }) {
  const { state, dispatch } = useApp();
  const worker = useWorker();
  const toast = useToast();
  const { ml } = useLangs(mother);
  const [form, setForm] = useState<FormKind>(null);
  const [constraint, setConstraint] = useState<ConstraintValue | undefined>();
  const removed = item.status === 'removed';
  const ov = item.overriddenBy ? state.overrides.find((o) => o.id === item.overriddenBy) : undefined;
  const ovBy = ov ? state.workers.find((w) => w.id === ov.workerId)?.name : undefined;
  const child = item.childId ? mother.children.find((c) => c.id === item.childId) : undefined;
  const Icon = CATEGORY_ICON[item.category];
  const mayEdit = can(worker, 'plan.edit');
  const kind = kindForItem(item.id, item.category);
  const alternatives = item.alternatives ?? [];

  const record = (v: ConstraintValue | null) => {
    setConstraint(v ?? undefined);
    if (!v) return;
    const c = toConstraint(v);
    if (!c) return;
    // Side effects and declines need their detail before saving; the rest save at once.
    if (v.outcome === 'side_effects' && (!v.severity || !v.symptoms?.length)) return;
    if (v.outcome === 'declined' && !v.why) return;
    dispatch({
      type: 'addEvents',
      motherId: mother.id,
      events: [{ kind: 'constraint', id: uid('ev'), at: stamp(state.clock), recordedBy: worker.id, itemId: item.id, childId: item.childId, ...c } as never],
      cause: `${item.title}: ${REASON_WORD[c.reason]}`,
    });
    toast('Saved. Her plan now shows an alternative.');
  };

  return (
    <li
      className={cx('gk-item group/item relative rounded-2xl bg-primary p-4 ring-1 ring-secondary ring-inset transition sm:p-5', removed && 'is-removed opacity-60', fresh && 'ring-2 ring-border-success', edited && 'ring-2 ring-border-brand', selected && 'ring-2 ring-border-brand')}
      data-item={item.id}
      data-category={item.category}
    >
      <div className="flex gap-3 sm:gap-4">
        <div className="flex shrink-0 flex-col items-center gap-2">
          {item.illustration ? (
            <span className="grid grid-cols-1 size-14 place-items-center overflow-hidden rounded-xl bg-secondary sm:size-16">
              <Illustration k={item.illustration} size={56} />
            </span>
          ) : (
            <IconTile icon={Icon} tone={CATEGORY_TONE[item.category] ?? 'gray'} size="lg" />
          )}
          <label className="grid grid-cols-1 size-8 cursor-pointer place-items-center rounded-md hover:bg-primary_hover" title="Select for a message or handout">
            <input type="checkbox" className="size-4 cursor-pointer accent-[var(--color-bg-brand-solid)]" checked={selected} onChange={onToggle} disabled={removed} aria-label={`Select ${item.title}`} />
          </label>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <h3 className={cx('gk-item-title min-w-0 flex-1 text-md leading-snug font-semibold text-primary', removed && 'line-through')}>{item.title}</h3>
            {mayEdit && !removed ? (
              <Dropdown.Root>
                <Button size="sm" color="tertiary" iconLeading={DotsVertical} aria-label={`Actions for ${item.title}`} className="-mt-1 -mr-2 shrink-0" />
                <Dropdown.Popover placement="bottom end">
                  <Dropdown.Menu onAction={(k) => setForm(k as FormKind)}>
                    <Dropdown.Item id="edit" label="Edit" icon={Edit03} />
                    <Dropdown.Item id="remove" label={item.locked ? 'Ask to remove' : 'Remove with a reason'} icon={item.locked ? Lock01 : Trash01} />
                    {can(worker, 'plan.propose') ? <Dropdown.Item id="propose" label="Propose for every mother like her" icon={Users01} /> : null}
                  </Dropdown.Menu>
                </Dropdown.Popover>
              </Dropdown.Root>
            ) : removed && ov && mayEdit ? (
              <Button size="sm" color="link-color" onClick={() => dispatch({ type: 'revertOverride', id: ov.id })}>
                Put back
              </Button>
            ) : null}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <GradeBadge g={item.evidence} />
            {item.locked ? (
              <Chip icon={Lock01} tone="gray" title="Safety-critical. One person cannot remove it.">
                Safety
              </Chip>
            ) : null}
            {item.timing ? <Chip tone="brand">{item.timing}</Chip> : null}
            {item.dueDate ? <Chip tone="brand">Due {fmtDate(item.dueDate)}</Chip> : null}
            {child ? <Chip tone="warning">{child.name.split(' ')[0]}</Chip> : null}
            {item.constraint ? <Chip tone="warning">{REASON_WORD[item.constraint.reason]}</Chip> : null}
            {item.origin === 'learned_rule' ? <Chip icon={Stars02}>Learned from experts</Chip> : null}
            {item.origin === 'worker_added' ? <Chip>Added by a health worker</Chip> : null}
            {item.origin === 'ai_suggested' ? <Chip>AI suggestion, approved</Chip> : null}
            {fresh ? <Chip tone="success">New</Chip> : null}
            {edited ? <Chip tone="brand">Changed</Chip> : null}
          </div>

          <div className="mt-3">
            {item.audience === 'worker' || item.workerOnly ? <p className="text-sm text-tertiary">For you only. Not shown to her.</p> : <MotherLineView item={item} mother={mother} workerId={worker.id} />}
          </div>

          {removed && ov ? <p className="mt-2 text-sm text-tertiary">Removed by {ovBy ?? 'a health worker'}: “{ov.reason}”</p> : null}
          {!removed && ov && ov.action === 'modify' ? <p className="mt-2 text-sm text-tertiary">Edited by {ovBy}</p> : null}

          {alternatives.length ? (
            <div className="mt-3 grid grid-cols-1 gap-2">
              {alternatives.map((a, i) => {
                const l = lineFor(ml, a.item.motherTextKey, a.item.motherText, a.item.motherTextParams);
                return (
                  <div key={i} className="rounded-xl bg-success-primary p-3 ring-1 ring-success_subtle ring-inset" data-testid="alternative">
                    <p className="text-xs font-semibold tracking-wide text-success-primary uppercase">Instead, because {REASON_WORD[a.reason]}</p>
                    <p className="mt-1 text-sm font-semibold text-primary">{a.item.title}</p>
                    <p className="mt-0.5 text-sm text-secondary" lang={l.lang} dir={l.dir}>
                      {l.text}
                    </p>
                    {a.item.howTo ? (
                      <div className="mt-2">
                        <HowToBody howTo={a.item.howTo} lang={ml} onOpenGuide={onGuide} compact />
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : null}

          <div className="mt-2 flex flex-wrap gap-x-5">
            {item.howTo?.steps?.length ? (
              <Disclosure summary="How">
                <div className="pt-1">
                  <HowToBody howTo={item.howTo} lang={ml} onOpenGuide={onGuide} />
                </div>
              </Disclosure>
            ) : null}
            <Disclosure summary="Why">
              <div className="space-y-2 pt-1 text-sm">
                <p className="text-secondary">{item.detail}</p>
                {item.because.length ? (
                  <ul className="flex flex-wrap gap-1.5">
                    {item.because.map((b, i) => (
                      <li key={i}>
                        <Chip>{b}</Chip>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <p className="text-tertiary">
                  {gradeLabel(item.evidence).label}.{' '}
                  {item.sources.map((s, i) => (
                    <span key={s.id}>
                      {i ? '; ' : ''}
                      {s.url ? (
                        <a className="underline underline-offset-2 hover:text-secondary" href={s.url} target="_blank" rel="noreferrer">
                          {s.label}
                        </a>
                      ) : (
                        s.label
                      )}
                    </span>
                  ))}
                </p>
              </div>
            </Disclosure>
            {kind && !removed && mayEdit ? (
              <Disclosure summary="She could not do this">
                <div className="pt-1">
                  <ConstraintControl kind={kind} itemId={item.id} label={`What happened with ${item.title}`} value={constraint} onChange={record} size="sm" />
                </div>
              </Disclosure>
            ) : null}
          </div>

          {form ? <ItemForm item={item} mother={mother} form={form} onDone={() => setForm(null)} /> : null}
        </div>
      </div>
    </li>
  );
}

function ItemForm({ item, mother, form, onDone }: { item: PlanItem; mother: Mother; form: Exclude<FormKind, null>; onDone: () => void }) {
  const { state, dispatch } = useApp();
  const worker = useWorker();
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [propose, setPropose] = useState(form === 'propose');
  const [title, setTitle] = useState(item.title);
  const [motherText, setMotherText] = useState(item.motherText);
  const [timing, setTiming] = useState(item.timing ?? '');
  const lockedRemove = form === 'remove' && item.locked;
  const field = 'min-h-11 w-full rounded-xl px-3 py-2 text-sm text-primary ring-1 ring-primary ring-inset outline-none focus:ring-2 focus:ring-brand';

  const submit = () => {
    if (!reason.trim()) return;
    if (lockedRemove) {
      const o: Override = { id: uid('ov'), motherId: mother.id, itemId: item.id, action: 'remove', reason: reason.trim(), workerId: worker.id, createdAt: stamp(state.clock), proposeGlobal: true, status: 'reverted' };
      dispatch({ type: 'addOverride', override: o, now: o.createdAt });
      toast('Sent to clinical review. The item stays in her plan meanwhile.');
      onDone();
      return;
    }
    const action: Override['action'] = form === 'remove' ? 'remove' : 'modify';
    const o: Override = {
      id: uid('ov'),
      motherId: mother.id,
      itemId: item.id,
      action,
      item: action === 'modify' ? { ...item, title, motherText, timing: timing || undefined } : undefined,
      reason: reason.trim(),
      workerId: worker.id,
      createdAt: stamp(state.clock),
      proposeGlobal: propose,
      status: 'active',
    };
    dispatch({ type: 'addOverride', override: o, now: o.createdAt });
    toast(`${form === 'remove' ? 'Removed from her plan' : form === 'propose' ? 'Proposed for every mother like her' : 'Item updated'}${propose && form !== 'propose' ? '. Proposed for every mother like her, waiting for expert review.' : '.'}`);
    onDone();
  };

  return (
    <form
      className="mt-4 grid grid-cols-1 gap-3 rounded-xl bg-secondary p-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      {lockedRemove ? (
        <p className="flex gap-2 text-sm text-secondary">
          <Lock01 className="mt-0.5 size-4 shrink-0 text-fg-quaternary" aria-hidden="true" />
          <span>
            <strong className="font-semibold text-primary">This is a safety item, so one person cannot remove it.</strong> If you think it is wrong for her, say why and a clinical reviewer will look at it. It stays in her plan meanwhile.
          </span>
        </p>
      ) : null}
      {form === 'edit' ? (
        <>
          <label className="grid grid-cols-1 gap-1.5 text-sm font-medium text-secondary">
            Title
            <input className={field} id={`t-${item.id}`} value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className="grid grid-cols-1 gap-1.5 text-sm font-medium text-secondary">
            What she is told
            <textarea className={cx(field, 'min-h-20')} id={`m-${item.id}`} value={motherText} onChange={(e) => setMotherText(e.target.value)} />
          </label>
          <label className="grid grid-cols-1 gap-1.5 text-sm font-medium text-secondary">
            When
            <input className={field} id={`w-${item.id}`} value={timing} onChange={(e) => setTiming(e.target.value)} />
          </label>
        </>
      ) : null}
      {form === 'propose' ? <p className="text-sm text-secondary">Propose this item, as it is now, for every mother in her situation. A clinical reviewer decides.</p> : null}
      <label className="grid grid-cols-1 gap-1.5 text-sm font-medium text-secondary">
        <span>
          Reason <span className="font-normal text-tertiary">(required)</span>
        </span>
        <input
          className={field}
          id={`r-${item.id}`}
          placeholder={form === 'remove' ? 'For example: She already does this every day' : 'What you changed and why'}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          autoFocus
        />
      </label>
      {form === 'edit' || (form === 'remove' && !item.locked) ? (
        <label className="flex min-h-10 cursor-pointer items-center gap-2 text-sm text-secondary">
          <input type="checkbox" className="size-4" checked={propose} onChange={(e) => setPropose(e.target.checked)} />
          Propose this change for every mother like her
        </label>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="md" color={form === 'remove' && !item.locked ? 'primary-destructive' : 'primary'} isDisabled={!reason.trim()}>
          {lockedRemove ? 'Send for review' : form === 'remove' ? 'Remove from her plan' : form === 'propose' ? 'Send proposal' : 'Save change'}
        </Button>
        <Button size="md" color="tertiary" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

// ---------- Add item ----------

function AddItem({ mother, plan, onDone }: { mother: Mother; plan: CarePlan; onDone: () => void }) {
  const { state, dispatch } = useApp();
  const worker = useWorker();
  const toast = useToast();
  const [mode, setMode] = useState<'library' | 'custom'>('library');
  const [pick, setPick] = useState('');
  const [title, setTitle] = useState('');
  const [motherText, setMotherText] = useState('');
  const [category, setCategory] = useState<PlanCategory>('education');
  const [reason, setReason] = useState('');
  const [propose, setPropose] = useState(false);
  const practices = useMemo(() => (TRADITIONAL_PRACTICES ?? []).filter((p: TraditionalPractice) => p.countries.includes(mother.country) && p.stage.includes(plan.state.stage) && !plan.items.some((i) => i.id === `trad.${p.id}`)), [mother.country, plan]);
  const chosen = practices.find((p) => p.id === pick);
  const field = 'min-h-11 w-full rounded-xl px-3 py-2 text-sm text-primary ring-1 ring-primary ring-inset outline-none focus:ring-2 focus:ring-brand';

  const save = () => {
    const isLib = mode === 'library' && chosen;
    const itemId = isLib ? `trad.${chosen!.id}` : `custom.${uid('it')}`;
    const item: Partial<PlanItem> & { title: string } = isLib
      ? { id: itemId, category: 'traditional_practice', title: chosen!.name, detail: `${chosen!.evidenceSummary} ${chosen!.guidance}`, motherText: chosen!.motherText, evidence: chosen!.grade, sources: chosen!.sources, because: [`Added by ${worker.name}: ${reason.trim()}`], origin: 'traditional', priority: 3, audience: 'both', status: 'active', illustration: 'family_support' }
      : { id: itemId, category, title: title.trim(), detail: reason.trim(), motherText: motherText.trim() || title.trim(), evidence: 'C', sources: [], because: [`Added by ${worker.name}: ${reason.trim()}`], origin: 'worker_added', priority: 3, audience: 'mother', status: 'active' };
    const o: Override = { id: uid('ov'), motherId: mother.id, itemId, action: 'add', item, reason: reason.trim(), workerId: worker.id, createdAt: stamp(state.clock), proposeGlobal: propose, status: 'active' };
    dispatch({ type: 'addOverride', override: o, now: o.createdAt });
    toast(propose ? 'Added, and proposed for every mother like her.' : 'Added to her plan.');
    onDone();
  };
  const valid = reason.trim() && (mode === 'library' ? Boolean(chosen) : Boolean(title.trim()));

  return (
    <SideSheet
      title="Add to her plan"
      onClose={onDone}
      footer={
        <>
          <Button size="md" color="tertiary" onClick={onDone}>
            Cancel
          </Button>
          <Button size="md" color="primary" isDisabled={!valid} onClick={save}>
            Add to her plan
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4">
        <Segmented
          label="Add from"
          value={mode}
          onChange={(v) => v && setMode(v)}
          options={[
            { value: 'library', label: 'Traditional practice' },
            { value: 'custom', label: 'Write your own' },
          ]}
        />
        {mode === 'library' ? (
          practices.length ? (
            <>
              <label className="grid grid-cols-1 gap-1.5 text-sm font-medium text-secondary">
                Practice she or her family follow
                <select className={field} id="add-practice" value={pick} onChange={(e) => setPick(e.target.value)}>
                  <option value="">Choose a practice</option>
                  {practices.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({gradeLabel(p.grade).label})
                    </option>
                  ))}
                </select>
              </label>
              {chosen ? (
                <div className="rounded-xl bg-secondary p-3 text-sm text-secondary">
                  <p>{chosen.description}</p>
                  <p className="mt-2">
                    <strong className="font-semibold text-primary">What to say:</strong> {chosen.guidance}
                  </p>
                </div>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-tertiary">No more practices in the library fit her stage and country.</p>
          )
        ) : (
          <>
            <label className="grid grid-cols-1 gap-1.5 text-sm font-medium text-secondary">
              Title
              <input className={field} id="add-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="For example: Ask her sister to come to the next visit" />
            </label>
            <label className="grid grid-cols-1 gap-1.5 text-sm font-medium text-secondary">
              What she is told
              <textarea className={cx(field, 'min-h-20')} id="add-mtext" value={motherText} onChange={(e) => setMotherText(e.target.value)} />
            </label>
            <label className="grid grid-cols-1 gap-1.5 text-sm font-medium text-secondary">
              Group
              <select className={field} id="add-cat" value={category} onChange={(e) => setCategory(e.target.value as PlanCategory)}>
                {CAT_ORDER.filter((c) => c !== 'danger_signs').map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABELS[c] ?? c}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
        <label className="grid grid-cols-1 gap-1.5 text-sm font-medium text-secondary">
          <span>
            Reason <span className="font-normal text-tertiary">(required)</span>
          </span>
          <input className={field} id="add-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why she needs this" />
        </label>
        <label className="flex min-h-10 cursor-pointer items-center gap-2 text-sm text-secondary">
          <input type="checkbox" className="size-4" checked={propose} onChange={(e) => setPropose(e.target.checked)} />
          Propose this change for every mother like her
        </label>
      </div>
    </SideSheet>
  );
}

// ---------- AI: explain and suggest ----------

function ExplainPlan({ mother, plan }: { mother: Mother; plan: CarePlan }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const { start, stop } = useAbort();
  const run = async () => {
    const signal = start();
    setBusy(true);
    setText('');
    setNote('');
    try {
      const p = await getProvider();
      const out = await p.explainPlan({ plan, mother, signal, onText: (t) => setText(t) });
      if (!signal.aborted) setText(out);
    } catch {
      if (!signal.aborted) setNote('The AI could not answer just now. The plan is complete without it.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card className="grid grid-cols-1 gap-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-md font-semibold text-primary">Explain this plan</h3>
        <AIBadge />
      </div>
      {text ? <p className="text-md leading-relaxed whitespace-pre-line text-secondary">{text}</p> : null}
      {busy && !text ? <Thinking onStop={() => { stop(); setBusy(false); }} /> : null}
      {note ? <p className="text-sm text-tertiary">{note}</p> : null}
      {!busy ? (
        <div>
          <Button size="sm" color="secondary" iconLeading={Stars02} onClick={run}>
            {text ? 'Explain again' : 'Explain in plain words'}
          </Button>
        </div>
      ) : null}
      <WhatAISees task="explain" args={{ plan, mother }} />
    </Card>
  );
}

function SuggestItems({ mother, plan }: { mother: Mother; plan: CarePlan }) {
  const { state, dispatch } = useApp();
  const worker = useWorker();
  const toast = useToast();
  const [items, setItems] = useState<Array<Pick<PlanItem, 'title' | 'detail' | 'motherText' | 'category'> & { k: string; done?: 'accepted' | 'rejected' }>>([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const { start, stop } = useAbort();
  const run = async () => {
    const signal = start();
    setBusy(true);
    setNote('');
    try {
      const p = await getProvider();
      const out = await p.suggestItems({ plan, mother, signal });
      if (!signal.aborted) {
        setItems(out.map((x, i) => ({ ...x, k: `${i}-${x.title}` })));
        if (!out.length) setNote('No extra suggestions for her right now.');
      }
    } catch {
      if (!signal.aborted) setNote('Suggestions are not available just now.');
    } finally {
      setBusy(false);
    }
  };
  const accept = (s: (typeof items)[number]) => {
    const itemId = `ai.${uid('it')}`;
    const o: Override = {
      id: uid('ov'),
      motherId: mother.id,
      itemId,
      action: 'add',
      item: { id: itemId, title: s.title, detail: s.detail, motherText: s.motherText, category: s.category, evidence: 'C', sources: [], because: [`Suggested by AI, accepted by ${worker.name}`], origin: 'ai_suggested', priority: 4, audience: 'mother', status: 'active' },
      reason: 'Accepted AI suggestion',
      workerId: worker.id,
      createdAt: stamp(state.clock),
      proposeGlobal: false,
      status: 'active',
    };
    dispatch({ type: 'addOverride', override: o, now: o.createdAt });
    setItems((xs) => xs.map((x) => (x.k === s.k ? { ...x, done: 'accepted' } : x)));
    toast('Added to her plan.');
  };
  return (
    <Card className="grid grid-cols-1 gap-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-md font-semibold text-primary">Supportive suggestions</h3>
        <AIBadge />
      </div>
      <p className="text-sm text-tertiary">Ideas for comfort, food and family support. Safety items always come from the rules, never from AI.</p>
      {busy ? <Thinking onStop={() => { stop(); setBusy(false); }} /> : null}
      {items.length ? (
        <ul className="divide-y divide-border-secondary">
          {items.map((s) => (
            <li key={s.k} className={cx('grid grid-cols-1 gap-1 py-3', s.done === 'rejected' && 'opacity-50')}>
              <strong className="text-sm font-semibold text-primary">{s.title}</strong>
              <span className="text-sm text-secondary">{s.motherText}</span>
              <span className="text-xs text-tertiary">{CATEGORY_LABELS[s.category] ?? s.category}</span>
              {s.done ? (
                <span className="text-sm text-tertiary">{s.done === 'accepted' ? 'Accepted' : 'Rejected'}</span>
              ) : (
                <span className="mt-1 flex gap-2">
                  <Button size="sm" color="primary" onClick={() => accept(s)}>
                    Accept
                  </Button>
                  <Button size="sm" color="tertiary" onClick={() => setItems((xs) => xs.map((x) => (x.k === s.k ? { ...x, done: 'rejected' } : x)))}>
                    Reject
                  </Button>
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : null}
      {note ? <p className="text-sm text-tertiary">{note}</p> : null}
      {!busy ? (
        <div>
          <Button size="sm" color="secondary" iconLeading={Stars02} onClick={run}>
            {items.length ? 'Suggest again' : 'Suggest supportive items'}
          </Button>
        </div>
      ) : null}
      <WhatAISees task="suggest" args={{ plan, mother }} />
    </Card>
  );
}

// ---------- Plan ----------

/**
 * The engine's summary ends with "Next contact …", which the next-contact line below already says.
 * Drop the repeat and make one sentence per clause.
 */
export function cleanSummary(summary: string): string {
  const s = summary.replace(/\s*Next( contact)?\b[^]*$/, '').trim();
  const sentences = s
    .split(/;\s*/)
    .map((x) => x.trim().replace(/\.$/, ''))
    .filter(Boolean)
    .map((x) => x.charAt(0).toUpperCase() + x.slice(1));
  return sentences.length ? `${sentences.join('. ')}.` : summary;
}

function groupItems(items: PlanItem[], showRemoved: boolean) {
  const visible = items.filter((i) => i.status !== 'removed' || showRemoved);
  const by = new Map<PlanCategory, PlanItem[]>();
  for (const i of visible) by.set(i.category, [...(by.get(i.category) ?? []), i]);
  for (const arr of by.values()) arr.sort((a, b) => a.priority - b.priority);
  const cats = [...by.keys()].sort((a, b) => {
    const ia = CAT_ORDER.indexOf(a);
    const ib = CAT_ORDER.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
  return cats.map((c) => [c, by.get(c)!] as const);
}

export function PlanView({ mother, plan, onSend, onPrint }: { mother: Mother; plan: CarePlan; onSend: (ids: string[]) => void; onPrint: (ids: string[]) => void }) {
  const personal = usePersonalMode();
  if (personal) return <MyPlan mother={mother} plan={plan} />;
  return <WorkerPlan mother={mother} plan={plan} onSend={onSend} onPrint={onPrint} />;
}

function WorkerPlan({ mother, plan, onSend, onPrint }: { mother: Mother; plan: CarePlan; onSend: (ids: string[]) => void; onPrint: (ids: string[]) => void }) {
  const { state } = useApp();
  const worker = useWorker();
  const t = useT();
  const [selected, setSelected] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [showRemoved, setShowRemoved] = useState(false);
  const [legend, setLegend] = useState(false);
  const [ai, setAi] = useState<'explain' | 'suggest' | null>(null);
  const [guide, setGuide] = useState<string | null>(null);
  const [childFilter, setChildFilter] = useState<string>('all');
  const changes = state.lastChanges[mother.id]?.diff;
  const kids = mother.children.filter((c) => plan.items.some((i) => i.childId === c.id));
  const filtered = childFilter === 'all' ? plan.items : childFilter === 'mother' ? plan.items.filter((i) => !i.childId) : plan.items.filter((i) => i.childId === childFilter);
  const grouped = useMemo(() => groupItems(filtered, showRemoved), [filtered, showRemoved]);
  const removedCount = plan.items.filter((i) => i.status === 'removed').length;
  const activeIds = plan.items.filter((i) => i.status === 'active').map((i) => i.id);
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const mayEdit = can(worker, 'plan.edit');
  const active = plan.items.filter((i) => i.status === 'active');
  const unknowns = plan.state.unknowns ?? [];

  return (
    <div className="grid grid-cols-1 gap-8">
      <AlertStack mother={mother} plan={plan} />
      <WhatChanged mother={mother} plan={plan} />

      {/* Summary first: the plan's shape at a glance */}
      <section aria-label="Plan summary" className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-8">
          <p className="text-md leading-relaxed text-secondary">{cleanSummary(plan.summary)}</p>
          {plan.nextContact ? (
            <p className="mt-3 text-sm text-tertiary">
              Next: <span className="font-semibold text-primary">{plan.nextContact.label}</span>, {fmtDate(plan.nextContact.date, { weekday: true })} ({relDay(plan.nextContact.date, state.clock)})
            </p>
          ) : null}
          {unknowns.length ? (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-semibold tracking-wide text-tertiary uppercase">Not tested</span>
              {unknowns.map((u) => (
                <Chip key={u.test + (u.childId ?? '')} tone={u.action === 'refer_for_test' ? 'error' : 'warning'} title={u.consequence}>
                  {u.test.replace(/_/g, ' ')}: unknown
                </Chip>
              ))}
            </div>
          ) : null}
        </Card>
        <Card className="lg:col-span-4">
          <p className="text-sm font-semibold text-primary">{active.length} items in her plan</p>
          <CategoryBar groups={groupItems(active, false)} />
        </Card>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" color="secondary" iconLeading={Stars02} onClick={() => setAi(ai === 'explain' ? null : 'explain')} aria-expanded={ai === 'explain'}>
            {t('plan.explain', 'Explain this plan')}
          </Button>
          <Button size="sm" color="secondary" iconLeading={Stars02} onClick={() => setAi(ai === 'suggest' ? null : 'suggest')} aria-expanded={ai === 'suggest'}>
            {t('plan.suggest', 'Suggest supportive items')}
          </Button>
          {mayEdit ? (
            <Button size="sm" color="secondary" iconLeading={Plus} onClick={() => setAdding(true)}>
              {t('plan.addItem', 'Add item')}
            </Button>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm" color="link-gray" onClick={() => setSelected(selected.length ? [] : activeIds)}>
            {selected.length ? 'Clear selection' : 'Select all'}
          </Button>
          <Button size="sm" color="link-gray" onClick={() => setLegend(!legend)} aria-expanded={legend}>
            Evidence grades
          </Button>
        </div>
      </div>

      {kids.length ? (
        <Segmented
          label="Whose items"
          size="sm"
          wrap
          value={childFilter}
          onChange={(v) => setChildFilter(v ?? 'all')}
          options={[{ value: 'all', label: 'Everyone' }, { value: 'mother', label: mother.name.split(' ')[0] }, ...kids.map((c) => ({ value: c.id, label: c.name.split(' ')[0] }))]}
          className="max-w-full sm:w-fit"
        />
      ) : null}

      {ai === 'explain' ? <ExplainPlan mother={mother} plan={plan} /> : null}
      {ai === 'suggest' ? <SuggestItems mother={mother} plan={plan} /> : null}
      {adding ? <AddItem mother={mother} plan={plan} onDone={() => setAdding(false)} /> : null}

      {legend ? (
        <Card className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {ALL_GRADES.map((g) => (
            <div key={g} className="flex items-start gap-3">
              <GradeBadge g={g} />
              <span className="text-sm text-tertiary">{gradeLabel(g).description}</span>
            </div>
          ))}
        </Card>
      ) : null}

      {grouped.length === 0 ? (
        <Card className="grid grid-cols-1 place-items-center gap-2 py-10 text-center">
          <Illustration k="calendar" size={80} />
          <p className="text-md font-semibold text-primary">Her plan is empty</p>
          <p className="text-sm text-tertiary">Record a visit to build her plan.</p>
        </Card>
      ) : (
        grouped.map(([cat, items]) => (
          <section key={cat} aria-labelledby={`cat-${cat}`} className="gk-cat grid grid-cols-1 gap-3">
            <div className="flex items-center gap-2">
              <IconTile icon={CATEGORY_ICON[cat]} tone={CATEGORY_TONE[cat] ?? 'gray'} size="sm" />
              <h3 id={`cat-${cat}`} className="text-md font-semibold text-primary">
                {CATEGORY_LABELS[cat] ?? cat}
              </h3>
              <span className="text-sm text-quaternary tnum">{items.length}</span>
            </div>
            <ul className="grid grid-cols-1 gap-3 xl:grid-cols-2">
              {items.map((i) => (
                <ItemCard key={i.id} item={i} mother={mother} selected={selected.includes(i.id)} onToggle={() => toggle(i.id)} fresh={Boolean(changes?.added.includes(i.id))} edited={Boolean(changes?.changed.includes(i.id))} onGuide={setGuide} />
              ))}
            </ul>
          </section>
        ))
      )}

      {removedCount ? (
        <div>
          <Button size="sm" color="link-gray" iconLeading={ChevronDown} onClick={() => setShowRemoved(!showRemoved)}>
            {showRemoved ? 'Hide removed items' : `Show ${removedCount} removed item${removedCount === 1 ? '' : 's'}`}
          </Button>
        </div>
      ) : null}

      {selected.length ? (
        <div role="region" aria-label="Selected items" className="sticky bottom-20 z-20 mx-auto flex w-full max-w-xl flex-wrap items-center justify-between gap-2 rounded-2xl bg-primary p-3 shadow-xl ring-1 ring-secondary lg:bottom-6">
          <span className="pl-1 text-sm font-semibold text-primary tnum">{selected.length} selected</span>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" color="tertiary" onClick={() => setSelected([])}>
              Clear
            </Button>
            <Button size="sm" color="secondary" iconLeading={Printer} onClick={() => onPrint(selected)}>
              {t('plan.printHandout', 'Print handout')}
            </Button>
            <Button size="sm" color="primary" iconLeading={Send01} onClick={() => onSend(selected)}>
              {t('plan.sendToMother', 'Send to mother')}
            </Button>
          </div>
        </div>
      ) : null}
      {guide ? <GuideSheet id={guide} country={mother.country} onClose={() => setGuide(null)} /> : null}
    </div>
  );
}

/** A thin bar of categories by count, with a legend of the top few. */
function CategoryBar({ groups }: { groups: ReadonlyArray<readonly [PlanCategory, PlanItem[]]> }) {
  const total = groups.reduce((n, [, items]) => n + items.length, 0) || 1;
  const tone = (c: PlanCategory) => CATEGORY_TONE[c];
  const fill = (c: PlanCategory) => (tone(c) === 'error' ? 'bg-fg-error-secondary' : tone(c) === 'warning' ? 'bg-fg-warning-secondary' : tone(c) === 'success' ? 'bg-fg-success-secondary' : tone(c) === 'brand' ? 'bg-fg-brand-secondary' : 'bg-fg-quaternary');
  return (
    <div className="mt-3">
      <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full" role="img" aria-label={groups.map(([c, i]) => `${CATEGORY_LABELS[c]} ${i.length}`).join(', ')}>
        {groups.map(([c, items]) => (
          <span key={c} className={cx('h-full', fill(c))} style={{ width: `${(items.length / total) * 100}%` }} />
        ))}
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5">
        {groups.slice(0, 6).map(([c, items]) => {
          const I = CATEGORY_ICON[c];
          return (
            <li key={c} className="flex min-w-0 items-center gap-1.5 text-xs text-tertiary">
              <I aria-hidden="true" className="size-3.5 shrink-0 text-fg-quaternary" />
              <span className="truncate">{CATEGORY_LABELS[c]}</span>
              <span className="ml-auto text-secondary tnum">{items.length}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ---------- Personal mode: "My plan" ----------

function MyPlan({ mother, plan: workerPlan }: { mother: Mother; plan: CarePlan }) {
  const { state } = useApp();
  const { ml } = useLangs(mother);
  // Her plan in personal mode: mother text only, worker-only items hidden, alerts as "Go to [place] now".
  const plan = useMemo(() => {
    try {
      const facility = state.facilities.find((f) => f.id === mother.facilityId);
      return buildPlan(mother, state.clock, {
        overrides: state.overrides.filter((o) => o.motherId === mother.id),
        learnedRules: state.learnedRules,
        previous: state.planVersions[mother.id],
        location: planLocationFor(mother),
        mode: 'personal',
        nearestFacility: facility?.name,
        emergencyNumber: emergencyShort(mother.country),
      } as Parameters<typeof buildPlan>[2]);
    } catch {
      return workerPlan;
    }
  }, [mother, state.clock, state.overrides, state.learnedRules, state.planVersions, state.facilities, workerPlan]);
  const [guide, setGuide] = useState<string | null>(null);
  const legal = legalFor(mother.country);
  const items = plan.items.filter((i) => i.status === 'active' && i.audience !== 'worker' && !i.workerOnly);
  const grouped = groupItems(items, false);
  const number = emergencyShort(mother.country);
  return (
    <div className="grid grid-cols-1 gap-8" data-testid="my-plan">
      <PersonalAlerts mother={mother} plan={plan} />
      <SectionTitle title="My plan" lede={plan.nextContact ? `Next visit: ${fmtDate(plan.nextContact.date, { weekday: true })} (${relDay(plan.nextContact.date, state.clock)}).` : undefined} />
      {grouped.map(([cat, list]) => (
        <section key={cat} aria-label={CATEGORY_LABELS[cat] ?? cat} className="grid grid-cols-1 gap-3">
          <h3 className="flex items-center gap-2 text-md font-semibold text-primary">
            <IconTile icon={CATEGORY_ICON[cat]} tone={CATEGORY_TONE[cat] ?? 'gray'} size="sm" />
            {CATEGORY_LABELS[cat] ?? cat}
          </h3>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {list.map((i) => {
              const l = lineFor(ml, i.motherTextKey, i.motherText, i.motherTextParams);
              return (
                <li key={i.id} data-item={i.id} className="flex gap-4 rounded-2xl bg-primary p-4 ring-1 ring-secondary ring-inset">
                  <span className="grid grid-cols-1 size-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-secondary">
                    <Illustration k={i.illustration ?? 'talk_to_someone'} size={60} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-md leading-snug text-primary" lang={l.lang} dir={l.dir}>
                      {l.text}
                    </p>
                    {i.timing ? <p className="mt-1 text-sm font-medium text-brand-secondary">{i.timing}</p> : null}
                    {i.howTo?.steps?.length ? (
                      <Disclosure summary="How" className="mt-1">
                        <HowToBody howTo={i.howTo} lang={ml} onOpenGuide={setGuide} compact />
                      </Disclosure>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      <footer className="rounded-2xl bg-secondary p-4 text-center text-sm text-tertiary" data-testid="my-plan-disclaimer">
        {DISCLAIMER_LINES.map((k) => lineFor(ml, k, legal.disclaimer, { number }).text).join(' ')}{' '}
        <a href={`tel:${number}`} className="font-semibold text-error-primary underline underline-offset-2">
          {legal.emergencyLabel} {number}
        </a>
      </footer>
      {guide ? <GuideSheet id={guide} country={mother.country} personal onClose={() => setGuide(null)} /> : null}
    </div>
  );
}
