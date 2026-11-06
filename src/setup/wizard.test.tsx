import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { OnboardingWizard } from './components/OnboardingWizard';
import { allLanguages, emergencyFor, languagesFor, listCountries } from '../ui/onboarding/geo';
import { applySetupPlan } from './apply';
import { recommendSetup } from './recommend';
import { setupStore } from './store';
import { st } from './strings';
import { connectAssistant, setAssistantConnector } from './assistant';
import type { GaskinStore } from '../storage';

describe('OnboardingWizard (server render)', () => {
  it('opens on "Who will use Gaskin?" with large options, icons, a progress bar and setup-root', () => {
    const html = renderToStaticMarkup(<OnboardingWizard onComplete={() => undefined} env={{}} />);
    expect(html).toContain('Who will use Gaskin?');
    expect(html).toContain('setup-root');
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('Myself or my family');
    expect(html).toContain('A health worker');
    expect(html).toContain('<svg');
  });

  it('renders in the chosen language', () => {
    const html = renderToStaticMarkup(<OnboardingWizard onComplete={() => undefined} env={{}} initialAnswers={{ workerLanguage: 'sw' }} />);
    expect(html).toContain('lang="sw"');
  });
});

describe('languages come from the place', () => {
  it('South Africa never offers Nigerian languages; Nigeria does', () => {
    const nigerian = ['ha', 'yo', 'ig', 'pcm', 'bin', 'urh', 'ff'];
    const za = languagesFor({ country: 'ZA', region: 'Gauteng' }).map((l) => l.code);
    expect(za.length).toBeGreaterThan(0);
    expect(za.filter((c) => nigerian.includes(c))).toEqual([]);
    const zaAll = allLanguages({ country: 'ZA', region: 'Gauteng' }).map((l) => l.code);
    expect(zaAll.filter((c) => nigerian.includes(c))).toEqual([]);
    const ng = languagesFor({ country: 'NG', region: 'Lagos' }).map((l) => l.code);
    expect(ng[0]).toBe('yo');
    expect(ng).toContain('en');
  });

  it('a Kenyan place leads with Kiswahili, a Ghanaian one never with Hausa first', () => {
    expect(languagesFor({ country: 'KE', region: 'Nairobi' })[0].code).toBe('sw');
    expect(languagesFor({ country: 'GH', region: 'Ashanti' })[0].code).toBe('tw');
  });

  it('lists every country, Nigeria, Ghana and Kenya first', () => {
    const cs = listCountries();
    expect(cs.slice(0, 3).map((c) => c.code)).toEqual(['NG', 'GH', 'KE']);
    expect(cs.length).toBeGreaterThan(190);
  });

  it('shows the emergency number for her country from src/legal (Ghana 112)', () => {
    expect(emergencyFor('GH').number).toBe('112');
    expect(emergencyFor('ZA').number).toMatch(/10177/);
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
