import { useEffect, useMemo, useRef, useState } from 'react';
import type { InboundMessage, SymptomEvent } from '../types';
import { stamp, uid, useApp, usePlans } from '../store';
import { triageSymptoms, TRIAGE_LABELS } from '../store/triage';
import { parseSymptomsFromText } from '../messaging';
import { SYMPTOM_LABELS } from '../clinical';
import { useNav } from './nav';
import { Empty, useToast } from './components';
import { fmtTime, PHONE_ACCESS_LABELS } from './format';
import { IAlert, ISend } from './icons';

const CANNED: Array<{ text: string; lang: string }> = [
  { text: 'My head dey bang me and my leg don swell', lang: 'Pidgin' },
  { text: 'Thank you ma, I go come for the clinic', lang: 'Pidgin' },
  { text: 'Belle dey pain me well well and blood dey come', lang: 'Pidgin' },
  { text: 'The baby no gree suck breast since morning and body hot', lang: 'Pidgin' },
  { text: 'I have been feeling very sad and I cannot sleep', lang: 'English' },
  { text: 'Thank you. I took my tablets today', lang: 'English' },
];

export function PhoneView({ id }: { id?: string }) {
  const { state, dispatch } = useApp();
  const plans = usePlans();
  const { go } = useNav();
  const toast = useToast();
  const mothers = state.mothers.filter((m) => state.country === 'ALL' || m.country === state.country);
  const withMessages = mothers.filter((m) => state.outbound.some((o) => o.motherId === m.id));
  const motherId = id ?? withMessages[0]?.id ?? mothers[0]?.id;
  const mother = state.mothers.find((m) => m.id === motherId);
  const [draft, setDraft] = useState('');
  const [last, setLast] = useState<{ msg: InboundMessage; tier: ReturnType<typeof triageSymptoms> } | null>(null);
  const chatRef = useRef<HTMLDivElement>(null);

  const thread = useMemo(() => {
    if (!mother) return [];
    const out = state.outbound
      .filter((o) => o.motherId === mother.id && o.status !== 'queued' && o.channel !== 'email' && state.messageMeta[o.id]?.recipient !== 'carer')
      .map((o) => ({ at: o.sentAt ?? o.createdAt, dir: 'in' as const, body: o.body, id: o.id }));
    const inb = state.inbound.filter((i) => i.motherId === mother.id).map((i) => ({ at: i.receivedAt, dir: 'out' as const, body: i.body, id: i.id }));
    return [...out, ...inb].sort((a, b) => (a.at < b.at ? -1 : 1));
  }, [mother, state.outbound, state.inbound, state.messageMeta]);

  useEffect(() => {
    const el = chatRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [thread.length]);

  if (!mother) {
    return (
      <div className="page">
        <Empty art="phone_call" title="No mothers in this country" />
      </div>
    );
  }

  const smart = mother.phone.access === 'smartphone' && mother.phone.hasWhatsApp;
  const reply = (body: string) => {
    const text = body.trim();
    if (!text) return;
    let parsed: InboundMessage['parsedSymptoms'] = [];
    try {
      parsed = parseSymptomsFromText(text);
    } catch {
      parsed = [];
    }
    const at = stamp(state.clock);
    const msg: InboundMessage = { id: uid('in'), motherId: mother.id, channel: smart ? 'whatsapp' : 'sms', body: text, receivedAt: at, parsedSymptoms: parsed };
    const tier = triageSymptoms(parsed);
    const events: SymptomEvent[] = parsed && parsed.length
      ? [{ kind: 'symptom', id: uid('ev'), at, recordedBy: 'mother', symptoms: parsed, via: smart ? 'whatsapp' : 'sms', note: text }]
      : [];
    dispatch({ type: 'inbound', message: msg, events, triage: tier });
    setLast({ msg, tier });
    setDraft('');
    if (tier === 'emergency') toast('Danger signs found in her reply. Her plan now shows an alert.');
  };

  const plan = plans.get(mother.id);
  const timeNow = fmtTime(stamp(state.clock));

  return (
    <div className="page">
      <header className="today-head">
        <h1 className="t-display">Her phone</h1>
        <p className="lede">What {mother.name.split(' ')[0]} sees, and how her reply reaches you. Reply as her to try it.</p>
      </header>
      <div className="phone-wrap">
        <div>
          {smart ? (
            <div className="phone" aria-label="Smartphone with a chat app">
              <div className="phone-screen">
                <div className="phone-status" style={{ background: '#2f5d4a', color: '#f4efe4' }}>
                  <span className="num">{timeNow}</span>
                  <span>4G ▮▮▮</span>
                </div>
                <div className="chat-head">
                  <span className="av">G</span>
                  <span>
                    <strong>Gaskin, {state.facilities.find((f) => f.id === mother.facilityId)?.name ?? 'your clinic'}</strong>
                    <small>Your midwife’s messages</small>
                  </span>
                </div>
                <div className="chat" ref={chatRef} aria-live="polite">
                  {thread.length === 0 ? <p className="small muted" style={{ textAlign: 'center', marginTop: 40 }}>No messages yet. Send one from her record.</p> : null}
                  {thread.map((m) => (
                    <div key={m.id} className={`bubble ${m.dir}`}>
                      {m.body}
                      <time>{fmtTime(m.at)}</time>
                    </div>
                  ))}
                </div>
                <form
                  className="chat-input"
                  onSubmit={(e) => {
                    e.preventDefault();
                    reply(draft);
                  }}
                >
                  <input id="phone-reply" aria-label="Type a reply as her" placeholder="Message" value={draft} onChange={(e) => setDraft(e.target.value)} />
                  <button type="submit" aria-label="Send reply">
                    <ISend />
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <div className="phone feature" aria-label="Basic phone with SMS">
              <div className="phone-screen">
                <div className="fp-bar">
                  <span>▮▮▯ MTN</span>
                  <span className="num">{timeNow}</span>
                </div>
                <div className="fp-body" ref={chatRef}>
                  {thread.length === 0 ? <p>No messages</p> : null}
                  {thread.map((m) => (
                    <div key={m.id} className="fp-msg">
                      <div className="from">{m.dir === 'in' ? 'From: CLINIC' : 'Sent'}</div>
                      <p>{m.body}</p>
                    </div>
                  ))}
                </div>
                <form
                  className="chat-input"
                  style={{ background: '#b8c3a1' }}
                  onSubmit={(e) => {
                    e.preventDefault();
                    reply(draft);
                  }}
                >
                  <input id="phone-reply" aria-label="Type a reply as her" placeholder="Write SMS" value={draft} onChange={(e) => setDraft(e.target.value)} style={{ borderRadius: 4 }} />
                  <button type="submit" aria-label="Send reply" style={{ borderRadius: 4, background: '#3b352d' }}>
                    <ISend />
                  </button>
                </form>
              </div>
              <div className="fp-keys" aria-hidden="true">
                {['1', '2 abc', '3 def', '4 ghi', '5 jkl', '6 mno', '7 pqrs', '8 tuv', '9 wxyz'].map((k) => (
                  <span key={k}>{k}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="section" style={{ gap: 22 }}>
          <label className="field">
            <span>Mother</span>
            <select className="select" id="phone-mother" value={mother.id} onChange={(e) => go({ name: 'phone', id: e.target.value }, { replace: true })}>
              {mothers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({PHONE_ACCESS_LABELS[m.phone.access]}
                  {m.phone.hasWhatsApp ? ', chat app' : ''})
                </option>
              ))}
            </select>
          </label>

          <section className="section">
            <span className="t-label">Reply as her</span>
            <div className="canned">
              {CANNED.map((c) => (
                <button key={c.text} onClick={() => reply(c.text)}>
                  “{c.text}” <span className="tiny muted">{c.lang}</span>
                </button>
              ))}
            </div>
          </section>

          {last ? (
            <section className={`panel`} aria-live="polite" style={{ display: 'grid', gap: 10 }}>
              <div className="section-head">
                <strong>What Gaskin understood</strong>
                <span className={`triage ${last.tier}`}>{TRIAGE_LABELS[last.tier]}</span>
              </div>
              {last.msg.parsedSymptoms && last.msg.parsedSymptoms.length ? (
                <div className="chips">
                  {last.msg.parsedSymptoms.map((s) => (
                    <span key={s} className="chip red">
                      {SYMPTOM_LABELS[s] ?? s}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="small soft">No danger signs found. It waits for her next contact.</p>
              )}
              {plan && plan.alerts.length && last.tier !== 'next_contact' ? (
                <p className="note amber" style={{ background: 'var(--red-soft)' }}>
                  <IAlert style={{ color: 'var(--red)' }} />
                  <span>
                    <strong>{plan.alerts[0].title}.</strong> {plan.alerts[0].action}
                  </span>
                </p>
              ) : null}
              <div className="btn-row">
                <button className="btn small primary" onClick={() => go({ name: 'patient', id: mother.id, tab: 'plan' })}>
                  Open her plan
                </button>
                <button className="btn small" onClick={() => go({ name: 'today' })}>
                  See Today
                </button>
              </div>
            </section>
          ) : null}
          <p className="small muted">
            {smart
              ? 'A generic chat app is shown. Gaskin works with any chat service the country uses.'
              : 'A basic phone gets plain SMS. Replies in English or Pidgin are read for danger signs.'}
          </p>
        </div>
      </div>
    </div>
  );
}
