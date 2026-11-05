/**
 * Connecting a worker's own AI assistant to Gaskin over MCP.
 *
 * The MCP server is built separately. This file holds the interface the wizard uses and a
 * stub implementation, so the UI can ship now and the server agent replaces `connectAssistant`
 * (or calls `setAssistantConnector`) without touching the wizard.
 *
 * Claude Desktop installs local MCP servers from a single .mcpb file (a zip with manifest.json),
 * by double-click, drag and drop, or Settings > Extensions > Install Extension.
 * Claude on the web, ChatGPT and others take a remote connector address (https URL).
 * Source: https://claude.com/docs/connectors/building/mcpb
 */
import type { AssistantTarget } from './types';

export interface AssistantConnection {
  target: AssistantTarget;
  /** 'download' = offer a file; 'address' = show a URL to copy; 'unavailable' = explain why */
  kind: 'download' | 'address' | 'unavailable';
  /** For 'download': file name and URL (may be a blob: URL) */
  fileName?: string;
  downloadUrl?: string;
  /** For 'address': the connector URL to paste into the assistant */
  address?: string;
  /** Plain steps for the worker, two to four lines */
  steps: string[];
  /** True once the server reports a successful connection */
  connected: boolean;
  /** Shown when nothing real is available yet */
  note?: string;
}

export type AssistantConnector = (target: AssistantTarget, opts?: { dataFileName?: string }) => Promise<AssistantConnection>;

/** Where the published extension will live once the MCP server agent ships it */
export const GASKIN_MCPB_URL = 'https://github.com/gaskin-health/gaskin-mcp/releases/latest/download/gaskin.mcpb';
/** Placeholder remote connector address; the server agent sets the real one */
export const GASKIN_CONNECTOR_URL = 'https://mcp.gaskin.health/mcp';

const STEPS: Record<AssistantTarget, string[]> = {
  claude_desktop: [
    'Download "Gaskin for Claude" below.',
    'Double-click the file. Claude opens and asks to install it. Press Install.',
    'When asked, choose your Gaskin folder (the one with gaskin-data.json).',
    'In Claude, ask: "Who should I visit first today?"',
  ],
  claude_web: [
    'Copy the address below.',
    'In Claude, open Settings, then Connectors, then "Add custom connector".',
    'Paste the address and press Add.',
  ],
  chatgpt: [
    'Copy the address below.',
    'In ChatGPT, open Settings, then Connectors (developer mode), and add a new connector.',
    'Paste the address and save.',
  ],
  other: ['Copy the address below.', 'In your assistant\'s settings, add an MCP connector and paste the address.'],
};

/** Stub: describes what to show. The MCP server agent replaces this via setAssistantConnector. */
const stubConnector: AssistantConnector = async (target) => {
  if (target === 'claude_desktop') {
    return {
      target,
      kind: 'download',
      fileName: 'gaskin.mcpb',
      downloadUrl: GASKIN_MCPB_URL,
      steps: STEPS.claude_desktop,
      connected: false,
      note: 'The Gaskin extension is being built. Until it is ready, use copy and paste with Claude.',
    };
  }
  return {
    target,
    kind: 'address',
    address: GASKIN_CONNECTOR_URL,
    steps: STEPS[target],
    connected: false,
    note: 'The Gaskin connector is being built. Until it is ready, use copy and paste with your assistant.',
  };
};

let impl: AssistantConnector = stubConnector;

/** Called by the MCP server module to provide the real implementation */
export function setAssistantConnector(fn: AssistantConnector | null): void {
  impl = fn ?? stubConnector;
}

/** What the wizard calls. Never throws. */
export async function connectAssistant(target: AssistantTarget, opts?: { dataFileName?: string }): Promise<AssistantConnection> {
  try {
    return await impl(target, opts);
  } catch (e) {
    return { target, kind: 'unavailable', steps: [], connected: false, note: `Could not prepare the connector: ${(e as Error)?.message ?? e}` };
  }
}

/** Whether the real connector is installed (not the stub) */
export function assistantConnectorReady(): boolean {
  return impl !== stubConnector;
}
