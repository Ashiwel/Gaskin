import type { Mother } from '../types';
import { useApp } from '../store';
import { TRIAGE_LABELS } from '../store/triage';
import { SYMPTOM_LABELS } from '../clinical';
import { useNav } from './nav';
import { Empty } from './components';
import { CHANNEL_LABELS, fmtDateTime } from './format';
import { IMessage, IPhone } from './icons';

export function MessagesTab({ mother, onCompose }: { mother: Mother; onCompose: () => void }) {
  const { state } = useApp();
  const { go } = useNav();
  type Row = { at: string; dir: 'out' | 'in'; node: React.ReactNode };
  const rows: Row[] = [];
  for (const o of state.outbound.filter((x) => x.motherId === mother.id)) {
    const meta = state.messageMeta[o.id];
    rows.push({
      at: o.createdAt,
      dir: 'out',
      node: (
        <>
          <div className="small muted">
            {CHANNEL_LABELS[o.channel] ?? o.channel} to {meta?.recipient === 'carer' ? meta.recipientName ?? 'family carer' : 'her'} · {fmtDateTime(o.createdAt)}
            {o.aiAssisted ? ' · written with AI, reviewed' : ''}
          </div>
          {meta?.subject ? <strong>{meta.subject}</strong> : null}
          <p style={{ whiteSpace: 'pre-wrap' }}>{o.body}</p>
          <div className="chips">
            <span className={`chip ${o.status === 'read' || o.status === 'delivered' ? 'green' : o.status === 'queued' ? 'amber' : ''}`}>
              {o.status === 'queued' ? 'Waiting for signal' : o.status[0].toUpperCase() + o.status.slice(1)}
            </span>
            {meta?.smsFallback ? <span className="chip red">Danger sign SMS, sent without data</span> : null}
            <span className="chip outline num">
              {o.segments ? `${o.segments} SMS · ` : ''}${o.estCostUSD.toFixed(3)}
            </span>
          </div>
        </>
      ),
    });
  }
  for (const i of state.inbound.filter((x) => x.motherId === mother.id)) {
    const t = state.inboundTriage[i.id];
    rows.push({
      at: i.receivedAt,
      dir: 'in',
      node: (
        <>
          <div className="small muted">
            From her by {CHANNEL_LABELS[i.channel] ?? i.channel} · {fmtDateTime(i.receivedAt)}
          </div>
          <p className="serif" style={{ fontSize: 17 }}>
            “{i.body}”
          </p>
          <div className="chips">
            {t ? <span className={`triage ${t}`}>{TRIAGE_LABELS[t]}</span> : null}
            {(i.parsedSymptoms ?? []).map((s) => (
              <span key={s} className="chip">
                {SYMPTOM_LABELS[s] ?? s}
              </span>
            ))}
          </div>
        </>
      ),
    });
  }
  rows.sort((a, b) => (a.at < b.at ? 1 : -1));
  return (
    <div className="section" style={{ gap: 18 }}>
      <div className="btn-row">
        <button className="btn primary" onClick={onCompose}>
          <IMessage /> Write a message
        </button>
        <button className="btn" onClick={() => go({ name: 'phone', id: mother.id })}>
          <IPhone /> See her phone
        </button>
      </div>
      {rows.length === 0 ? (
        <Empty art="phone_call" title="No messages yet">
          Messages you send and her replies appear here.
        </Empty>
      ) : (
        <ul className="support" style={{ gap: 18 }}>
          {rows.map((r, i) => (
            <li key={i} style={{ borderLeftColor: r.dir === 'in' ? 'var(--clay)' : 'var(--line-2)', display: 'grid', gap: 6 }}>
              {r.node}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
