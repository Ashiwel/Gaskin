/**
 * Messages: a hub of threads, one per mother, with triage labels, and her phone as she sees it.
 * The phone is a generic smartphone (chat app) or a basic phone (SMS), chosen from her record.
 * Reply as her with a canned line in her language or by typing; Gaskin reads it for danger signs.
 */
import { useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, ArrowRight, MessageChatCircle, Phone01, Printer, SearchLg } from '@untitledui/icons';
import type { InboundMessage, Mother, SymptomEvent } from '../types';
import { stamp, uid, useApp, usePlans, useWorker } from '../store';
import { triageSymptoms, TRIAGE_LABELS, type TriageTier } from '../store/triage';
import { parseSymptomsFromText } from '../messaging';
import { SYMPTOM_LABELS } from '../clinical';
import { LANGUAGE_NAMES } from '../data';
import { Button } from '../components/base/buttons/button';
import { Badge, BadgeWithDot } from '../components/base/badges/badges';
import { cx } from '../utils/cx';
import { useNav } from './nav';
import { useToast } from './components';
import { fmtTime, PHONE_ACCESS_LABELS, CHANNEL_LABELS } from './format';
import { inScope, personalMotherId, usePersonalMode, useScope } from './today/access';
import { Card, hashTone, Initials, PageHeader, Segmented } from './messages/kit';
import { FeaturePhoneFrame, SmartphoneFrame } from './phone/Devices';
import { cannedFor, dirOfLang, dirOfText, threadFor } from './phone/thread';

const TRIAGE_TONE: Record<TriageTier, 'error' | 'warning' | 'gray'> = { emergency: 'error', same_day: 'warning', next_contact: 'gray' };
const TRIAGE_RANK: Record<TriageTier, number> = { emergency: 0, same_day: 1, next_contact: 2 };

interface Thread {
  mother: Mother;
  last?: { at: string; body: string; from: 'clinic' | 'her' };
  unread: number;
  tier?: TriageTier;
  count: number;
}

function useThreads(mothers: Mother[]): Thread[] {
  const { state } = useApp();
  return useMemo(() => {
    const out: Thread[] = [];
    for (const m of mothers) {
      const outs = state.outbound.filter((o) => o.motherId === m.id);
      const ins = state.inbound.filter((i) => i.motherId === m.id);
      if (!outs.length && !ins.length) continue;
      const lastOut = outs.reduce<(typeof outs)[number] | undefined>((a, o) => (!a || o.createdAt > a.createdAt ? o : a), undefined);
      const lastIn = ins.reduce<(typeof ins)[number] | undefined>((a, i) => (!a || i.receivedAt > a.receivedAt ? i : a), undefined);
      const last =
        lastIn && (!lastOut || lastIn.receivedAt > lastOut.createdAt)
          ? { at: lastIn.receivedAt, body: lastIn.body, from: 'her' as const }
          : lastOut
            ? { at: lastOut.createdAt, body: lastOut.body, from: 'clinic' as const }
            : undefined;
      const readAt = state.readInbound[m.id];
      const unreadMsgs = ins.filter((i) => !readAt || i.receivedAt > readAt);
      const tiers = unreadMsgs.map((i) => state.inboundTriage[i.id]).filter(Boolean) as TriageTier[];
      const tier = tiers.sort((a, b) => TRIAGE_RANK[a] - TRIAGE_RANK[b])[0];
      out.push({ mother: m, last, unread: unreadMsgs.length, tier, count: outs.length + ins.length });
    }
    return out.sort((a, b) => {
      const ta = a.tier ? TRIAGE_RANK[a.tier] : 3;
      const tb = b.tier ? TRIAGE_RANK[b.tier] : 3;
      if (ta !== tb) return ta - tb;
      if ((b.unread > 0 ? 1 : 0) !== (a.unread > 0 ? 1 : 0)) return (b.unread > 0 ? 1 : 0) - (a.unread > 0 ? 1 : 0);
      return (b.last?.at ?? '').localeCompare(a.last?.at ?? '');
    });
  }, [mothers, state.outbound, state.inbound, state.readInbound, state.inboundTriage]);
}

function ThreadRow({ t, active, onOpen }: { t: Thread; active: boolean; onOpen: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        aria-current={active ? 'true' : undefined}
        data-thread={t.mother.id}
        className={cx('flex w-full cursor-pointer items-start gap-3 rounded-xl px-3 py-3 text-start transition hover:bg-primary_hover', active && 'bg-secondary ring-1 ring-secondary')}
      >
        <span className="relative">
          <Initials name={t.mother.name} tone={hashTone(t.mother.id)} />
          {t.unread ? <span aria-hidden="true" className="absolute -top-0.5 -right-0.5 size-3 rounded-full bg-brand-solid ring-2 ring-[var(--color-bg-primary)]" /> : null}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <strong className={cx('truncate text-sm text-primary', t.unread ? 'font-semibold' : 'font-medium')}>{t.mother.name}</strong>
            <span className="shrink-0 text-xs text-tertiary tnum">{t.last ? fmtTime(t.last.at) : ''}</span>
          </span>
          <span className="mt-0.5 line-clamp-1 text-sm text-tertiary" dir={t.last ? dirOfText(t.last.body) : undefined}>
            {t.last?.from === 'clinic' ? 'You: ' : ''}
            {t.last?.body}
          </span>
          <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {t.tier ? (
              <BadgeWithDot size="sm" color={TRIAGE_TONE[t.tier]} type="pill-color">
                {TRIAGE_LABELS[t.tier]}
              </BadgeWithDot>
            ) : null}
            {t.unread ? (
              <Badge size="sm" color="brand">
                {t.unread} new
              </Badge>
            ) : null}
            <span className="text-xs text-quaternary">{PHONE_ACCESS_LABELS[t.mother.phone.access]}</span>
          </span>
        </span>
      </button>
    </li>
  );
}

export function PhoneView({ id }: { id?: string }) {
  const { state, dispatch } = useApp();
  const plans = usePlans();
  const worker = useWorker();
  const { go } = useNav();
  const toast = useToast();
  const personal = usePersonalMode();
  const [scope] = useScope(worker);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | 'triage' | 'unread'>('all');
  const [last, setLast] = useState<{ msg: InboundMessage; tier: TriageTier } | null>(null);
  const [draft, setDraft] = useState('');

  const mothers = useMemo(() => {
    if (personal) {
      const me = personalMotherId(state.mothers);
      return state.mothers.filter((m) => m.id === me);
    }
    return state.mothers.filter((m) => inScope(m, scope, worker));
  }, [personal, state.mothers, scope, worker]);
  const threads = useThreads(mothers);
  const motherId = personal ? mothers[0]?.id : (id ?? threads[0]?.mother.id ?? mothers[0]?.id);
  const mother = state.mothers.find((m) => m.id === motherId && mothers.some((x) => x.id === m.id));
  const thread = useMemo(() => (mother ? threadFor(state, mother) : []), [mother, state]);
  const shown = threads.filter((t) => {
    if (filter === 'triage' && !t.tier) return false;
    if (filter === 'unread' && !t.unread) return false;
    return !q.trim() || t.mother.name.toLowerCase().includes(q.trim().toLowerCase());
  });
  const triaged = threads.filter((t) => t.tier).length;
  const unread = threads.filter((t) => t.unread).length;

  const reply = (body: string) => {
    if (!mother) return;
    const text = body.trim();
    if (!text) return;
    let parsed: InboundMessage['parsedSymptoms'] = [];
    try {
      parsed = parseSymptomsFromText(text);
    } catch {
      parsed = [];
    }
    const smart = mother.phone.access === 'smartphone' && mother.phone.hasWhatsApp;
    const at = stamp(state.clock);
    const msg: InboundMessage = { id: uid('in'), motherId: mother.id, channel: smart ? 'whatsapp' : 'sms', body: text, receivedAt: at, parsedSymptoms: parsed };
    const tier = triageSymptoms(parsed);
    const events: SymptomEvent[] = parsed && parsed.length ? [{ kind: 'symptom', id: uid('ev'), at, recordedBy: 'mother', symptoms: parsed, via: smart ? 'whatsapp' : 'sms', note: text }] : [];
    dispatch({ type: 'inbound', message: msg, events, triage: tier });
    setLast({ msg, tier });
    setDraft('');
    if (tier === 'emergency') toast(personal ? 'These are danger signs. Go to the clinic now.' : 'Danger signs found in her reply. Her plan now shows an alert.');
  };

  const open = (m: Mother) => {
    setLast(null);
    setDraft('');
    go({ name: 'phone', id: m.id }, { replace: true });
    dispatch({ type: 'markRead', motherId: m.id, at: stamp(state.clock) });
  };

  if (!mother) {
    return (
      <div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-8">
        <PageHeader title="Messages" lede="Messages to the mothers you look after, and their replies, appear here." />
        <Card>
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <MessageChatCircle className="size-8 text-fg-quaternary" aria-hidden="true" />
            <p className="text-md font-semibold text-primary">No mothers in your caseload yet</p>
            <p className="max-w-[44ch] text-sm text-tertiary">Register a mother, or ask a supervisor to add mothers to your caseload.</p>
          </div>
        </Card>
      </div>
    );
  }

  const smart = mother.phone.access === 'smartphone' && mother.phone.hasWhatsApp;
  const noPhone = mother.phone.access === 'none';
  const facility = state.facilities.find((f) => f.id === mother.facilityId)?.name ?? 'your clinic';
  const shortFacility = facility.replace(/Primary Health Centre/i, 'PHC');
  const plan = plans.get(mother.id);
  const time = fmtTime(stamp(state.clock));
  const first = mother.name.split(' ')[0];
  const canned = cannedFor(mother.language);
  const lang = mother.language;
  const dir = dirOfLang(lang);
  const alert = plan?.alerts.find((a) => a.level !== 'warning');

  const phone = noPhone ? (
    <div className="mx-auto flex w-full max-w-[320px] flex-col items-center gap-3 rounded-3xl bg-secondary p-8 text-center ring-1 ring-secondary" data-testid="phone-none">
      <Printer className="size-10 text-fg-quaternary" aria-hidden="true" />
      <p className="text-md font-semibold text-primary">{first} has no phone</p>
      <p className="text-sm text-tertiary">She gets a printed picture sheet at each visit, and you can call a family carer for her. Messages by SMS or chat app are not offered.</p>
      {!personal ? (
        <Button color="secondary" size="sm" iconLeading={Printer} onClick={() => go({ name: 'patient', id: mother.id, tab: 'plan', sheet: 'handout' })}>
          Print her sheet
        </Button>
      ) : null}
    </div>
  ) : smart ? (
    <SmartphoneFrame
      messages={thread}
      time={time}
      sender={personal ? shortFacility : `Gaskin, ${shortFacility}`}
      senderLine={personal ? 'Your clinic' : 'Your midwife’s messages'}
      draft={draft}
      onDraft={setDraft}
      onSend={reply}
      lang={lang}
      dir={dir}
      inputLabel={personal ? 'Write to your clinic' : 'Type a reply as her'}
      empty={personal ? 'No messages yet.' : 'No messages yet. Send one from her record.'}
    />
  ) : (
    <FeaturePhoneFrame
      messages={thread}
      time={time}
      sender="CLINIC"
      senderLine=""
      draft={draft}
      onDraft={setDraft}
      onSend={reply}
      lang={lang}
      dir={dir}
      inputLabel={personal ? 'Write to your clinic' : 'Type a reply as her'}
      empty="No messages"
    />
  );

  return (
    <div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-6 lg:gap-8">
      <PageHeader
        title={personal ? 'Messages' : 'Messages'}
        lede={
          personal
            ? 'Messages from your clinic. If you have a danger sign, do not wait for a reply: go to the clinic.'
            : `${threads.length} conversations. ${triaged ? `${triaged} need${triaged === 1 ? 's' : ''} attention` : 'None needs attention now'}, ${unread} unread.`
        }
      />

      <div className={cx('grid gap-6', !personal && 'lg:grid-cols-[320px_minmax(0,1fr)]')}>
        {!personal ? (
          <aside aria-label="Conversations" className={cx('min-w-0', id ? 'hidden lg:block' : 'block')}>
            <div className="grid gap-3">
              <label className="relative block">
                <span className="sr-only">Search conversations</span>
                <SearchLg aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-quaternary" />
                <input
                  id="thread-search"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search mothers"
                  className="h-10 w-full rounded-lg bg-primary pr-3 pl-9 text-sm text-primary shadow-xs ring-1 ring-primary outline-none ring-inset placeholder:text-placeholder focus-visible:ring-2 focus-visible:ring-brand"
                />
              </label>
              <Segmented
                size="sm"
                label="Show"
                value={filter}
                onChange={setFilter}
                options={[
                  { id: 'all', label: 'All', count: threads.length },
                  { id: 'triage', label: 'Needs attention', count: triaged },
                  { id: 'unread', label: 'Unread', count: unread },
                ]}
              />
            </div>
            <ul className="mt-3 grid gap-1" data-testid="threads">
              {shown.map((t) => (
                <ThreadRow key={t.mother.id} t={t} active={t.mother.id === mother.id} onOpen={() => open(t.mother)} />
              ))}
              {shown.length === 0 ? <li className="px-3 py-8 text-center text-sm text-tertiary">No conversations match.</li> : null}
            </ul>
          </aside>
        ) : null}

        <section aria-label={`Conversation with ${mother.name}`} className={cx('min-w-0', !personal && !id && 'hidden lg:block')}>
          {!personal ? (
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <button type="button" onClick={() => go({ name: 'phone' }, { replace: true })} className="flex size-10 cursor-pointer items-center justify-center rounded-lg text-fg-quaternary ring-1 ring-secondary lg:hidden" aria-label="Back to conversations">
                  <ArrowLeft className="size-5" aria-hidden="true" />
                </button>
                <Initials name={mother.name} tone={hashTone(mother.id)} size="lg" />
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-semibold text-primary">{mother.name}</h2>
                  <p className="truncate text-sm text-tertiary">
                    {PHONE_ACCESS_LABELS[mother.phone.access]}
                    {smart ? ', chat app' : ''} · writes in {LANGUAGE_NAMES[mother.language] ?? mother.language}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button color="secondary" size="sm" iconTrailing={ArrowRight} onClick={() => go({ name: 'patient', id: mother.id, tab: 'plan' })}>
                  Open her plan
                </Button>
                <Button color="primary" size="sm" iconLeading={MessageChatCircle} onClick={() => go({ name: 'patient', id: mother.id, tab: 'messages', sheet: 'compose' })}>
                  Write to her
                </Button>
              </div>
            </div>
          ) : null}

          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
            <div className="min-w-0">
              {phone}
              <p className="mt-3 text-center text-xs text-tertiary">
                {noPhone ? 'Printed sheet and calls through her family.' : smart ? 'A generic chat app. Gaskin works with the chat service her country uses.' : 'A basic phone gets plain SMS.'}
              </p>
            </div>

            <div className="grid min-w-0 gap-4">
              {last ? (
                <Card title={personal ? 'What this means' : 'What Gaskin understood'} action={<BadgeWithDot color={TRIAGE_TONE[last.tier]} type="pill-color">{TRIAGE_LABELS[last.tier]}</BadgeWithDot>}>
                  <div aria-live="polite" data-testid="understood" className="grid gap-3">
                    {last.msg.parsedSymptoms && last.msg.parsedSymptoms.length ? (
                      <div className="flex flex-wrap gap-1.5">
                        {last.msg.parsedSymptoms.map((s) => (
                          <Badge key={s} color={last.tier === 'emergency' ? 'error' : 'warning'} type="color">
                            {SYMPTOM_LABELS[s] ?? s}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-tertiary">No danger signs found. It waits for her next contact.</p>
                    )}
                    {alert && last.tier !== 'next_contact' ? (
                      <div role="alert" className="flex items-start gap-2.5 rounded-lg bg-error-primary p-3 ring-1 ring-error_subtle">
                        <AlertTriangle aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-fg-error-primary" />
                        <p className="text-sm text-error-primary">
                          <strong className="font-semibold">{alert.title}.</strong> {alert.action}
                        </p>
                      </div>
                    ) : null}
                    {!personal ? (
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" color={last.tier === 'emergency' ? 'primary-destructive' : 'secondary'} onClick={() => go({ name: 'patient', id: mother.id, tab: 'plan' })}>
                          Open her plan
                        </Button>
                        <Button size="sm" color="tertiary" onClick={() => go({ name: 'today' })}>
                          See Today
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </Card>
              ) : null}

              {!noPhone ? (
                <Card title={personal ? 'Quick replies' : `Reply as ${first}`}>
                  <p className="-mt-2 mb-3 text-sm text-tertiary">{personal ? 'Tap to send.' : 'Tap a line to send it from her phone. Gaskin reads every reply for danger signs.'}</p>
                  <ul className="canned grid gap-2">
                    {canned.map((c) => (
                      <li key={c.text}>
                        <button
                          type="button"
                          onClick={() => reply(c.text)}
                          className="flex w-full cursor-pointer items-start gap-3 rounded-lg bg-primary px-3 py-2.5 text-start ring-1 ring-secondary transition hover:bg-primary_hover"
                        >
                          <span aria-hidden="true" className={cx('mt-1.5 size-2 shrink-0 rounded-full', c.tone === 'danger' ? 'bg-error-solid' : c.tone === 'concern' ? 'bg-warning-solid' : 'bg-success-solid')} />
                          <span className="min-w-0 flex-1">
                            <span lang={c.lang} dir={dirOfLang(c.lang)} className="block text-sm text-primary">
                              {c.text}
                            </span>
                            <span className="mt-0.5 block text-xs text-tertiary">
                              {LANGUAGE_NAMES[c.lang as keyof typeof LANGUAGE_NAMES] ?? c.lang}: {c.gist}
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </Card>
              ) : null}

              {!personal ? (
                <Card title="On this thread">
                  <dl className="grid grid-cols-3 gap-3 text-center">
                    <div className="rounded-lg bg-secondary p-3">
                      <dt className="text-xs text-tertiary">Sent</dt>
                      <dd className="text-lg font-semibold text-primary tnum">{state.outbound.filter((o) => o.motherId === mother.id).length}</dd>
                    </div>
                    <div className="rounded-lg bg-secondary p-3">
                      <dt className="text-xs text-tertiary">Replies</dt>
                      <dd className="text-lg font-semibold text-primary tnum">{state.inbound.filter((i) => i.motherId === mother.id).length}</dd>
                    </div>
                    <div className="rounded-lg bg-secondary p-3">
                      <dt className="text-xs text-tertiary">Channel</dt>
                      <dd className="truncate text-sm font-semibold text-primary">{noPhone ? 'Print' : smart ? CHANNEL_LABELS.whatsapp : 'SMS'}</dd>
                    </div>
                  </dl>
                  <Button className="mt-4 w-full" color="secondary" size="sm" iconLeading={Phone01} onClick={() => go({ name: 'patient', id: mother.id, tab: 'messages' })}>
                    See every message and cost
                  </Button>
                </Card>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
