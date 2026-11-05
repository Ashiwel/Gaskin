import { useMemo, useState } from 'react';
import type { Alert, CarePlan, Mother, PlanCategory, PlanItem, Override, TraditionalPractice } from '../types';
import { stamp, uid, useApp, useWorker } from '../store';
import { CATEGORY_LABELS, TRADITIONAL_PRACTICES } from '../clinical';
import { Grade, gradeLabel, Illustration, Thinking, useAbort, useToast, Empty, GRADE_SHORT } from './components';
import { IAlert, ICheck, IChevron, IEdit, ILock, IPlus, IPrint, ISend, ISpark, ITrash } from './icons';
import { AIBadge, getProvider, WhatAISees } from './ai';
import { fmtDate, fmtTime, relDay } from './format';
import { useT } from './i18n';
import { MotherLine } from './MotherLine';
import AnimatedBorderTrail from './animata/AnimatedBorderTrail';

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

// ---------- Alerts ----------

function AlertCard({ alert, mother }: { alert: Alert; mother: Mother }) {
  const { state, dispatch } = useApp();
  const worker = useWorker();
  const toast = useToast();
  const ack = state.alertAcks.find((a) => a.motherId === mother.id && a.alertId === alert.id);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const by = ack ? state.workers.find((w) => w.id === ack.by)?.name ?? ack.by : '';
  const t = useT();
  const levelLabel = alert.level === 'emergency' ? t('alert.emergency', 'Emergency') : alert.level === 'urgent' ? t('alert.urgent', 'Urgent') : t('alert.warning', 'Warning');
  const card = (
    <div className={`alert ${alert.level === 'emergency' ? 'emergency' : ''}${alert.level === 'warning' ? ' warning' : ''}`} role="alert" data-alert={alert.id}>
      <IAlert className="ico" />
      <div className="body">
        <span className="level">
          {levelLabel}
          {alert.subject === 'child' ? ' for baby' : ''}
        </span>
        <span className="title">{alert.title}</span>
        <span className="do">{alert.action}</span>
        <span className="alert-why">
          {alert.reason}
          {alert.sources.length ? ` (${alert.sources.map((s) => s.label).join('; ')})` : ''}
        </span>
        <div className="mt-1 rounded-[var(--r-s)] bg-raised/70 px-3 py-2.5">
          <span className="mb-1 block text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-ink-3">{t('dual.mother_side', 'Tell her')}</span>
          <MotherLine alert={alert} mother={mother} workerId={worker.id} />
        </div>
        {ack ? (
          <span className="ack">
            <ICheck width={14} height={14} style={{ color: 'var(--green)' }} />
            Acknowledged by {by}, {fmtTime(ack.at)}: “{ack.note}”. It stays here until her readings change.
            <button className="link-btn" onClick={() => setOpen(true)}>
              Add note
            </button>
          </span>
        ) : null}
        {!ack && !open ? (
          <div>
            <button className="btn small" onClick={() => setOpen(true)}>
              {t('alert.acknowledge', 'Acknowledge with a note')}
            </button>
          </div>
        ) : null}
        {open ? (
          <form
            className="alert-ack-form"
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
              className="input"
              id={`ack-${alert.id}`}
              placeholder="What you did, for example: Referred, transport arranged"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              autoFocus
              aria-label="What you did"
            />
            <button className="btn small primary" type="submit" disabled={!note.trim()}>
              Save note
            </button>
            <button className="btn small ghost" type="button" onClick={() => setOpen(false)}>
              Cancel
            </button>
          </form>
        ) : null}
      </div>
    </div>
  );
  // Emergencies get a slow border trail so they cannot be missed (stops under reduced motion).
  return alert.level === 'emergency' ? (
    <AnimatedBorderTrail trailColor="var(--red)" duration="5s" trailSize="md" data-testid="border-trail" contentClassName="[&>.alert]:rounded-[calc(var(--r-l)-2px)]">
      {card}
    </AnimatedBorderTrail>
  ) : (
    card
  );
}

// ---------- What changed ----------

export function WhatChanged({ mother, plan }: { mother: Mother; plan: CarePlan }) {
  const { state, dispatch } = useApp();
  const t = useT();
  const rec = state.lastChanges[mother.id];
  if (!rec) return null;
  const d = rec.diff;
  const title = (id: string) => plan.items.find((i) => i.id === id)?.title ?? id;
  const alertTitle = (id: string) => plan.alerts.find((a) => a.id === id)?.title ?? id;
  const lines: Array<{ sym: string; cls: string; text: string }> = [
    ...d.newAlerts.map((id) => ({ sym: '!', cls: 'al', text: `New alert: ${alertTitle(id)}` })),
    ...d.added.map((id) => ({ sym: '+', cls: 'add', text: `Added: ${title(id)}` })),
    ...d.changed.map((id) => ({ sym: '~', cls: 'chg', text: `Changed: ${title(id)}` })),
    ...d.removed.map((id) => ({ sym: '−', cls: 'rem', text: `Removed: ${title(id)}` })),
  ];
  if (!lines.length) return null;
  return (
    <section className="changes" aria-label="What changed" data-testid="what-changed">
      <div className="changes-head">
        <strong>{t('plan.whatChanged', 'What changed in her plan')}</strong>
        <span className="small muted">
          {rec.cause} · version {rec.version} · {fmtDate(rec.at)}
          <button className="link-btn" style={{ marginLeft: 10 }} onClick={() => dispatch({ type: 'dismissChanges', motherId: mother.id })}>
            Got it
          </button>
        </span>
      </div>
      <ul>
        {lines.map((l, i) => (
          <li key={i}>
            <span className={`sym ${l.cls}`}>{l.sym}</span>
            <span>{l.text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------- Item ----------

type FormKind = 'remove' | 'edit' | null;

function ItemRow({
  item,
  mother,
  selected,
  onToggle,
  fresh,
  edited,
}: {
  item: PlanItem;
  mother: Mother;
  selected: boolean;
  onToggle: () => void;
  fresh: boolean;
  edited: boolean;
}) {
  const { state, dispatch } = useApp();
  const worker = useWorker();
  const toast = useToast();
  const [why, setWhy] = useState(false);
  const [form, setForm] = useState<FormKind>(null);
  const [reason, setReason] = useState('');
  const [propose, setPropose] = useState(false);
  const [title, setTitle] = useState(item.title);
  const [motherText, setMotherText] = useState(item.motherText);
  const [timing, setTiming] = useState(item.timing ?? '');
  const removed = item.status === 'removed';
  const ov = item.overriddenBy ? state.overrides.find((o) => o.id === item.overriddenBy) : undefined;
  const ovBy = ov ? state.workers.find((w) => w.id === ov.workerId)?.name : undefined;

  const submit = () => {
    if (!reason.trim()) return;
    const o: Override = {
      id: uid('ov'),
      motherId: mother.id,
      itemId: item.id,
      action: form === 'remove' ? 'remove' : 'modify',
      item: form === 'edit' ? { ...item, title, motherText, timing: timing || undefined } : undefined,
      reason: reason.trim(),
      workerId: worker.id,
      createdAt: stamp(state.clock),
      proposeGlobal: propose,
      status: 'active',
    };
    dispatch({ type: 'addOverride', override: o, now: o.createdAt });
    toast(
      `${form === 'remove' ? 'Removed from her plan' : 'Item updated'}${propose ? '. Proposed for every mother like her, waiting for expert review.' : '.'}`,
    );
    setForm(null);
    setReason('');
    setPropose(false);
  };

  return (
    <li className={`item${removed ? ' removed' : ''}${fresh ? ' fresh' : ''}${edited ? ' edited' : ''}`} data-item={item.id} data-category={item.category}>
      <label className="pick">
        <input type="checkbox" checked={selected} onChange={onToggle} disabled={removed} aria-label={`Select ${item.title}`} />
      </label>
      <div className="thumb">
        <Illustration k={item.illustration} size={48} />
      </div>
      <div className="item-main">
        <div className="item-top">
          <span className="item-title">
            {item.title}
            {item.locked ? (
              <span className="lock" title="Safety-critical. Cannot be removed by one person.">
                <ILock /> Safety
              </span>
            ) : null}
          </span>
          {!removed ? (
            <span className="item-actions">
              <button className="btn icon small ghost" aria-label={`Edit ${item.title}`} title="Edit" onClick={() => setForm(form === 'edit' ? null : 'edit')}>
                <IEdit />
              </button>
              <button className="btn icon small ghost" aria-label={`Remove ${item.title}`} title="Remove" onClick={() => setForm(form === 'remove' ? null : 'remove')}>
                <ITrash />
              </button>
            </span>
          ) : ov ? (
            <button className="link-btn" onClick={() => dispatch({ type: 'revertOverride', id: ov.id })}>
              Put back
            </button>
          ) : null}
        </div>
        {item.audience === 'worker' ? <p className="mother-text muted">For you only. Not shown to her.</p> : <MotherLine item={item} mother={mother} workerId={worker.id} />}
        <div className="item-meta">
          <Grade g={item.evidence} />
          {item.timing ? <span>{item.timing}</span> : null}
          {item.dueDate ? <span>Due {fmtDate(item.dueDate)}</span> : null}
          {item.origin === 'learned_rule' ? <span className="chip clay">Learned from experts</span> : null}
          {item.origin === 'worker_added' ? <span className="chip outline">Added by a health worker</span> : null}
          {item.origin === 'ai_suggested' ? <span className="chip outline">AI suggestion, approved</span> : null}
          {removed && ov ? (
            <span>
              Removed by {ovBy ?? 'a health worker'}: “{ov.reason}”
            </span>
          ) : null}
          {!removed && ov && ov.action === 'modify' ? <span>Edited by {ovBy}</span> : null}
          <button className="link-btn" onClick={() => setWhy(!why)} aria-expanded={why}>
            {why ? 'Hide why' : 'Why?'}
          </button>
        </div>
        {why ? (
          <div className="why">
            <p className="soft">{item.detail}</p>
            {item.because.length ? (
              <div>
                <strong className="small">Because</strong>
                <ul>
                  {item.because.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="src small">
              <span className="muted">{gradeLabel(item.evidence).label}.</span>
              {item.sources.map((s) =>
                s.url ? (
                  <a key={s.id} href={s.url} target="_blank" rel="noreferrer">
                    {s.label}
                  </a>
                ) : (
                  <span key={s.id}>{s.label}</span>
                ),
              )}
            </div>
          </div>
        ) : null}

        {form === 'remove' && item.locked ? (
          <div className="inline-form">
            <p className="small">
              <strong>This is a safety item, so it cannot be removed here.</strong> It protects her from a danger the guidelines treat as serious. If you think it is wrong for her, record why and propose a change; a clinical reviewer will decide.
            </p>
            <label className="field">
              <span>Why it may not fit her</span>
              <textarea className="textarea" id={`lockreason-${item.id}`} value={reason} onChange={(e) => setReason(e.target.value)} />
            </label>
            <div className="btn-row">
              <button
                className="btn small primary"
                disabled={!reason.trim()}
                onClick={() => {
                  const o: Override = {
                    id: uid('ov'),
                    motherId: mother.id,
                    itemId: item.id,
                    action: 'remove',
                    reason: reason.trim(),
                    workerId: worker.id,
                    createdAt: stamp(state.clock),
                    proposeGlobal: true,
                    status: 'reverted',
                  };
                  // Recorded as a proposal only: the item stays in her plan.
                  dispatch({ type: 'addOverride', override: o, now: o.createdAt });
                  toast('Sent to clinical review. The item stays in her plan meanwhile.');
                  setForm(null);
                  setReason('');
                }}
              >
                Send for review
              </button>
              <button className="btn small ghost" onClick={() => setForm(null)}>
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        {(form === 'remove' && !item.locked) || form === 'edit' ? (
          <form
            className="inline-form"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            {form === 'edit' ? (
              <>
                <label className="field">
                  <span>Title</span>
                  <input className="input" id={`t-${item.id}`} value={title} onChange={(e) => setTitle(e.target.value)} />
                </label>
                <label className="field">
                  <span>What she is told</span>
                  <textarea className="textarea" id={`m-${item.id}`} value={motherText} onChange={(e) => setMotherText(e.target.value)} />
                </label>
                <label className="field">
                  <span>When</span>
                  <input className="input" id={`w-${item.id}`} value={timing} onChange={(e) => setTiming(e.target.value)} />
                </label>
              </>
            ) : null}
            <label className="field">
              <span>
                Reason <span className="hint">(required)</span>
              </span>
              <input
                className="input"
                id={`r-${item.id}`}
                placeholder={form === 'remove' ? 'For example: She already does this every day' : 'What you changed and why'}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                autoFocus
              />
            </label>
            <label className="switch">
              <input type="checkbox" checked={propose} onChange={(e) => setPropose(e.target.checked)} />
              Propose this change for every mother like her
            </label>
            <div className="btn-row">
              <button className="btn small primary" type="submit" disabled={!reason.trim()}>
                {form === 'remove' ? 'Remove from her plan' : 'Save change'}
              </button>
              <button className="btn small ghost" type="button" onClick={() => setForm(null)}>
                Cancel
              </button>
            </div>
          </form>
        ) : null}
      </div>
    </li>
  );
}

// ---------- Add item ----------

function AddItem({ mother, plan, onDone }: { mother: Mother; plan: CarePlan; onDone: () => void }) {
  const { state, dispatch } = useApp();
  const worker = useWorker();
  const toast = useToast();
  const [mode, setMode] = useState<'library' | 'custom'>('library');
  const [pick, setPick] = useState<string>('');
  const [title, setTitle] = useState('');
  const [motherText, setMotherText] = useState('');
  const [category, setCategory] = useState<PlanCategory>('education');
  const [reason, setReason] = useState('');
  const [propose, setPropose] = useState(false);
  const practices = useMemo(() => {
    const list: TraditionalPractice[] = (TRADITIONAL_PRACTICES ?? []).filter(
      (p) => p.countries.includes(mother.country) && p.stage.includes(plan.state.stage) && !plan.items.some((i) => i.id === `trad.${p.id}`),
    );
    return list;
  }, [mother.country, plan]);
  const chosen = practices.find((p) => p.id === pick);

  const save = () => {
    const isLib = mode === 'library' && chosen;
    const itemId = isLib ? `trad.${chosen!.id}` : `custom.${uid('it')}`;
    const item: Partial<PlanItem> & { title: string } = isLib
      ? {
          id: itemId,
          category: 'traditional_practice',
          title: chosen!.name,
          detail: `${chosen!.evidenceSummary} ${chosen!.guidance}`,
          motherText: chosen!.motherText,
          evidence: chosen!.grade,
          sources: chosen!.sources,
          because: [`Added by ${worker.name}: ${reason.trim()}`],
          origin: 'traditional',
          priority: 3,
          audience: 'both',
          status: 'active',
          illustration: 'family_support',
        }
      : {
          id: itemId,
          category,
          title: title.trim(),
          detail: reason.trim(),
          motherText: motherText.trim() || title.trim(),
          evidence: 'C',
          sources: [],
          because: [`Added by ${worker.name}: ${reason.trim()}`],
          origin: 'worker_added',
          priority: 3,
          audience: 'mother',
          status: 'active',
        };
    const o: Override = {
      id: uid('ov'),
      motherId: mother.id,
      itemId,
      action: 'add',
      item,
      reason: reason.trim(),
      workerId: worker.id,
      createdAt: stamp(state.clock),
      proposeGlobal: propose,
      status: 'active',
    };
    dispatch({ type: 'addOverride', override: o, now: o.createdAt });
    toast(propose ? 'Added, and proposed for every mother like her.' : 'Added to her plan.');
    onDone();
  };

  const valid = reason.trim() && (mode === 'library' ? Boolean(chosen) : Boolean(title.trim()));

  return (
    <form
      className="inline-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) save();
      }}
    >
      <div className="seg" role="group" aria-label="Add from">
        <button type="button" aria-pressed={mode === 'library'} onClick={() => setMode('library')}>
          Traditional practice
        </button>
        <button type="button" aria-pressed={mode === 'custom'} onClick={() => setMode('custom')}>
          Write your own
        </button>
      </div>
      {mode === 'library' ? (
        practices.length ? (
          <>
            <label className="field">
              <span>Practice she or her family follow</span>
              <select className="select" id="add-practice" value={pick} onChange={(e) => setPick(e.target.value)}>
                <option value="">Choose a practice</option>
                {practices.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({GRADE_SHORT[p.grade]}: {gradeLabel(p.grade).label})
                  </option>
                ))}
              </select>
            </label>
            {chosen ? (
              <div className="why">
                <p>{chosen.description}</p>
                <p className="soft">
                  <strong>What to say:</strong> {chosen.guidance}
                </p>
              </div>
            ) : null}
          </>
        ) : (
          <p className="small muted">No more practices in the library fit her stage and country.</p>
        )
      ) : (
        <>
          <label className="field">
            <span>Title</span>
            <input className="input" id="add-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="For example: Ask her sister to come to the next visit" />
          </label>
          <label className="field">
            <span>What she is told</span>
            <textarea className="textarea" id="add-mtext" value={motherText} onChange={(e) => setMotherText(e.target.value)} />
          </label>
          <label className="field">
            <span>Group</span>
            <select className="select" id="add-cat" value={category} onChange={(e) => setCategory(e.target.value as PlanCategory)}>
              {CAT_ORDER.filter((c) => c !== 'danger_signs').map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c] ?? c}
                </option>
              ))}
            </select>
          </label>
        </>
      )}
      <label className="field">
        <span>
          Reason <span className="hint">(required)</span>
        </span>
        <input className="input" id="add-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why she needs this" />
      </label>
      <label className="switch">
        <input type="checkbox" checked={propose} onChange={(e) => setPropose(e.target.checked)} />
        Propose this change for every mother like her
      </label>
      <div className="btn-row">
        <button className="btn small primary" type="submit" disabled={!valid}>
          Add to her plan
        </button>
        <button className="btn small ghost" type="button" onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
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
      if (!signal.aborted) setNote('The AI could not answer just now. The plan above is complete without it.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="ai-out">
      <div className="section-head">
        <strong className="t-h3">Explain this plan</strong>
        <AIBadge />
      </div>
      {text ? <p className="text">{text}</p> : null}
      {busy && !text ? <Thinking onStop={() => { stop(); setBusy(false); }} /> : null}
      {busy && text ? (
        <button className="btn small ghost" onClick={() => { stop(); setBusy(false); }}>
          Stop
        </button>
      ) : null}
      {note ? <p className="small muted">{note}</p> : null}
      {!busy ? (
        <div className="btn-row">
          <button className="btn small" onClick={run}>
            <ISpark /> {text ? 'Explain again' : 'Explain in plain words'}
          </button>
        </div>
      ) : null}
      <WhatAISees task="explain" args={{ plan, mother }} />
    </div>
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
      item: {
        id: itemId,
        title: s.title,
        detail: s.detail,
        motherText: s.motherText,
        category: s.category,
        evidence: 'C',
        sources: [],
        because: [`Suggested by AI, accepted by ${worker.name}`],
        origin: 'ai_suggested',
        priority: 4,
        audience: 'mother',
        status: 'active',
      },
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
    <div className="ai-out">
      <div className="section-head">
        <strong className="t-h3">Supportive suggestions</strong>
        <AIBadge />
      </div>
      <p className="small muted">Ideas for comfort, food and family support. Safety items always come from the rules, never from AI.</p>
      {busy ? <Thinking onStop={() => { stop(); setBusy(false); }} /> : null}
      {items.length ? (
        <ul className="support" style={{ listStyle: 'none' }}>
          {items.map((s) => (
            <li key={s.k} style={{ opacity: s.done === 'rejected' ? 0.5 : 1 }}>
              <strong>{s.title}</strong>
              <span className="soft">{s.motherText}</span>
              <span className="tiny muted">{CATEGORY_LABELS[s.category] ?? s.category}</span>
              {s.done ? (
                <span className="small muted">{s.done === 'accepted' ? 'Accepted' : 'Rejected'}</span>
              ) : (
                <span className="btn-row" style={{ marginTop: 4 }}>
                  <button className="btn small primary" onClick={() => accept(s)}>
                    Accept
                  </button>
                  <button className="btn small ghost" onClick={() => setItems((xs) => xs.map((x) => (x.k === s.k ? { ...x, done: 'rejected' } : x)))}>
                    Reject
                  </button>
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : null}
      {note ? <p className="small muted">{note}</p> : null}
      {!busy ? (
        <div className="btn-row">
          <button className="btn small" onClick={run}>
            <ISpark /> {items.length ? 'Suggest again' : 'Suggest supportive items'}
          </button>
        </div>
      ) : null}
      <WhatAISees task="suggest" args={{ plan, mother }} />
    </div>
  );
}

// ---------- Plan ----------

export function PlanView({ mother, plan, onSend, onPrint }: { mother: Mother; plan: CarePlan; onSend: (ids: string[]) => void; onPrint: (ids: string[]) => void }) {
  const { state } = useApp();
  const t = useT();
  const [selected, setSelected] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [showRemoved, setShowRemoved] = useState(false);
  const [legend, setLegend] = useState(false);
  const [ai, setAi] = useState<'explain' | 'suggest' | null>(null);
  const changes = state.lastChanges[mother.id]?.diff;

  const grouped = useMemo(() => {
    const visible = plan.items.filter((i) => i.status !== 'removed' || showRemoved);
    const by = new Map<PlanCategory, PlanItem[]>();
    for (const i of visible) {
      const arr = by.get(i.category) ?? [];
      arr.push(i);
      by.set(i.category, arr);
    }
    for (const arr of by.values()) arr.sort((a, b) => a.priority - b.priority);
    const cats = [...by.keys()].sort((a, b) => {
      const ia = CAT_ORDER.indexOf(a);
      const ib = CAT_ORDER.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
    return cats.map((c) => [c, by.get(c)!] as const);
  }, [plan.items, showRemoved]);

  const removedCount = plan.items.filter((i) => i.status === 'removed').length;
  const activeIds = plan.items.filter((i) => i.status === 'active').map((i) => i.id);
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const alerts = [...plan.alerts].sort((a, b) => ({ emergency: 0, urgent: 1, warning: 2 })[a.level] - ({ emergency: 0, urgent: 1, warning: 2 })[b.level]);

  return (
    <div className="section" style={{ gap: 26 }}>
      {alerts.length ? (
        <section className="alerts" aria-label="Alerts">
          {alerts.map((a) => (
            <AlertCard key={a.id} alert={a} mother={mother} />
          ))}
        </section>
      ) : null}

      <WhatChanged mother={mother} plan={plan} />

      <div className="section" style={{ gap: 10 }}>
        <p className="plan-summary">{plan.summary}</p>
        {plan.nextContact ? (
          <p className="small soft">
            Next: <strong>{plan.nextContact.label}</strong>, {fmtDate(plan.nextContact.date, { weekday: true })} ({relDay(plan.nextContact.date, state.clock)})
          </p>
        ) : null}
      </div>

      <div className="plan-tools">
        <div className="btn-row">
          <button className="btn small" onClick={() => setAi(ai === 'explain' ? null : 'explain')} aria-expanded={ai === 'explain'}>
            <ISpark /> {t('plan.explain', 'Explain this plan')}
          </button>
          <button className="btn small" onClick={() => setAi(ai === 'suggest' ? null : 'suggest')} aria-expanded={ai === 'suggest'}>
            <ISpark /> {t('plan.suggest', 'Suggest supportive items')}
          </button>
          <button className="btn small" onClick={() => setAdding(!adding)} aria-expanded={adding}>
            <IPlus /> {t('plan.addItem', 'Add item')}
          </button>
        </div>
        <div className="btn-row">
          <button className="link-btn" onClick={() => setSelected(selected.length ? [] : activeIds)}>
            {selected.length ? 'Clear selection' : 'Select all'}
          </button>
          <button className="link-btn" onClick={() => setLegend(!legend)} aria-expanded={legend}>
            Evidence grades
          </button>
        </div>
      </div>

      {ai === 'explain' ? <ExplainPlan mother={mother} plan={plan} /> : null}
      {ai === 'suggest' ? <SuggestItems mother={mother} plan={plan} /> : null}
      {adding ? <AddItem mother={mother} plan={plan} onDone={() => setAdding(false)} /> : null}

      {legend ? (
        <div className="panel legend">
          {ALL_GRADES.map((g) => (
            <div className="legend-row" key={g}>
              <span>
                <Grade g={g} /> <span className="small">{gradeLabel(g).label}</span>
              </span>
              <span className="small soft">{gradeLabel(g).description}</span>
            </div>
          ))}
        </div>
      ) : null}

      {grouped.length === 0 ? (
        <Empty art="calendar" title="Her plan is empty">
          Record a visit to build her plan.
        </Empty>
      ) : (
        grouped.map(([cat, items]) => (
          <section className="cat" key={cat} aria-label={CATEGORY_LABELS[cat] ?? cat}>
            <div className="cat-head">
              <h3>{CATEGORY_LABELS[cat] ?? cat}</h3>
              <span className="muted">{items.length}</span>
            </div>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {items.map((i) => (
                <ItemRow
                  key={i.id}
                  item={i}
                  mother={mother}
                  selected={selected.includes(i.id)}
                  onToggle={() => toggle(i.id)}
                  fresh={Boolean(changes?.added.includes(i.id))}
                  edited={Boolean(changes?.changed.includes(i.id))}
                />
              ))}
            </ul>
          </section>
        ))
      )}

      {removedCount ? (
        <button className="link-btn" onClick={() => setShowRemoved(!showRemoved)}>
          {showRemoved ? 'Hide removed items' : `Show ${removedCount} removed item${removedCount === 1 ? '' : 's'}`}
        </button>
      ) : null}

      {selected.length ? (
        <div className="sendbar" role="region" aria-label="Selected items">
          <span className="small">
            {selected.length} selected
            <IChevron width={0} height={0} />
          </span>
          <div className="btn-row">
            <button className="btn small ghost" onClick={() => setSelected([])}>
              Clear
            </button>
            <button className="btn small" onClick={() => onPrint(selected)}>
              <IPrint /> {t('plan.printHandout', 'Print handout')}
            </button>
            <button className="btn small" onClick={() => onSend(selected)}>
              <ISend /> {t('plan.sendToMother', 'Send to mother')}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
