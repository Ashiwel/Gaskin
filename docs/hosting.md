# Hosting Gaskin

Gaskin runs in three ways, and the same front end picks the right one by itself. On a USB stick or as a single file, it keeps everything on the device. Inside claude.ai, as the hosted demo, it shares one live workspace among everyone who opens the link. On a Gaskin server, it syncs every health worker's phone, sends real SMS, WhatsApp, voice and email, and reports to DHIS2. This guide covers the last two.

## How the front end chooses

`pickBackend()` in `src/hosted` makes the choice at start-up. Inside the claude.ai artifact viewer it uses the shared `db` store. When a server address is set, through `?server=https://…` in the link, a previous sign-in, or `VITE_GASKIN_SERVER_URL` at build time, it uses the server and asks for a phone number and PIN. Otherwise it keeps records on the device through `src/storage`. A worker who has not signed in can still work offline, and her changes wait on the phone.

## The hosted demo on claude.ai

The demo used for the UNICEF video and for reviewers is the single-file build published as a claude.ai Artifact. It stores 37 synthetic mothers as about 60 small documents: one per mother with her timeline inside it, one per mother for her messages, one per override, proposal and approved rule, and one for the shared demo clock. Each viewer's own settings live in a private subtree that nobody else, the owner included, can read.

Publish it with these capabilities (they are exported as `ARTIFACT_CAPABILITIES`):

```json
{
  "db": {
    "rules": [
      { "path": "", "read": "view", "write": "interact" },
      { "path": "rules", "read": "view", "write": "admin" },
      { "path": "data/users/{self}", "read": "interact", "write": "interact" }
    ]
  },
  "user": { "scopes": ["profile"] },
  "sample": {},
  "downloads": true
}
```

The first rule lets every signed-in viewer read the shared demo and lets Contributors change it. The second keeps the approved-rule library in the hands of the artifact's editors, who play the clinical reviewer. The third gives each person their own settings. A Viewer, or a reviewer from outside the organisation on a public link, can still use every screen, but their changes are kept in their own browser on top of the live shared data, and a note says so.

After the first publish, fill the empty store with the synthetic cohort rather than hard-coding it into the page. `cd server && npm run artifact-seed -- ./artifact-seed` writes one JSON file per document and a `batches.json` with groups of 40 writes, ready for the ArtifactData batch tool. The page also offers "load demo data" to an editor who opens an empty workspace.

Two people can work on the same mother at once. Writes are debounced, take a short cooperative lease on the mother's document, read the newest copy, and merge: clinical events are a union by id and are never lost, message status only moves forward, and her profile fields go to the last writer. If someone with an older copy overwrites the document anyway, the backend notices on the next snapshot, puts its own events back, and shows the worker a plain note asking her to check the record.

When the page is opened as a file, or by a signed-out visitor, `claude.use('db')` resolves `null` and the demo runs on the device alone.

## The production server

The server in `server/` is a Node 20+ TypeScript service built on Hono. It uses SQLite by default (one file, simple to back up and encrypt) and Postgres when `DATABASE_URL` is a Postgres URL. The rules engine and the privacy layer are the same code the phones run, imported from `src/engine` and `src/privacy`, so a plan computed on the server matches the plan on the phone.

### Deploy on a VPS or a Nigerian cloud

Data residency is a deployment choice, and for health data it should be made deliberately. Nigeria's NDPA 2023 has no adequacy list, and contractual clauses for transfers abroad need the regulator's approval, Kenya's Data Protection Act read literally limits transfers, and Ghana's draft AI health policy bars storage abroad without safeguards. Hosting in the country of care avoids the question. In Nigeria that means a local provider such as Galaxy Backbone (the government's cloud), Rack Centre or MainOne (Equinix) in Lagos, or Layer3 in Abuja; in Kenya, Safaricom or iColo in Nairobi; in Ghana, the National Data Centre or a local colocation provider. A 2 vCPU, 4 GB virtual machine with 50 GB of encrypted disk is enough for a pilot of several thousand mothers.

```bash
git clone https://github.com/gaskin-health/gaskin && cd gaskin/server
cp .env.example .env            # fill it in: PUBLIC_URL, CORS_ORIGINS, ADMIN_PHONE, ADMIN_PIN, AUDIT_IP_SALT
docker compose up -d            # SQLite in the gaskin-data volume
docker compose logs -f gaskin   # "listening on … messaging=sandbox ai=off"
```

For Postgres, set `DATABASE_URL=postgres://gaskin:…@postgres:5432/gaskin` and `POSTGRES_PASSWORD` in `.env` and run `docker compose --profile postgres up -d`. Without Docker, `npm ci && npm run build && npm start` works on any machine with Node 20 or later.

Put a TLS reverse proxy in front of port 8787, which is published on localhost only. With Caddy, one line does it: `gaskin.example.ng { reverse_proxy 127.0.0.1:8787 }`. Set `TRUST_PROXY=true` so the audit log and the sign-in rate limit see the real client address.

### Accounts

The first admin account is created on first start from `ADMIN_PHONE` and `ADMIN_PIN`; remove `ADMIN_PIN` from `.env` afterwards. Admins create facilities (with their DHIS2 org unit ids) through `POST /api/admin/facilities` and accounts through `POST /api/admin/users`, or from the command line with `npm run create-user`. Each account has one role and a list of facilities.

| Role | Can do |
|---|---|
| worker | Read and write the mothers at her own facilities; send messages; use the AI proxy |
| supervisor | The same across every facility she supervises; read message costs, DHIS2 exports and her facilities' audit log |
| clinical_reviewer | As supervisor, and approve or reject proposed rule changes |
| programme_officer | Aggregate reports, costs and DHIS2 only; no named records |
| admin | Manage accounts and facilities and read the full audit log; no clinical records unless also scoped |

Sign-in is a phone number and a 4–8 digit PIN, because many health workers share phones and have no email. Easy PINs such as 1234 and 0000 are refused, five wrong PINs lock the account for 15 minutes, ten attempts on one number in 15 minutes are refused from any address, and the server stores only a scrypt hash of each PIN and a SHA-256 hash of each session token. A session unused for 14 days ends; `POST /api/auth/refresh` swaps a token for a fresh one, up to 90 days after sign-in. For reviewers and the pitch video, `DEMO_PIN=… npm run seed-demo` loads the synthetic cohort with one account per demo worker; it refuses to run on a database with real records.

### Sync

The phone works offline and keeps an outbox. `POST /api/sync` takes the device id, the last cursor and the queued changes, each with its own `opId`. The server applies each op once, so a retry after a dropped 2G connection never writes twice. Clinical events are append-only and keyed by their own id, so the same visit recorded twice is stored once. Records, overrides and messages go to the last writer, and the server reports a conflict when someone else saved a mother's record after the copy the phone started from. The reply carries the changes other devices made since the cursor, filtered to the worker's facilities, and any emergency or urgent alerts the server's engine raised for the mothers in the upload. `GET /api/events` nudges open apps to sync at once.

## Messaging gateways

`MESSAGING_MODE=sandbox` is the default, and nothing real is sent: messages walk through queued, sent and delivered on timers, and test numbers ending 0000 and 0001 fail as do-not-disturb and switched off. Set `MESSAGING_MODE=live` and the credentials below to send for real. Each provider is wrapped in the same `MessageGateway` interface, and every delivery receipt updates the message and syncs to every phone.

| Channel | Provider | Delivery report URL to set in the provider's dashboard |
|---|---|---|
| SMS (Nigeria) | Termii, DND route by default | `{PUBLIC_URL}/webhooks/termii` |
| SMS (all three countries) | Africa's Talking | `{PUBLIC_URL}/webhooks/africastalking/sms?token={AT_WEBHOOK_TOKEN}`, inbound `/webhooks/africastalking/inbound?token={AT_WEBHOOK_TOKEN}` |
| Voice | Africa's Talking | `{PUBLIC_URL}/webhooks/africastalking/voice?token={AT_WEBHOOK_TOKEN}` (voice callback) |
| WhatsApp | Meta WhatsApp Cloud API | `{PUBLIC_URL}/webhooks/whatsapp`, verify token `WHATSAPP_VERIFY_TOKEN` |
| Email | Any SMTP server | none: email is marked sent when the server accepts it |

Three rules keep messages arriving and costs down. In Nigeria, many numbers are on the NCC do-not-disturb register and receive SMS only from a registered alphanumeric sender ID on the transactional route; register "Gaskin" (or the programme's name) with Termii or Africa's Talking before going live, and send care messages only to mothers who gave messaging consent, which the server checks. On WhatsApp, Meta charges roughly eight times as much for a marketing template as for a utility template, so register one UTILITY template per language, specific to her care, such as `gaskin_care_update`: "Hello {{1}}, this is your health worker at {{2}}. {{3}}". Inside the 24-hour window after she writes to us, the server sends free text instead. Routine messages are held during quiet hours (20:00 to 08:00 by default) and sent in the morning; danger-sign alerts are never held.

Every send logs Gaskin's estimated cost, and every receipt that carries a price logs the provider's actual cost; `GET /api/reports/costs` totals both.

## AI

Gaskin works fully without AI, and the server starts with AI switched off. To switch it on, point `AI_BASE_URL` and `AI_MODEL` at any OpenAI-compatible endpoint. The default recommendation is an open-weight model served in the country of care, which keeps prompts inside the border and avoids the transfer question entirely.

```bash
docker compose --profile ai up -d
docker compose exec ollama ollama pull qwen2.5:7b-instruct
# .env: AI_BASE_URL=http://ollama:11434/v1  AI_MODEL=qwen2.5:7b-instruct  AI_RESIDENCY=in_country
```

On a GPU server, vLLM serves the same API (`vllm serve Qwen/Qwen2.5-7B-Instruct`) with far higher throughput. A 7-billion-parameter model runs on a single 24 GB GPU, or slowly on a CPU with 16 GB of memory.

The phone de-identifies every prompt before it leaves, and the server does it again before the model sees it, with every name, community and facility in the worker's scope. A prompt in which any known identifier survives is blocked, and nothing is sent. Replies come back with first names restored. The server never logs prompt or reply content; the audit log records the task, the byte count, the categories removed and the outcome. Pseudonymised data is still personal data under the NDPA, so mothers' consent to AI processing is still needed, and a processor agreement is needed with any provider not run by the programme itself.

## DHIS2 and public metrics

`GET /api/reports/dhis2?period=202610` returns a DHIS2 `dataValueSets` payload per facility with monthly counts: ANC first, fourth and eighth contacts, first contacts before 12 weeks, births by place, PNC within 48 hours and seven days, referrals, depression screening, and ten antigens. Counts from 1 to 9 are withheld, zeros are reported, and where a total and all but one of its parts would be published, the smallest other part is withheld too, so a hidden count cannot be recovered by subtraction. Map Gaskin's codes to the national instance's UIDs once in `dhis2-mapping.example.json`, copy it to `/data/dhis2-mapping.json`, set `DHIS2_URL`, `DHIS2_USERNAME` and `DHIS2_PASSWORD`, and a programme officer can push a month with `POST /api/reports/dhis2/push`.

`GET /api/public/metrics` needs no sign-in and serves the open reporting UNICEF asks of its portfolio: mothers enrolled and active, stage, ANC4+ among women who gave birth, facility births, PNC within 48 hours, messages by channel, delivery rate, messaging cost per mother, monthly activity and AI use. It is country-level only, applies the same small-count rule, publishes a rate only when its denominator is at least 10, and is cached for an hour.

## Costs

The figures below are for a pilot of 5,000 mothers in one Nigerian state, at ₦1,329 to the dollar.

| Item | Monthly cost | Basis |
|---|---|---|
| Server (2 vCPU, 4 GB, 50 GB disk, in Lagos) | US$30–60 | Local cloud list prices; a donated government cloud slot costs nothing |
| Encrypted off-site backups | US$5 | 10 GB of object storage in-country |
| SMS | about US$17 | Two SMS a month per mother at ₦2.15 + 7.5% VAT (MTN bulk); DND-route rates are higher |
| WhatsApp utility templates | about US$22 | Two a month for the third of mothers with WhatsApp, at US$0.0067 each |
| Voice reminders | about US$6 | One one-minute call a month for the 10% who cannot read, at ₦15 a minute |
| AI on a GPU in-country | US$250–700, or US$0 | A rented 24 GB GPU; switch AI off and templates do the work |
| Domain and TLS | under US$2 | Let's Encrypt is free |

Without AI, the whole pilot costs about US$80–110 a month, or roughly 2 US cents per mother. Messages, which made up three-quarters of MomConnect's running costs at South African prices, come to about US$45 of that, and hosting is the rest. Data bundles for health workers are not included: at ₦1,500 for 1.8 GB, they are 30% of a CHIPS agent's stipend, and a programme budget, not the worker, should pay for them.

## Security and data-protection checklist

Before real records go on a server, a deployment should be able to tick every line.

- **Registration.** Register with the NDPC as a data controller of major importance (more than 200 people's sensitive data), appoint a data protection officer, and complete a data-protection impact assessment before go-live. In Kenya, register with the ODPC and notify the Digital Health Agency; in Ghana, register with the DPC.
- **Consent.** Record each mother's consent to data processing and to messages (the server will not message her without it) and, where AI is on, to AI processing.
- **Encryption in transit.** TLS on every public address; HSTS is set by the server's security headers.
- **Encryption at rest.** Put `/data` (or the Postgres volume) on an encrypted disk: LUKS on a VPS, or the provider's encrypted volumes with keys you control. Encrypt backups before they leave the machine (`restic` or `age`), keep one copy off-site in the same country, and test a restore every quarter.
- **Webhooks.** In live mode every gateway refuses callbacks it cannot verify: set `WHATSAPP_APP_SECRET`, `TERMII_WEBHOOK_SECRET` and `AT_WEBHOOK_TOKEN`, or forged receipts and fake inbound SMS are possible. With `NODE_ENV=production` the server will not start while any of these, or a wildcard `CORS_ORIGINS`, is unsafe.
- **Secrets.** Keep `.env` readable by the service account only; never commit it. Rotate gateway keys and `AUDIT_IP_SALT` when anyone with access leaves.
- **Accounts.** One account per person, never shared; remove leavers the same day; review who has which facility every quarter.
- **Least privilege.** Programme officers see aggregates only; admins do not see records unless also scoped to a facility.
- **Audit.** The audit log records sign-ins, syncs, plan views, messages, AI calls, reports and admin actions, with hashed IP addresses and no content. Review it monthly, and keep it for two years (`RETENTION_AUDIT_DAYS=730`).
- **Retention.** Message text is cleared after 90 days, keeping status and cost. Sync logs are pruned after 180 days. Clinical records are never deleted automatically; records with no activity for seven years are listed for the data protection officer to review, and are deleted only if `RETENTION_AUTO_DELETE=true`.
- **AI.** Prefer an in-country open-weight model. Never put an offshore API key in `AI_API_KEY` without a processor agreement and the mothers' consent.
- **Updates.** Rebuild the image monthly for Node and OS security fixes; watch the repository for Gaskin releases.
- **Medical device rules.** Reminders and education fall at the bottom of NAFDAC's SaMD risk matrix, but danger-sign triage that drives referral probably does not. Book a pre-submission meeting with NAFDAC (and the PPB in Kenya, the FDA in Ghana) before scaling beyond a pilot.

### Breach response: the 72-hour procedure

Nigeria's NDPC and Kenya's ODPC must be told of a personal-data breach within 72 hours of the controller becoming aware of it, and Kenya's Digital Health Agency within 48 hours. The clock starts when anyone on the team suspects a breach, so the procedure starts then too.

1. **Hour 0: contain.** Whoever spots it tells the data protection officer and the technical lead at once, by phone. Revoke the affected sessions (`DELETE FROM sessions`, or the affected user's rows), rotate exposed keys, block the address or account involved, and take a snapshot of the disk and logs before changing anything else.
2. **Hours 0–24: assess.** Use the audit log to establish which accounts, facilities and mothers were affected, what categories of data were exposed, and whether the data was encrypted. Judge whether the breach is likely to put mothers at risk. With health data, it almost always is.
3. **Hours 24–72: notify.** The DPO files the notification with the NDPC (and the ODPC and Digital Health Agency in Kenya, the DPC in Ghana) describing the nature of the breach, the categories and approximate numbers of people and records, the likely consequences, the measures taken, and a contact point. If something is still unknown at 72 hours, notify with what is known and follow up.
4. **Tell the mothers.** Where the risk is high, tell the affected mothers in plain language, in their own language, through their health worker or by SMS, with what happened and what to do. Tell the state primary health care board and any funder whose contract requires it.
5. **Within 30 days: learn.** Write a short incident report, fix the cause, and record the breach in the breach register, which the NDPC can ask to see.

Keep the DPO's and the technical lead's phone numbers, and the regulators' reporting addresses, printed at the front of the programme's operations file, because a breach may take the server, and the documents on it, offline.
