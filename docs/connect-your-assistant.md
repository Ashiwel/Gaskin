# Connect your AI assistant to Gaskin

Gaskin can work with an AI assistant you already use, such as Claude Desktop. Once it is connected, you can ask the assistant "Who should I visit first today?", "Why is iron in this mother's plan?" or "Record a blood pressure of 150 over 100 for M-7F3A", and it reads and updates Gaskin for you.

The assistant does not see the mothers' names. It sees a short code for each mother, such as M-7F3A, with an age range like 25-29 and dates like "in 12 days". Names, phone numbers, villages and exact dates stay on your computer. You can match a code to a mother inside the Gaskin app.

## Claude Desktop (recommended)

Claude Desktop runs on a Windows or Mac laptop. It needs the internet to talk to Claude, but your Gaskin records stay in a folder on the laptop or on your USB stick.

1. **Download.** In Gaskin, open Settings, choose "Connect your AI assistant", then "Claude Desktop", and press **Download Gaskin for Claude**. You get one file called `gaskin.mcpb`.
2. **Double-click it.** Claude Desktop opens and shows the Gaskin extension.
3. **Click Install in Claude.** Claude asks for your Gaskin folder. Choose the folder that holds `gaskin-data.json` (for example your USB stick, or Documents/Gaskin). Leave "Hide names and identifying details" switched on.

Then start a new chat in Claude and ask: "Who should I visit first today?"

If Claude says it cannot find your data, open Gaskin, go to Settings, choose **Save to folder**, and pick the same folder you chose in step 3.

### What the assistant can and cannot do

The assistant can list who to see next, open a mother's plan, explain why each item is there and which guideline it comes from, list danger-sign alerts, draft a message for a mother, and record what you observed (blood pressure, weight, temperature, symptoms, a lab result, an EPDS score, feeding, or the baby's growth).

Before it records anything, it shows you what it is about to save and asks you to agree. Nothing is saved until you say yes.

It cannot delete records, remove a locked item from a plan, hide an alert, or send a message. Messages are drafts: you check them and send them from Gaskin.

Every time the assistant uses Gaskin, a line is added to `gaskin-assistant-audit.log` in your Gaskin folder. The line says when, which tool, and which mother code. It never contains the conversation.

Every time the assistant saves something, the previous `gaskin-data.json` is copied into the `backups` folder first.

### Showing names (only if your facility allows it)

You can switch de-identification off in Gaskin settings, or in Claude under Settings, Extensions, Gaskin. Do this only if your facility's rules and the mother's consent allow her details to go to an AI company. When it is off, every answer from Gaskin starts with a warning line saying that names are included.

## ChatGPT, Claude on the web, and other assistants

ChatGPT and Claude on the web run on the internet, not on your laptop. They connect to tools through a web address (a "connector URL"). Your laptop is not on the internet in that way, so these assistants **cannot reach Gaskin on your laptop by themselves**.

They can connect when your facility runs the Gaskin hub, or a secure tunnel, which gives Gaskin a proper web address. This is part of the pilot. Ask your supervisor or the Gaskin pilot team for the address. When you have it:

1. Copy the address.
2. In ChatGPT, open Settings, then Connectors, and add a new connector (this needs developer mode). In Claude on the web, open Settings, then Connectors, then "Add custom connector".
3. Paste the address and save.

Until then, use Claude Desktop, or the copy-and-paste option in Gaskin settings, which works with any AI app.

## For technical staff

### What it is

`mcp-server/` is a Model Context Protocol server written in TypeScript with the official `@modelcontextprotocol/sdk`. It imports the app's own engine, clinical rules, messaging and privacy code from `../src`, so the assistant sees exactly the plans the app shows. esbuild bundles everything into one file, `mcp-server/dist/server.js` (about 1.1 MB), which runs with plain `node` (version 18 or later) and needs no `node_modules`.

### Build

```bash
cd mcp-server
npm install
npm run build      # dist/server.js
npm run bundle     # also dist/gaskin.mcpb (about 320 KB), validated with the official mcpb CLI
npm test           # unit and end-to-end tests (run build first)
```

`npm run bundle` also writes `dist/gaskin.mcpb.base64.txt`. When the app is built afterwards, `src/setup/connectAssistant.ts` embeds it, so the Claude Desktop download works offline from the USB stick. If the app is built without it, the download step points to the published release instead.

### Run

```bash
node dist/server.js                       # stdio; data folder = the folder holding server.js (or its parent if in dist/)
node dist/server.js /media/GASKIN         # stdio, data folder given
node dist/server.js --http                # Streamable HTTP on 127.0.0.1:8765, prints a URL with a short key
node dist/server.js --http --port 9000 --host 127.0.0.1
```

Environment variables:

| Variable | Meaning |
| --- | --- |
| `GASKIN_DATA_DIR` | Folder holding `gaskin-data.json`. A path to a `.json` file is also accepted. |
| `GASKIN_DEIDENTIFY` | `false` switches de-identification off. Anything else leaves it on. |
| `GASKIN_DEMO` | `true` writes the sample mothers into an empty folder. It never overwrites a data file. |
| `GASKIN_HTTP_TOKEN` | Fixed access key for `--http` (otherwise a random 10-character key per start). |
| `GASKIN_ALLOWED_HOSTS` | Extra `Host` headers to accept in `--http` mode, for a tunnel or hub, for example `gaskin.example.org`. |

Manual configuration for Claude Desktop, Claude Code or another local client:

```json
{
  "mcpServers": {
    "gaskin": {
      "command": "node",
      "args": ["/path/to/gaskin/mcp-server/dist/server.js", "/path/to/Gaskin-data-folder"]
    }
  }
}
```

### The extension (.mcpb)

`mcp-server/manifest.json` uses MCPB manifest version 0.3 (checked against the spec at github.com/modelcontextprotocol/mcpb and validated with `@anthropic-ai/mcpb` 2.1.2). The server type is `node`; Claude Desktop ships its own Node.js runtime on macOS and Windows, so workers install nothing else. `user_config` asks for three things: the data folder (a directory picker, default `Documents/Gaskin`), the de-identification switch (default on), and whether to write sample mothers into an empty folder (default off). Claude Desktop passes them to the server as `GASKIN_DATA_DIR`, `GASKIN_DEIDENTIFY` and `GASKIN_DEMO`. The bundle is not signed yet; `mcpb sign` with the project's certificate belongs in the release process.

### Data file

The server reads `gaskin-data.json` in any of the three shapes Gaskin writes: the folder-storage envelope `{ app, format, savedAt, data }`, the Settings export `{ app, schema, exportedAt, state }`, or a bare state. It writes back in the same shape. Writes go to a temporary file in the same folder, are flushed, and are renamed over the original, so a crash never leaves a half-written file. The previous file is copied to `backups/gaskin-data-<timestamp>.json` first, and the newest 200 copies are kept. The folder is watched and the file is re-checked on every call, so changes saved by the app are picked up straight away. A write re-reads the file first, so the app's latest save is not lost.

The only write is appending one clinical event (vitals, symptom, lab, screening, feeding or growth) to a mother's timeline, the same event types the app records, followed by the same plan-version bookkeeping as the app's reducer.

### Tokens and de-identification

Each mother gets a token such as `M-7F3A`: an HMAC of her record id under a random secret, remembered once issued. The secret and the token map live in a top-level `mcpPrivate` section of the data file, with a copy in `.gaskin-assistant-private.json` in case the app re-saves the file without it. Tokens are only turned back into records inside the server and are never sent.

With de-identification on (the default), each response is built from age bands, stage, zone (for example "South West Nigeria") and relative dates, and then the whole response goes through the app's privacy layer (`src/privacy`): every known mother, child, carer, worker, facility, community and region name is replaced with a placeholder, along with phone numbers, emails, IDs and calendar dates. A final leak check redacts anything that still matches a known identifier. The first line of every response states whether de-identification is on. It is off only if `settings.deidentify` (or `settings.assistant.deidentify`) in the data file is `false`, or the connector's `GASKIN_DEIDENTIFY` is `false`.

### Tools

| Tool | Purpose |
| --- | --- |
| `gaskin_whoami` | Worker, facility, caseload size, settings, de-identification status. |
| `gaskin_list_caseload` | Ranked "who to see next": alerts first, then danger signs by message, then the engine's contact-priority score and reasons. |
| `gaskin_get_care_plan` | Stage, alerts, risks, active items with because-reasons, evidence grade, sources, locked flag; next contact; recent events. |
| `gaskin_record_observation` | Preview by default. With `confirmedByWorker: true`, saves and returns the plan diff and new alerts. Rejects impossible readings. |
| `gaskin_draft_message` | Template message in her language pack or plain English, for her best channel. Never sends. |
| `gaskin_list_alerts` | All open alerts, most serious first. |
| `gaskin_explain_rule` | Why an item or alert is in her plan, with evidence grade, sources and any override or learned rule. |

No tool deletes data, edits or removes plan items, changes overrides, or dismisses alerts.

### Audit log

`gaskin-assistant-audit.log` in the data folder holds one JSON line per tool call: `at`, `tool`, `mother` (token or null), `outcome` (`ok`, `preview`, `saved`, `error`), `deidentified`, and `prev`, a short hash of the line before it. The chain shows if a line was deleted or edited (`verifyAuditChain()` in `src/store.ts` checks it). It holds no clinical content and no free text from the assistant.

The server refuses to follow a symbolic link for the data file, the `backups` folder, the audit log or the token file, so a link planted in the folder cannot make it read or write elsewhere. It refuses data files over 64 MB, and says plainly when the data file is encrypted with a Gaskin passphrase, which it cannot read yet.

### HTTP mode and its limits

`--http` serves the Streamable HTTP transport at `/mcp` on `127.0.0.1` with a random 10-character key, accepted as `Authorization: Bearer <key>` or `?key=<key>`, rejects unknown `Host` headers (DNS-rebinding protection) and refuses requests from web pages on other sites. This suits assistants running on the same computer. It will not bind to any other address unless `GASKIN_HTTP_TOKEN` is at least 24 characters and `GASKIN_ALLOWED_HOSTS` names the hosts, and it refuses `GASKIN_ALLOWED_HOSTS=*`.

Cloud-hosted assistants (ChatGPT, Claude on the web and mobile) connect from the provider's servers, so they cannot reach a laptop's `localhost`. Reaching them needs either a facility hub (a small always-on machine running this server behind HTTPS with proper authentication) or a tunnel such as Cloudflare Tunnel or ngrok. Both belong in the pilot, because they raise questions this prototype does not settle: OAuth instead of a shared key, where the hub sits, who administers it, and a data processing agreement with the AI provider. The data is pseudonymised, not anonymous, so under Nigeria's NDPA 2023, Kenya's DPA 2019 and Ghana's DPA 2012 consent and a processor agreement are still required for any cloud assistant.

### Known limits

- The bundle is unsigned, so Claude Desktop shows it as unverified.
- Claude Desktop has been tested only through its documented install path and the MCPB validator here; a manual check on Windows and macOS is still needed before the pilot.
- If the app and the assistant save within the same fraction of a second, the later save wins. The backup folder keeps the earlier version.
- Notes added through `note` are scrubbed against every known name before they are stored in de-identified mode, but a name Gaskin has never seen (a neighbour, say) can slip through the pattern rules.
- Citations that contain a place name (for example a trial named after a city) show that place as `[COMMUNITY]` in de-identified mode. This is deliberate caution.
