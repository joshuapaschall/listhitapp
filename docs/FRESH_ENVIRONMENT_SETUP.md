# ListHit — Fresh Environment Setup

Everything needed to stand up ListHit on a brand-new Supabase project + Vercel
deployment. The database schema is one file (`00000000000000_baseline.sql`); this
checklist covers the things a schema dump can't carry.

> Generated 2026-06-04. Follow the steps in order.

---

## 1. Database schema (one file)

Apply `00000000000000_baseline.sql` to the new Supabase project. It creates the
full public schema — 51 tables, 231 RLS policies, 29 functions, 27 triggers,
all indexes, constraints, and foreign keys — plus the required extensions.

- **CLI:** drop the file in `supabase/migrations/` and run `supabase db reset`.
- **SQL editor:** paste the file contents and **Run**.

## 2. The `auth.users` signup trigger (one query)

The baseline cannot include the trigger on `auth.users` (it lives in the `auth`
schema, which a public-only dump skips). The function it calls,
`public.handle_new_user()`, *is* in the baseline. To recreate the trigger, run
this in the SQL editor of the **source** project and apply the result on the new one:

```sql
select pg_get_triggerdef(t.oid) || ';'
from pg_trigger t
where t.tgrelid = 'auth.users'::regclass and not t.tgisinternal;
```

(Once captured, this statement is pasted into the TODO block at the bottom of the
baseline file so future rebuilds include it automatically.)

## 3. Storage buckets

Create these in **Supabase → Storage** (all private; the app serves them via
signed URLs):

- `call-recordings`
- `voicemails`
- `voicemail-greetings`
- `property-images`
- `email-assets`

> Confirm public/private and any size limits against the source project's Storage
> settings — bucket policies are not part of the schema dump.

## 4. Environment variables

Set every variable from `env.example` in Vercel (Project → Settings →
Environment Variables) and locally in `.env.local`. The Supabase trio
(`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`) comes from the new project's API settings; generate
fresh secrets for `CRON_SECRET`, `EMAIL_UNSUBSCRIBE_SECRET`, `ADMIN_TASKS_TOKEN`,
and `VOICE_SYNC_SECRET_KEY` (`openssl rand -hex 32`).

## 5. Deploy + crons

Deploy to Vercel. The cron jobs in `vercel.json` register automatically on the
first **production** deploy — no manual setup. Verify under Project → Cron Jobs
that they show recent `200` runs. (Scheduling is driven entirely by Vercel cron;
the old Supabase `pg_cron` scheduler is retired.)

## 6. Bootstrap the first owner + organization

There is no longer a seed-admin endpoint (the `internal/*` bootstrap routes were
removed for security). To create the first account on a fresh project:

1. **Supabase → Authentication → Users → Add user** (email + password, confirm).
   Copy the new user's UUID.
2. In the SQL editor:

   ```sql
   -- create the organization
   insert into public.organizations (name) values ('Your Company')
   returning id;  -- copy this org id

   -- link the auth user as the owner profile (use the UUID + org id above)
   insert into public.profiles (id, email, role, org_id)
   values ('<AUTH_USER_UUID>', 'you@example.com', 'owner', '<ORG_ID>')
   on conflict (id) do update
     set role = 'owner', org_id = excluded.org_id;

   -- set the org owner
   update public.organizations set owner_id = '<AUTH_USER_UUID>'
   where id = '<ORG_ID>';
   ```

   (If the signup trigger from step 2 already created a profile row, the
   `on conflict` clause updates it instead of failing.)

## 7. Optional seed data

The archived `scripts/db/archive/04_seed.sql` contains a default tag/group set
that's handy for a new install. It also includes sample buyers — skip those for a
real deployment. Per-user permission grants happen automatically as users are
created through the app, so no permission seed is required.

---

## What the baseline does and does not include

**Included:** all `public` tables, columns, defaults, constraints, foreign keys,
indexes, RLS policies, functions, and triggers; required Postgres extensions.

**Not included (handled by the steps above):** the `auth.users` signup trigger,
Storage buckets and their policies, environment variables/secrets, Vercel cron
registration, and bootstrap data. None of these live in a Postgres schema dump.
