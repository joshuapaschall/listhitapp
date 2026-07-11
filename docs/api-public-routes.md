# Intentionally-public API routes

> **Read this before adding any `/api/**` route.**
>
> `middleware.ts` bypasses auth for **every** `/api/` path (its `allowedPrefixes`
> includes `"/api/"`), delegating authentication to each route. That means a new
> API route ships **completely open** unless it does one of the following itself:
>
> 1. **Authenticates the session** — `requireOrgContext()` (or the
>    `getOrgScopedClient()` wrapper) and returns `401`/`400` when there is no
>    user/org. This is the default for anything the browser calls.
> 2. **Verifies a provider signature** — webhooks validate the caller
>    (Telnyx Ed25519 / Twilio signature).
> 3. **Checks a job secret** — cron/job routes call `requireCronAuth()`
>    (`CRON_SECRET`).
>
> If a route does **none** of these, it is public by design and **must be listed
> below with a reason**. "Public by accident" is a security bug — see the
> `/api/numbers/list` incident that motivated this doc (it returned the owner's
> entire Telnyx phone-number inventory to any unauthenticated caller and to every
> tenant's dialer).

## Intentionally public (no session)

| Route | Why public | Guard |
|---|---|---|
| `app/api/public/**` | Tenant marketing sites, signup/lead forms, public property + location lookups | Org resolved from request host or slug; no cross-tenant data returned |
| `app/api/unsubscribe/**` | One-click unsubscribe from marketing emails (no login) | Opaque id/token in the link |
| `app/api/buyers/[id]/unsubscribe` | One-click unsubscribe from a specific buyer's emails | Opaque buyer id/token |
| `app/api/m/[id]` | Email open/click tracking pixel — fired by mail clients with no session | Opaque id |
| `app/api/short-links/clicks` | Public short-link redirect telemetry | Opaque slug |
| `app/api/media-links` | Public media fetch for MMS (carriers/recipients fetch without a session) | Opaque id |
| `app/api/csp-report` | Browser CSP violation reports (POSTed by the browser, no session) | None needed — write-only report sink |
| `app/api/webhooks/**` | Provider callbacks (Telnyx, Twilio, SES) | Provider signature validation |
| Cron/job routes (e.g. `app/api/telnyx/cleanup`, `app/api/*-campaigns/process`, `app/api/recordings/sync`, `app/api/*-campaigns/requeue-stuck`, `app/api/gmail/sync-cron`) | Scheduled jobs invoked by the platform scheduler, not a browser | `requireCronAuth()` / `CRON_SECRET` |

## Everything else must authenticate

Any route not in the table above is expected to call `requireOrgContext()` (or
`getOrgScopedClient()`) at the top of every exported handler, return `401` when
there is no `user` and `400` when there is no `orgId`, and use the returned
`supabase` (cookie-authed) client — scoping org-owned tables with
`.eq("org_id", orgId)` as belt-and-braces alongside RLS.
