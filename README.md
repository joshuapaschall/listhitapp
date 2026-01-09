# DispoTool

This project is a custom real estate buyer CRM built with Next.js App Router, Tailwind CSS, Supabase and shadcn/ui. It mirrors InvestorLift but tailored for your workflow.

## Setup

Install dependencies before running any development or lint tasks:

```bash
./scripts/setup.sh
```

Running this script installs all packages with **pnpm** so `pnpm run lint` and `pnpm test` work properly. Skipping the script can lead to errors such as `next: not found` when starting the dev server or `jest: not found` during tests.


**Important:** Always run this setup script before trying to lint or test the project. It ensures all dependencies are present.

### Install dependencies for lint and tests

Run `pnpm install` or `./scripts/setup.sh` before executing `pnpm run lint` or
`pnpm test`. Skipping this step often results in a "next: not found" error.

Copy `.env.example` to `.env.local` and add your Supabase credentials. Provide a Mapbox access token via the `NEXT_PUBLIC_MAPBOX_TOKEN` variable so the map preview and address autocomplete work. Set `NEXT_PUBLIC_BASE_URL` and `DISPOTOOL_BASE_URL` to the base URL of your local site (e.g. `http://localhost:3000`):

```bash
cp .env.example .env.local
# then edit .env.local with your values
```

### Environment variables

Backend scripts and API routes require `SUPABASE_SERVICE_ROLE_KEY` for authentication. This key is for **server code only** and must never be exposed to the browser. Make sure it is set in `.env.local` after copying `.env.example`.

DispoTool verifies all required variables at startup. The check lives in
`lib/env-check.ts` and is imported by `app/layout.tsx`, causing the build to fail
if any variable is missing.

When deploying to services like Vercel, add `SUPABASE_SERVICE_ROLE_KEY` to both
the **Build** and **Runtime** environment variable sections. The build step
imports `lib/env-check.ts`, so missing variables will stop the deployment.

On Vercel, also ensure the following variables are defined:

- `DISPOTOOL_BASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `ADMIN_TASKS_TOKEN` (generate with `openssl rand -hex 32`)
- `NEXT_PUBLIC_MEDIA_BASE_URL` (optional override for branded short media links; falls back to `NEXT_PUBLIC_APP_URL`, then `SITE_URL`, then `https://app.listhit.io`)
- `AWS_SES_REGION`, `AWS_SES_ACCESS_KEY_ID`, `AWS_SES_SECRET_ACCESS_KEY`, and `AWS_SES_FROM_EMAIL` for transactional email
- `EMAIL_SEND_DELAY_MS`, `EMAIL_RETRY_BACKOFF_MS`, and `EMAIL_RATE_MAX_RETRY` to pace SES sends and retries without hitting provider limits
- `EMAIL_QUEUE_WORKER_ID`, `EMAIL_QUEUE_LEASE_SECONDS`, `EMAIL_QUEUE_MAX_ATTEMPTS`, `EMAIL_QUEUE_BASE_BACKOFF_MS`, and `EMAIL_QUEUE_JITTER_MS` to tune email processing leases and retries

Webhook processes that mirror incoming SMS and MMS to Supabase also need
`TELNYX_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY` and `NEXT_PUBLIC_SUPABASE_URL`.
Without these variables attachments stay on Telnyx-hosted URLs which expire
after 24 hours.
If incoming files don't show a Supabase link, verify these values were
available when the webhook executed.

## Database bootstrap

Provision a fresh Supabase instance by running the consolidated SQL files in `scripts/db` in numeric order:

1. `scripts/db/00_extensions.sql`
2. `scripts/db/01_schema.sql`
3. `scripts/db/02_functions_triggers.sql`
4. `scripts/db/03_rls_policies.sql`
5. `scripts/db/04_seed.sql` (optional demo data)
6. `scripts/db/05_scheduler.sql` (optional pg_cron jobs)

For existing production databases, run `scripts/db/98_schema_patch.sql` first to apply safe fixes, then re-run `scripts/db/03_rls_policies.sql`.

The Supabase Dashboard SQL editor is sufficient—paste or upload each file in order and run it. If you prefer the CLI, pipe each file through `psql $SUPABASE_URL -f <file>` after exporting your database connection string. The `db/legacy` folder retains the historical migrations and prior bootstrap scripts but is not applied to new environments.

## Voice Routing & Tenancy

Voice routing is tenant-aware so each inbound DID can point to a specific customer organization.

### Voice Routing (Multi-tenant)

Voice routing resolves each inbound DID to the correct tenant organization before the Telnyx webhook dispatches the call.

- `public.inbound_numbers` maps every `e164` value to an `org_id` plus optional metadata like `label` and `enabled`.
- The Telnyx webhook normalizes `call.to` / `call.to_number` to E.164, looks up the organization in `public.inbound_numbers`, then falls back to `DEFAULT_ORG_ID` when the DID is unknown.
- Dispatcher fallbacks live in `public.org_voice_settings` and take precedence over the global `FALLBACK_AGENT_SIP_USERNAME`.
- Seed or update DIDs via the admin-only endpoint `POST /api/admin/numbers/seed` protected by the `ADMIN_TASKS_TOKEN` bearer token.

#### DID seeding endpoint

1. Generate an admin token once per environment and store it in `.env.local` and in Vercel project settings as `ADMIN_TASKS_TOKEN` (use `openssl rand -hex 32`).
2. Redeploy after adding the variable so `/api/admin/numbers/seed` runs on the Node runtime in production.
3. Call the endpoint with a JSON payload that includes the desired rows. Numbers are automatically normalized to E.164, deduplicated, and upserted on the `e164` column.

##### Sample payload (`numbers.json`)

```json
{
  "rows": [
    { "e164": "+17708022090", "label": "Main" },
    { "e164": "+17707463936", "label": "Sales" },
    { "e164": "+17703435014", "label": "Line 3" },
    { "e164": "+17702990875", "label": "Line 4" },
    { "e164": "+16789165742", "label": "ATL 1" },
    { "e164": "+16788557545", "label": "ATL 2" },
    { "e164": "+16784030906", "label": "ATL 3" },
    { "e164": "+16782845735", "label": "ATL 4" },
    { "e164": "+16782181871", "label": "ATL 5" },
    { "e164": "+14047603791", "label": "ATL 6" },
    { "e164": "+14046891727", "label": "ATL 7" },
    { "e164": "+14044740361", "label": "ATL 8" },
    { "e164": "+14043482283", "label": "ATL 9" },
    { "e164": "+14042323574", "label": "ATL 10" },
    { "e164": "+17702144873", "label": "Backup" }
  ]
}
```

##### Example cURL request

```bash
curl -X POST "https://<your-app-domain>/api/admin/numbers/seed" \
  -H "Authorization: Bearer $ADMIN_TASKS_TOKEN" \
  -H "Content-Type: application/json" \
  -d @numbers.json
```

##### Sanity checks

- Confirm the seeded rows:

  ```sql
  select e164, label, org_id, enabled
  from public.inbound_numbers
  order by e164;
  ```

- Verify the Telnyx Call Control application webhook URL is set to `https://<your-app-domain>/api/webhooks/telnyx-voice`.

### Onboarding checklist for a new customer

1. Insert or confirm the organization row in `public.organizations`.
2. Insert each of the customer's DIDs into `public.inbound_numbers` with the organization's ID.
3. (Optional) Upsert `public.org_voice_settings` for custom fallback SIP or voicemail behavior.

#### Sample SQL helper

```sql
insert into public.inbound_numbers (e164, org_id, label)
values
  ('+17708020090', 'adddf602-790e-4be7-a0df-04b7bdbd1b1b', 'Main Inbound'),
  ('+17707463936', 'adddf602-790e-4be7-a0df-04b7bdbd1b1b', 'Sales DID')
on conflict (e164) do update
  set org_id = excluded.org_id,
      label = excluded.label,
      enabled = true;

insert into public.org_voice_settings (org_id, fallback_mode, fallback_sip_username)
values (
  'adddf602-790e-4be7-a0df-04b7bdbd1b1b',
  'dispatcher_sip',
  'sip_077357_b5hz'
)
on conflict (org_id) do update
  set fallback_mode = excluded.fallback_mode,
      fallback_sip_username = excluded.fallback_sip_username;
```

### Telnyx dev helper (feature flagged)

- `scripts/dev-list-telnyx-numbers.ts` lists the active numbers on your Telnyx Call Control application and prints a ready-to-edit `INSERT` block.
- The script is disabled by default; set `ENABLE_TELNYX_DEV_TOOLS=1` locally before running it with `pnpm ts-node scripts/dev-list-telnyx-numbers.ts`.
- Never enable the flag in production environments.

### Dev bypass for Agent Portal
Set NEXT_PUBLIC_DEV_BYPASS_AGENT_AUTH=true to skip agent login in development/staging.
Never enable in production.

## Seed the first Admin

1. Set env:
   ADMIN_EMAIL=you@example.com
   ADMIN_PASSWORD=StrongPass!234
   SUPABASE_URL=...
   SUPABASE_SERVICE_ROLE_KEY=...
2. Run: `pnpm seed:admin`
3. Login to the app and visit `/admin/*`

## One-time Admin Seeding
Run once after deploy to provision the first admin user:

```bash
curl -X POST "https://finaldispotool.vercel.app/api/internal/seed-admin" \
  -H "x-seed-token: 123456789"
```

Returns { ok: true, email, userId } on success.
After seeding, remove or disable ADMIN_SEED_TOKEN or delete the route for security.

## Upsert user (internal)
GET https://<your-domain>/api/internal/upsert-user?token=<ADMIN_SEED_TOKEN>&email=<email>&password=<TempPass!234>&name=<Name>&role=admin

Provide Google OAuth details for Gmail features:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GMAIL_FROM`
- `NEXT_PUBLIC_GOOGLE_REDIRECT_URI`
- `OPENAI_API_KEY` (optional)

Setting `OPENAI_API_KEY` enables the optional ChatGPT features. The prompt library lives at `/prompts` where you can store reusable prompts. Selecting a prompt while composing an SMS or email sends it to ChatGPT and inserts the generated text. If your database pre-dates this feature, run `db/legacy/migrations/archive/014-create-ai-prompts.sql` to create the `ai_prompts` table.

With the key set, an **AI Assistant** button appears in message composers and in the SMS and Email campaign modals. It opens a chat modal that lets you converse with ChatGPT and copy or insert the final response into your message. Requests use the **gpt-4o** model and the API caps each conversation at **20 messages** and **8k characters** total.

You can save your last user message as a reusable prompt directly from the modal. Saved prompts show up in the prompt selector for quick insertion in future sessions.

After setting these variables, Gmail threads sync automatically. Visiting
`/gmail` or any endpoint that hits `/api/gmail/threads` triggers a sync.
If you enable the optional scheduler job in `scripts/db/05_scheduler.sql`,
`pnpm run db:schedule` will POST to `/api/gmail/sync-cron` every 5 minutes
using `CRON_SECRET` without needing a hardcoded `user_id`. Running
`pnpm ts-node scripts/gmail-sync.ts` manually is optional if you want to seed
threads right away.

When using Telnyx for voice calls during development, expose your local Next.js
server with a tunneling tool like **ngrok** so Telnyx can reach your public URL.

### Voice Setup

#### Telnyx configuration
- Create or reuse a **Call Control Application** and point its webhook to
  `<BASE_URL>/api/webhooks/telnyx-voice`.
- Assign every inbound DID that should reach DispoTool to that application.

#### Environment
- `TELNYX_API_KEY`
- `CALL_CONTROL_APP_ID`
- `FALLBACK_AGENT_SIP_USERNAME`
- `DEFAULT_ORG_ID` (optional – used to load org-specific routing settings)

#### Presence
- Agents connect to TelnyxRTC in the browser.
- Once connected, the app heartbeats to `/api/agents/presence` every 25 seconds
  with the agent's `sip_username` and a unique `client_id`.

#### Routing
- The webhook normalizes `call.to`/`call.to_number` to E.164 and resolves the org via `public.inbound_numbers` before falling back to `DEFAULT_ORG_ID`.
- It sends the call to the most recently online agent (seen in the last 60 seconds).
- When no agent is available it loads the org's dispatcher settings from `public.org_voice_settings`.
- If no org fallback exists it uses the global `FALLBACK_AGENT_SIP_USERNAME`.
- When no destination is available, the webhook logs the issue but still returns HTTP 200 so Telnyx never retries.

#### Testing
- Launch the Next.js dev server and connect the web client to TelnyxRTC.
- Simulate an inbound webhook locally:

  ```bash
  curl -X POST http://localhost:3000/api/webhooks/telnyx-voice \
    -H 'Content-Type: application/json' \
    -d '{
      "data": {
        "event_type": "call.initiated",
        "payload": {
          "call_control_id": "v3:TEST_CALL_CONTROL_ID"
        }
      }
    }'
  ```

- Watch the terminal or Vercel logs for the Telnyx transfer request. (The
  transfer call will 404 locally, which is expected.)

### Telnyx WebRTC Calls

DispoTool uses Telnyx WebRTC tokens with the `@telnyx/webrtc` SDK instead of SIP trunking. Agents fetch a short-lived token from `/api/agents/<id>/token`, then pass it to the SDK to establish calls.

This endpoint reads the `agent_session` cookie, confirms the path ID matches the logged-in agent, and requests a token from Telnyx using the agent's `sip_username`. It requires the following environment variables:

- `TELNYX_API_KEY`
- `CALL_CONTROL_APP_ID` (accepts legacy `VOICE_CONNECTION_ID` / `TELNYX_VOICE_CONNECTION_ID`)
- `TELNYX_DEFAULT_CALLER_ID`

### Demo call-center agent

Running `scripts/db/04_seed.sql` now provisions a placeholder agent so the voice UI works immediately after seeding:

- **Email:** `agent1@company.com`
- **Password:** `test123`
- **SIP Username:** `agent1`
- **SIP Password:** `test123`

Update the Telephony Credential ID once you create a credential in the Telnyx portal:

```sql
UPDATE agents
SET telephony_credential_id = 'YOUR_TELNYX_CREDENTIAL_ID'
WHERE email = 'agent1@company.com';
```

Replace the seeded password before deploying to production:

```sql
UPDATE agents
SET password_hash = crypt('YourStrongPassword', gen_salt('bf')),
    sip_password = 'YourTelnyxPassword'
WHERE email = 'agent1@company.com';
```

Delete the row entirely if you prefer to provision agents manually.

See the Telnyx docs for [Call Control Apps](https://developers.telnyx.com/docs/api/v2/call-control/Applications) and [WebRTC tokens](https://developers.telnyx.com/docs/api/v2/webrtc/WebRTC-Tokens) for more details.

## Database Setup

Use the consolidated scripts in `scripts/db` (see the **Database bootstrap** section above) to install the schema, functions, RLS policies, optional seed data, and scheduler jobs. All historical migrations have been archived to `db/legacy` for reference when backfilling very old environments; they are not required for new deployments.

The campaign system uses Telnyx for SMS and AWS SES for email delivery with a
leased email queue. Define the following variables in `.env.local`:

- `TELNYX_API_KEY`
- `TELNYX_PUBLIC_KEY`
- `SKIP_TELNYX_SIG` (optional, set to `1` locally to bypass signature checks)
- `TELNYX_MESSAGING_PROFILE_ID`
- `TELNYX_DEFAULT_CALLER_ID` – default caller ID (e.g., your DID) for outbound calls
- `CALL_CONTROL_APP_ID` – Voice connection ID used for `/v2/telephony_credentials` (legacy `VOICE_CONNECTION_ID` / `TELNYX_VOICE_CONNECTION_ID` are still read as fallbacks)
- `VOICE_SYNC_SECRET_KEY`
- `AWS_SES_REGION`, `AWS_SES_ACCESS_KEY_ID`, `AWS_SES_SECRET_ACCESS_KEY`, `AWS_SES_FROM_EMAIL`, and `AWS_SES_FROM_NAME` for SES-signed sends
- `AWS_SES_CONFIGURATION_SET` if you use configuration sets for feedback loops
- `AWS_SNS_TOPIC_ARN` for bounce/complaint notifications
- `EMAIL_QUEUE_WORKER_ID` (optional, defaults to a random worker name)
- `EMAIL_QUEUE_LEASE_SECONDS` (how long a worker owns a job)
- `EMAIL_QUEUE_MAX_ATTEMPTS` (max retry attempts before a job is marked dead)
- `EMAIL_QUEUE_BASE_BACKOFF_MS` and `EMAIL_QUEUE_JITTER_MS` (exponential backoff + jitter for retries)
- `SHORTIO_API_KEY`
- `SHORTIO_DOMAIN`

Create a Voice Connection in the Telnyx portal with both URLs pointing to `<BASE_URL>/api/webhooks/telnyx-voice` and assign your numbers to it. The **Voice Connection ID** is shown in **Voice → Connections** when you open the connection details; this numeric value is what Telnyx calls the "Credential Connection ID". Set this value in `CALL_CONTROL_APP_ID` (legacy `VOICE_CONNECTION_ID` / `TELNYX_VOICE_CONNECTION_ID` variables are still supported as fallbacks). Set `TELNYX_DEFAULT_CALLER_ID` to the default caller ID (e.g., your DID) for outbound calls. Per-agent telephony credentials are created automatically under the configured voice connection whenever an agent is provisioned or requests a WebRTC token.

The TelnyxDeviceProvider now authenticates with a short-lived login token generated by `/api/telnyx/token` through a direct API call. Incoming calls will ring in the app once the connection is configured. The API creates telephony credentials on demand and requests a token from `/v2/telephony_credentials/:id/token`. Credentials are stored in Supabase and deleted automatically after 24 hours.

On first load you'll see a "Tap anywhere to enable audio" banner. Interacting with the page once unlocks the ringtone for incoming calls. This sets `audioUnlocked` in `localStorage` so the prompt only appears the first time.

### Telnyx Voice Calling (WebRTC)

This app supports inbound and outbound calls via Telnyx WebRTC using token-based authentication. To enable:

- Create a Voice Connection in the Telnyx Portal and assign it to your DID number and Outbound Voice Profile.
- Add these values to `.env.local`; they are required for voice calling:

```
  TELNYX_API_KEY=your_tenlyx_api_key
  TELNYX_DEFAULT_CALLER_ID=your_default_caller_id
  CALL_CONTROL_APP_ID=your_voice_connection_id  # VOICE_CONNECTION_ID / TELNYX_VOICE_CONNECTION_ID fall back here
  # Optional TURN credentials if behind a restrictive firewall
  NEXT_PUBLIC_TELNYX_TURN_USERNAME=your_turn_username
  NEXT_PUBLIC_TELNYX_TURN_PASSWORD=your_turn_password
```

Ensure `TELNYX_API_KEY` belongs to the same Telnyx account as your voice connection.
Tokens will not generate if the voice connection ID is invalid or tied to a
different account.

- Point both the **Webhook URL** and **Answer URL** for your number to `<BASE_URL>/api/webhooks/telnyx-voice`.

Client-side calls are initialized using a one-time token retrieved from `/api/telnyx/token`, which generates the login token directly via the Telnyx API.

Create a private API key from the Short.io dashboard under **Integrations → API**
and verify your custom domain in the **Domains** section. Set
`SHORTIO_API_KEY` to that private key and `SHORTIO_DOMAIN` to the domain you
added (for example `links.example.com`). Only these two values are required—no
public key or domain ID is needed.

```ts
import { createShortLink } from "@/services/shortio-service"

const { shortURL, path } = await createShortLink("https://example.com/page")
console.log(shortURL, path)
```

Twilio support has been removed. SMS and voice now rely solely on these Telnyx variables.

`TELNYX_API_KEY` authenticates API requests and generates the WebRTC token. `TELNYX_MESSAGING_PROFILE_ID` controls SMS sending. `CALL_CONTROL_APP_ID` identifies the credential connection used for outbound calls and agent-specific SIP credentials (legacy `VOICE_CONNECTION_ID` / `TELNYX_VOICE_CONNECTION_ID` values are supported for compatibility). Webhook requests are verified using `TELNYX_PUBLIC_KEY` for Ed25519 signatures. `TELNYX_API_KEY` must also be set so incoming MMS are mirrored to Supabase; Telnyx-hosted URLs expire after 24 hours.
Telephony credentials are created automatically as needed and stored in the `telnyx_credentials` table. Tokens are issued via `/v2/telephony_credentials/:id/token` and are not saved.

### Voice Components and Call Flow

All UI elements for dialing and handling calls live in [`components/voice/`](components/voice/).
Outbound calls are initiated by [`app/api/calls/outbound/route.ts`](app/api/calls/outbound/route.ts), which sends the request to Telnyx and stores the call ID in Supabase.
Telnyx posts events for both outbound and inbound calls to [`app/api/webhooks/telnyx-voice/route.ts`](app/api/webhooks/telnyx-voice/route.ts).
Unit tests for this endpoint live in [`tests/telnyx-voice-webhook.test.ts`](tests/telnyx-voice-webhook.test.ts) and mock Telnyx events with a fake Supabase client. Use these tests as a reference when adding or debugging voice features.
The webhook updates call records, saves recordings and bridges incoming callers directly to the web client.

### Voice Numbers

Run `/admin/sync-numbers` whenever you need to pull your Telnyx inventory into Supabase. The page POSTs to `/api/internal/sync-numbers`, a proxy route that forwards the request to `/api/sync/voice-numbers` and adds the `Authorization` header from `VOICE_SYNC_SECRET_KEY` on the server. Users simply send a POST request to the internal endpoint and the proxy handles the secret header. The sync fetches all numbers from Telnyx and upserts them into the `voice_numbers` table.

The table stores the following fields:

- `id` – UUID primary key
- `phone_number` – unique phone number
- `friendly_name` – optional alias
- `provider_id` – Telnyx number ID
- `connection_id` – voice connection ID
- `messaging_profile_id` – messaging profile ID
- `status` – provisioning status
- `tags` – array of tags
- `created_at` – timestamp of the last sync

If your database was created before these fields existed, run
`db/legacy/migrations/archive/018-add-voice-number-sync-fields.sql` to add them.

## Marketing Campaigns

Create and view campaigns at `/campaigns`. The composer at `/campaigns/new`
lets you choose between SMS or Email, write your message (and optional email
subject), filter recipients by group, tag or location, and schedule delivery.
Leaving the schedule blank sends the campaign immediately.
When sending emails, any URLs in the message body are shortened using
Short.io. The generated key is stored per recipient for later analytics and
click counts can be retrieved via `/api/short-links/clicks`.

### SMS Compliance

Include opt-out instructions like "Reply STOP to unsubscribe" in your SMS messages as needed. When a buyer replies with STOP, Telnyx posts to the `/api/webhooks/telnyx-incoming-sms` route which disables their `can_receive_sms` flag.
Delivery status updates should target the `/api/webhooks/telnyx-status` endpoint.
Configure your Telnyx number with `<BASE_URL>/api/webhooks/telnyx-voice` for both the **Answer URL** and **Webhook URL**. Inbound calls are bridged by returning `<Connect><Client>listhitapp</Client></Connect>` from this webhook.
Set additional webhooks to:
`<BASE_URL>/api/webhooks/telnyx-incoming-sms` for inbound SMS/MMS and STOP events
`<BASE_URL>/api/webhooks/telnyx-status` for delivery receipts and call status updates.
Enable recording and status callbacks pointing to the voice URL so outbound and inbound calls hit the same route.

The voice webhook must be publicly reachable so Telnyx can deliver events. When developing locally, expose your Next.js server with **ngrok** and update the webhook URL in the Telnyx dashboard to the public address.


Configure these URLs in the Telnyx dashboard so incoming calls and status events POST to your deployment.

### SMS Rate Limits

SMS delivery is throttled by the limiter in `lib/sms-rate-limiter.ts` to keep
traffic within carrier guidelines. Each carrier has its own queue and T-Mobile
is capped at **10k segments per day**. Adjust the behavior with these variables
in `.env.local`:

- `TELNYX_GLOBAL_MPS` – overall messages per second
- `TELNYX_CARRIER_MPS` – per-carrier messages per second
- `TELNYX_TMO_DAILY_LIMIT` – daily T-Mobile segment limit

See Telnyx's messaging compliance docs
for details on required registration and throughput limits.

### Supported MMS File Types and Sizes

DispoTool supports `.jpg`, `.jpeg`, `.png`, `.gif`, `.bmp`, `.webp`, `.m4a`, `.mp3`, `.wav`, `.ogg`, `.oga`, `.opus`, `.amr`, `.webm`, `.weba`, `.mp4`, `.3gp`, and `.pdf` attachments. Audio in `.amr`, `.webm`, `.weba`, `.3gp`, `.wav`, `.ogg`, and `.m4a` is automatically converted to `.mp3` before upload and only the resulting link is stored. Each file must be under **1 MB**.

The allowed extensions and size limit are defined in `utils/uploadMedia.ts`. If you change the limit there, update this note as well.

Incoming attachments are saved under `/incoming` and outgoing ones under `/outgoing`. Audio files in unsupported formats are converted to `.mp3` automatically.
The conversation UI only displays `.mp3` audio attachments, so other formats are ignored in the thread view.

### Troubleshooting Incoming MMS Storage

Attachments saved with external Telnyx URLs mean the webhook could not upload the file to Supabase. Ensure `TELNYX_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY` and `NEXT_PUBLIC_SUPABASE_URL` were available when the event was processed. The API logs a message like `Missing required environment variables: ...` and returns a `500` error if any are missing. After correcting the variables, resend the webhook payload to store the file with a Supabase link.

When Telnyx returns media URLs but none are saved, the webhook logs a warning:

```
⚠️ ensurePublicMediaUrls returned empty array { rawMediaUrls: [...], mediaUrls: [] }
```

If saving the message itself fails, an error log like the following includes the database detail:

```
❌ Message insert error { message: "...", detail: "..." }
```

### Sending Campaigns

Campaign delivery is handled by the `/api/campaigns/send` route. Requests must
include an `Authorization` header. Use the Supabase service role key for
internal calls or supply a user access token that matches the campaign's owner.
If the token does not belong to the campaign owner, the route responds with
`403 Forbidden`.


## Linting

Make sure dependencies are installed with `./scripts/setup.sh` before linting:

```bash
./scripts/setup.sh
pnpm run lint
```

## Development

Start the development server after dependencies are installed:

```bash
pnpm dev
```

## Theme Colors

The main color palette lives in `app/globals.css`. The `:root` block defines
custom properties like `--primary`, `--accent`, and their `*-foreground`
counterparts. These values use HSL notation and are consumed throughout the UI
via Tailwind's `bg-[color:var(--primary)]` style syntax.

Change the HSL values to update the theme. For example adjust `--primary` for
your brand color and `--accent` for highlights, updating the corresponding
foreground variables to ensure contrast. Edit the `.dark` block to modify the
dark mode palette.

## Assigning Buyers to Groups

New buyers can now be assigned to groups during creation via the **Assign to Groups** section in the Add Buyer modal. Newly created groups are automatically selected and group counts refresh after the buyer is added.

## Email Queue Resilience

Email campaigns enqueue one row per recipient in `email_campaign_queue` with per-contact payloads. Each row now tracks `recipient_id`, `buyer_id`, `to_email`, `attempts`, `max_attempts`, `locked_at`, `lock_expires_at`, `locked_by`, `last_error`, and `sent_at` so workers can lease jobs safely. Supabase RPC helpers `claim_email_queue_jobs` and `requeue_stuck_email_jobs` manage leasing and requeuing stuck work, and the queue enforces idempotency with a unique `(campaign_id, recipient_id)` constraint.

Control pacing and retries with the email-specific environment variables: `EMAIL_SEND_DELAY_MS` sets the gap between individual sends, `EMAIL_RETRY_BACKOFF_MS` controls the cooldown when SES returns rate limit errors, and `EMAIL_RATE_MAX_RETRY` caps rate-limit retries before marking a job as failed. Leave these at their defaults if you are not tuning SES throughput.

## Location Suggestions

Location selectors use the `locations.json` file at the project root. This dataset lists every city and county in the United States along with its state ID. The `searchLocations` helper in `lib/location-utils.ts` loads the file on first use and searches it in memory. Because the data is bundled with the client, location suggestions work entirely client-side without querying Supabase.

## Scheduling Property Showings

Showings can be scheduled from multiple places in the interface:

- **Buyers list** – open the buyer details or edit modal and click **Schedule Showing** to link the buyer to a property.
- **Property page** – use the **Schedule Showing** button to quickly set a viewing for the displayed property.
- **Showings page** – navigate to `/showings` to see upcoming appointments and click **Schedule Showing** to create a new entry.

The `showings` table keeps track of the buyer, property, scheduled time, and notes. Reminders can optionally be sent via Telnyx; if you implement this feature, provide `TELNYX_API_KEY` and a sending number in your `.env.local`.

## Testing

Make sure dependencies are installed with `./scripts/setup.sh` before running tests:
```bash
./scripts/setup.sh
pnpm test
```

The GitHub Actions workflow automatically lints and tests on every push.

## Deployment

- `pnpm run db:schedule` – enables pg_cron/pg_net and (re)creates the scheduler job.

### Supabase Secrets

Before enabling the scheduler, set the required secrets in Supabase:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET` generated with `openssl rand -hex 32` (used by cron callbacks and the edge function; keep this out of SQL commands)
- `DISPOTOOL_BASE_URL` (or `SITE_URL`) pointing to your deployed Next.js site
- `FUNCTION_URL` pointing to your deployed `send-scheduled-campaigns` function (if you use the edge function trigger)
- `AWS_SES_REGION`, `AWS_SES_ACCESS_KEY_ID`, `AWS_SES_SECRET_ACCESS_KEY`, and `AWS_SES_FROM_EMAIL` so cron-triggered email processing can sign SES requests
- Optional queue tuning values like `EMAIL_QUEUE_WORKER_ID`, `EMAIL_QUEUE_LEASE_SECONDS`, and `EMAIL_QUEUE_MAX_ATTEMPTS` if you need to override defaults in scheduled jobs

On Vercel, set these variables in both the **Build** and **Runtime** sections
to prevent build failures.

`pnpm run db:schedule` uses `envsubst` to inject these secrets into the SQL before applying it. Run the command from a terminal where the variables above are already exported so the cron jobs point at the correct URLs and credentials.
`CRON_SECRET` is the preferred credential for scheduled HTTP callbacks so pg_cron jobs do not need the Supabase service role key embedded in SQL.

### Cron Security

- `pg_cron` jobs and the `send-scheduled-campaigns` edge function must send `Authorization: Bearer <CRON_SECRET>` when calling protected endpoints.
- Do **not** embed `SUPABASE_SERVICE_ROLE_KEY` inside `cron.job.command`; keep it in Supabase secrets for admin access only.
- To rotate `CRON_SECRET`, generate a new value, update Vercel environment variables, update Supabase secrets (including the edge function), redeploy the edge function, then re-run `pnpm run db:schedule` so `pg_cron` picks up the new header.

### After Supabase redeploy

When Supabase is redeployed, refresh every copy of the credentials to avoid token drift:

- Vercel environment variables: `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_URL`
- Supabase Edge Function secrets for `send-scheduled-campaigns`: `CRON_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `pg_cron` jobs if `CRON_SECRET` changed (rerun `pnpm run db:schedule` so headers update)

### Validate cron secrets

`pg_cron` jobs call Next.js routes for campaigns and Gmail sync. Use `CRON_SECRET` in the `Authorization: Bearer ...` header for these calls. Make sure the Supabase project secrets that cron can read match the values used by your deployed app:

- `CRON_SECRET` should be present in Supabase so scheduled HTTP jobs can authenticate without exposing the service role key. Generate one locally with `openssl rand -hex 32`, set it in Vercel, then run `supabase secrets set CRON_SECRET=...`.
- `SITE_URL` (or `DISPOTOOL_BASE_URL` for backward compatibility) must be the public URL of the deployed site (for example `https://app.listhit.io`). A localhost value will cause the HTTP calls to fail inside Supabase.

Check what Supabase has stored with:

```bash
supabase secrets list --project-ref <project_id>
```

If either value is missing or incorrect, re-run the `supabase secrets set ...` command above. After correcting the secrets, run `pnpm run db:schedule` to recreate the cron jobs with the updated environment.

After the secrets are configured, run `pnpm run db:schedule` to create the cron jobs.
The email processing and stuck-job requeue cron tasks now run every **minute** as defined in `scripts/db/05_scheduler.sql`.
For production, change the cron expressions in that file to `*/5 * * * *` so campaign tasks run every five minutes instead of every minute during local testing.

To deploy the edge function that sends scheduled campaigns, run:

```bash
supabase functions deploy send-scheduled-campaigns
```

This uploads `supabase/functions/send-scheduled-campaigns` using the project ID from `supabase/config.toml`.

### Cron scheduling (Supabase SQL editor)

If you run `scripts/db/05_scheduler.sql` directly in the Supabase SQL editor, replace placeholders like `${SITE_URL}`, `${CRON_SECRET}`, and `${FUNCTION_URL}` with the correct values before executing.

After applying the script, the **Jobs** tab in Supabase should list:

- `send-scheduled-campaigns` (edge function trigger, runs every 5 minutes)
- `process-email-queue` (Next.js route, runs every minute locally; switch to every 5 minutes in production)
- `requeue-stuck-email-jobs` (Next.js route, runs every minute locally; switch to every 5 minutes in production)
- `sync-gmail-threads` (optional; keep commented unless Gmail sync is enabled)
- `cleanup-telnyx-creds` (optional Telnyx cleanup; commented by default)

### Gmail Sync

`scripts/db/05_scheduler.sql` also creates a second cron job that POSTs to
`/api/gmail/sync-cron` every **5 minutes**. The cron-safe route accepts
`Authorization: Bearer <CRON_SECRET>` (or the service role key for backward
compatibility) and does **not** require hardcoded `user_id` values. When called
without a `userId` payload it selects accounts from `gmail_tokens` that have
`last_synced_at` older than five minutes (or null), limits the batch size with
`limitUsers` (default 10), and updates `gmail_tokens.last_synced_at` after each
sync. The job uses `SITE_URL` (falling back to `DISPOTOOL_BASE_URL` if provided)
to build the URL, so set that secret before running `pnpm run db:schedule`.

#### Troubleshooting

If threads aren't syncing:

- Double-check that all Gmail environment variables from `.env.example` are set
  (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GMAIL_FROM` and
  `NEXT_PUBLIC_GOOGLE_REDIRECT_URI`). Missing values will cause the Gmail API
  client to fail.
- A revoked or expired Gmail OAuth grant stored in `gmail_tokens` will stop sync.
  Reconnect the inbox so a valid refresh token is stored in the table.

Verify the scheduler is active by running:

```sql
select * from cron.job where jobname = 'sync-gmail-threads';
```

If no row is returned, recreate the job with:

```bash
pnpm run db:schedule
```


## Deployment & Domains

Set `NEXT_PUBLIC_BASE_URL` and `DISPOTOOL_BASE_URL` to the full URL of your site.
For example, deploying to `https://app.listhit.io` requires:

```bash
NEXT_PUBLIC_BASE_URL=https://app.listhit.io
DISPOTOOL_BASE_URL=https://app.listhit.io
```

After deployment, log in at `/login` and access the admin tools at `/admin/users`.
Add your domain in Vercel's dashboard and point its DNS records to Vercel before going live.
## 🔗 Short.io Setup


1. Create an account at [short.io](https://short.io).
2. Add the domain `go.georgiawholesalehomes.com` to your account.
3. Generate a **Private API Key** from the Short.io dashboard.
4. Set the following variables in `.env.local`:

   ```
   SHORTIO_API_KEY=your_private_key
   SHORTIO_DOMAIN=go.georgiawholesalehomes.com
   NEXT_PUBLIC_SHORTIO_DOMAIN=go.georgiawholesalehomes.com
   ```

Only server-side calls need the API key, so you don't expose it to the browser.
