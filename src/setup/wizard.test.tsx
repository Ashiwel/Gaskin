import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { OnboardingWizard } from './components/OnboardingWizard';
import { applySetupPlan } from './apply';
import { recommendSetup } from './recommend';
import { setupStore } from './store';
import { st } from './strings';
import { connectAssistant, setAssistantConnector } from './assistant';
import type { GaskinStore } from '../storage';

describe('OnboardingWizard (server render)', () => {
  it('opens on the language question with large options, progress dots and setup- classes', () => {
    const html = renderToStaticMarkup(<OnboardingWizard onComplete={() => undefined} env={{}} />);
    expect(html).toContain('Which language do you want Gaskin in?');
    expect(html).toContain('setup-option');
    expect(html).toContain('setup-dot');
    expect(html).toContain('Kiswahili');
    expect(html).toContain('<svg');
  });

  it('shows the next question in the chosen language', () => {
    const html = renderToStaticMarkup(<OnboardingWizard onComplete={() => undefined} env={{}} initialAnswers={{ workerLanguage: 'sw' }} />);
    expect(html).toContain('lang="sw"');
  });
});

describe('strings', () => {
  it('falls back to English for missing keys and fills placeholders', () => {
    expect(st('step', 'sw', { n: 2, total: 14 })).toBe('Swali 2 kati ya 14');
    expect(st('step', 'other', { n: 2, total: 14 })).toBe('Question 2 of 14');
    expect(st('q.devices' as never, 'zh')).toBe('您工作时可以使用什么设备？');
  });
});

describe('connectAssistant', () => {
  it('stub offers the Claude Desktop extension download and a copyable address for others; replaceable', async () => {
    const d = await connectAssistant('claude_desktop');
    expect(d.kind).toBe('download');
    expect(d.fileName).toMatch(/\.mcpb$/);
    const w = await connectAssistant('chatgpt');
    expect(w.kind).toBe('address');
    setAssistantConnector(async (target) => ({ target, kind: 'address', address: 'https://example.test/mcp', steps: [], connected: true }));
    expect((await connectAssistant('claude_web')).connected).toBe(true);
    setAssistantConnector(null);
  });
});

describe('applySetupPlan', () => {
  it('installs packs, sets AI with de-identification, falls back without a key, loads the place and saves the setup', async () => {
    const plan = recommendSetup(
      { workerLanguage: 'en', country: 'NG', region: 'Benue', role: 'midwife', devices: ['android_phone'], internet: 'fourg', dataBudget: 'medium', aiApps: ['chatgpt'], aiPay: 'programme', techComfort: 3, mothersLanguages: ['ha', 'pcm'] },
      {},
    );
    expect(plan.ai.mode).toBe('own_key');
    const installed: string[] = [];
    const configured: unknown[] = [];
    let mode = 'browser';
    const fakeStore = { setMode: async (m: string) => void (mode = m), chooseFolder: async () => false, status: () => ({ message: '' }) } as unknown as GaskinStore<unknown>;
    const steps: string[] = [];
    const res = await applySetupPlan(plan, { country: 'NG', region: 'Benue' }, {
      onProgress: (p) => steps.push(`${p.step}:${p.state}`),
      deps: {
        installPack: (async (code: string) => void installed.push(code)) as never,
        configureAI: ((s: unknown) => (configured.push(s), s)) as never,
        getStore: async () => fakeStore,
      },
    });
    expect(installed).toEqual(['ha', 'pcm']);
    expect(configured[0]).toEqual({ mode: 'any_app' }); // no key typed: copy and paste
    expect(res.location?.id).toBe('NG-benue');
    expect(mode).toBe('browser');
    expect(steps).toContain('ai:fallback');
    expect(setupStore.get()?.plan.region).toBe('Benue');
  });

  it('uses the key when given', async () => {
    const plan = recommendSetup({ country: 'GH', region: 'Ashanti', devices: ['android_phone'], internet: 'wifi', dataBudget: 'large', aiApps: ['gemini'], aiPay: 'me', techComfort: 4 }, {});
    const configured: Array<{ mode: string; ownKey?: { apiKey: string; kind: string } }> = [];
    const fakeStore = { setMode: async () => undefined, chooseFolder: async () => false, status: () => ({ message: '' }) } as unknown as GaskinStore<unknown>;
    await applySetupPlan(plan, {}, { apiKey: ' AIza-test ', deps: { installPack: (async () => undefined) as never, configureAI: ((s: never) => (configured.push(s), s)) as never, getStore: async () => fakeStore } });
    expect(configured[0].mode).toBe('own_key');
    expect(configured[0].ownKey).toMatchObject({ kind: 'gemini', apiKey: 'AIza-test' });
  });
});
