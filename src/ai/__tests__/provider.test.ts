import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { _resetAI, configureAI, getAIProvider, getAIStatus, onManualRequest, submitManualReply, cancelManualRequest, getAIAuditLog } from '..';
import { _resetManual } from '../providers/manual';
import { _resetAIStatus } from '../status';
import { setPrivacyDirectory } from '../../privacy';
import { DIRECTORY, EMERGENCY_ALERT, mother, plan } from './fixtures';

const g = globalThis as unknown as { window?: unknown };

beforeEach(() => {
  _resetAI();
  _resetAIStatus();
  _resetManual();
  setPrivacyDirectory(DIRECTORY);
});
afterEach(() => {
  delete g.window;
  vi.unstubAllGlobals();
});

describe('getAIProvider selection', () => {
  it('returns the template provider when window.claude is absent', async () => {
    const p = await getAIProvider();
    expect(p.id).toBe('template');
    expect(p.live).toBe(false);
    expect(getAIStatus().provider).toBe('template');
  });

  it('returns the template provider when window exists without claude', async () => {
    g.window = {};
    const p = await getAIProvider();
    expect(p.id).toBe('template');
  });

  it('uses Claude via sample when available, and falls back permanently on not_granted', async () => {
    const sample = vi.fn(async () => {
      throw { code: 'not_granted', message: 'declined' };
    });
    g.window = { claude: { use: async (n: string) => (n === 'sample' ? sample : null) } };
    const p = await getAIProvider();
    expect(p.id).toBe('claude-sample');
    const m = mother();
    const msg = await p.personaliseMessage({ plan: plan(m), mother: m, channel: 'sms', language: 'en', itemIds: [] });
    expect(msg).toMatch(/Adaeze/); // template result
    expect(getAIStatus().live).toBe(false);
    expect(getAIStatus().lastError).toMatch(/not allowed/);
    // Second call does not hit sample again
    await p.personaliseMessage({ plan: plan(m), mother: m, channel: 'sms', language: 'en', itemIds: [] });
    expect(sample).toHaveBeenCalledTimes(1);
  });

  it('honours mode none even inside Claude', async () => {
    g.window = { claude: { use: async () => vi.fn() } };
    configureAI({ mode: 'none' });
    const p = await getAIProvider();
    expect(p.id).toBe('template');
    expect(getAIStatus().mode).toBe('none');
  });

  it('selects own_key providers from settings', async () => {
    configureAI({ mode: 'own_key', ownKey: { kind: 'anthropic', model: 'claude-haiku-4-5', apiKey: 'sk-test' } });
    expect((await getAIProvider()).id).toBe('anthropic');
    configureAI({ mode: 'own_key', ownKey: { kind: 'gemini', model: 'gemini-2.0-flash', apiKey: 'k' } });
    expect((await getAIProvider()).id).toBe('gemini');
    configureAI({ mode: 'own_key', ownKey: { kind: 'openai_compatible', baseUrl: 'https://api.groq.com/openai/v1', model: 'llama', apiKey: 'k' } });
    expect((await getAIProvider()).id).toBe('openai-compatible');
    configureAI({ mode: 'on_device', onDevice: { kind: 'local_server', baseUrl: 'http://localhost:11434/v1', model: 'qwen2.5:3b' } });
    expect((await getAIProvider()).id).toBe('on-device-server');
    configureAI({ mode: 'any_app' });
    expect((await getAIProvider()).id).toBe('any-app');
  });

  it('rejects incomplete settings with a plain message', () => {
    expect(() => configureAI({ mode: 'own_key' })).toThrow(/API key/);
  });

  it('sends a de-identified prompt to an OpenAI-compatible server and restores her name locally', async () => {
    const bodies: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: { body: string }) => {
        bodies.push(init.body);
        return new Response(JSON.stringify({ choices: [{ message: { content: 'Hello [MOTHER], take one ferrous sulphate 200 mg tablet and folic acid 400 mcg every day. [WORKER], [FACILITY]' } }] }), { status: 200 });
      }),
    );
    configureAI({ mode: 'own_key', ownKey: { kind: 'openai_compatible', baseUrl: 'https://example.org/v1', model: 'm', apiKey: 'k' } });
    const p = await getAIProvider();
    const m = mother();
    const out = await p.personaliseMessage({ plan: plan(m), mother: m, channel: 'sms', language: 'en', itemIds: ['med.iron_folate'] });
    expect(out).toBe('Hello Adaeze, take one ferrous sulphate 200 mg tablet and folic acid 400 mcg every day. Fatima, Nsukka Primary Health Centre');
    const sent = bodies.join('\n');
    for (const leak of ['Adaeze', 'Okafor', 'Nsukka', '0142', 'Fatima', 'Bello', 'm-ng-001', '2026-']) expect(sent).not.toContain(leak);
    const log = getAIAuditLog();
    expect(log.at(-1)).toMatchObject({ provider: 'openai-compatible', task: 'personalise', outcome: 'sent', deidentified: true });
    expect(log.at(-1)!.bytes).toBeGreaterThan(100);
  });
});

describe('copy-and-paste (any_app) round trip', () => {
  it('emits a de-identified request, accepts a pasted reply and validates it', async () => {
    configureAI({ mode: 'any_app' });
    const p = await getAIProvider();
    const m = mother();
    const reqs: Array<{ id: string; task: string; prompt: string }> = [];
    const off = onManualRequest((r) => reqs.push(r));
    const pending = p.personaliseMessage({ plan: plan(m), mother: m, channel: 'sms', language: 'pcm', itemIds: ['med.iron_folate', 'visit.anc'] });
    await vi.waitFor(() => expect(reqs).toHaveLength(1));
    expect(reqs[0].task).toBe('personalise');
    expect(reqs[0].prompt).toContain('[MOTHER]');
    expect(reqs[0].prompt).not.toMatch(/Adaeze|Okafor|Nsukka/);
    expect(reqs[0].prompt.length).toBeLessThan(1500);
    expect(submitManualReply(reqs[0].id, '[MOTHER], abeg take one ferrous sulphate 200 mg tablet and folic acid 400 mcg every day. Come clinic for 30 weeks. [WORKER], [FACILITY]')).toBe(true);
    await expect(pending).resolves.toMatch(/^Adaeze, abeg take one ferrous sulphate 200 mg/);
    off();
  });

  it('falls back to the template when a pasted reply fails guardrails', async () => {
    configureAI({ mode: 'any_app' });
    const p = await getAIProvider();
    const m = mother();
    const pl = plan(m, {}, [EMERGENCY_ALERT]);
    let id = '';
    const off = onManualRequest((r) => (id = r.id));
    const pending = p.personaliseMessage({ plan: pl, mother: m, channel: 'sms', language: 'en', itemIds: [] });
    await vi.waitFor(() => expect(id).not.toBe(''));
    submitManualReply(id, 'Hi [MOTHER], headaches are normal, no need to go anywhere. Take paracetamol 1000 mg.');
    const out = await pending;
    expect(out).toMatch(/Go to the nearest hospital NOW/);
    expect(getAIStatus().lastError).toMatch(/replaced by the template/);
    off();
  });

  it('uses the template when the worker cancels', async () => {
    configureAI({ mode: 'any_app' });
    const p = await getAIProvider();
    let id = '';
    const off = onManualRequest((r) => (id = r.id));
    const pending = p.translate({ texts: { a: 'Sleep on your left side.' }, language: 'pcm' });
    await vi.waitFor(() => expect(id).not.toBe(''));
    cancelManualRequest(id);
    await expect(pending).resolves.toEqual({ a: 'Sleep for your left side.' }); // template Pidgin
    off();
  });

  it('does not send explanation or suggestion tasks in constrained modes', async () => {
    configureAI({ mode: 'any_app' });
    const p = await getAIProvider();
    const m = mother();
    let fired = false;
    const off = onManualRequest(() => (fired = true));
    const text = await p.explainPlan({ plan: plan(m), mother: m });
    expect(text).toMatch(/Adaeze is pregnant, 29 weeks/);
    expect(await p.suggestItems({ plan: plan(m), mother: m })).toEqual([]);
    expect(fired).toBe(false);
    off();
  });
});
