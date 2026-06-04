# ListHit

**ListHit is a real-estate dispositions CRM** for wholesalers and agents — the system of record for buyers, properties, showings, and offers, with built-in SMS, voice calling, and email campaigns to move deals. It is built to a genuinely multi-tenant, production standard: every tenant's data is isolated at the database level, and the same codebase powers both an in-house operation and external organizations.

This README is the single source of truth for what the app is, how it's built, and how to run it. For the disaster-recovery / new-environment playbook, see [`docs/FRESH_ENVIRONMENT_SETUP.md`](docs/FRESH_ENVIRONMENT_SETUP.md).

---

## Contents

- [What ListHit does](#what-listhit-does)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Repository layout](#repository-layout)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Database](#database)
- [Background jobs (cron + queues)](#background-jobs-cron--queues)
- [Integrations](#integrations)
- [Multi-tenancy & security](#multi-tenancy--security)
- [Testing & CI](#testing--ci)
- [Deployment](#deployment)
- [Conventions](#conventions)
- [Known cleanup](#known-cleanup)

---

## What ListHit does

ListHit is organized around the deal lifecycle. The main areas:

- **Dashboard** — cockpit of live metrics (active properties, buyers added, showings, offers accepted, close rate), a profit zone, deal funnel, and activity charts, all backed by real Supabase queries.
- **Buyers** — the buyer database: tags, groups, consent/opt-in tracking, import/export, and per-buyer message history.
- **Properties** — property listings with images, slugs, and a public-facing detail page; deal economics feed the dashboard.
- **Showings** — schedule showings and send automated reminders.
- **Offers** — track offers through to accepted/closed, with due-diligence and closing fields.
- **Campaigns** — SMS and email campaigns with segment-based targeting, a queue-driven sender, and per-campaign analytics (delivery, clicks, replies, opt-outs).
- **SMS Inbox** — two-way SMS threads with sticky sender resolution and opt-out handling.
- **Email Inbox** — multi-account Gmail integration (OAuth) for sending and triaging email.
- **Calls** — browser-based voice calling (WebRTC), call recording, voicemail with custom greetings, and a call log with playback.
- **Settings** — profile, organization, users & roles/permissions, markets (phone-number grouping), email domains (self-service SES verification), message templates, segments, negative keywords, and Do-Not-Contact.

A public API (`/api/public/*`) powers the marketing site (buyer signup, property listings) and native branded short links.

## Tech stack

- **Framework:** Next.js 14 (App Router) + TypeScript
- **UI:** Tailwind CSS + shadcn/ui (Radix primitives)
- **Backend:** Supabase — Postgres (with Row-Level Security), Auth, and Storage
- **Hosting:** Vercel (web app, serverless API routes, cron)
- **Package manager:** pnpm `10.4.0` · **Node:** `>=18.17 <23`
- **Testing:** Vitest (unit/integration) + Cypress (e2e)

## Architecture

ListHit is a single Next.js application: server-rendered pages and ~150 API route handlers, deployed on Vercel.

- **Data & auth:** Supabase Postgres is the backend. The browser and server use Supabase clients (`lib/supabase/`); agent authentication is native Supabase Auth. Row-Level Security isolates every tenant's data (see [Multi-tenancy & security](#multi-tenancy--security)).
- **Background work:** Vercel cron triggers a set of API endpoints on a schedule to drain the SMS and email send queues, send showing reminders, refresh email-sender reputation, and sync voice numbers (see [Background jobs](#background-jobs-cron--queues)).
- **Integrations:** Telnyx (SMS + voice), AWS SES (marketing email), Resend (transactional email), AWS Polly (voicemail greetings), Gmail (inbox), OpenAI (AI copy/assistant), Mapbox (maps/geocoding), and DeBounce (email validation).
- **File handling:** large uploads (property images, recordings) go **directly** from the browser to Supabase Storage via signed URLs — never routed through an API route — to stay under Vercel's request size limit.

## Repository layout

```
app/            Next.js App Router — pages and ~150 API route handlers (app/api/*)
components/     Shared and domain UI components (+ shadcn primitives in components/ui)
services/       Data-access / integration layer (dashboard, campaigns, calls, voicemail, etc.)
lib/            Cross-cutting utilities: Supabase clients, auth/org context, permissions,
                SMS/voice helpers, segments, email senders, logging
hooks/          React hooks (notifications, realtime, etc.)
supabase/       Supabase config, edge functions, and migrations/ (the schema baseline)
scripts/db/     archive/ — historical SQL migrations, superseded by the baseline (kept for reference)
docs/           FRESH_ENVIRONMENT_SETUP.md and other documentation
tests/          Vitest suites    cypress/  e2e specs
```

## Getting started

Prerequisites: Node `>=18.17 <23` and pnpm `10.4.0`.

```bash
# 1. install dependencies
pnpm install

# 2. configure environment
cp env.example .env.local
# then fill in .env.local (see Environment variables below)

# 3. run the dev server
pnpm dev          # http://localhost:3000
```

Useful scripts:

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start the dev server |
| `pnpm build` | Production build (must pass before any PR) |
| `pnpm lint` | ESLint |
| `pnpm test` | Run the Vitest suite |
| `pnpm cy` | Run Cypress e2e tests |

## Environment variables

All required variables are documented in [`env.example`](env.example) — copy it to `.env.local` for local work and set the same values in Vercel for deploys. The essentials:

- **Supabase:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- **App:** `NEXT_PUBLIC_BASE_URL`, `APP_TIMEZONE`
- **Secrets** (generate with `openssl rand -hex 32`): `CRON_SECRET`, `EMAIL_UNSUBSCRIBE_SECRET`, `VOICE_SYNC_SECRET_KEY`, `ADMIN_TASKS_TOKEN`
- **Telnyx** (SMS + voice): API key, messaging profile, call-control app, `DEFAULT_OUTBOUND_DID`, WebRTC credentials
- **Email:** AWS SES credentials/region + `AWS_SES_FROM_EMAIL`; `RESEND_API_KEY` / `RESEND_FROM_EMAIL` for transactional notifications
- **Polly** (voicemail greetings): `AWS_POLLY_*`
- **Gmail OAuth:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, redirect URI
- **AI:** `OPENAI_API_KEY`
- **Other:** `NEXT_PUBLIC_MAPBOX_TOKEN`, `DEBOUNCE_API_KEY`, short-link domains

## Database

The entire schema lives in **one file**: [`supabase/migrations/00000000000000_baseline.sql`](supabase/migrations/00000000000000_baseline.sql). It is a `pg_dump` snapshot of production (51 tables, 231 RLS policies, 29 functions, 27 triggers, all indexes and constraints) plus the required extensions and the `auth.users` signup trigger. Running this one file recreates the complete database.

- **Apply it:** `supabase db reset` (CLI) or paste it into the Supabase SQL editor.
- **History:** every prior incremental migration (75 files across two old systems) is archived under `scripts/db/archive/` for reference. The baseline supersedes all of them — a fresh database only needs the baseline.
- **Going forward:** add each new schema change as a new timestamped file in `supabase/migrations/` and apply it in the Supabase SQL editor.
- **Standing up a brand-new environment** (new database operator, disaster recovery): follow [`docs/FRESH_ENVIRONMENT_SETUP.md`](docs/FRESH_ENVIRONMENT_SETUP.md), which also covers Storage buckets, secrets, cron, and bootstrapping the first owner — the things a schema file can't carry.

## Background jobs (cron + queues)

Scheduling is driven entirely by **Vercel cron** (`vercel.json`); the old Supabase `pg_cron` scheduler is retired. Cron requests are GET requests authenticated with `CRON_SECRET`. The jobs:

| Endpoint | Schedule | Job |
| --- | --- | --- |
| `/api/sms-campaigns/process` | every minute | drain the SMS send queue |
| `/api/email-campaigns/process` | every minute | drain the email send queue |
| `/api/cron/dispatch-due-campaigns` | every 2 min | release scheduled campaigns when due |
| `/api/sms-campaigns/requeue-stuck` | every 5 min | recover stuck SMS jobs |
| `/api/email-campaigns/requeue-stuck` | every 5 min | recover stuck email jobs |
| `/api/cron/ses-reputation` | every 5 min | refresh SES reputation snapshot |
| `/api/cron/showing-reminders` | every 15 min | send showing reminders |
| `/api/sync/voice-numbers` | daily 06:00 | sync Telnyx voice numbers |

Sends are queue-backed (`sms_campaign_queue`, `email_campaign_queue`) with leasing, retries, and backoff, so throughput is paced and failures are recovered rather than lost.

## Integrations

- **Telnyx** — SMS (two-way, delivery/cost/segment tracking, opt-outs) and voice (WebRTC browser calling, recording, voicemail).
- **AWS SES** — marketing/campaign email, with self-service domain verification and per-org verified senders.
- **Resend** — transactional notifications (`notifications@listhit.io`).
- **AWS Polly** — text-to-speech voicemail greetings.
- **Gmail** — multi-account OAuth inbox (send, reply, label, sync).
- **OpenAI** — AI message copy generation and an in-app assistant (both require an authenticated user).
- **Mapbox** — maps and address autocomplete/geocoding.
- **DeBounce** — email validation on public buyer signup.

### Telnyx webhook configuration

In the Telnyx dashboard, point your numbers' webhooks at these routes (replace `<BASE_URL>` with your deployed URL):

| Telnyx setting | URL | Handles |
| --- | --- | --- |
| Voice — Answer URL + Webhook URL | `<BASE_URL>/api/webhooks/telnyx-voice` | inbound/outbound call events, recordings, voicemail |
| Messaging — inbound | `<BASE_URL>/api/webhooks/telnyx-incoming-sms` | inbound SMS/MMS and STOP/opt-out events |
| Messaging — delivery status | `<BASE_URL>/api/webhooks/telnyx-status` | delivery receipts and call status updates |

SMS throughput is paced by `lib/sms-rate-limiter.ts`; tune it with `TELNYX_GLOBAL_MPS` (overall messages/sec), `TELNYX_CARRIER_MPS` (per-carrier messages/sec), and `TELNYX_TMO_DAILY_LIMIT` (daily T-Mobile segment cap).

## Multi-tenancy & security

ListHit is multi-tenant with defense-in-depth:

- Every tenant table carries an `org_id`. Row-Level Security policies (via the `auth_org_id()` `SECURITY DEFINER` helper) are the hard guarantee, and application code also filters by `org_id` explicitly as a second layer.
- Routes that use the service-role client (which bypasses RLS) **must** filter by `org_id` in application code — RLS does not protect service-role access.
- Authorization is role + per-key permissions (`profiles.role` plus the `permissions` table), checked server-side via `lib/permissions/server.ts`.
- Email unsubscribe links are HMAC-signed; cron endpoints require `CRON_SECRET`.

## Testing & CI

- `pnpm test` runs Vitest; `pnpm cy` runs Cypress.
- GitHub Actions runs build + tests on every PR. The **build** step is required and blocks merges; the test step reports results. `main` is protected — changes land via pull request.
- Before opening a PR: `pnpm build` must pass with zero type errors.

## Deployment

- Hosted on **Vercel**; pushes to `main` deploy to production.
- Cron jobs register automatically from `vercel.json` on the first production deploy.
- Set all environment variables (see above) in the Vercel project settings.

## Conventions

- TypeScript, functional React components, 2-space indent, double quotes.
- Prefer focused changes over large rewrites; keep each PR green (`pnpm build`) before the next.
- Tailwind utility-first styling; reuse `components/ui` primitives before adding new UI.

## Known cleanup

Minor, non-blocking housekeeping:

- `package.json` still has a `db:schedule` script that points to `scripts/db/05_scheduler.sql` (now archived) and drove the retired pg_cron scheduler — safe to delete.
- `scripts/seed-admin.mjs` (`pnpm seed:admin`) predates Supabase-Auth-based onboarding; review before relying on it.
