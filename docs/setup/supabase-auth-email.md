# Supabase Auth emails (signup, password reset, sign-in link, invite, email change)

Supabase sends these emails itself, not ListHit's code. These steps make them go out
through Resend from `notifications@listhit.io`, styled like every other ListHit email.

The HTML lives in `supabase/email-templates/`. It's generated from the same
`renderEmail` design every ListHit email uses, so never edit the HTML by hand. Change
`lib/email/auth-templates.ts`, then run:

```bash
pnpm dlx tsx scripts/build-auth-email-templates.ts
```

`tests/auth-email-templates.test.ts` fails if the committed files no longer match the
generator.

## 1. Send through Resend (custom SMTP)

1. Open the Supabase dashboard → your project → **Authentication** → **Emails** →
   **SMTP Settings**.
2. Turn on **Enable custom SMTP**.
3. Fill in:

   | Field | Value |
   |---|---|
   | Sender email | `notifications@listhit.io` |
   | Sender name | `ListHit` |
   | Host | `smtp.resend.com` |
   | Port | `465` |
   | Username | `resend` |
   | Password | your Resend API key (the same value as `RESEND_API_KEY`) |

4. Click **Save**.

`listhit.io` must already be a verified domain in Resend (Resend → Domains). It is if
other ListHit platform emails already send.

## 2. Paste each template and its subject

Still in **Authentication** → **Emails**, open the **Templates** tab. For each template
below:

1. Click the template name.
2. Replace **Subject** with the subject below.
3. Switch the body to **Source** (`<>`), select everything, and paste the whole file.
4. Click **Save**.

| Supabase template | Subject | File |
|---|---|---|
| Confirm signup | `Confirm your ListHit account` | `supabase/email-templates/confirm-signup.html` |
| Reset password | `Reset your ListHit password` | `supabase/email-templates/reset-password.html` |
| Magic link | `Your ListHit sign-in link` | `supabase/email-templates/magic-link.html` |
| Invite user | `You're invited to ListHit` | `supabase/email-templates/invite.html` |
| Change email address | `Confirm your new email` | `supabase/email-templates/change-email.html` |

The files use Supabase's own variables (`{{ .ConfirmationURL }}`, `{{ .Email }}`,
`{{ .NewEmail }}`). Paste them exactly as they are.

## 3. Raise the auth email rate limit

The built-in Supabase mailer allows only a few emails an hour. With custom SMTP you can
raise it:

1. **Authentication** → **Rate Limits**.
2. Set **Rate limit for sending emails** to at least `100` per hour.
3. Click **Save**.

## 4. Check it

1. Sign out, then go to `/signup` and create a test account with an inbox you can read.
2. The "Confirm your ListHit account" email should arrive within a minute, from
   ListHit <notifications@listhit.io>, with the ListHit header and a red button.
3. Click **Confirm my email**. It should sign you in.
4. Also try **Forgot password** on `/login` and check the reset email the same way.

If nothing arrives, check Resend → **Emails** for a bounce or error, and recheck the SMTP
password.
