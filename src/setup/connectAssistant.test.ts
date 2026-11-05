import { describe, expect, it } from 'vitest';
import { connectAssistant, setConnectorHubUrl } from './connectAssistant';
import { connectAssistant as wizardConnect } from './assistant';

describe('connectAssistant (real MCP connector)', () => {
  it('Claude Desktop: three plain steps and the .mcpb (embedded when mcp-server was bundled)', async () => {
    const r = await connectAssistant('claude_desktop');
    expect(r.ok).toBe(true);
    expect(r.downloadName).toBe('gaskin.mcpb');
    expect(r.steps).toHaveLength(3);
    if (r.fileData instanceof Blob) {
      const head = new Uint8Array(await r.fileData.slice(0, 2).arrayBuffer());
      expect([head[0], head[1]]).toEqual([0x50, 0x4b]);
      expect(r.fileData.size).toBeLessThan(2 * 1024 * 1024);
      expect(r.steps[2]).toMatch(/Click Install in Claude/);
    }
  });

  it('ChatGPT: honest about localhost until a hub URL is set', async () => {
    setConnectorHubUrl(undefined);
    const r = await connectAssistant('chatgpt');
    expect(r.ok).toBe(false);
    expect(r.note).toMatch(/tunnel or a facility hub/);
    setConnectorHubUrl('https://hub.example.test/mcp');
    const h = await connectAssistant('chatgpt');
    expect(h.ok).toBe(true);
    expect(h.connectorUrl).toBe('https://hub.example.test/mcp');
    setConnectorHubUrl(undefined);
  });

  it('replaces the wizard stub', async () => {
    const d = await wizardConnect('claude_desktop');
    expect(d.kind).toBe('download');
    expect(d.note ?? '').not.toMatch(/being built/);
    const o = await wizardConnect('other');
    expect(o.kind).toBe('address');
    expect(o.address).toBe('http://127.0.0.1:8765/mcp');
  });
});
