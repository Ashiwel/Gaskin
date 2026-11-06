/**
 * Write to a mother: who receives it, by which channel (cost compared as bars), in which language
 * (with its pack status), "Write with AI" with what the AI sees side by side, safety checks as a
 * checklist, the SMS segment meter, then approve and send with a live delivery track.
 * A mother with no phone is offered only a printed sheet or a call through a family carer.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { CloudOff, Printer, Stars02, Translate01 } from '@untitledui/icons';
import type { CarePlan, Channel, LanguageCode, Mother, OutboundMessage } from '../types';
import { stamp, uid, useApp, useWorker, type DeliveryStep } from '../store';
import { sendThroughBackend } from '../store/backend';
import { COUNTRIES, LANGUAGE_NAMES } from '../data';
import { chooseChannel, composeFallbackMessage, estimateCost, smsSegments } from '../messaging';
import { isPackCode, summarisePack } from '../i18n';
import { stampOutbound } from '../auth';
import { Button } from '../components/base/buttons/button';
import { Badge } from '../components/base/badges/badges';
import { Checkbox } from '../components/base/checkbox/checkbox';
import { cx } from '../utils/cx';
import { Thinking, useAbort, useToast } from './components';
import { AIBadge, getProvider, validate, WhatAISees, useAIStatus } from './ai';
import { CHANNEL_LABELS, money, place, usd, withoutTitle } from './format';
import { useNav } from './nav';
import { useT } from './i18n';
import { Panel, StepHead } from './messages/Panel';
import { CheckRow, Segmented } from './messages/kit';
import { ChannelCards, DeliveryTrack, SegmentMeter, type ChannelOption } from './messages/ComposeParts';
import { dirOfLang } from './phone/thread';

function safeChoose(mother: Mother) {
  try {
    return chooseChannel(mother, COUNTRIES[mother.country]);
  } catch {
    return { channel: 'sms' as Channel, reason: 'SMS reaches every phone.', alternatives: ['whatsapp', 'voice', 'print'] as Channel[] };
  }
}

function safeCost(ch: Channel, text: string, mother: Mother) {
  try {
    return estimateCost(ch, text || ' ', COUNTRIES[mother.country]);
  } catch {
    return { local: 0, usd: 0, units: 1, unitLabel: 'message' };
  }
}

/** Channels she can actually receive. No phone: printed sheet or a call through a carer only. */
export function channelsFor(mother: Mother, recommended: Channel, alternatives: Channel[]): Channel[] {
  const noPhone = mother.phone.access === 'none' || !mother.phone.number;
  if (noPhone) return ['print', 'voice'];
  const list: Channel[] = [recommended, ...alternatives, 'sms'];
  if (mother.phone.hasWhatsApp && mother.phone.access === 'smartphone') list.push('whatsapp');
  if (mother.email) list.push('email');
  return Array.from(new Set(list)).filter((c) => c !== 'whatsapp' || (mother.phone.hasWhatsApp && mother.phone.access === 'smartphone'));
}

type PackState = { label: string; tone: 'success' | 'warning' | 'gray'; ready: boolean };
function packState(lang: LanguageCode): PackState {
  if (lang === 'en') return { label: 'Reviewed', tone: 'success', ready: true };
  if (!isPackCode(lang)) return { label: 'Coming soon', tone: 'gray', ready: false };
  try {
    const s = summarisePack(lang);
    if (s.status === 'reviewed') return { label: 'Reviewed', tone: 'success', ready: true };
    if (s.status === 'none' || s.motherCoverage === 0) return { label: 'Coming soon', tone: 'gray', ready: false };
    return { label: s.status === 'partial' ? 'Partly translated' : 'Draft translation', tone: 'warning', ready: true };
  } catch {
    return { label: 'Coming soon', tone: 'gray', ready: false };
  }
}

export function ComposeSheet({ mother, plan, itemIds, onClose }: { mother: Mother; plan: CarePlan; itemIds?: string[]; onClose: () => void }) {
  const { state, dispatch } = useApp();
  const worker = useWorker();
  const toast = useToast();
  const { go } = useNav();
  const status = useAIStatus();
  const t = useT();
  const country = COUNTRIES[mother.country];
  const symbol = country?.currencySymbol ?? '';
  const first = mother.name.split(' ')[0];
  const rec = useMemo(() => safeChoose(mother), [mother]);
  const noPhone = mother.phone.access === 'none' || !mother.phone.number;
  const channels = useMemo(() => channelsFor(mother, rec.channel, rec.alternatives), [mother, rec]);
  const [channel, setChannel] = useState<Channel>(() => (channels.includes(rec.channel) ? rec.channel : channels[0]));
  const [language, setLanguage] = useState<LanguageCode>(mother.language);
  const ids = itemIds && itemIds.length ? itemIds : plan.items.filter((i) => i.status === 'active').sort((a, b) => a.priority - b.priority).slice(0, 3).map((i) => i.id);
  const fallback = (ch: Channel = channel, lang: LanguageCode = language) => {
    try {
      return composeFallbackMessage(plan, mother, { channel: ch, language: lang, itemIds: ids });
    } catch {
      return `Hello ${first}, this is ${worker.name}. Please remember your next visit. If you bleed, have a bad headache or fits, go to the clinic now.`;
    }
  };
  const [text, setText] = useState(() => fallback());
  const [subject, setSubject] = useState(`Your care plan from ${worker.name}`);
  const [aiUsed, setAiUsed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [reviewed, setReviewed] = useState(false);
  const [recipient, setRecipient] = useState<'mother' | 'carer'>(noPhone ? 'carer' : 'mother');
  const carer = state.carers[mother.id];
  const [carerName, setCarerName] = useState(carer?.name ?? '');
  const [carerRel, setCarerRel] = useState(carer?.relation ?? 'Grandmother');
  const [carerNumber, setCarerNumber] = useState(carer?.number ?? '');
  const [sentId, setSentId] = useState<string | null>(null);
  const { start, stop } = useAbort();
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((x) => window.clearTimeout(x)), []);

  // Refill the template when channel or language change, unless the worker has written her own.
  const touched = useRef(false);
  useEffect(() => {
    if (!touched.current && !aiUsed) setText(fallback());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel, language]);

  const guard = useMemo(() => validate(text, plan, mother, { audience: 'mother' }), [text, plan, mother]);
  const segs = useMemo(() => {
    try {
      return smsSegments(text);
    } catch {
      return Math.ceil(text.length / 160);
    }
  }, [text]);
  // eslint-disable-next-line no-control-regex
  const unicode = /[^\x00-\x7F£¥èéùìòÇØøÅåΔΦΓΛΩΠΨΣΘΞÆæßÉÄÖÑÜ§¿äöñüà€]/.test(text);
  const cost = safeCost(channel, text, mother);
  const untranslated = /\[needs translation/i.test(text);
  const pack = packState(language);
  const languages = Array.from(new Set([mother.language, ...(country?.languages ?? []), 'en' as LanguageCode]));
  const hasDangerAlert = plan.alerts.some((a) => a.level !== 'warning');
  const carerNeeded = recipient === 'carer' || (noPhone && channel === 'voice');
  const carerMissing = carerNeeded && channel !== 'print' && !carerNumber.trim();
  const isPrint = channel === 'print';

  const options: ChannelOption[] = channels.map((ch) => {
    const c = safeCost(ch, text, mother);
    return {
      channel: ch,
      costLabel: money(c.local, symbol),
      usdLabel: usd(c.usd),
      usd: c.usd,
      units: `${c.units} ${c.unitLabel}`,
      recommended: ch === rec.channel,
      note: ch === 'voice' && noPhone ? 'Through a carer' : undefined,
    };
  });

  const write = async () => {
    const signal = start();
    setBusy(true);
    setNote('');
    const before = text;
    setText('');
    try {
      const p = await getProvider();
      const out = await p.personaliseMessage({
        plan,
        mother,
        channel,
        language,
        itemIds: ids,
        maxChars: channel === 'sms' ? 306 : undefined,
        workerName: withoutTitle(worker.name),
        facilityName: state.facilities.find((f) => f.id === mother.facilityId)?.name,
        emergencyLine: country?.emergencyLine,
        signal,
        onText: (x) => setText(x),
      });
      if (!signal.aborted) {
        setText(out);
        setAiUsed(true);
        touched.current = true;
        setReviewed(false);
      }
    } catch {
      if (!signal.aborted) {
        setText(before);
        setNote('The AI could not write just now, so the standard message is shown. You can edit it.');
      }
    } finally {
      setBusy(false);
    }
  };

  const send = () => {
    if (isPrint) {
      onClose();
      go({ name: 'patient', id: mother.id, tab: 'plan', sheet: 'handout', itemIds: ids });
      return;
    }
    const now = stamp(state.clock);
    const id = uid('out');
    const offline = state.offline;
    const smsFallback = offline && hasDangerAlert && !noPhone;
    const effChannel: Channel = smsFallback ? 'sms' : channel;
    const c = safeCost(effChannel, text, mother);
    let msg: OutboundMessage = {
      id,
      motherId: mother.id,
      channel: effChannel,
      language,
      body: text,
      segments: effChannel === 'sms' ? segs : undefined,
      estCostLocal: c.local,
      estCostUSD: c.usd,
      status: 'queued',
      createdAt: now,
      planVersion: state.planVersions[mother.id]?.version ?? plan.version,
      itemIds: ids,
      aiAssisted: aiUsed,
      reviewedBy: worker.id,
    };
    msg = stampOutbound(stampOutbound(msg, worker.id, 'create'), worker.id, 'send');
    const toCarer = recipient === 'carer' || noPhone;
    if (toCarer && carerName.trim()) {
      dispatch({ type: 'setCarer', motherId: mother.id, carer: { name: carerName.trim(), relation: carerRel, number: carerNumber.trim() || undefined } });
    }
    dispatch({
      type: 'sendMessage',
      message: msg,
      meta: {
        recipient: toCarer ? 'carer' : 'mother',
        recipientName: toCarer ? `${carerName.trim() || carerRel} (${carerRel.toLowerCase()})` : undefined,
        number: toCarer && carerNumber.trim() ? carerNumber.trim() : mother.phone.number,
        subject: channel === 'email' ? subject : undefined,
        times: { queued: now },
        smsFallback,
      },
    });
    setSentId(id);
    if (offline && !smsFallback) {
      toast('No signal. The message is queued and will send when you are back online.');
      return;
    }
    const to = toCarer && carerNumber.trim() ? carerNumber.trim() : undefined;
    if (sendThroughBackend({ message: msg, to, recipient: toCarer ? 'carer' : 'mother', subject: channel === 'email' ? subject : undefined })) {
      toast(smsFallback ? 'No data signal. Danger signs sent by plain SMS.' : 'Sent.');
      return;
    }
    // No backend (tests): simulate delivery receipts here.
    const base = new Date(now).getTime();
    const steps: Array<[DeliveryStep, number, number]> = [
      ['sent', 700, 4],
      ['delivered', 1600, 21],
      ['read', 3000, 240],
    ];
    for (const [st, delay, secs] of steps) {
      if (st === 'read' && effChannel === 'sms') continue;
      timers.current.push(window.setTimeout(() => dispatch({ type: 'messageStatus', id, status: st, at: new Date(base + secs * 1000).toISOString() }), delay));
    }
    toast(smsFallback ? 'No data signal. Danger signs sent by plain SMS.' : 'Sent.');
  };

  const sent = sentId ? state.outbound.find((o) => o.id === sentId) : undefined;
  const sentMeta = sentId ? state.messageMeta[sentId] : undefined;
  const canSend = reviewed && Boolean(text.trim()) && !busy && !untranslated && guard.ok !== false && !carerMissing;
  const blockReason = untranslated ? 'Translate the message first' : !guard.ok ? 'Fix the safety checks first' : carerMissing ? 'Add the carer’s phone number' : !reviewed ? 'Tick that you have read it' : undefined;

  const footer = sent ? (
    <>
      {!noPhone ? (
        <Button color="secondary" onClick={() => go({ name: 'phone', id: mother.id })}>
          See it on her phone
        </Button>
      ) : null}
      <Button color="primary" onClick={onClose}>
        Done
      </Button>
    </>
  ) : (
    <>
      <Checkbox
        className="mr-auto"
        isSelected={reviewed}
        onChange={setReviewed}
        data-testid="reviewed"
        label={isPrint ? 'I have read this sheet and it is right for her' : t('compose.reviewed', 'I have read this message and it is right for her')}
      />
      <Button color="primary" isDisabled={!canSend} onClick={send} data-testid="approve-send" iconLeading={isPrint ? Printer : undefined} aria-describedby={blockReason ? 'send-why' : undefined}>
        {isPrint ? 'Open the printable sheet' : t('compose.approveSend', 'Approve and send')}
      </Button>
      {blockReason ? (
        <span id="send-why" className="sr-only">
          {blockReason}
        </span>
      ) : null}
    </>
  );

  return (
    <Panel title={`Message ${first}`} subtitle={`Acting as ${worker.name}`} onClose={onClose} label="Compose message" footer={footer} width="lg" testId="compose">
      {sent ? (
        <section className="grid gap-6" aria-live="polite">
          <div>
            <h3 className="text-lg font-semibold text-primary">{sent.status === 'queued' ? 'Waiting for signal' : sent.status === 'failed' ? 'Not delivered' : 'On its way'}</h3>
            <p className="text-sm text-tertiary">
              {CHANNEL_LABELS[sent.channel]} to {sentMeta?.recipient === 'carer' ? sentMeta.recipientName : mother.name} · {money(sent.estCostLocal, symbol)} ({usd(sent.estCostUSD)})
            </p>
          </div>
          <DeliveryTrack times={sentMeta?.times ?? {}} sms={sent.channel === 'sms' || sent.channel === 'voice'} failed={sent.status === 'failed'} />
          {sentMeta?.smsFallback ? (
            <p className="flex items-start gap-2 rounded-lg bg-warning-primary p-3 text-sm text-warning-primary ring-1 ring-warning_subtle">
              <CloudOff className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> No data signal, so the danger signs went by plain SMS. The rest will sync later.
            </p>
          ) : null}
          <div className="rounded-2xl rounded-bl-md bg-secondary p-4 ring-1 ring-secondary">
            <p lang={sent.language} dir={dirOfLang(sent.language)} className="text-md whitespace-pre-wrap text-primary">
              {sent.body}
            </p>
          </div>
        </section>
      ) : (
        <div className="grid gap-8">
          {/* 1. Recipient */}
          <section>
            <StepHead n={1} title="Send to" />
            {noPhone ? (
              <p className="mb-3 flex items-start gap-2 rounded-lg bg-secondary p-3 text-sm text-secondary ring-1 ring-secondary" data-testid="no-phone-note">
                <Printer className="mt-0.5 size-4 shrink-0 text-fg-quaternary" aria-hidden="true" />
                {first} has no phone of her own, so Gaskin offers a printed sheet or a call to someone in her family. SMS and chat apps are not offered.
              </p>
            ) : (
              <Segmented
                label="Recipient"
                value={recipient}
                onChange={setRecipient}
                options={[
                  { id: 'mother', label: first },
                  { id: 'carer', label: 'Family carer' },
                ]}
              />
            )}
            {(recipient === 'carer' || noPhone) && !isPrint ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <label className="grid gap-1.5 text-sm font-medium text-secondary">
                  Name
                  <input id="carer-name" className="h-10 rounded-lg bg-primary px-3 text-md text-primary shadow-xs ring-1 ring-primary ring-inset" value={carerName} onChange={(e) => setCarerName(e.target.value)} placeholder="For example, Mama Nkechi" />
                </label>
                <label className="grid gap-1.5 text-sm font-medium text-secondary">
                  Relation
                  <select id="carer-rel" className="h-10 rounded-lg bg-primary px-3 text-md text-primary shadow-xs ring-1 ring-primary ring-inset" value={carerRel} onChange={(e) => setCarerRel(e.target.value)}>
                    {['Grandmother', 'Mother-in-law', 'Husband', 'Sister', 'Aunt', 'Friend'].map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1.5 text-sm font-medium text-secondary">
                  Phone{noPhone ? '' : ' (blank uses hers)'}
                  <input id="carer-num" inputMode="tel" className="h-10 rounded-lg bg-primary px-3 text-md text-primary shadow-xs ring-1 ring-primary ring-inset" value={carerNumber} onChange={(e) => setCarerNumber(e.target.value)} />
                </label>
              </div>
            ) : null}
          </section>

          {/* 2. Channel */}
          <section>
            <StepHead n={2} title="Channel" aside={<span className="text-xs text-tertiary">Cost for this message</span>} />
            <ChannelCards options={options} value={channel} onChange={setChannel} />
            <p className="mt-3 text-sm text-tertiary">
              <strong className="font-semibold text-secondary">Why {CHANNEL_LABELS[rec.channel]}:</strong> {rec.reason}
            </p>
            {state.offline ? (
              <p className="mt-3 flex items-start gap-2 rounded-lg bg-warning-primary p-3 text-sm text-warning-primary ring-1 ring-warning_subtle">
                <CloudOff className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> You are offline. Messages wait in a queue and send when you reconnect.
                {hasDangerAlert && !noPhone ? ' Danger-sign messages still go out by plain SMS.' : ''}
              </p>
            ) : null}
          </section>

          {/* 3. Language and words */}
          <section>
            <StepHead
              n={3}
              title={isPrint ? 'What the sheet says' : 'Message'}
              aside={
                <div className="flex flex-wrap items-center gap-2">
                  <AIBadge />
                  {busy ? (
                    <Thinking
                      onStop={() => {
                        stop();
                        setBusy(false);
                      }}
                    />
                  ) : (
                    <Button size="sm" color="secondary" iconLeading={Stars02} onClick={write} isDisabled={status.provider === 'none'} data-testid="write-ai">
                      {t('compose.writeAI', 'Write with AI')}
                    </Button>
                  )}
                </div>
              }
            />
            <div className="mb-3 flex flex-wrap items-end gap-3">
              <label className="grid min-w-[200px] gap-1.5 text-sm font-medium text-secondary">
                Language
                <span className="relative">
                  <Translate01 aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-quaternary" />
                  <select id="compose-lang" className="h-10 w-full rounded-lg bg-primary pr-3 pl-9 text-md text-primary shadow-xs ring-1 ring-primary ring-inset" value={language} onChange={(e) => setLanguage(e.target.value as LanguageCode)}>
                    {languages.map((l) => {
                      const ps = packState(l);
                      return (
                        <option key={l} value={l} disabled={!ps.ready}>
                          {LANGUAGE_NAMES[l] ?? l}
                          {l === mother.language ? ' (her language)' : ''}
                          {ps.ready ? '' : ': coming soon'}
                        </option>
                      );
                    })}
                  </select>
                </span>
              </label>
              <Badge color={pack.tone} type="pill-color" size="md">
                {pack.label}
              </Badge>
              {!packState(mother.language).ready ? <span className="text-xs text-tertiary">{LANGUAGE_NAMES[mother.language]} is coming soon, so plain English is used.</span> : null}
            </div>
            {status.provider === 'none' ? <p className="mb-2 text-sm text-tertiary">AI is off. The standard message comes from her plan.</p> : null}
            {untranslated ? (
              <p className="mb-2 rounded-lg bg-warning-primary p-3 text-sm text-warning-primary ring-1 ring-warning_subtle">This still needs translating into {LANGUAGE_NAMES[language] ?? language}. Translate it yourself, write with AI, or send it in plain English.</p>
            ) : null}
            {note ? <p className="mb-2 text-sm text-tertiary">{note}</p> : null}
            {channel === 'email' ? (
              <label className="mb-3 grid gap-1.5 text-sm font-medium text-secondary">
                Subject
                <input id="compose-subject" className="h-10 rounded-lg bg-primary px-3 text-md text-primary shadow-xs ring-1 ring-primary ring-inset" value={subject} onChange={(e) => setSubject(e.target.value)} />
              </label>
            ) : null}
            <label className="sr-only" htmlFor="compose-text">
              {channel === 'email' ? 'Body' : 'Message'}
            </label>
            <textarea
              id="compose-text"
              lang={language}
              dir={dirOfLang(language)}
              className={cx('min-h-[180px] w-full rounded-xl bg-primary p-3.5 text-md leading-relaxed text-primary shadow-xs ring-1 ring-primary outline-none ring-inset focus-visible:ring-2 focus-visible:ring-brand', busy && 'animate-pulse')}
              value={text}
              onChange={(e) => {
                touched.current = true;
                setText(e.target.value);
                setReviewed(false);
              }}
            />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              {channel === 'sms' ? <SegmentMeter chars={text.length} segments={segs} unicode={unicode} /> : <span className="text-xs text-tertiary tnum">{text.length} characters</span>}
              <span className="text-sm font-semibold text-primary tnum">
                {money(cost.local, symbol)} <span className="font-normal text-tertiary">({usd(cost.usd)})</span>
              </span>
            </div>
            <div className="mt-4">
              <WhatAISees
                task="personalise"
                layout="side"
                args={{ plan, mother, channel, language, itemIds: ids }}
                local={{ name: mother.name, phone: mother.phone.number, place: place(mother), facility: state.facilities.find((f) => f.id === mother.facilityId)?.name, worker: worker.name, age: mother.age }}
              />
            </div>
          </section>

          {/* 4. Safety checks */}
          <section>
            <StepHead n={4} title={t('compose.safetyChecks', 'Safety checks')} aside={guard.issues.length ? <Badge color="error">{guard.issues.length} to fix</Badge> : <Badge color="success">All passed</Badge>} />
            <ul className="divide-y divide-border-secondary rounded-xl bg-primary px-3.5 ring-1 ring-secondary" data-testid="guardrails">
              {guard.issues.length === 0 ? (
                <>
                  <CheckRow status="ok">No medicine doses or diagnoses that are not in her plan</CheckRow>
                  <CheckRow status="ok">{hasDangerAlert ? 'Danger signs and where to go are kept' : 'No reassurance that could delay care'}</CheckRow>
                  <CheckRow status="ok">No personal details beyond her first name</CheckRow>
                  <CheckRow status={pack.tone === 'success' ? 'ok' : 'warn'}>{pack.tone === 'success' ? 'Language reviewed by a native speaker' : `${LANGUAGE_NAMES[language] ?? language} is a draft translation: read it before sending`}</CheckRow>
                </>
              ) : (
                guard.issues.map((i) => (
                  <CheckRow key={i} status="fail">
                    {i}
                  </CheckRow>
                ))
              )}
            </ul>
          </section>
        </div>
      )}
    </Panel>
  );
}
