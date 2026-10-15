// Supabase Auth sends signup / password / magic-link / invite / email-change
// emails itself. These templates are generated from renderEmail (ListHit theme)
// with Supabase's Go-template variables as placeholders, so they always match
// every other ListHit email. Regenerate with:
//   pnpm dlx tsx scripts/build-auth-email-templates.ts
// tests/auth-email-templates.test.ts fails if the committed files drift.

import { renderEmail } from "@/lib/email/layout"

export type AuthTemplate = { file: string; subject: string; html: string }

const FOOTER = {
  reason: "You're getting this because someone used {{ .Email }} with ListHit. If that wasn't you, you can ignore this email.",
}

export function buildAuthTemplates(): AuthTemplate[] {
  const t = (file: string, subject: string, input: Omit<Parameters<typeof renderEmail>[0], "theme" | "footer">) => ({
    file,
    subject,
    html: renderEmail({ theme: "listhit", footer: FOOTER, ...input }).html,
  })
  return [
    t("confirm-signup.html", "Confirm your ListHit account", {
      preheader: "Confirm your email to finish creating your ListHit account.",
      heading: "Confirm your email",
      paragraphs: ["Welcome to ListHit. Confirm {{ .Email }} to finish creating your account."],
      button: { label: "Confirm my email", url: "{{ .ConfirmationURL }}" },
      tip: "This link expires in 24 hours.",
    }),
    t("reset-password.html", "Reset your ListHit password", {
      preheader: "Choose a new password for your ListHit account.",
      heading: "Reset your password",
      paragraphs: ["Someone asked to reset the password for {{ .Email }}. Choose a new one below. If this wasn't you, you can ignore this email."],
      button: { label: "Choose a new password", url: "{{ .ConfirmationURL }}" },
      tip: "This link works once and expires after a short time.",
    }),
    t("magic-link.html", "Your ListHit sign-in link", {
      preheader: "Your one-click sign-in link for ListHit.",
      heading: "Sign in to ListHit",
      paragraphs: ["Use the button below to sign in as {{ .Email }}. No password needed."],
      button: { label: "Sign in", url: "{{ .ConfirmationURL }}" },
      tip: "This link works once and expires after a short time.",
    }),
    t("invite.html", "You're invited to ListHit", {
      preheader: "You've been invited to join a team on ListHit.",
      heading: "You're invited to ListHit",
      paragraphs: ["You've been invited to join a team on ListHit. Accept the invite to set your password and get started."],
      button: { label: "Accept invite", url: "{{ .ConfirmationURL }}" },
      tip: "This link works once and expires after a short time.",
    }),
    t("change-email.html", "Confirm your new email", {
      preheader: "Confirm the new email address for your ListHit account.",
      heading: "Confirm your new email",
      paragraphs: ["Confirm that you want to change your ListHit email from {{ .Email }} to {{ .NewEmail }}."],
      button: { label: "Confirm new email", url: "{{ .ConfirmationURL }}" },
      tip: "If you didn't ask for this, ignore this email and your address stays the same.",
    }),
  ]
}
