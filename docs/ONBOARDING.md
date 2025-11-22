# DispoTool onboarding overview

## Core stack and setup
- Built on the Next.js App Router with Tailwind CSS styling, shadcn/ui components, and Supabase for auth/data, mirroring an InvestorLift-style CRM workflow. See the root README for the stack description and environment expectations.【F:README.md†L1-L74】
- The root layout registers global styles, Google Inter font, and wraps pages with `ClientProviders` while importing the environment guard in `lib/env-check.ts` so missing variables break builds early.【F:app/layout.tsx†L1-L26】

## Repository layout
- **app/**: App Router routes and page logic. Notable entries include the dashboard group at `app/(dashboard)/dashboard/page.tsx` that renders KPIs and charts with React Query, and feature areas like `app/calls`, `app/inbox`, `app/properties`, and `app/templates` for domain workflows.【F:app/(dashboard)/dashboard/page.tsx†L1-L141】
- **components/**: Shared UI and feature components, organized by domain (e.g., `components/dashboard`, `components/calls`, `components/properties`) plus shadcn primitives under `components/ui` and theming helpers such as `components/theme-provider.tsx`.
- **services/**: Data-access and integration layer for each domain (buyers, campaigns, calls, Gmail, offers, properties, SendFox, Telnyx voicemail, etc.). For example, `services/dashboard-service.ts` defines the KPI and trend fetchers used by the dashboard page.【F:services/dashboard-service.ts†L1-L94】
- **lib/**: Cross-cutting utilities for Supabase clients, authentication, SMS/voice helpers, tagging, exports, logging, and environment validation.【F:lib/supabaseClient.ts†L1-L7】
- **supabase/**: Configuration and edge function code intended for Supabase deployments (see `supabase/config.toml` and functions directory).
- **scripts/**: Operational helpers including `scripts/setup.sh` for installing dependencies before linting or testing.【F:README.md†L5-L20】

## Data, auth, and integrations
- Supabase is the primary backend; the browser client is created in `lib/supabaseClient.ts` using the public URL and anon key env vars.【F:lib/supabaseClient.ts†L1-L7】
- Telephony and messaging features integrate with Telnyx (calls/voicemail) and SendFox (email lists) through dedicated services under `services/` and supporting utilities under `lib/telnyx` and `lib/voice-env.ts`. Environment variables for these integrations are documented in the README.【F:README.md†L21-L103】
- Dashboard metrics are currently mock implementations in `services/dashboard-service.ts`; replacing them with real Supabase queries is a likely next step.【F:services/dashboard-service.ts†L1-L71】

## Testing and quality
- Follow the contributor guidelines: run `pnpm run lint` and `pnpm test` after installing dependencies with `pnpm install` or `./scripts/setup.sh`. This keeps ESLint and Jest/Vitest suites healthy before committing.【F:AGENTS.md†L10-L24】

## Pointers for new contributors
- Start by reading `app/layout.tsx` and `app/page.tsx` to see how global providers and the landing experience are wired, then explore feature routes under `app/*` that match your work area.
- Browse `components/` for reusable building blocks and domain widgets before creating new UI to stay consistent with the existing Tailwind + shadcn styling.
- Review relevant `services/*.ts` files to understand how front-end pages fetch or mock their data; align new features with these patterns or extend them with Supabase queries.
- Confirm required environment variables via `lib/env-check.ts` and the README when adding new integrations to avoid build-time failures.
- Keep the lint/test loop running via `pnpm run lint` and `pnpm test` during development to catch regressions early.
