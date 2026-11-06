/**
 * Copy-and-paste AI: three steps (copy the prompt, paste the answer, see the checks), then the
 * answer goes back to Gaskin, which runs its own guardrails before anything is sent.
 */
import { useEffect, useState } from 'react';
import { Copy01 } from '@untitledui/icons';
import { Button } from '../components/base/buttons/button';
import { useToast } from './components';
import { onManual, submitManual, type ManualRequest } from './ai';
import { Panel, StepHead } from './messages/Panel';
import { CheckRow } from './messages/kit';

export function ManualAIHost() {
  const [req, setReq] = useState<ManualRequest | null>(null);
  const [reply, setReply] = useState('');
  const toast = useToast();
  useEffect(
    () =>
      onManual((r) => {
        setReq(r);
        setReply('');
      }),
    [],
  );
  if (!req) return null;
  const close = (accept: boolean) => {
    submitManual(req.id, accept ? reply : null);
    setReq(null);
    setReply('');
  };
  // Light checks that do not need the plan: no phone numbers, no doses, not too long.
  const checks: Array<{ ok: boolean; text: string }> = reply.trim()
    ? [
        { ok: !/\b\d{7,}\b/.test(reply), text: /\b\d{7,}\b/.test(reply) ? 'Contains what looks like a phone number' : 'No phone numbers' },
        {
          ok: !(/\b\d+\s?(mg|ml|mcg|iu)\b/i.test(reply) && req.task !== 'extract'),
          text: /\b\d+\s?(mg|ml|mcg|iu)\b/i.test(reply) && req.task !== 'extract' ? 'Mentions a medicine dose. Check it against her plan' : 'No medicine doses',
        },
        { ok: reply.length <= 4000, text: reply.length > 4000 ? 'Very long. Consider trimming' : 'A sensible length' },
      ]
    : [];
  return (
    <Panel
      title="Use any AI app"
      subtitle="Names, phone numbers, places and dates have already been removed."
      onClose={() => close(false)}
      label="Copy and paste AI"
      testId="manual-ai"
      footer={
        <>
          <Button color="tertiary" onClick={() => close(false)}>
            Discard
          </Button>
          <Button color="primary" isDisabled={!reply.trim()} onClick={() => close(true)}>
            Use this answer
          </Button>
        </>
      }
    >
      <div className="grid gap-8">
        <section>
          <StepHead n={1} title="Copy this prompt" />
          {req.instructions ? <p className="mb-3 text-sm text-tertiary">{req.instructions}</p> : null}
          <pre className="max-h-56 overflow-auto rounded-xl bg-secondary p-3.5 font-mono text-xs leading-relaxed whitespace-pre-wrap text-secondary ring-1 ring-secondary">{req.prompt}</pre>
          <Button
            className="mt-3"
            size="sm"
            color="secondary"
            iconLeading={Copy01}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(req.prompt);
                toast('Prompt copied. Paste it into your AI app.');
              } catch {
                toast('Copy is blocked here. Select the text and copy it.');
              }
            }}
          >
            Copy prompt
          </Button>
        </section>
        <section>
          <StepHead n={2} title="Paste the answer" />
          <label htmlFor="manual-reply" className="sr-only">
            The AI app’s answer
          </label>
          <textarea
            id="manual-reply"
            className="min-h-40 w-full rounded-xl bg-primary p-3.5 text-md text-primary shadow-xs ring-1 ring-primary outline-none ring-inset focus-visible:ring-2 focus-visible:ring-brand"
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Paste the AI app’s answer here"
          />
        </section>
        {checks.length ? (
          <section>
            <StepHead n={3} title="Checks" />
            <ul className="divide-y divide-border-secondary rounded-xl bg-primary px-3.5 ring-1 ring-secondary">
              {checks.map((c) => (
                <CheckRow key={c.text} status={c.ok ? 'ok' : 'warn'}>
                  {c.text}
                </CheckRow>
              ))}
            </ul>
            <p className="mt-2 text-xs text-tertiary">You will review it again before anything is sent.</p>
          </section>
        ) : null}
      </div>
    </Panel>
  );
}
