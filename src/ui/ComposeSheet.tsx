import { useEffect, useMemo, useRef, useState } from 'react';
import type { CarePlan, Channel, LanguageCode, Mother, OutboundMessage } from '../types';
import { stamp, uid, useApp, useWorker, type DeliveryStep } from '../store';
import { sendThroughBackend } from '../store/backend';
import { COUNTRIES, LANGUAGE_NAMES } from '../data';
import { chooseChannel, composeFallbackMessage, estimateCost, smsSegments } from '../messaging';
import { Sheet, Thinking, useAbort, useToast } from './components';
import { AIBadge, getProvider, validate, WhatAISees, useAIStatus } from './ai';
import { CHANNEL_LABELS, fmtTime, money, usd, withoutTitle } from './format';
import { ICheckCircle, ISpark, IWarnCircle, ICloudOff } from './icons';
import { useNav } from './nav';
import { useT } from './i18n';

const STEPS: DeliveryStep[] = ['queued', 'sent', 'delivered', 'read'];
const STEP_LABEL: Record<DeliveryStep, string> = { queued: 'Queued', sent: 'Sent', delivered: 'Delivered', read: 'Read' };

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

export function ComposeSheet({ mother, plan, itemIds, onClose }: { mother: Mother; plan: CarePlan; itemIds?: string[]; onClose: () => void }) {
  const { state, dispatch } = useApp();
  const worker = useWorker();
  const toast = useToast();
  const { go } = useNav();
  const status = useAIStatus();
  const t = useT();
  const country = COUNTRIES[mother.country];
  const rec = useMemo(() => safeChoose(mother), [mother]);
  const channels: Channel[] = useMemo(() => Array.from(new Set([rec.channel, ...rec.alternatives, 'sms' as Channel, ...(mother.email ? (['email'] as Channel[]) : [])])).filter((c) => c !== 'print'), [rec, mother.email]);
  const [channel, setChannel] = useState<Channel>(rec.channel === 'print' ? 'sms' : rec.channel);
  const [language, setLanguage] = useState<LanguageCode>(mother.language);
  const ids = itemIds && itemIds.length ? itemIds : plan.items.filter((i) => i.status === 'active').sort((a, b) => a.priority - b.priority).slice(0, 3).map((i) => i.id);
  const fallback = () => {
    try {
      return composeFallbackMessage(plan, mother, { channel, language, itemIds: ids });
    } catch {
      return `Hello ${mother.name.split(' ')[0]}, this is ${worker.name}. Please remember your next visit. If you bleed, have a bad headache or fits, go to the clinic now.`;
    }
  };
  const [text, setText] = useState(fallback);
  const [subject, setSubject] = useState(`Your care plan from ${worker.name}`);
  const [aiUsed, setAiUsed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [reviewed, setReviewed] = useState(false);
  const [recipient, setRecipient] = useState<'mother' | 'carer'>('mother');
  const carer = state.carers[mother.id];
  const [carerName, setCarerName] = useState(carer?.name ?? '');
  const [carerRel, setCarerRel] = useState(carer?.relation ?? 'Grandmother');
  const [carerNumber, setCarerNumber] = useState(carer?.number ?? '');
  const [sentId, setSentId] = useState<string | null>(null);
  const { start, stop } = useAbort();
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  // Refill the template when channel or language change, unless the worker has written their own.
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
  const cost = safeCost(channel, text, mother);
  const untranslated = /\[needs translation/i.test(text);

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
        onText: (t) => setText(t),
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
    const now = stamp(state.clock);
    const id = uid('out');
    const offline = state.offline;
    const hasDanger = plan.alerts.some((a) => a.level !== 'warning');
    const smsFallback = offline && hasDanger;
    const effChannel: Channel = smsFallback ? 'sms' : channel;
    const c = safeCost(effChannel, text, mother);
    const msg: OutboundMessage = {
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
    if (recipient === 'carer' && carerName.trim()) {
      dispatch({ type: 'setCarer', motherId: mother.id, carer: { name: carerName.trim(), relation: carerRel, number: carerNumber.trim() || undefined } });
    }
    dispatch({
      type: 'sendMessage',
      message: msg,
      meta: {
        recipient,
        recipientName: recipient === 'carer' ? `${carerName.trim() || carerRel} (${carerRel.toLowerCase()})` : undefined,
        number: recipient === 'carer' && carerNumber.trim() ? carerNumber.trim() : mother.phone.number,
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
    // Through the backend: simulated receipts in the demo, real gateways on a Gaskin server.
    const to = recipient === 'carer' && carerNumber.trim() ? carerNumber.trim() : undefined;
    if (sendThroughBackend({ message: msg, to, recipient, subject: channel === 'email' ? subject : undefined })) {
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
      if (st === 'read' && effChannel === 'sms') continue; // SMS has no read receipts
      timers.current.push(window.setTimeout(() => dispatch({ type: 'messageStatus', id, status: st, at: new Date(base + secs * 1000).toISOString() }), delay));
    }
    toast(smsFallback ? 'No data signal. Danger signs sent by plain SMS.' : 'Sent.');
  };

  const sent = sentId ? state.outbound.find((o) => o.id === sentId) : undefined;
  const sentMeta = sentId ? state.messageMeta[sentId] : undefined;

  return (
    <Sheet
      title={`Message ${mother.name.split(' ')[0]}`}
      onClose={onClose}
      label="Compose message"
      footer={
        sent ? (
          <>
            <button className="btn" onClick={() => go({ name: 'phone', id: mother.id })}>
              See it on her phone
            </button>
            <button className="btn primary" onClick={onClose}>
              Done
            </button>
          </>
        ) : (
          <>
            <label className="check" style={{ marginRight: 'auto', alignSelf: 'center' }}>
              <input type="checkbox" checked={reviewed} onChange={(e) => setReviewed(e.target.checked)} data-testid="reviewed" />
              {t('compose.reviewed', 'I have read this message and it is right for her')}
            </label>
            <button className="btn primary" disabled={!reviewed || !text.trim() || busy || untranslated} onClick={send} data-testid="approve-send" title={untranslated ? 'Translate the message first' : undefined}>
              {t('compose.approveSend', 'Approve and send')}
            </button>
          </>
        )
      }
    >
      {sent ? (
        <section className="section">
          <h3 className="t-h2">{sent.status === 'queued' ? 'Waiting for signal' : 'On its way'}</h3>
          <ol className="status-steps" aria-label="Delivery">
            {STEPS.map((s) => {
              const t = sentMeta?.times[s];
              return (
                <li key={s} className={t ? 'on' : ''}>
                  {STEP_LABEL[s]}
                  <time>{t ? fmtTime(t) : sent.channel === 'sms' && s === 'read' ? 'not shown for SMS' : ''}</time>
                </li>
              );
            })}
          </ol>
          {sentMeta?.smsFallback ? (
            <p className="note amber">
              <ICloudOff /> No data signal, so the danger signs went by plain SMS. The rest will sync later.
            </p>
          ) : null}
          <div className="ai-out">
            <p className="text" style={{ fontSize: 15.5 }}>
              {sent.body}
            </p>
            <span className="small muted">
              {CHANNEL_LABELS[sent.channel]} to {sentMeta?.recipient === 'carer' ? sentMeta.recipientName : mother.name} · {money(sent.estCostLocal, country?.currencySymbol ?? '')} ({usd(sent.estCostUSD)})
            </span>
          </div>
        </section>
      ) : (
        <>
          <section className="section">
            <span className="t-label">Send to</span>
            <div className="seg" role="group" aria-label="Recipient">
              <button aria-pressed={recipient === 'mother'} onClick={() => setRecipient('mother')}>
                {mother.name.split(' ')[0]}
              </button>
              <button aria-pressed={recipient === 'carer'} onClick={() => setRecipient('carer')}>
                Family carer
              </button>
            </div>
            {recipient === 'carer' ? (
              <div className="grid2">
                <label className="field">
                  <span>Name</span>
                  <input className="input" id="carer-name" value={carerName} onChange={(e) => setCarerName(e.target.value)} placeholder="For example: Mama Nkechi" />
                </label>
                <label className="field">
                  <span>Relation</span>
                  <select className="select" id="carer-rel" value={carerRel} onChange={(e) => setCarerRel(e.target.value)}>
                    {['Grandmother', 'Mother-in-law', 'Husband', 'Sister', 'Aunt', 'Friend'].map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>
                    Phone <span className="hint">(blank uses her phone)</span>
                  </span>
                  <input className="input" id="carer-num" inputMode="tel" value={carerNumber} onChange={(e) => setCarerNumber(e.target.value)} />
                </label>
              </div>
            ) : null}
          </section>

          <section className="section">
            <span className="t-label">Channel</span>
            <p className="small soft">
              <strong>Recommended: {CHANNEL_LABELS[rec.channel]}.</strong> {rec.reason}
            </p>
            <div className="channels" role="radiogroup" aria-label="Channel">
              {channels.map((ch) => {
                const c = safeCost(ch, text, mother);
                return (
                  <label key={ch} className="channel">
                    <input type="radio" name="channel" checked={channel === ch} onChange={() => setChannel(ch)} />
                    <span>
                      <strong>{CHANNEL_LABELS[ch] ?? ch}</strong>
                      {ch === rec.channel ? <span className="chip green" style={{ marginLeft: 8 }}>Recommended</span> : null}
                      <div className="tiny muted">
                        {c.units} {c.unitLabel}
                        {c.units === 1 ? '' : 's'}
                      </div>
                    </span>
                    <span className="cost">
                      {money(c.local, country?.currencySymbol ?? '')}
                      <div className="tiny muted">{usd(c.usd)}</div>
                    </span>
                  </label>
                );
              })}
            </div>
            {state.offline ? (
              <p className="note amber">
                <ICloudOff /> You are offline. Messages wait in a queue and send when you reconnect.
                {plan.alerts.some((a) => a.level !== 'warning') ? ' Danger-sign messages still go out by plain SMS.' : ''}
              </p>
            ) : null}
          </section>

          <section className="section">
            <div className="section-head">
              <label className="field" style={{ minWidth: 180 }}>
                <span>Language</span>
                <select className="select" id="compose-lang" value={language} onChange={(e) => setLanguage(e.target.value as LanguageCode)}>
                  {Array.from(new Set([mother.language, ...(country?.languages ?? []), 'en' as LanguageCode])).map((l) => (
                    <option key={l} value={l}>
                      {LANGUAGE_NAMES[l] ?? l}
                      {l === mother.language ? ' (her language)' : ''}
                    </option>
                  ))}
                </select>
              </label>
              <div className="btn-row">
                <AIBadge />
                {busy ? (
                  <Thinking onStop={() => { stop(); setBusy(false); }} />
                ) : (
                  <button className="btn small" onClick={write} disabled={status.provider === 'none'} data-testid="write-ai">
                    <ISpark /> {t('compose.writeAI', 'Write with AI')}
                  </button>
                )}
              </div>
            </div>
            {status.provider === 'none' ? <p className="small muted">AI is off. The standard message below comes from her plan.</p> : null}
            {untranslated ? (
              <p className="note amber">
                <IWarnCircle /> This still needs translating into {LANGUAGE_NAMES[language] ?? language}. Translate it yourself, write with AI, or send it in plain English.
              </p>
            ) : null}
            {note ? <p className="small muted">{note}</p> : null}
            {channel === 'email' ? (
              <label className="field">
                <span>Subject</span>
                <input className="input" id="compose-subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
              </label>
            ) : null}
            <label className="field">
              <span>{channel === 'email' ? 'Body' : 'Message'}</span>
              <textarea
                className="textarea"
                id="compose-text"
                style={{ minHeight: 170 }}
                value={text}
                onChange={(e) => {
                  touched.current = true;
                  setText(e.target.value);
                  setReviewed(false);
                }}
              />
            </label>
            <div className="counter num">
              <span>{text.length} characters</span>
              {channel === 'sms' ? (
                <span>
                  {segs} SMS {segs === 1 ? 'part' : 'parts'} · {money(cost.local, country?.currencySymbol ?? '')} ({usd(cost.usd)})
                </span>
              ) : (
                <span>
                  {money(cost.local, country?.currencySymbol ?? '')} ({usd(cost.usd)})
                </span>
              )}
            </div>
            <WhatAISees task="personalise" args={{ plan, mother, channel, language, itemIds: ids }} />
          </section>

          <section className="section">
            <span className="t-label">{t('compose.safetyChecks', 'Safety checks')}</span>
            <ul className="guard">
              {guard.issues.length === 0 ? (
                <>
                  <li className="ok">
                    <ICheckCircle /> No medicine doses or diagnoses that are not in her plan
                  </li>
                  <li className="ok">
                    <ICheckCircle /> Danger signs and where to go are kept
                  </li>
                  <li className="ok">
                    <ICheckCircle /> No personal details beyond her first name
                  </li>
                </>
              ) : (
                guard.issues.map((i) => (
                  <li key={i} className="bad">
                    <IWarnCircle /> {i}
                  </li>
                ))
              )}
            </ul>
          </section>
        </>
      )}
    </Sheet>
  );
}
