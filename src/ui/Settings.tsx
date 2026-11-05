import { useRef, useState } from 'react';
import { useApp, SCHEMA, type AppState } from '../store';
import { getAISettings, PROVIDER_OPTIONS, type AISettings, type ProviderOption } from '../ai';
import { saveFile } from './HandoutSheet';
import { useToast } from './components';
import { AIBadge, configure, useAIStatus } from './ai';
import { ICheckCircle, IDownload, IUpload } from './icons';
import { AssistantSection, LanguagesSection, SetupSection, StorageSection } from './SettingsExtra';

const AI_KEY = 'gaskin.ai-settings.v1';

/** Restore saved AI settings on start. The key stays on this device only. */
export function restoreAISettings() {
  try {
    const raw = window.localStorage.getItem(AI_KEY);
    if (raw) configure(JSON.parse(raw));
  } catch {
    /* storage blocked or settings invalid: keep defaults */
  }
}

function persist(s: AISettings) {
  try {
    window.localStorage.setItem(AI_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

type CardId = AISettings['mode'];

interface Card {
  id: CardId;
  title: string;
  blurb: string;
  cost: string;
  needs: string;
  privacy: string;
}

const TITLES: Partial<Record<CardId, string>> = {
  none: 'No AI',
  claude_here: 'Use Claude here',
  own_key: 'Your own API key',
  on_device: 'On this device',
  any_app: 'Any AI app you already use',
  auto: 'Automatic',
};

function cards(): Card[] {
  const order: CardId[] = ['none', 'auto', 'claude_here', 'own_key', 'on_device', 'any_app'];
  const byId = new Map<string, ProviderOption>(PROVIDER_OPTIONS.map((o) => [o.id, o]));
  const out: Card[] = order
    .map((id) => byId.get(id))
    .filter((o): o is ProviderOption => Boolean(o))
    .map((o) => ({ id: o.id, title: TITLES[o.id] ?? o.label, blurb: o.description, cost: o.cost, needs: o.needs, privacy: o.privacy }));
  return out;
}

export function Settings() {
  const { state, dispatch } = useApp();
  const toast = useToast();
  const status = useAIStatus();
  const initial = getAISettings();
  const [mode, setMode] = useState<CardId>(initial.mode);
  const ownPresets = PROVIDER_OPTIONS.find((o) => o.id === 'own_key')?.presets ?? [];
  const devPresets = PROVIDER_OPTIONS.find((o) => o.id === 'on_device')?.presets ?? [];
  const [own, setOwn] = useState(() => ({
    kind: (initial.ownKey?.kind ?? 'openai_compatible') as NonNullable<AISettings['ownKey']>['kind'],
    baseUrl: initial.ownKey?.baseUrl ?? ownPresets[0]?.baseUrl ?? '',
    model: initial.ownKey?.model ?? ownPresets[0]?.model ?? '',
    apiKey: initial.ownKey?.apiKey ?? '',
  }));
  const [dev, setDev] = useState(() => ({
    kind: (initial.onDevice?.kind ?? 'local_server') as NonNullable<AISettings['onDevice']>['kind'],
    baseUrl: initial.onDevice?.baseUrl ?? devPresets[0]?.baseUrl ?? 'http://localhost:11434/v1',
    model: initial.onDevice?.model ?? devPresets[0]?.model ?? '',
  }));
  const [err, setErr] = useState('');
  const [deid, setDeid] = useState<boolean>(() => (initial as { deidentify?: boolean }).deidentify !== false && initial.onDevice?.deidentify !== false);
  const [confirmOff, setConfirmOff] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const list = cards();

  const apply = (s0: AISettings, label: string, deidentify = deid) => {
    const s = { ...s0, deidentify } as AISettings;
    if (s.onDevice) s.onDevice = { ...s.onDevice, deidentify };
    const e = configure(s);
    if (e) {
      setErr(e);
      return;
    }
    setErr('');
    persist(s);
    toast(`AI set to: ${label}`);
  };

  const choose = (c: Card) => {
    setMode(c.id);
    setErr('');
    if (c.id === 'own_key' || c.id === 'on_device') return; // these need the form below
    apply({ mode: c.id }, c.title);
  };

  const exportData = async () => {
    const data = JSON.stringify({ app: 'gaskin', schema: SCHEMA, exportedAt: new Date().toISOString(), state }, null, 2);
    const r = await saveFile(`gaskin-backup-${state.clock.slice(0, 10)}.json`, data, 'application/json');
    toast(r === 'declined' ? 'Export cancelled.' : 'Backup ready to save.');
  };

  const importData = async (f: File) => {
    try {
      const text = await f.text();
      const parsed = JSON.parse(text) as { app?: string; state?: AppState };
      const st = parsed.state;
      if (parsed.app !== 'gaskin' || !st || !Array.isArray(st.mothers)) throw new Error('not a Gaskin file');
      dispatch({ type: 'import', state: { ...st, schema: SCHEMA } });
      toast(`Imported ${st.mothers.length} mothers.`);
    } catch {
      toast('That file is not a Gaskin backup. Nothing was changed.');
    }
  };

  return (
    <div className="page">
      <header className="today-head">
        <h1 className="t-display">Settings</h1>
        <p className="lede">Many midwives cannot reach or pay for AI. Gaskin works fully without it, accepts AI from anywhere, and removes personal details before anything leaves the phone.</p>
      </header>

      <LanguagesSection />

      <section className="section">
        <div className="section-head">
          <h2 className="t-h2">AI</h2>
          <AIBadge />
        </div>
        {status.lastError ? <p className="small muted">{status.lastError}</p> : null}
        <div className="modes">
          {list.map((c) => (
            <button key={c.id} className="mode" aria-pressed={mode === c.id} onClick={() => choose(c)} data-mode={c.id}>
              {mode === c.id ? <ICheckCircle className="on" width={20} height={20} style={{ color: 'var(--green)' }} /> : null}
              <h3>{c.title}</h3>
              <p className="small soft">{c.blurb}</p>
              <dl>
                <div>
                  <dt>Cost</dt>
                  <dd>{c.cost}</dd>
                </div>
                <div>
                  <dt>Needs</dt>
                  <dd>{c.needs}</dd>
                </div>
                <div>
                  <dt>Privacy</dt>
                  <dd>{c.privacy}</dd>
                </div>
              </dl>
            </button>
          ))}
        </div>

        {mode === 'own_key' ? (
          <form
            className="panel section"
            onSubmit={(e) => {
              e.preventDefault();
              apply({ mode: 'own_key', ownKey: { ...own, baseUrl: own.baseUrl || undefined } }, 'Your own API key');
            }}
          >
            <h3 className="t-h3">Your own API key</h3>
            {ownPresets.length ? (
              <div className="chips">
                {ownPresets.map((p) => (
                  <button
                    type="button"
                    key={p.label}
                    className="filter-chip"
                    aria-pressed={own.model === p.model && own.kind === p.kind}
                    onClick={() => setOwn({ ...own, kind: p.kind as typeof own.kind, baseUrl: p.baseUrl ?? '', model: p.model })}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            ) : null}
            <div className="grid2">
              <label className="field">
                <span>Service type</span>
                <select className="select" id="byok-kind" value={own.kind} onChange={(e) => setOwn({ ...own, kind: e.target.value as typeof own.kind })}>
                  <option value="openai_compatible">OpenAI-compatible</option>
                  <option value="anthropic">Claude API</option>
                  <option value="gemini">Google Gemini</option>
                </select>
              </label>
              <label className="field">
                <span>Web address (base URL)</span>
                <input className="input" id="byok-url" value={own.baseUrl} onChange={(e) => setOwn({ ...own, baseUrl: e.target.value })} placeholder="https://api.example.com/v1" />
              </label>
              <label className="field">
                <span>Model</span>
                <input className="input" id="byok-model" value={own.model} onChange={(e) => setOwn({ ...own, model: e.target.value })} />
              </label>
              <label className="field">
                <span>Key</span>
                <input className="input" id="byok-key" type="password" autoComplete="off" value={own.apiKey} onChange={(e) => setOwn({ ...own, apiKey: e.target.value })} />
              </label>
            </div>
            <p className="small muted">The key is stored only on this device and is never included in backups.</p>
            {err ? <p className="note amber">{err}</p> : null}
            <div>
              <button className="btn primary small" type="submit">
                Save and use
              </button>
            </div>
          </form>
        ) : null}

        {mode === 'on_device' ? (
          <form
            className="panel section"
            onSubmit={(e) => {
              e.preventDefault();
              apply({ mode: 'on_device', onDevice: { kind: dev.kind, model: dev.model, baseUrl: dev.kind === 'local_server' ? dev.baseUrl : undefined } }, 'On this device');
            }}
          >
            <h3 className="t-h3">On this device or a facility hub</h3>
            {devPresets.length ? (
              <div className="chips">
                {devPresets.map((p) => (
                  <button
                    type="button"
                    key={p.label}
                    className="filter-chip"
                    aria-pressed={dev.model === p.model}
                    onClick={() => setDev({ kind: p.kind as typeof dev.kind, baseUrl: p.baseUrl ?? dev.baseUrl, model: p.model })}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            ) : null}
            <div className="grid2">
              <label className="field">
                <span>Where it runs</span>
                <select className="select" id="local-kind" value={dev.kind} onChange={(e) => setDev({ ...dev, kind: e.target.value as typeof dev.kind })}>
                  <option value="local_server">A local server (Ollama, LM Studio)</option>
                  <option value="in_browser">Inside this browser</option>
                </select>
              </label>
              {dev.kind === 'local_server' ? (
                <label className="field">
                  <span>Server address</span>
                  <input className="input" id="local-url" value={dev.baseUrl} onChange={(e) => setDev({ ...dev, baseUrl: e.target.value })} />
                </label>
              ) : null}
              <label className="field">
                <span>Model</span>
                <input className="input" id="local-model" value={dev.model} onChange={(e) => setDev({ ...dev, model: e.target.value })} />
              </label>
            </div>
            {err ? <p className="note amber">{err}</p> : null}
            <div>
              <button className="btn primary small" type="submit">
                Save and use
              </button>
            </div>
          </form>
        ) : null}

        <div className="panel section" style={{ gap: 10 }}>
          <label className="switch">
            <input
              type="checkbox"
              id="deidentify"
              checked={deid}
              onChange={(e) => {
                if (e.target.checked) {
                  setDeid(true);
                  setConfirmOff(false);
                  const cur = getAISettings();
                  apply(cur, 'names removed before sending', true);
                } else setConfirmOff(true);
              }}
            />
            <strong>Remove names and personal details before sending to AI</strong>
          </label>
          <p className="small soft">On by default. Names, phone numbers, places and dates are replaced with placeholders, and put back on this phone when the answer arrives.</p>
          {confirmOff ? (
            <div className="note amber" style={{ display: 'grid', gap: 10 }}>
              <span>
                Turning this off sends her real name, community and dates to the AI service. Only do this for an AI on this device or your own facility server, and only with her consent.
              </span>
              <span className="btn-row">
                <button
                  className="btn small danger"
                  onClick={() => {
                    setDeid(false);
                    setConfirmOff(false);
                    apply(getAISettings(), 'personal details included', false);
                  }}
                >
                  Turn off and send real details
                </button>
                <button className="btn small ghost" onClick={() => setConfirmOff(false)}>
                  Keep details private
                </button>
              </span>
            </div>
          ) : null}
        </div>

        {mode === 'any_app' ? (
          <p className="note">When you ask for AI help, Gaskin shows a short request with a Copy button. Paste it into any AI app, then paste the answer back. Gaskin checks the answer before you use it.</p>
        ) : null}

      </section>

      <AssistantSection />

      <StorageSection />

      <section className="section">
        <h2 className="t-h2">Your data</h2>
        <p className="soft" style={{ maxWidth: '66ch' }}>
          Save a backup of everything on this device, or load one from another phone or the connector. API keys are never included.
        </p>
        <div className="btn-row">
          <button className="btn" onClick={exportData}>
            <IDownload /> Export backup
          </button>
          <button className="btn" onClick={() => fileRef.current?.click()}>
            <IUpload /> Import backup
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            id="import-file"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importData(f);
              e.target.value = '';
            }}
          />
        </div>
      </section>
      <SetupSection />
    </div>
  );
}
