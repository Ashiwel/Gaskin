/**
 * Settings sections, part two: visits, notifications and reminders, messaging, printing,
 * AI assistant, privacy and security, storage and backup, run setup again, about and legal.
 */
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
  AlertTriangle,
  Bell01,
  BookOpen01,
  CheckCircle,
  ClipboardCheck,
  Clock,
  Copy01,
  Database02,
  Download01,
  Eye,
  FileLock02,
  HelpCircle,
  Key01,
  Lock01,
  MessageChatSquare,
  Moon02,
  Printer,
  RefreshCw01,
  Save01,
  Scale01,
  Send01,
  Shield02,
  ShieldTick,
  Stars02,
  Trash01,
  Upload01,
  Users01,
} from '@untitledui/icons';
import { useApp, SCHEMA, type AppState } from '../../store';
import { useBridgeStatus, hardReset } from '../../store/backend';
import { forgetAIKey, getAISettings, keyPersistence, loadAISettings, needsKeyAgain, PROVIDER_OPTIONS, saveAISettings, type AISettings, type KeyPersistence } from '../../ai';
import { connectAssistant, resetSetup, useSetup, type AssistantConnection, type AssistantTarget } from '../../setup';
import { decryptWithPassphrase, getAppStore, isEncrypted, passphraseProblem, validateImportedState, MAX_IMPORT_BYTES, type StoreStatus } from '../../storage';
import { listCustomQuestions, deleteCustomQuestion, customQuestionStore } from '../../visits/customQuestions';
import { VISIT_TEMPLATES } from '../../visits';
import { saveFile } from '../HandoutSheet';
import { useToast } from '../components';
import { auditLog, configure, useAIStatus, type AuditRow } from '../ai';
import { useWorkerLang } from '../i18n';
import { can, clearAccounts, setAutoLockMinutes, useAccounts, autoLockMinutes } from '../accounts/auth';
import { TextField, Choice } from '../onboarding/kit';
import { languageName, languagesFor } from '../onboarding/geo';
import { smsCharLimit, usePrefs, type Situation } from './prefs';
import { Callout, ConfirmDialog, Group, Row, SectionHeader, Segmented, SelectInline, SmallButton, SwitchRow } from './parts';
import { cx } from '../../utils/cx';
import type { Channel } from '../../types';

// ---------------------------------------------------------------------------
// Visits
// ---------------------------------------------------------------------------

const VISIT_TYPE_LABEL: Record<string, string> = { anc: 'Every antenatal visit', pnc: 'Every postnatal visit', child_health: 'Every child visit', home_visit: 'Every home visit' };
const templateLabel = (id: string) => VISIT_TEMPLATES.find((t) => t.id === id)?.label ?? VISIT_TYPE_LABEL[id] ?? id;

export function VisitsSection() {
  const { current } = useAccounts();
  const toast = useToast();
  const [p, set] = usePrefs();
  useSyncExternalStore(customQuestionStore.subscribe, customQuestionStore.getVersion, customQuestionStore.getVersion);
  const qs = listCustomQuestions(current ? { workerId: current.id, facilityId: current.facilityId } : {});
  const [del, setDel] = useState<string | null>(null);
  const grouped = useMemo(() => {
    const m = new Map<string, typeof qs>();
    for (const q of qs) m.set(q.visitType, [...(m.get(q.visitType) ?? []), q]);
    return [...m.entries()];
  }, [qs]);
  return (
    <div className="grid gap-6" data-testid="visits-section">
      <SectionHeader title="Visits" lede="Questions you added to the Ask step, and reminders before each visit." icon={ClipboardCheck} />
      {qs.length ? (
        grouped.map(([type, list]) => (
          <Group key={type} title={templateLabel(type)}>
            {list.map((q) => (
              <Row key={q.id} label={q.text} hint={`${q.answer === 'yes_no' ? 'Yes or no' : 'Written answer'}. ${q.scope === 'facility' ? 'Whole facility' : 'Only you'}.`} icon={HelpCircle}>
                <SmallButton icon={Trash01} onPress={() => setDel(q.id)} testId="delete-question">
                  Delete
                </SmallButton>
              </Row>
            ))}
          </Group>
        ))
      ) : (
        <div className="rounded-2xl border border-dashed border-primary p-8 text-center">
          <HelpCircle aria-hidden="true" className="mx-auto size-8 text-fg-quaternary" />
          <p className="mt-3 text-md font-semibold text-primary">No questions of your own yet</p>
          <p className="mt-1 text-sm text-tertiary">During a visit, add a question at the Ask step. It appears on every later visit of that kind, and you can delete it here.</p>
        </div>
      )}
      <Group title="Reminders to mothers" note="Danger-sign alerts never wait for reminders.">
        <Row label="Remind her before a visit" hint={`${p.visitReminderDays} days before`} icon={Bell01}>
          <SelectInline
            label="Days before a visit"
            value={p.visitReminderDays}
            onChange={(v) => set({ visitReminderDays: v })}
            options={[1, 2, 3, 5, 7].map((d) => ({ id: d, label: `${d} day${d === 1 ? '' : 's'} before` }))}
            testId="reminder-days"
          />
        </Row>
        <SwitchRow label="And the day before" value={p.visitReminderDayBefore} onChange={(v) => set({ visitReminderDayBefore: v })} icon={Clock} />
      </Group>
      <ConfirmDialog
        open={Boolean(del)}
        title="Delete this question?"
        confirmLabel="Delete"
        onCancel={() => setDel(null)}
        onConfirm={() => {
          if (del) deleteCustomQuestion(del);
          setDel(null);
          toast('Question deleted. Answers already given stay in the records.');
        }}
      >
        <p>It will not appear on future visits. Answers already recorded stay in each mother’s history.</p>
      </ConfirmDialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export function NotificationsSection() {
  const [p, set] = usePrefs();
  const hours = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, '0')}:00`);
  return (
    <div className="grid gap-6" data-testid="notifications-section">
      <SectionHeader title="Notifications and reminders" lede="What Gaskin tells you about. Danger-sign alerts always show, at any hour." icon={Bell01} />
      <Group title="Tell me about">
        <SwitchRow label="Contacts due today and tomorrow" icon={ClipboardCheck} value={p.notifyDueContacts} onChange={(v) => set({ notifyDueContacts: v })} testId="notify-due" />
        <SwitchRow label="Replies from mothers" icon={MessageChatSquare} value={p.notifyReplies} onChange={(v) => set({ notifyReplies: v })} testId="notify-replies" />
        <Row label="Danger signs" hint="Always on. They cannot be switched off." icon={AlertTriangle} tone="danger" />
      </Group>
      <Group title="Quiet hours" note="Routine messages to mothers wait until quiet hours end. Urgent and danger messages still go.">
        <SwitchRow label="Quiet hours" icon={Moon02} value={p.quietHours} onChange={(v) => set({ quietHours: v })} testId="quiet-hours" />
        {p.quietHours ? (
          <Row label="From and to" icon={Clock} stack>
            <span className="flex items-center gap-2">
              <SelectInline label="Quiet from" value={p.quietFrom} onChange={(v) => set({ quietFrom: v })} options={hours.map((h) => ({ id: h, label: h }))} />
              <span className="text-tertiary">to</span>
              <SelectInline label="Quiet until" value={p.quietTo} onChange={(v) => set({ quietTo: v })} options={hours.map((h) => ({ id: h, label: h }))} />
            </span>
          </Row>
        ) : null}
      </Group>
      <QuietClock from={p.quietFrom} to={p.quietTo} on={p.quietHours} />
    </div>
  );
}

/** A 24-hour ring with the quiet hours shaded. */
function QuietClock({ from, to, on }: { from: string; to: string; on: boolean }) {
  const f = Number(from.slice(0, 2));
  const t = Number(to.slice(0, 2));
  const hours = Array.from({ length: 24 }, (_, h) => (f <= t ? h >= f && h < t : h >= f || h < t));
  return (
    <div className="flex items-center gap-5 rounded-2xl bg-secondary p-5 ring-1 ring-secondary ring-inset">
      <svg viewBox="0 0 100 100" className="size-24 shrink-0" role="img" aria-label={on ? `Quiet from ${from} to ${to}` : 'Quiet hours off'}>
        {hours.map((q, h) => {
          const a0 = ((h / 24) * 360 - 90) * (Math.PI / 180);
          const a1 = (((h + 1) / 24) * 360 - 90) * (Math.PI / 180);
          const r = 44;
          const r2 = 30;
          const d = `M${50 + r * Math.cos(a0)} ${50 + r * Math.sin(a0)} A${r} ${r} 0 0 1 ${50 + r * Math.cos(a1)} ${50 + r * Math.sin(a1)} L${50 + r2 * Math.cos(a1)} ${50 + r2 * Math.sin(a1)} A${r2} ${r2} 0 0 0 ${50 + r2 * Math.cos(a0)} ${50 + r2 * Math.sin(a0)}Z`;
          return <path key={h} d={d} fill={on && q ? 'var(--color-chart-3)' : 'var(--color-chart-track)'} stroke="var(--color-bg-secondary)" strokeWidth="0.8" />;
        })}
        <text x="50" y="54" textAnchor="middle" fontSize="11" fill="var(--color-text-tertiary)">
          24 h
        </text>
      </svg>
      <p className="text-sm text-secondary">{on ? `Routine messages wait between ${from} and ${to}.` : 'Messages can go at any hour.'}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Messaging
// ---------------------------------------------------------------------------

const SITUATIONS: Array<{ id: Situation; label: string; hint: string }> = [
  { id: 'routine', label: 'Her plan and advice', hint: 'Weekly tips, food, what comes next' },
  { id: 'reminder', label: 'Visit reminders', hint: 'Before each due contact' },
  { id: 'danger', label: 'Danger signs', hint: 'Plain SMS works on every phone, even offline' },
  { id: 'carer', label: 'To her family carer', hint: 'Husband, mother or sister she names' },
];
const CHANNELS: Array<{ id: Channel; label: string }> = [
  { id: 'sms', label: 'SMS' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'voice', label: 'Voice' },
  { id: 'print', label: 'Printed card' },
];

export function MessagingSection() {
  const [p, set] = usePrefs();
  const { current } = useAccounts();
  const { state } = useApp();
  const facility = state.facilities.find((f) => f.id === current?.facilityId)?.name ?? '';
  const sender = p.senderName || (current ? `${current.name.split(' ')[0]}${facility ? `, ${facility}` : ''}` : 'Gaskin');
  const limit = smsCharLimit(p.smsParts);
  return (
    <div className="grid gap-6" data-testid="messaging-section">
      <SectionHeader title="Messaging" lede="How messages reach mothers by default. You can change the channel on any message before it goes." icon={Send01} />
      <Group title="Default channel">
        {SITUATIONS.map((s) => (
          <Row key={s.id} label={s.label} hint={s.hint} stack>
            <Segmented
              label={s.label}
              value={p.channels[s.id]}
              onChange={(v) => set({ channels: { ...p.channels, [s.id]: v } })}
              options={s.id === 'danger' ? CHANNELS.filter((c) => c.id === 'sms' || c.id === 'voice') : CHANNELS}
              wrap={s.id !== 'danger'}
              testId={`channel-${s.id}`}
            />
          </Row>
        ))}
      </Group>
      <Group title="Signing and length">
        <div className="p-4">
          <TextField label="Sender name at the end of each message" value={p.senderName} onChange={(v) => set({ senderName: v.slice(0, 40) })} placeholder={sender} hint="Leave empty to use your first name and facility." testId="sender-name" />
        </div>
        <SwitchRow label="Messages to family carers" hint="Only with her consent, recorded on her record." icon={Users01} value={p.carerMessages} onChange={(v) => set({ carerMessages: v })} />
        <Row label="Longest SMS" hint={`${limit} characters. Each extra part costs one more SMS.`} icon={MessageChatSquare} stack>
          <Segmented label="SMS parts" value={p.smsParts} onChange={(v) => set({ smsParts: v })} options={[{ id: 1, label: '1 part' }, { id: 2, label: '2 parts' }, { id: 3, label: '3 parts' }]} testId="sms-parts" />
        </Row>
      </Group>
      <div className="rounded-2xl bg-secondary p-5 ring-1 ring-secondary ring-inset">
        <p className="text-xs font-semibold tracking-wide text-tertiary uppercase">Preview</p>
        <div className="mt-3 max-w-sm rounded-2xl rounded-bl-md bg-primary p-4 text-sm text-primary shadow-xs ring-1 ring-secondary">
          Adaeze, your next check is on Thursday at Surulere PHC. Bring your card. If you have bleeding, a bad headache or swollen face, go to the clinic now.
          <span className="mt-2 block text-tertiary">{sender}</span>
        </div>
        <div className="mt-3 h-1.5 max-w-sm overflow-hidden rounded-full bg-tertiary" aria-hidden="true">
          <div className="h-full rounded-full bg-brand-solid" style={{ width: `${Math.min(100, (180 / limit) * 100)}%` }} />
        </div>
        <p className="mt-1 text-xs text-tertiary tnum">About 180 of {limit} characters</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Printing
// ---------------------------------------------------------------------------

export function PrintingSection() {
  const [p, set] = usePrefs();
  const saved = useSetup();
  const wl = useWorkerLang();
  const a = (saved?.answers ?? {}) as { countryCode?: string; region?: string };
  const langs = languagesFor({ country: a.countryCode ?? saved?.plan.country, region: saved?.plan.region });
  return (
    <div className="grid gap-6" data-testid="printing-section">
      <SectionHeader title="Printing" lede="Picture cards and plans for mothers who do not read or have no phone." icon={Printer} />
      {saved?.plan.printing.routine ? <Callout tone="brand" icon={Printer}>{saved.plan.printing.routine}</Callout> : null}
      <Group title="Paper">
        <Row label="Paper size" icon={Printer}>
          <Segmented label="Paper size" value={p.paper} onChange={(v) => set({ paper: v })} options={[{ id: 'a4', label: 'A4' }, { id: 'letter', label: 'Letter' }]} testId="paper" />
        </Row>
        <SwitchRow label="Black and white" hint="Cheaper, and the pictures still read clearly." icon={Printer} value={p.blackAndWhite} onChange={(v) => set({ blackAndWhite: v })} testId="bw" />
        <Row label="Handout language" icon={BookOpen01} stack>
          <SelectInline
            label="Handout language"
            value={p.handoutLanguage}
            onChange={(v) => set({ handoutLanguage: v })}
            options={[{ id: '', label: 'Her own language' }, ...[...new Set([wl, ...langs.map((l) => l.code)])].map((c) => ({ id: c, label: languageName(c) }))]}
            testId="handout-language"
          />
        </Row>
      </Group>
      <div className="flex items-end gap-6 rounded-2xl bg-secondary p-5 ring-1 ring-secondary ring-inset" aria-hidden="true">
        <div className={cx('rounded-md bg-primary shadow-xs ring-1 ring-secondary', p.paper === 'a4' ? 'h-28 w-20' : 'h-26 w-20')}>
          <div className="m-2 grid grid-cols-2 gap-1">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className={cx('h-7 rounded-sm', p.blackAndWhite ? 'bg-tertiary' : i % 2 ? 'bg-brand-primary' : 'bg-warning-primary')} />
            ))}
          </div>
        </div>
        <p className="text-sm text-secondary">
          {p.paper === 'a4' ? 'A4' : 'US Letter'}, {p.blackAndWhite ? 'black and white' : 'colour'}, in {p.handoutLanguage ? languageName(p.handoutLanguage) : 'each mother’s language'}.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AI assistant
// ---------------------------------------------------------------------------

type Mode = AISettings['mode'];
const MODE_ORDER: Mode[] = ['none', 'auto', 'claude_here', 'own_key', 'on_device', 'any_app'];
const MODE_TITLE: Record<Mode, string> = { none: 'No AI', auto: 'Automatic', claude_here: 'Claude, in this page', own_key: 'Your own key', on_device: 'On this device', any_app: 'Any AI app' };
const ASSISTANTS: Array<{ id: AssistantTarget; label: string }> = [
  { id: 'claude_desktop', label: 'Claude Desktop' },
  { id: 'claude_web', label: 'Claude on the web' },
  { id: 'chatgpt', label: 'ChatGPT' },
  { id: 'other', label: 'Other' },
];

function persist(s: AISettings, kp?: KeyPersistence) {
  try {
    saveAISettings(s, kp);
  } catch {
    /* storage blocked */
  }
}

export function AISection() {
  const toast = useToast();
  const status = useAIStatus();
  const { current } = useAccounts();
  const initial = loadAISettings() ?? getAISettings();
  const [mode, setMode] = useState<Mode>(initial.mode);
  const ownPresets = PROVIDER_OPTIONS.find((o) => o.id === 'own_key')?.presets ?? [];
  const devPresets = PROVIDER_OPTIONS.find((o) => o.id === 'on_device')?.presets ?? [];
  const [own, setOwn] = useState(() => ({
    kind: (initial.ownKey?.kind ?? 'openai_compatible') as NonNullable<AISettings['ownKey']>['kind'],
    baseUrl: initial.ownKey?.baseUrl ?? ownPresets[0]?.baseUrl ?? '',
    model: initial.ownKey?.model ?? ownPresets[0]?.model ?? '',
    apiKey: initial.ownKey?.apiKey ?? '',
  }));
  const [kp, setKp] = useState<KeyPersistence>(() => keyPersistence());
  const [dev, setDev] = useState(() => ({
    kind: (initial.onDevice?.kind ?? 'local_server') as NonNullable<AISettings['onDevice']>['kind'],
    baseUrl: initial.onDevice?.baseUrl ?? 'http://localhost:11434/v1',
    model: initial.onDevice?.model ?? devPresets[0]?.model ?? '',
  }));
  const [deid, setDeid] = useState<boolean>(() => (initial as { deidentify?: boolean }).deidentify !== false && initial.onDevice?.deidentify !== false);
  const [confirmOff, setConfirmOff] = useState(false);
  const [err, setErr] = useState('');
  const [assistant, setAssistant] = useState<AssistantTarget>('claude_desktop');
  const [conn, setConn] = useState<AssistantConnection | null>(null);
  const [rows, setRows] = useState<AuditRow[]>(() => auditLog());
  const askKey = needsKeyAgain(loadAISettings());
  const allowed = !current || can(current, 'change_settings') || current.role === 'worker';

  useEffect(() => {
    let live = true;
    void connectAssistant(assistant).then((c) => live && setConn(c));
    return () => {
      live = false;
    };
  }, [assistant]);
  useEffect(() => {
    const t = window.setInterval(() => setRows(auditLog()), 3000);
    return () => window.clearInterval(t);
  }, []);

  const apply = (s0: AISettings, label: string, deidentify = deid, persistence = kp) => {
    const s = { ...s0, deidentify } as AISettings;
    if (s.onDevice) s.onDevice = { ...s.onDevice, deidentify };
    const e = configure(s as unknown as Record<string, unknown>);
    if (e) return setErr(e);
    setErr('');
    persist(s, persistence);
    toast(`AI: ${label}.`);
  };
  const choose = (m: Mode) => {
    setMode(m);
    setErr('');
    if (m === 'own_key' || m === 'on_device') return;
    apply({ mode: m }, MODE_TITLE[m]);
  };
  const download = async () => {
    if (!conn?.downloadUrl) return;
    try {
      if (conn.downloadUrl.startsWith('blob:')) {
        const blob = await (await fetch(conn.downloadUrl)).blob();
        const claude = (window as unknown as { claude?: { use?: (n: string) => Promise<unknown> } }).claude;
        const dl = (await claude?.use?.('downloads').catch(() => null)) as { save?: (a: { filename: string; data: Blob }) => Promise<unknown> } | null | undefined;
        if (dl?.save) await dl.save({ filename: conn.fileName ?? 'gaskin.mcpb', data: blob });
        else {
          const a = document.createElement('a');
          a.href = conn.downloadUrl;
          a.download = conn.fileName ?? 'gaskin.mcpb';
          document.body.appendChild(a);
          a.click();
          a.remove();
        }
        toast('Gaskin for Claude is downloading. Double-click it to install.');
      } else window.open(conn.downloadUrl, '_blank', 'noopener');
    } catch {
      toast('The download did not start. Try again.');
    }
  };
  const opts = MODE_ORDER.map((id) => PROVIDER_OPTIONS.find((o) => o.id === id)).filter((o): o is (typeof PROVIDER_OPTIONS)[number] => Boolean(o));
  const sent = rows.filter((r) => r.destination !== 'none').length;

  return (
    <div className="grid gap-6" data-testid="ai-section">
      <SectionHeader
        title="AI assistant"
        lede="Gaskin works fully without AI. Safety comes from the rules, and AI only helps write and translate. Names are removed before anything leaves this device."
        icon={Stars02}
        action={
          <span className={cx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-medium ring-1 ring-inset', status.live ? 'bg-success-primary text-success-primary ring-success_subtle' : 'bg-secondary text-secondary ring-secondary')}>
            <span aria-hidden="true" className={cx('size-2 rounded-full', status.live ? 'bg-success-solid' : 'bg-fg-quaternary')} />
            {status.label || 'Templates'}
          </span>
        }
      />
      {!allowed ? <Callout tone="gray">Only a supervisor can change AI on this device.</Callout> : null}
      {askKey ? (
        <Callout tone="warning" icon={Key01} testId="key-again">
          Your AI key was not kept after Gaskin closed. Type it again below to use your own key, or choose another option.
        </Callout>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" role="radiogroup" aria-label="AI mode">
        {opts.map((o) => {
          const on = mode === o.id;
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={on}
              data-mode={o.id}
              disabled={!allowed}
              onClick={() => choose(o.id)}
              className={cx('flex min-h-11 cursor-pointer flex-col gap-2 rounded-2xl p-4 text-left outline-focus-ring focus-visible:outline-2 disabled:cursor-not-allowed disabled:opacity-60', on ? 'bg-brand-primary ring-2 ring-brand ring-inset' : 'bg-primary ring-1 ring-secondary ring-inset hover:bg-primary_hover')}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="text-md font-semibold text-primary">{MODE_TITLE[o.id]}</span>
                {on ? <CheckCircle aria-hidden="true" className="size-5 text-fg-brand-primary" /> : null}
              </span>
              <span className="text-sm text-tertiary">{o.description}</span>
              <span className="mt-auto flex flex-wrap gap-1.5 pt-1">
                <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary ring-1 ring-secondary ring-inset">{o.cost}</span>
                <span className={cx('rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', o.leavesDevice ? 'bg-warning-primary text-warning-primary ring-border-warning_subtle' : 'bg-success-primary text-success-primary ring-success_subtle')}>{o.leavesDevice ? 'Leaves the device' : 'Stays on the device'}</span>
              </span>
            </button>
          );
        })}
      </div>

      {mode === 'own_key' ? (
        <Group title="Your own key">
          <div className="grid gap-4 p-4">
            <div className="flex flex-wrap gap-2">
              {ownPresets.map((pr) => (
                <button key={pr.label} type="button" aria-pressed={own.model === pr.model && own.kind === pr.kind} onClick={() => setOwn({ ...own, kind: pr.kind as typeof own.kind, baseUrl: pr.baseUrl ?? '', model: pr.model })} className={cx('h-10 cursor-pointer rounded-full px-3 text-sm font-semibold ring-1 ring-inset', own.model === pr.model ? 'bg-brand-primary text-brand-secondary ring-brand' : 'bg-primary text-secondary ring-primary hover:bg-primary_hover')}>
                  {pr.label}
                </button>
              ))}
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <TextField label="Web address (base URL)" value={own.baseUrl} onChange={(v) => setOwn({ ...own, baseUrl: v })} placeholder="https://api.example.com/v1" />
              <TextField label="Model" value={own.model} onChange={(v) => setOwn({ ...own, model: v })} />
            </div>
            <TextField label="Key" type="password" autoComplete="off" value={own.apiKey} onChange={(v) => setOwn({ ...own, apiKey: v })} testId="byok-key" />
            <fieldset>
              <legend className="mb-2 text-sm font-medium text-secondary">Keep the key</legend>
              <div className="grid gap-2 md:grid-cols-3">
                <Choice size="md" label="Until I close Gaskin" hint="Best on a shared device." selected={kp === 'session'} onPress={() => setKp('session')} />
                <Choice size="md" label="Remember on this device" hint="Anyone using this browser could find it." selected={kp === 'device'} onPress={() => setKp('device')} />
                <Choice size="md" label="Ask me every time" hint="Never saved anywhere." selected={kp === 'memory'} onPress={() => setKp('memory')} />
              </div>
            </fieldset>
            {kp === 'device' ? <Callout tone="warning" icon={AlertTriangle}>A key kept on this device can be read by anyone who opens this browser’s tools. Use it only on a phone or laptop that is yours alone.</Callout> : null}
            {err ? <Callout tone="error">{err}</Callout> : null}
            <div className="flex flex-wrap gap-2">
              <SmallButton tone="primary" onPress={() => apply({ mode: 'own_key', ownKey: { ...own, baseUrl: own.baseUrl || undefined } }, 'your own key')} testId="save-key">
                Save and use
              </SmallButton>
              <SmallButton
                icon={Trash01}
                onPress={() => {
                  forgetAIKey();
                  setOwn({ ...own, apiKey: '' });
                  toast('Your key has been removed from this device.');
                }}
                testId="forget-key"
              >
                Remove my key from this device
              </SmallButton>
            </div>
          </div>
        </Group>
      ) : null}

      {mode === 'on_device' ? (
        <Group title="On this device or a facility hub">
          <div className="grid gap-4 p-4">
            <div className="flex flex-wrap gap-2">
              {devPresets.map((pr) => (
                <button key={pr.label} type="button" aria-pressed={dev.model === pr.model} onClick={() => setDev({ kind: pr.kind as typeof dev.kind, baseUrl: pr.baseUrl ?? dev.baseUrl, model: pr.model })} className={cx('h-10 cursor-pointer rounded-full px-3 text-sm font-semibold ring-1 ring-inset', dev.model === pr.model ? 'bg-brand-primary text-brand-secondary ring-brand' : 'bg-primary text-secondary ring-primary hover:bg-primary_hover')}>
                  {pr.label}
                </button>
              ))}
            </div>
            <Segmented label="Where it runs" value={dev.kind} onChange={(v) => setDev({ ...dev, kind: v })} options={[{ id: 'local_server', label: 'A local server' }, { id: 'in_browser', label: 'In this browser' }]} />
            <div className="grid gap-3 md:grid-cols-2">
              {dev.kind === 'local_server' ? <TextField label="Server address" value={dev.baseUrl} onChange={(v) => setDev({ ...dev, baseUrl: v })} /> : null}
              <TextField label="Model" value={dev.model} onChange={(v) => setDev({ ...dev, model: v })} />
            </div>
            {err ? <Callout tone="error">{err}</Callout> : null}
            <div>
              <SmallButton tone="primary" onPress={() => apply({ mode: 'on_device', onDevice: { kind: dev.kind, model: dev.model, baseUrl: dev.kind === 'local_server' ? dev.baseUrl : undefined } }, 'on this device')}>
                Save and use
              </SmallButton>
            </div>
          </div>
        </Group>
      ) : null}

      {mode === 'any_app' ? <Callout tone="gray">When you ask for AI help, Gaskin shows a short request with a Copy button. Paste it into any AI app, then paste the answer back. Gaskin checks it before you use it.</Callout> : null}

      <Group title="Privacy">
        <SwitchRow
          label="Remove names and personal details before sending"
          hint="Names, phone numbers, places and dates become placeholders, and are put back on this device."
          icon={ShieldTick}
          value={deid}
          testId="deidentify"
          onChange={(v) => {
            if (v) {
              setDeid(true);
              apply(getAISettings(), 'names removed before sending', true);
            } else setConfirmOff(true);
          }}
        />
        <Row label="What the AI sees" hint="Open any mother, then Message, then “What the AI sees” to read exactly what would be sent." icon={Eye} />
      </Group>
      <ConfirmDialog
        open={confirmOff}
        title="Send real names to the AI?"
        confirmLabel="Turn off and send real details"
        onCancel={() => setConfirmOff(false)}
        onConfirm={() => {
          setDeid(false);
          setConfirmOff(false);
          apply(getAISettings(), 'personal details included', false);
        }}
      >
        <p>Her real name, community and dates would reach the AI service. Do this only for an AI on this device or your own facility server, and only with her consent.</p>
      </ConfirmDialog>

      <section aria-labelledby="audit-h" className="grid gap-3" data-testid="ai-audit">
        <div className="flex items-baseline justify-between gap-3">
          <h3 id="audit-h" className="text-sm font-semibold text-secondary">
            AI audit log
          </h3>
          <span className="text-sm text-tertiary tnum">
            {rows.length} request{rows.length === 1 ? '' : 's'}, {sent} sent
          </span>
        </div>
        {rows.length ? (
          <div className="overflow-hidden rounded-2xl ring-1 ring-secondary ring-inset">
            <ul className="divide-y divide-border-secondary">
              {[...rows].reverse().slice(0, 8).map((r, i) => (
                <li key={i} className="flex items-center gap-3 px-4 py-3 text-sm">
                  <span className={cx('size-2 shrink-0 rounded-full', r.destination === 'none' || r.destination === 'on_device' ? 'bg-success-solid' : 'bg-warning-solid')} aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate text-primary">
                    {r.task} <span className="text-tertiary">via {r.provider || 'templates'}</span>
                  </span>
                  <span className="hidden text-tertiary sm:inline">{r.categories.join(', ') || 'Plan text only'}</span>
                  <span className="shrink-0 text-tertiary tnum">{r.size ? `${r.size.toLocaleString('en-GB')} B` : 'none'}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="rounded-2xl bg-secondary p-4 text-sm text-tertiary">No AI requests on this device yet. Each one is logged here with what it was for and what kind of data went, never the text itself.</p>
        )}
      </section>

      <Group title="Connect your assistant" note="Your own AI assistant can answer “Who should I visit first today?”, asks before it changes a record, and sees records with names removed." testId="connect-assistant">
        <div className="grid gap-4 p-4">
          <Segmented label="Assistant" value={assistant} onChange={setAssistant} options={ASSISTANTS} full wrap />
          {conn ? (
            <>
              <ol className="grid min-w-0 list-decimal gap-1.5 pl-5 text-sm break-words text-secondary">
                {conn.steps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
              {conn.kind === 'download' ? (
                <div className="flex flex-wrap items-center gap-3">
                  <SmallButton tone="primary" icon={Download01} onPress={download} testId="download-mcpb">
                    Download Gaskin for Claude
                  </SmallButton>
                  <span className="text-sm text-tertiary">{conn.downloadUrl?.startsWith('blob:') ? 'Included in this copy of Gaskin, so it works offline.' : 'Downloads once.'}</span>
                </div>
              ) : null}
              {conn.kind === 'address' && conn.address ? (
                <div className="flex flex-wrap items-center gap-2">
                  <code className="min-w-0 flex-1 rounded-lg bg-secondary px-3 py-2.5 text-sm break-all text-primary">{conn.address}</code>
                  <SmallButton
                    icon={Copy01}
                    onPress={() => {
                      void navigator.clipboard?.writeText(conn.address!).catch(() => undefined);
                      toast('Address copied.');
                    }}
                  >
                    Copy
                  </SmallButton>
                </div>
              ) : null}
              {conn.note ? <p className="text-sm text-tertiary">{conn.note}</p> : null}
            </>
          ) : null}
        </div>
      </Group>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Privacy and security
// ---------------------------------------------------------------------------

function useStore() {
  const [st, setSt] = useState<StoreStatus | null>(null);
  const [enc, setEnc] = useState(false);
  useEffect(() => {
    let off: (() => void) | undefined;
    void getAppStore()
      .then(async (s) => {
        setSt(s.status());
        setEnc(await s.isEncrypted().catch(() => false));
        off = s.subscribe((x) => {
          setSt(x);
          void s.isEncrypted().then(setEnc, () => undefined);
        });
      })
      .catch(() => undefined);
    return () => off?.();
  }, []);
  return { st, enc };
}

export function PrivacySection({ onDeleted }: { onDeleted?: () => void }) {
  const toast = useToast();
  const { state } = useApp();
  const { current } = useAccounts();
  const [p, set] = usePrefs();
  const { st, enc } = useStore();
  const [passOpen, setPassOpen] = useState(false);
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [confirmOffEnc, setConfirmOffEnc] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [typed, setTyped] = useState('');
  const [lockMins, setLockMins] = useState(() => autoLockMinutes());
  const problem = pass ? passphraseProblem(pass) : null;
  const canEditLock = current ? can(current, 'change_settings') || Boolean(current.personal) : true;

  const exportMine = async () => {
    const data = JSON.stringify({ app: 'gaskin', schema: SCHEMA, exportedAt: new Date().toISOString(), state }, null, 2);
    const r = await saveFile(`gaskin-my-data-${state.clock.slice(0, 10)}.json`, data, 'application/json');
    toast(r === 'declined' ? 'Export cancelled.' : 'Your data is ready to save.');
  };

  return (
    <div className="grid gap-6" data-testid="privacy-section">
      <SectionHeader title="Privacy and security" lede="Who can open Gaskin on this device, how records are protected, and how long they are kept." icon={Shield02} />
      <Group title="Screen lock" note="After this many minutes without a tap, the PIN screen shows. Records stay open in memory only while unlocked.">
        <Row label="Lock after" icon={Lock01}>
          <SelectInline
            label="Auto-lock"
            value={lockMins}
            onChange={async (v) => {
              const e = await setAutoLockMinutes(v);
              if (e) return toast(e);
              setLockMins(v);
              set({ autoLockMinutes: v });
              toast(`Gaskin locks after ${v} minute${v === 1 ? '' : 's'} without use.`);
            }}
            options={[1, 2, 5, 10, 15, 30, 60].map((m) => ({ id: m, label: `${m} minute${m === 1 ? '' : 's'}` }))}
            testId="auto-lock"
          />
        </Row>
        {!canEditLock ? <Row label="Only a supervisor can change this." hint="It applies to everyone on this device." icon={Users01} /> : null}
      </Group>

      <Group title="Protect records with a passphrase" testId="encryption">
        <Row
          label={enc ? 'Records are encrypted' : 'Records are not encrypted'}
          hint={enc ? 'The data file, backups and the browser copy are locked with your passphrase.' : 'Recommended when records are kept on a USB stick or in a folder. A lost stick then cannot be read.'}
          icon={FileLock02}
        >
          {enc ? (
            <SmallButton onPress={() => setConfirmOffEnc(true)}>Turn off</SmallButton>
          ) : (
            <SmallButton tone="primary" onPress={() => setPassOpen(true)} testId="enable-encryption">
              Turn on
            </SmallButton>
          )}
        </Row>
        {enc ? (
          <Row label="Lock records now" hint="Asks for the passphrase before anyone can open them again." icon={Lock01}>
            <SmallButton
              onPress={async () => {
                const s = await getAppStore();
                s.lock();
                toast('Records locked.');
              }}
            >
              Lock now
            </SmallButton>
          </Row>
        ) : null}
        {passOpen ? (
          <div className="grid gap-3 bg-secondary p-4">
            <TextField label="Passphrase" type="password" autoComplete="new-password" value={pass} onChange={setPass} hint={problem ?? 'Three or four ordinary words work well, for example “mango river blue chair”.'} testId="passphrase" />
            <TextField label="Type it again" type="password" autoComplete="new-password" value={pass2} onChange={setPass2} testId="passphrase2" />
            <Callout tone="warning" icon={AlertTriangle}>
              If the passphrase is forgotten, nobody can open these records, not even a supervisor. Write it down and keep it with your PIN recovery card, somewhere locked. Then delete the old plain backups in the backups folder.
            </Callout>
            <div className="flex flex-wrap gap-2">
              <SmallButton
                tone="primary"
                disabled={!pass || Boolean(problem) || pass !== pass2}
                testId="save-passphrase"
                onPress={async () => {
                  try {
                    const s = await getAppStore();
                    await s.enableEncryption(pass);
                    setPass('');
                    setPass2('');
                    setPassOpen(false);
                    toast('Records are now encrypted.');
                  } catch (e) {
                    toast((e as Error).message);
                  }
                }}
              >
                Encrypt records
              </SmallButton>
              <SmallButton onPress={() => (setPassOpen(false), setPass(''), setPass2(''))}>Cancel</SmallButton>
            </div>
          </div>
        ) : null}
      </Group>
      <ConfirmDialog
        open={confirmOffEnc}
        title="Stop encrypting records?"
        confirmLabel="Turn off encryption"
        onCancel={() => setConfirmOffEnc(false)}
        onConfirm={async () => {
          setConfirmOffEnc(false);
          try {
            const s = await getAppStore();
            await s.disableEncryption();
            toast('Records are saved without a passphrase from now on.');
          } catch (e) {
            toast((e as Error).message);
          }
        }}
      >
        <p>Anyone who finds the USB stick or folder could then read the records.</p>
      </ConfirmDialog>

      <Group title="Keeping records" note="Mothers who left care more than this long ago are offered for removal. Nothing is removed without asking.">
        <Row label="Keep records" icon={Clock}>
          <SelectInline
            label="Retention"
            value={p.retentionMonths}
            onChange={(v) => set({ retentionMonths: v })}
            options={[
              { id: 0, label: 'Until I delete them' },
              { id: 24, label: '2 years after care ends' },
              { id: 60, label: '5 years after care ends' },
              { id: 120, label: '10 years after care ends' },
            ]}
            testId="retention"
          />
        </Row>
      </Group>

      <Group title="Your data">
        <Row label="Export my data" hint="Everything on this device, as one file. Keys and PINs are never included." icon={Download01} onPress={exportMine} testId="export-mine" />
        <Row label="Delete my data from this device" hint="Removes records, profiles, settings and language packs here." icon={Trash01} tone="danger" onPress={() => setConfirmDelete(true)} testId="delete-mine" />
      </Group>
      {st?.state === 'needs_passphrase' ? <Callout tone="warning">{st.message}</Callout> : null}
      <ConfirmDialog
        open={confirmDelete}
        title="Delete everything on this device?"
        confirmLabel="Delete everything"
        confirmDisabled={typed.trim().toUpperCase() !== 'DELETE'}
        onCancel={() => (setConfirmDelete(false), setTyped(''))}
        onConfirm={async () => {
          setConfirmDelete(false);
          await hardReset().catch(() => undefined);
          await clearAccounts();
          try {
            for (const k of Object.keys(localStorage)) if (k.startsWith('gaskin.')) localStorage.removeItem(k);
          } catch {
            /* ignore */
          }
          forgetAIKey();
          onDeleted?.();
          window.location.hash = '';
          window.location.reload();
        }}
      >
        <p>This cannot be undone. Export your data first if you may need it. Records already shared with a server stay there.</p>
        <label className="grid gap-1.5 text-sm font-medium text-secondary">
          Type DELETE to confirm
          <input value={typed} onChange={(e) => setTyped(e.target.value)} className="h-11 rounded-lg bg-primary px-3 text-md text-primary ring-1 ring-primary outline-hidden ring-inset focus:ring-2 focus:ring-brand" data-testid="delete-confirm-text" />
        </label>
      </ConfirmDialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Storage and backup
// ---------------------------------------------------------------------------

interface PendingImport {
  state: AppState;
  counts: { mothers: number; events: number };
  fileName: string;
}

export function StorageSection() {
  const toast = useToast();
  const { state, dispatch } = useApp();
  const bridge = useBridgeStatus();
  const { st, enc } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<PendingImport | null>(null);
  const [encFile, setEncFile] = useState<{ env: unknown; name: string } | null>(null);
  const [encPass, setEncPass] = useState('');
  const [problems, setProblems] = useState<string[] | null>(null);
  const shared = bridge.status?.kind === 'artifact' || bridge.status?.kind === 'http';
  const events = state.mothers.reduce((n, m) => n + m.events.length, 0);

  const check = (raw: unknown, name: string) => {
    const r = validateImportedState<AppState>(raw);
    if (!r.ok || !r.state) {
      setProblems(r.problems.length ? r.problems : ['This file is not a Gaskin backup.']);
      return;
    }
    setProblems(null);
    setPending({ state: r.state, counts: r.counts ?? { mothers: r.state.mothers.length, events: 0 }, fileName: name });
  };
  const pick = async (f: File) => {
    if (f.size > MAX_IMPORT_BYTES) return setProblems(['That file is too large to be a Gaskin backup.']);
    try {
      const parsed = JSON.parse(await f.text()) as Record<string, unknown>;
      if (isEncrypted(parsed)) return setEncFile({ env: parsed, name: f.name });
      const inner = (parsed.state ?? parsed.data ?? parsed) as Record<string, unknown>;
      if (isEncrypted(inner)) return setEncFile({ env: inner, name: f.name });
      check(inner, f.name);
    } catch {
      setProblems(['That file could not be read. Choose a Gaskin backup file (.json).']);
    }
  };
  const exportData = async () => {
    const data = JSON.stringify({ app: 'gaskin', schema: SCHEMA, exportedAt: new Date().toISOString(), state }, null, 2);
    const r = await saveFile(`gaskin-backup-${state.clock.slice(0, 10)}.json`, data, 'application/json');
    toast(r === 'declined' ? 'Backup cancelled.' : 'Backup ready to save.');
  };

  return (
    <div className="grid gap-6" data-testid="storage-section">
      <SectionHeader title="Storage and backup" lede="Where records are kept, and copies in case a phone is lost or a stick breaks." icon={Database02} />
      <div className="grid gap-3 sm:grid-cols-3" data-testid="storage-panel">
        <div className="rounded-2xl bg-primary p-4 ring-1 ring-secondary ring-inset sm:col-span-2">
          <p className="flex items-center gap-2 text-sm text-tertiary">
            <span aria-hidden="true" className={cx('size-2 rounded-full', bridge.localOnly ? 'bg-warning-solid' : 'bg-success-solid')} />
            Kept in
          </p>
          <p className="mt-1 text-lg font-semibold text-primary">{bridge.status?.label ?? st?.where ?? 'This device'}</p>
          {st ? (
            <p className="mt-1 text-sm text-tertiary" data-testid="storage-message">
              {st.message}
              {st.persisted ? ' The browser will not clear it.' : ''}
            </p>
          ) : null}
          {bridge.status?.fallbackReason ? <p className="mt-1 text-sm text-tertiary">{bridge.status.fallbackReason}</p> : null}
        </div>
        <div className="rounded-2xl bg-primary p-4 ring-1 ring-secondary ring-inset">
          <p className="text-sm text-tertiary">Records</p>
          <p className="mt-1 text-display-xs font-semibold text-primary tnum">{state.mothers.length}</p>
          <p className="text-sm text-tertiary tnum">{events.toLocaleString('en-GB')} entries</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <span className={cx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-medium ring-1 ring-inset', enc ? 'bg-success-primary text-success-primary ring-success_subtle' : 'bg-secondary text-secondary ring-secondary')}>
          <Lock01 aria-hidden="true" className="size-4" />
          {enc ? 'Encrypted' : 'Not encrypted'}
        </span>
        <span className={cx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-medium ring-1 ring-inset', st?.backupDue ? 'bg-warning-primary text-warning-primary ring-border-warning_subtle' : 'bg-secondary text-secondary ring-secondary')}>
          <RefreshCw01 aria-hidden="true" className="size-4" />
          {st?.lastBackupAt ? `Last backup ${new Date(st.lastBackupAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : 'No backup yet'}
          {st?.backupDue ? ', one is due' : ''}
        </span>
      </div>
      {!shared ? (
        <Group title="Where to save">
          {st?.mode !== 'folder' ? (
            <Row
              label="Save to a folder or USB stick"
              hint="Records travel with the stick and open on any computer. Gaskin keeps the last 10 copies."
              icon={Save01}
              onPress={async () => {
                const s = await getAppStore();
                const ok = await s.chooseFolder().catch(() => false);
                toast(ok ? 'Records now save to that folder.' : 'This browser cannot save to a folder. Records stay here, with backup files.');
              }}
            />
          ) : (
            <Row
              label="Reconnect the folder"
              hint="Needed after the browser restarts."
              icon={Save01}
              onPress={async () => {
                const s = await getAppStore();
                await s.reconnectFolder().catch(() => false);
              }}
            />
          )}
          <Row
            label="Save a backup file now"
            icon={Download01}
            onPress={async () => {
              const s = await getAppStore();
              const ok = await s.exportFile().catch(() => false);
              toast(ok ? 'Backup file saved.' : 'The backup could not be saved.');
            }}
          />
        </Group>
      ) : (
        <Callout tone="gray">{bridge.status?.kind === 'artifact' ? 'Everyone with the link sees the same synthetic mothers. Your changes save to the shared workspace when you may edit it.' : 'Changes sync to the Gaskin server and wait on this device while offline.'}</Callout>
      )}
      <Group title="Move records" note="Keys and PINs are never included in an export.">
        <Row label="Export a backup" hint="Every record on this device as one file." icon={Download01} onPress={exportData} testId="export-backup" />
        <Row label="Import a backup" hint="Checked before anything changes. You see what will be replaced first." icon={Upload01} onPress={() => fileRef.current?.click()} testId="import-backup" />
      </Group>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        hidden
        id="import-file"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void pick(f);
          e.target.value = '';
        }}
      />
      {problems ? (
        <Callout tone="error" icon={AlertTriangle} testId="import-problems">
          <p className="font-semibold">Nothing was changed.</p>
          <ul className="mt-1 list-disc pl-5">
            {problems.slice(0, 5).map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </Callout>
      ) : null}
      <ConfirmDialog
        open={Boolean(encFile)}
        title="This backup is encrypted"
        confirmLabel="Open backup"
        tone="primary"
        confirmDisabled={!encPass}
        onCancel={() => (setEncFile(null), setEncPass(''))}
        onConfirm={async () => {
          const f = encFile!;
          try {
            const { data } = await decryptWithPassphrase<Record<string, unknown>>(f.env as never, encPass);
            setEncFile(null);
            setEncPass('');
            check((data as Record<string, unknown>).state ?? data, f.name);
          } catch (e) {
            toast((e as Error).message || 'That passphrase is not right.');
          }
        }}
      >
        <p>Type the passphrase it was saved with.</p>
        <input type="password" aria-label="Passphrase" value={encPass} onChange={(e) => setEncPass(e.target.value)} className="h-11 rounded-lg bg-primary px-3 text-md text-primary ring-1 ring-primary outline-hidden ring-inset focus:ring-2 focus:ring-brand" />
      </ConfirmDialog>
      <ConfirmDialog
        open={Boolean(pending)}
        title="Replace the records on this device?"
        confirmLabel="Replace with this backup"
        onCancel={() => setPending(null)}
        onConfirm={() => {
          const pnd = pending!;
          setPending(null);
          dispatch({ type: 'import', state: { ...pnd.state, schema: SCHEMA } });
          toast(`Imported ${pnd.counts.mothers} mothers and ${pnd.counts.events.toLocaleString('en-GB')} entries.`);
        }}
      >
        {pending ? (
          <>
            <p>
              <span className="font-medium text-primary">{pending.fileName}</span> was checked and is safe to open.
            </p>
            <div className="grid grid-cols-2 gap-3" data-testid="import-compare">
              <div className="rounded-xl bg-secondary p-3">
                <p className="text-xs text-tertiary">Now on this device</p>
                <p className="text-lg font-semibold text-primary tnum">{state.mothers.length} mothers</p>
                <p className="text-xs text-tertiary tnum">{events.toLocaleString('en-GB')} entries</p>
              </div>
              <div className="rounded-xl bg-brand-primary p-3">
                <p className="text-xs text-brand-secondary">In the backup</p>
                <p className="text-lg font-semibold text-primary tnum">{pending.counts.mothers} mothers</p>
                <p className="text-xs text-tertiary tnum">{pending.counts.events.toLocaleString('en-GB')} entries</p>
              </div>
            </div>
            <p>Everything now on this device is replaced. Export a backup first if you may need it.</p>
          </>
        ) : null}
      </ConfirmDialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Run setup again
// ---------------------------------------------------------------------------

export function SetupAgainSection() {
  const saved = useSetup();
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="grid gap-6" data-testid="setup-section">
      <SectionHeader title="Run setup again" lede="Answer the questions again, for a new phone, a new place or a new way of working. Records and workers stay." icon={RefreshCw01} />
      {saved ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            ['Runs', saved.plan.run.label],
            ['Place', `${saved.plan.region ? `${saved.plan.region}, ` : ''}${saved.plan.countryName}`],
            ['Languages', `${languageName(saved.plan.languages.ui)} for you; ${saved.plan.languages.mothers.map((l) => languageName(l)).join(', ')} for mothers`],
            ['AI', saved.plan.ai.label],
          ].map(([k, v]) => (
            <div key={k} className="rounded-2xl bg-primary p-4 ring-1 ring-secondary ring-inset">
              <p className="text-sm text-tertiary">{k}</p>
              <p className="mt-1 text-md font-semibold text-primary">{v}</p>
            </div>
          ))}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <SmallButton tone="primary" icon={RefreshCw01} onPress={() => setConfirm(true)} testId="run-setup-again">
          Run setup again
        </SmallButton>
        <SmallButton icon={Download01} onPress={async () => void (await saveFile('gaskin-setup.json', JSON.stringify(saved?.plan ?? {}, null, 2), 'application/json'))}>
          Save my setup
        </SmallButton>
      </div>
      <ConfirmDialog
        open={confirm}
        title="Run setup again?"
        confirmLabel="Start setup"
        tone="primary"
        onCancel={() => setConfirm(false)}
        onConfirm={() => {
          setConfirm(false);
          resetSetup();
          toast('Setup will start again.');
        }}
      >
        <p>Your records, workers and PINs stay. Setup asks the questions again and can change languages, AI and where records are kept.</p>
      </ConfirmDialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// About and legal (short; the full page is About)
// ---------------------------------------------------------------------------

export function LegalSection({ onOpenAbout }: { onOpenAbout: () => void }) {
  const [open, setOpen] = useState<'licence' | 'notices' | null>(null);
  return (
    <div className="grid gap-6" data-testid="legal-section">
      <SectionHeader title="About and legal" icon={Scale01} />
      <Group>
        <Row label="About Gaskin" hint="What it is, how it builds a plan, who made it" icon={BookOpen01} onPress={onOpenAbout} testId="open-about" />
        <Row label="Disclaimers" hint="A prototype with synthetic data. The care rules are waiting for clinical review. Not for patient care yet." icon={AlertTriangle} />
        <Row label="Licences" hint="Code: AGPL-3.0-only. Clinical content, pictures and language packs: CC BY 4.0." icon={Scale01} onPress={() => setOpen(open === 'licence' ? null : 'licence')} />
        {open === 'licence' ? (
          <div className="bg-secondary p-4 text-sm text-secondary">
            Anyone may run, change and share Gaskin. Anyone who offers a changed version as a service must publish their changes too. Content may be reused with credit to Gaskin.
          </div>
        ) : null}
        <Row label="Third-party notices" hint="Untitled UI, React Aria, Inter, Animata and others" icon={BookOpen01} onPress={() => setOpen(open === 'notices' ? null : 'notices')} />
        {open === 'notices' ? (
          <ul className="grid gap-1 bg-secondary p-4 text-sm text-secondary">
            {NOTICES.map(([n, l]) => (
              <li key={n} className="flex justify-between gap-3">
                <span>{n}</span>
                <span className="text-tertiary">{l}</span>
              </li>
            ))}
          </ul>
        ) : null}
        <Row label="Version" hint={`Gaskin ${VERSION}, data schema ${SCHEMA}`} icon={CheckCircle} />
      </Group>
    </div>
  );
}

export const VERSION = '0.2.0';
export const NOTICES: Array<[string, string]> = [
  ['React and React DOM', 'MIT'],
  ['Untitled UI React and icons', 'MIT'],
  ['React Aria, React Stately', 'Apache-2.0'],
  ['Tailwind CSS (build only)', 'MIT'],
  ['tailwind-merge', 'MIT'],
  ['Animata components', 'MIT'],
  ['Inter typeface', 'SIL OFL 1.1'],
  ['Ghana district names (ghana-geo-data, Wikipedia)', 'CC BY-SA 4.0'],
  ['geoBoundaries, CLDR and ISO 3166 place data', 'CC BY 4.0, CC BY 3.0 IGO, Unicode-3.0, MIT'],
  ['Model Context Protocol SDK', 'MIT'],
];
