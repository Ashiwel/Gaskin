import { useEffect, useState } from 'react';
import { Sheet, useToast } from './components';
import { onManual, submitManual, type ManualRequest } from './ai';
import { ICheckCircle, ICopy, IWarnCircle } from './icons';

/** Copy-and-paste AI: shows the prompt, takes the reply, checks it, then hands it back. */
export function ManualAIHost() {
  const [req, setReq] = useState<ManualRequest | null>(null);
  const [reply, setReply] = useState('');
  const toast = useToast();
  useEffect(() => onManual((r) => { setReq(r); setReply(''); }), []);
  if (!req) return null;
  const close = (accept: boolean) => {
    submitManual(req.id, accept ? reply : null);
    setReq(null);
    setReply('');
  };
  // Light checks that do not need the plan: length, no phone numbers, no dosage units.
  const issues: string[] = [];
  if (reply.trim()) {
    if (/\b\d{7,}\b/.test(reply)) issues.push('Contains what looks like a phone number');
    if (/\b\d+\s?(mg|ml|mcg|iu)\b/i.test(reply) && req.task !== 'extract') issues.push('Mentions a medicine dose. Check it against her plan');
    if (reply.length > 4000) issues.push('Very long. Consider trimming');
  }
  return (
    <Sheet
      title="Use any AI app"
      onClose={() => close(false)}
      label="Copy and paste AI"
      footer={
        <>
          <button className="btn ghost" onClick={() => close(false)}>
            Discard
          </button>
          <button className="btn primary" disabled={!reply.trim()} onClick={() => close(true)}>
            Use this answer
          </button>
        </>
      }
    >
      <section className="section">
        <span className="t-label">1. Copy this prompt</span>
        <p className="small soft">{req.instructions ? `${req.instructions} ` : ''}Names, phone numbers, places and dates have already been removed.</p>
        <pre className="code" style={{ maxHeight: 220 }}>
          {req.prompt}
        </pre>
        <div>
          <button
            className="btn small"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(req.prompt);
                toast('Prompt copied. Paste it into your AI app.');
              } catch {
                toast('Copy is blocked here. Select the text and copy it.');
              }
            }}
          >
            <ICopy /> Copy prompt
          </button>
        </div>
      </section>
      <section className="section">
        <span className="t-label">2. Paste the answer</span>
        <textarea className="textarea" id="manual-reply" style={{ minHeight: 160 }} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Paste the AI app’s answer here" />
      </section>
      {reply.trim() ? (
        <section className="section">
          <span className="t-label">3. Checks</span>
          <ul className="guard">
            {issues.length === 0 ? (
              <li className="ok">
                <ICheckCircle /> No phone numbers, doses or other problems found. You will review it again before sending.
              </li>
            ) : (
              issues.map((i) => (
                <li key={i} className="bad">
                  <IWarnCircle /> {i}
                </li>
              ))
            )}
          </ul>
        </section>
      ) : null}
    </Sheet>
  );
}
