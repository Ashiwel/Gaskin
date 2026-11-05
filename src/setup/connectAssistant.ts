/**
 * Connect a health worker's own AI assistant to Gaskin (the MCP server in mcp-server/).
 *
 * Claude Desktop: one file, gaskin.mcpb, installed by double-click. When the
 * app is built after `npm run bundle` in mcp-server/, the file is embedded in
 * the app (about 320 KB, under the 2 MB limit), so the download works offline
 * from the USB stick. Without it the steps point to the published release.
 *
 * ChatGPT, Claude on the web and other cloud assistants take a connector URL.
 * They run in the cloud and cannot reach a laptop's localhost, so they need the
 * Gaskin connector on a facility hub or behind a tunnel (pilot work). Local
 * assistants that accept a URL can use http://127.0.0.1:8765/mcp directly.
 *
 * Also registers itself with the onboarding wizard (setAssistantConnector), so
 * importing this module once replaces the wizard's stub.
 */
import { GASKIN_MCPB_URL, setAssistantConnector, type AssistantConnection } from './assistant';
import type { AssistantTarget } from './types';

export type AssistantKind = 'claude_desktop' | 'chatgpt' | 'other';

export interface ConnectResult {
  ok: boolean;
  steps: string[];
  downloadName?: string;
  fileData?: string | Blob;
  connectorUrl?: string;
  /** Plain-language caveat for the worker, when there is one */
  note?: string;
}

export const MCPB_FILE_NAME = 'gaskin.mcpb';
/** The address `node server.js --http` prints, without its access key */
export const LOCAL_CONNECTOR_URL = 'http://127.0.0.1:8765/mcp';

/** A facility hub or tunnel address for cloud assistants; set by the pilot deployment */
let hubUrl: string | undefined = (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_GASKIN_CONNECTOR_URL || undefined;
export function setConnectorHubUrl(url: string | undefined): void {
  hubUrl = url?.trim() || undefined;
}

// The built extension, embedded at app build time when it exists. A glob (not a plain import)
// so the app still builds when mcp-server has not been bundled yet.
const embedded = import.meta.glob<string>('../../mcp-server/dist/gaskin.mcpb.base64.txt', { query: '?raw', import: 'default' });
const MAX_EMBED_BYTES = 2 * 1024 * 1024;

async function loadBundle(): Promise<Blob | null> {
  const load = Object.values(embedded)[0];
  if (!load) return null;
  try {
    const b64 = (await load()).trim();
    if (!b64 || (b64.length * 3) / 4 > MAX_EMBED_BYTES) return null;
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    // A .mcpb is a zip; check the signature so a broken build never reaches a worker.
    if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) return null;
    return new Blob([bytes], { type: 'application/zip' });
  } catch {
    return null;
  }
}

const DESKTOP_STEPS = ['Download "Gaskin for Claude".', 'Double-click it. Claude Desktop opens.', 'Click Install in Claude, then choose your Gaskin folder.'];

export async function connectAssistant(kind: AssistantKind): Promise<ConnectResult> {
  if (kind === 'claude_desktop') {
    const blob = await loadBundle();
    if (blob) return { ok: true, steps: DESKTOP_STEPS, downloadName: MCPB_FILE_NAME, fileData: blob };
    return {
      ok: true,
      steps: [`Download "Gaskin for Claude" from ${GASKIN_MCPB_URL} (needs internet once).`, DESKTOP_STEPS[1], DESKTOP_STEPS[2]],
      downloadName: MCPB_FILE_NAME,
      connectorUrl: undefined,
      note: 'This copy of Gaskin does not include the extension file, so it downloads from the internet once.',
    };
  }

  if (kind === 'chatgpt') {
    if (hubUrl) {
      return {
        ok: true,
        connectorUrl: hubUrl,
        steps: ['Copy the address below.', 'In ChatGPT, open Settings, then Connectors, and add a new connector (developer mode).', 'Paste the address, save, and ask: "Who should I visit first today?"'],
      };
    }
    return {
      ok: false,
      steps: [
        'ChatGPT runs on the internet, so it cannot reach Gaskin on this laptop by itself.',
        'Your facility needs the Gaskin hub (or a secure tunnel). Ask your supervisor or the Gaskin pilot team.',
        'Until then, use Claude Desktop, or the copy-and-paste option in Gaskin settings.',
      ],
      note: 'Cloud assistants cannot reach a laptop\'s localhost without a tunnel or a facility hub.',
    };
  }

  return {
    ok: true,
    connectorUrl: hubUrl ?? LOCAL_CONNECTOR_URL,
    steps: hubUrl
      ? ['Copy the address below.', 'In your assistant, add an MCP connector and paste the address.', 'Ask: "Who should I visit first today?"']
      : [
          'On this laptop, start the Gaskin connector: node server.js --http (it is in the Gaskin folder).',
          'It prints an address with a short key. Paste that full address into your assistant as an MCP connector.',
          'This works for assistants on this laptop. Cloud assistants need the facility hub.',
        ],
  };
}

// ---------- Adapter for the onboarding wizard ----------

function toConnection(target: AssistantTarget, r: ConnectResult): AssistantConnection {
  if (r.fileData) {
    const blob = typeof r.fileData === 'string' ? new Blob([r.fileData]) : r.fileData;
    let url: string | undefined;
    try {
      url = URL.createObjectURL(blob);
    } catch {
      url = undefined;
    }
    return { target, kind: 'download', fileName: r.downloadName, downloadUrl: url ?? GASKIN_MCPB_URL, steps: r.steps, connected: false, note: r.note };
  }
  if (target === 'claude_desktop') {
    return { target, kind: 'download', fileName: r.downloadName ?? MCPB_FILE_NAME, downloadUrl: GASKIN_MCPB_URL, steps: r.steps, connected: false, note: r.note };
  }
  if (r.connectorUrl) return { target, kind: 'address', address: r.connectorUrl, steps: r.steps, connected: false, note: r.note };
  return { target, kind: 'unavailable', steps: r.steps, connected: false, note: r.note };
}

setAssistantConnector(async (target) => {
  const kind: AssistantKind = target === 'claude_desktop' ? 'claude_desktop' : target === 'chatgpt' || target === 'claude_web' ? 'chatgpt' : 'other';
  const r = await connectAssistant(kind);
  const conn = toConnection(target, r);
  if (target === 'claude_web' && conn.kind !== 'address') {
    conn.steps = conn.steps.map((s) => s.replace(/ChatGPT/g, 'Claude on the web'));
  }
  return conn;
});
