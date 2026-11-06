/**
 * Two generic phones, drawn with tokens only and no brand marks: a modern smartphone for chat-app
 * delivery and a candybar feature phone for SMS. Each renders a thread in her language and script
 * (dir and lang per message, so Arabic reads right to left), with times and delivery ticks.
 */
import { useEffect, useRef, type FormEvent, type ReactNode } from 'react';
import { ChevronLeft, Phone01, Send01 } from '@untitledui/icons';
import { cx } from '../../utils/cx';
import type { ThreadMessage } from './thread';

// ---------- Small parts ----------

function SignalBars({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 18 12" className={cx('h-2.5 w-4', className)} aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={i * 4.5} y={9 - i * 3} width="3" height={3 + i * 3} rx="0.8" fill="currentColor" opacity={i === 3 ? 0.35 : 1} />
      ))}
    </svg>
  );
}

function BatteryIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 26 12" className={cx('h-2.5 w-5', className)} aria-hidden="true">
      <rect x="0.5" y="0.5" width="22" height="11" rx="3" fill="none" stroke="currentColor" opacity="0.45" />
      <rect x="2" y="2" width="15" height="8" rx="1.8" fill="currentColor" />
      <rect x="23.5" y="4" width="2" height="4" rx="1" fill="currentColor" opacity="0.45" />
    </svg>
  );
}

/** Delivery ticks: one for sent, two for delivered, two in the brand colour for read. */
export function Ticks({ status, className }: { status: ThreadMessage['status']; className?: string }) {
  if (!status || status === 'queued' || status === 'failed') return null;
  const two = status === 'delivered' || status === 'read';
  const label = status === 'read' ? 'Read' : status === 'delivered' ? 'Delivered' : 'Sent';
  return (
    <svg viewBox="0 0 18 11" role="img" aria-label={label} className={cx('h-2.5 w-4 shrink-0', status === 'read' ? 'text-fg-brand-secondary' : 'text-fg-quaternary', className)}>
      <path d="M1 6l3.2 3.2L11 2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      {two ? <path d="M7.5 9.2L14.5 2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /> : null}
    </svg>
  );
}

function useStickToBottom(dep: unknown) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [dep]);
  return ref;
}

interface FrameProps {
  messages: ThreadMessage[];
  time: string;
  sender: string;
  senderLine: string;
  draft: string;
  onDraft: (v: string) => void;
  onSend: (text: string) => void;
  /** Her language, for the input's lang and dir */
  lang: string;
  dir: 'ltr' | 'rtl';
  empty?: ReactNode;
  /** Label for the input (as her, or as you in personal mode) */
  inputLabel: string;
}

// ---------- Smartphone ----------

export function SmartphoneFrame({ messages, time, sender, senderLine, draft, onDraft, onSend, lang, dir, empty, inputLabel }: FrameProps) {
  const chat = useStickToBottom(messages.length);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSend(draft);
  };
  let lastDay = '';
  return (
    <div
      data-testid="phone-smart"
      className="relative mx-auto w-full max-w-[320px] rounded-[44px] bg-primary-solid p-2.5 shadow-xl ring-1 ring-secondary"
      aria-label="Her smartphone, with a chat app"
      role="figure"
    >
      {/* Side buttons */}
      <span aria-hidden="true" className="absolute top-28 -left-0.5 h-12 w-1 rounded-l bg-quaternary" />
      <span aria-hidden="true" className="absolute top-44 -left-0.5 h-12 w-1 rounded-l bg-quaternary" />
      <span aria-hidden="true" className="absolute top-36 -right-0.5 h-16 w-1 rounded-r bg-quaternary" />
      <div className="relative flex h-[600px] flex-col overflow-hidden rounded-[34px] bg-secondary">
        {/* Status bar with a generic camera pill */}
        <div className="relative flex h-11 shrink-0 items-center justify-between bg-primary px-6 text-xs font-semibold text-primary">
          <span className="tnum">{time}</span>
          <span aria-hidden="true" className="absolute top-2.5 left-1/2 h-6 w-24 -translate-x-1/2 rounded-full bg-primary-solid" />
          <span className="flex items-center gap-1.5">
            <SignalBars />
            <span className="text-[10px]">4G</span>
            <BatteryIcon />
          </span>
        </div>
        {/* Chat header */}
        <div className="flex shrink-0 items-center gap-2.5 border-b border-secondary bg-primary px-3 py-2">
          <ChevronLeft aria-hidden="true" className="size-5 text-fg-quaternary" />
          <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-solid text-sm font-semibold text-on-fill">
            {sender.slice(0, 1)}
          </span>
          <span className="min-w-0 flex-1">
            <strong className="block truncate text-sm font-semibold text-primary">{sender}</strong>
            <span className="block truncate text-xs text-tertiary">{senderLine}</span>
          </span>
          <Phone01 aria-hidden="true" className="size-5 text-fg-quaternary" />
        </div>
        {/* Messages */}
        <div ref={chat} className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-3 py-3" aria-live="polite" aria-label="Messages on her phone">
          {messages.length === 0 ? <div className="m-auto max-w-[24ch] text-center text-sm text-tertiary">{empty}</div> : null}
          {messages.map((m) => {
            const day = m.dayLabel;
            const showDay = day !== lastDay;
            lastDay = day;
            if (m.kind === 'call') {
              return (
                <div key={m.id} className="contents">
                  {showDay ? <DayChip label={day} /> : null}
                  <div className="mx-auto flex items-center gap-2 rounded-full bg-primary px-3 py-1.5 text-xs text-tertiary ring-1 ring-secondary">
                    <Phone01 aria-hidden="true" className="size-3.5" />
                    {m.body}
                    <span className="tnum">{m.time}</span>
                  </div>
                </div>
              );
            }
            const mine = m.from === 'her';
            return (
              <div key={m.id} className="contents">
                {showDay ? <DayChip label={day} /> : null}
                <div className={cx('flex', mine ? 'justify-end' : 'justify-start')}>
                  <div
                    data-bubble={mine ? 'out' : 'in'}
                    className={cx(
                      'relative max-w-[82%] rounded-2xl px-3 pt-2 pb-1.5 text-[14.5px] leading-snug shadow-xs',
                      mine ? 'rounded-br-md bg-brand-primary text-primary ring-1 ring-brand' : 'rounded-bl-md bg-primary text-primary ring-1 ring-secondary',
                    )}
                  >
                    <p lang={m.lang} dir={m.dir} className="m-0 break-words whitespace-pre-wrap">
                      {m.body}
                    </p>
                    <span className="mt-0.5 flex items-center justify-end gap-1 text-[11px] text-tertiary">
                      <span className="tnum">{m.time}</span>
                      {mine ? <Ticks status={m.status} /> : null}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {/* Input */}
        <form onSubmit={submit} className="flex shrink-0 items-center gap-2 border-t border-secondary bg-primary px-2.5 pt-2 pb-5">
          <input
            id="phone-reply"
            aria-label={inputLabel}
            placeholder="Message"
            lang={lang}
            dir={dir}
            value={draft}
            onChange={(e) => onDraft(e.target.value)}
            className="h-10 min-w-0 flex-1 rounded-full bg-secondary px-4 text-sm text-primary ring-1 ring-secondary outline-none placeholder:text-placeholder focus-visible:ring-2 focus-visible:ring-brand"
          />
          <button type="submit" aria-label="Send reply" disabled={!draft.trim()} className="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-brand-solid text-on-fill disabled:opacity-50">
            <Send01 className="size-4.5" aria-hidden="true" />
          </button>
        </form>
        <span aria-hidden="true" className="absolute bottom-1.5 left-1/2 h-1 w-28 -translate-x-1/2 rounded-full bg-quaternary" />
      </div>
    </div>
  );
}

function DayChip({ label }: { label: string }) {
  return <div className="mx-auto my-1 rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-medium text-tertiary ring-1 ring-secondary">{label}</div>;
}

// ---------- Feature phone ----------

const KEYS: Array<[string, string]> = [
  ['1', ''],
  ['2', 'abc'],
  ['3', 'def'],
  ['4', 'ghi'],
  ['5', 'jkl'],
  ['6', 'mno'],
  ['7', 'pqrs'],
  ['8', 'tuv'],
  ['9', 'wxyz'],
  ['*', ''],
  ['0', '+'],
  ['#', ''],
];

export function FeaturePhoneFrame({ messages, time, sender, draft, onDraft, onSend, lang, dir, empty, inputLabel }: FrameProps) {
  const screen = useStickToBottom(messages.length);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSend(draft);
  };
  return (
    <div
      data-testid="phone-feature"
      className="relative mx-auto w-full max-w-[260px] rounded-[36px] bg-tertiary px-4 pt-6 pb-5 shadow-xl ring-1 ring-primary"
      aria-label="Her basic phone, with SMS"
      role="figure"
    >
      <span aria-hidden="true" className="mx-auto mb-3 block h-1.5 w-14 rounded-full bg-quaternary" />
      {/* LCD screen */}
      <div className="overflow-hidden rounded-lg bg-success-primary ring-4 ring-quaternary">
        <div className="flex items-center justify-between border-b border-success_subtle px-2 py-1 font-mono text-[11px] text-success-primary">
          <SignalBars />
          <span className="tnum">{time}</span>
          <BatteryIcon />
        </div>
        <div className="border-b border-success_subtle px-2 py-0.5 font-mono text-[11px] font-semibold text-success-primary">Messages: {sender}</div>
        <div ref={screen} className="h-[232px] overflow-y-auto px-2 py-1.5 font-mono text-[12.5px] leading-snug text-success-primary" aria-live="polite" aria-label="Text messages on her phone">
          {messages.length === 0 ? <p className="m-0 opacity-80">{empty}</p> : null}
          {messages.map((m) => (
            <div key={m.id} className={cx('mb-2 border-b border-dashed border-success_subtle pb-1.5', m.from === 'her' && 'ps-4')}>
              <div className="flex justify-between gap-2 text-[10.5px] font-semibold opacity-80">
                <span>{m.kind === 'call' ? 'Call' : m.from === 'her' ? 'Sent' : `From: ${sender}`}</span>
                <span className="flex items-center gap-1 tnum">
                  {m.dayLabel} {m.time}
                  {m.from === 'her' ? <span>{m.status === 'delivered' || m.status === 'read' ? 'Delivered' : 'Sent'}</span> : null}
                </span>
              </div>
              <p lang={m.lang} dir={m.dir} className="m-0 break-words whitespace-pre-wrap">
                {m.body}
              </p>
            </div>
          ))}
        </div>
        <form onSubmit={submit} className="flex items-center gap-1 border-t border-success_subtle p-1">
          <input
            id="phone-reply"
            aria-label={inputLabel}
            placeholder="Write SMS"
            lang={lang}
            dir={dir}
            value={draft}
            onChange={(e) => onDraft(e.target.value)}
            className="h-8 min-w-0 flex-1 rounded-sm bg-primary px-2 font-mono text-xs text-primary ring-1 ring-success_subtle outline-none focus-visible:ring-2 focus-visible:ring-brand"
          />
          <button type="submit" aria-label="Send reply" disabled={!draft.trim()} className="h-8 shrink-0 cursor-pointer rounded-sm bg-success-solid px-2 font-mono text-xs font-semibold text-on-fill disabled:opacity-50">
            Send
          </button>
        </form>
      </div>
      {/* Soft keys and navigation pad */}
      <div aria-hidden="true" className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <span className="h-6 rounded-md bg-quaternary" />
        <span className="flex size-12 items-center justify-center rounded-full bg-quaternary ring-1 ring-primary">
          <span className="size-5 rounded-full bg-tertiary" />
        </span>
        <span className="h-6 rounded-md bg-quaternary" />
      </div>
      <div aria-hidden="true" className="mt-3 grid grid-cols-3 gap-1.5">
        {KEYS.map(([k, sub]) => (
          <span key={k} className="flex h-8 flex-col items-center justify-center rounded-lg bg-primary text-sm leading-none font-semibold text-secondary shadow-xs ring-1 ring-secondary">
            {k}
            {sub ? <span className="text-[8px] font-medium tracking-wide text-quaternary uppercase">{sub}</span> : null}
          </span>
        ))}
      </div>
    </div>
  );
}
