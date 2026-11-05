/**
 * Settings sections added at integration: languages (worker and mothers), connect your
 * assistant (one-click .mcpb for Claude Desktop), storage status, and run setup again.
 */
import { useEffect, useState, useSyncExternalStore } from 'react';
import { LanguagePicker, installedLanguages, isPackCode, packStore, type PackCode } from '../i18n';
import { connectAssistant, resetSetup, setupStore, useSetup, type AssistantConnection, type AssistantTarget } from '../setup';
import { getAppStore, type StoreStatus } from '../storage';
import { useBridgeStatus } from '../store/backend';
import { useToast } from './components';
import { useWorkerLang } from './i18n';
import { saveFile } from './HandoutSheet';
import { ICheckCircle, ICopy, IDownload } from './icons';
import { cn } from './animata/cn';

export function LanguagesSection() {
  const saved = useSetup();
  const wl = useWorkerLang() as PackCode;
  useSyncExternalStore(packStore.subscribe, packStore.getVersion, packStore.getVersion);
  const mothers = (saved?.plan.languages.mothers ?? []).filter((l) => isPackCode(l)) as PackCode[];
  const setWorker = (code: PackCode) => {
    const cur = setupStore.get();
    if (!cur) return;
    setupStore.set({ ...cur, plan: { ...cur.plan, languages: { ...cur.plan.languages, ui: code, worker: code } } });
  };
  const setMothers = (codes: PackCode[]) => {
    const cur = setupStore.get();
    if (!cur) return;
    setupStore.set({ ...cur, plan: { ...cur.plan, languages: { ...cur.plan.languages, mothers: codes.filter((c) => c !== 'fr') as typeof cur.plan.languages.mothers } } });
  };
  return (
    <section className="section" aria-labelledby="set-lang">
      <h2 className="t-h2" id="set-lang">
        Languages
      </h2>
      <p className="soft max-w-[66ch]">
        Your language runs every screen. Each mother has her own language, set when you register her and changeable on her record; it is used only for what she sees and hears. Packs download once and work offline. Drafts are marked until a speaker checks them.
      </p>
      {!saved ? <p className="note">Run setup first to choose your languages.</p> : null}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="min-w-0">
          <LanguagePicker uiLang={wl} value={wl} onChange={(v) => setWorker(v as PackCode)} installOnSelect label="My language" downloadMs={400} />
        </div>
        <div className="min-w-0">
          <LanguagePicker uiLang={wl} value={mothers.length ? mothers : ['en']} multiple onChange={(v) => setMothers(v as PackCode[])} installOnSelect label="Mothers’ languages" downloadMs={400} />
          <p className="tiny muted mt-2">Installed: {installedLanguages().join(', ')}</p>
        </div>
      </div>
    </section>
  );
}

const TARGETS: Array<{ id: AssistantTarget; label: string; blurb: string }> = [
  { id: 'claude_desktop', label: 'Claude Desktop', blurb: 'One file. Double-click it and Claude installs Gaskin on this laptop.' },
  { id: 'claude_web', label: 'Claude on the web', blurb: 'Needs the facility hub, because a cloud assistant cannot reach this laptop.' },
  { id: 'chatgpt', label: 'ChatGPT', blurb: 'Same as Claude on the web: needs the facility hub or a secure tunnel.' },
  { id: 'other', label: 'Another assistant', blurb: 'Any assistant that accepts an MCP connector address.' },
];

export function AssistantSection() {
  const toast = useToast();
  const saved = useSetup();
  const [target, setTarget] = useState<AssistantTarget>(saved?.plan.ai.assistant ?? 'claude_desktop');
  const [conn, setConn] = useState<AssistantConnection | null>(null);
  useEffect(() => {
    let live = true;
    void connectAssistant(target).then((c) => live && setConn(c));
    return () => {
      live = false;
    };
  }, [target]);

  const download = async () => {
    if (!conn?.downloadUrl) return;
    try {
      if (conn.downloadUrl.startsWith('blob:')) {
        const blob = await (await fetch(conn.downloadUrl)).blob();
        // Inside claude.ai the downloads capability saves it; elsewhere a normal download.
        const claude = (window as unknown as { claude?: { use?: (n: string) => Promise<unknown> } }).claude;
        const dl = (await claude?.use?.('downloads').catch(() => null)) as { save?: (a: { filename: string; data: Blob }) => Promise<unknown> } | null | undefined;
        if (dl?.save) {
          await dl.save({ filename: conn.fileName ?? 'gaskin.mcpb', data: blob });
        } else {
          const a = document.createElement('a');
          a.href = conn.downloadUrl;
          a.download = conn.fileName ?? 'gaskin.mcpb';
          document.body.appendChild(a);
          a.click();
          a.remove();
        }
        toast('Gaskin for Claude is downloading. Double-click it to install.');
      } else {
        window.open(conn.downloadUrl, '_blank', 'noopener');
      }
    } catch {
      toast('The download did not start. Try again, or use copy and paste meanwhile.');
    }
  };

  return (
    <section className="section" aria-labelledby="set-assistant" data-testid="connect-assistant">
      <h2 className="t-h2" id="set-assistant">
        Connect your assistant
      </h2>
      <p className="soft max-w-[66ch]">
        Use Gaskin from the AI assistant you already have. It can answer “Who should I visit first today?” and draft messages, asks before it changes a record, and sees records with names and places removed.
      </p>
      <div className="seg" role="group" aria-label="Assistant">
        {TARGETS.map((x) => (
          <button key={x.id} type="button" aria-pressed={target === x.id} onClick={() => setTarget(x.id)}>
            {x.label}
          </button>
        ))}
      </div>
      <p className="small muted">{TARGETS.find((x) => x.id === target)?.blurb}</p>
      {conn ? (
        <div className="panel section" style={{ gap: 12 }}>
          <ol className="m-0 grid gap-1.5 pl-5 text-[0.92rem] text-ink-2">
            {conn.steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
          {conn.kind === 'download' ? (
            <div className="btn-row">
              <button className="btn primary" onClick={download} data-testid="download-mcpb">
                <IDownload /> Download Gaskin for Claude
              </button>
              <span className="small muted">{conn.downloadUrl?.startsWith('blob:') ? 'Included in this copy of Gaskin, so it works offline.' : 'Downloads from the internet once.'}</span>
            </div>
          ) : null}
          {conn.kind === 'address' && conn.address ? (
            <div className="btn-row">
              <code className="code min-w-0 flex-1 break-all">{conn.address}</code>
              <button
                className="btn small"
                onClick={() => {
                  void navigator.clipboard?.writeText(conn.address!).catch(() => undefined);
                  toast('Address copied.');
                }}
              >
                <ICopy /> Copy
              </button>
            </div>
          ) : null}
          {conn.note ? <p className="note">{conn.note}</p> : null}
        </div>
      ) : null}
    </section>
  );
}

export function StorageSection() {
  const toast = useToast();
  const bridge = useBridgeStatus();
  const [st, setSt] = useState<StoreStatus | null>(null);
  const [mode, setMode] = useState<string>('');
  useEffect(() => {
    let off: (() => void) | undefined;
    void getAppStore()
      .then((s) => {
        setSt(s.status());
        setMode(s.mode);
        off = s.subscribe((x) => {
          setSt(x);
          setMode(x.mode);
        });
      })
      .catch(() => undefined);
    return () => off?.();
  }, []);
  const shared = bridge.status?.kind === 'artifact' || bridge.status?.kind === 'http';
  return (
    <section className="section" aria-labelledby="set-storage">
      <h2 className="t-h2" id="set-storage">
        Where records are kept
      </h2>
      <div className="panel grid gap-2.5" data-testid="storage-panel">
        <p className="m-0 flex items-center gap-2 font-semibold">
          <span aria-hidden="true" className={cn('inline-block size-2 rounded-full', bridge.localOnly ? 'bg-amber' : 'bg-green')} />
          {bridge.status?.label ?? 'This device'}
        </p>
        {bridge.status?.fallbackReason ? <p className="small soft m-0">{bridge.status.fallbackReason}</p> : null}
        {shared ? <p className="small soft m-0">{bridge.status?.kind === 'artifact' ? 'Everyone with the link sees the same synthetic mothers. Changes save to the shared workspace when you are allowed to edit it.' : 'Changes sync to the Gaskin server and wait on this phone while offline.'}</p> : null}
        {st ? (
          <p className="small soft m-0" data-testid="storage-message">
            On this device: {st.message}
            {st.persisted ? ' The browser will not clear it.' : ''}
          </p>
        ) : null}
        {!shared ? (
          <div className="btn-row">
            {mode !== 'folder' ? (
              <button
                className="btn small"
                onClick={async () => {
                  const s = await getAppStore();
                  const ok = await s.chooseFolder().catch(() => false);
                  toast(ok ? 'Records now save to that folder.' : 'This browser cannot save to a folder. Records stay here, with backup files.');
                }}
              >
                Save to a folder or USB stick
              </button>
            ) : (
              <button
                className="btn small"
                onClick={async () => {
                  const s = await getAppStore();
                  await s.reconnectFolder().catch(() => false);
                }}
              >
                Reconnect folder
              </button>
            )}
            <button
              className="btn small"
              onClick={async () => {
                const s = await getAppStore();
                const ok = await s.exportFile().catch(() => false);
                toast(ok ? 'Backup file saved.' : 'The backup could not be saved.');
              }}
            >
              <IDownload /> Save a backup file
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function SetupSection() {
  const saved = useSetup();
  const toast = useToast();
  return (
    <section className="section" aria-labelledby="set-setup">
      <h2 className="t-h2" id="set-setup">
        Setup
      </h2>
      {saved ? (
        <div className="panel grid gap-1.5">
          <p className="m-0 flex items-center gap-2">
            <ICheckCircle width={18} height={18} className="text-green" />
            <span>
              {saved.plan.run.label}. {saved.plan.countryName}
              {saved.plan.region ? `, ${saved.plan.region}` : ''}. AI: {saved.plan.ai.label}.
            </span>
          </p>
          <p className="small muted m-0">Names and personal details are removed before anything is sent to an AI.</p>
        </div>
      ) : null}
      <div className="btn-row">
        <button
          className="btn"
          data-testid="run-setup-again"
          onClick={() => {
            resetSetup();
            toast('Setup will start again.');
          }}
        >
          Run setup again
        </button>
        <button
          className="btn ghost"
          onClick={async () => {
            const blob = new Blob([JSON.stringify(saved?.plan ?? {}, null, 2)], { type: 'application/json' });
            await saveFile('gaskin-setup.json', await blob.text(), 'application/json');
          }}
        >
          Save my setup
        </button>
      </div>
    </section>
  );
}
