import { assertServer } from "@/utils/assert-server"
import { FROM_EMAIL, resend } from "@/lib/resend"
import { supabaseAdmin } from "@/lib/supabase"

assertServer()

/**
 * Account lifecycle emails (invite, password reset, account ready).
 *
 * Every function resolves — none throws. A mail failure is data the caller has
 * to act on: the admin routes surface `emailSent: false` plus the link so an
 * admin can deliver it by hand. Swallowing the error and reporting success is
 * the exact bug this file replaces.
 *
 * The HTML is self-contained on purpose. `lib/email-templates/` holds
 * Templatical `TemplateContent` objects for the campaign editor and a
 * `BrandConfig` value with no renderer — neither produces a transactional HTML
 * wrapper, so there is nothing there to reuse.
 */

export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "https://app.listhit.io"

export type SendResult = { sent: boolean; error?: string }

const NOT_CONFIGURED: SendResult = {
  sent: false,
  error: "RESEND_API_KEY not configured",
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

/**
 * `organizations.business_name ?? organizations.name`, falling back to the
 * product name. Never throws — a failed lookup just means a generic subject.
 */
export async function resolveOrgName(orgId: string | null | undefined): Promise<string> {
  if (!orgId) return "ListHit"
  try {
    const { data } = await supabaseAdmin
      .from("organizations")
      .select("name, business_name")
      .eq("id", orgId)
      .maybeSingle()
    return data?.business_name || data?.name || "ListHit"
  } catch (err) {
    console.error("[account-emails] Failed to resolve org name", err)
    return "ListHit"
  }
}

function renderEmail({
  orgName,
  heading,
  body,
  buttonLabel,
  buttonUrl,
  footerNote,
}: {
  orgName: string
  heading: string
  body: string
  buttonLabel?: string
  buttonUrl?: string
  footerNote?: string
}): string {
  const safeOrg = escapeHtml(orgName)
  const button =
    buttonLabel && buttonUrl
      ? `
              <tr>
                <td style="padding:8px 0 24px 0;">
                  <a href="${escapeHtml(buttonUrl)}" style="display:inline-block;background-color:#1E3A8A;color:#ffffff;font-family:Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;line-height:20px;text-decoration:none;padding:12px 24px;border-radius:6px;">${escapeHtml(buttonLabel)}</a>
                </td>
              </tr>
              <tr>
                <td style="padding:0 0 24px 0;font-family:Helvetica,Arial,sans-serif;font-size:13px;line-height:20px;color:#6B7280;">
                  Or paste this link into your browser:<br />
                  <span style="word-break:break-all;color:#1E3A8A;">${escapeHtml(buttonUrl)}</span>
                </td>
              </tr>`
      : ""

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background-color:#F3F4F6;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F3F4F6;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background-color:#ffffff;border-radius:8px;border:1px solid #E5E7EB;">
            <tr>
              <td style="padding:32px 32px 0 32px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="padding:0 0 12px 0;font-family:Helvetica,Arial,sans-serif;font-size:22px;font-weight:700;line-height:30px;color:#111827;">${escapeHtml(heading)}</td>
                  </tr>
                  <tr>
                    <td style="padding:0 0 24px 0;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:24px;color:#374151;">${body}</td>
                  </tr>${button}
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 32px 32px;">
                <div style="border-top:1px solid #E5E7EB;padding-top:16px;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:18px;color:#6B7280;">
                  ${footerNote ? `${escapeHtml(footerNote)}<br />` : ""}Sent by ${safeOrg}.
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

async function send(to: string, subject: string, html: string, label: string): Promise<SendResult> {
  if (!resend) {
    console.error(`[account-emails] ${label} not sent — RESEND_API_KEY not configured`, { to })
    return NOT_CONFIGURED
  }

  try {
    await resend.emails.send({ from: FROM_EMAIL, to, subject, html })
    return { sent: true }
  } catch (err) {
    console.error(`[account-emails] ${label} failed`, err)
    return { sent: false, error: String(err) }
  }
}

export async function sendInviteEmail({
  to,
  inviteUrl,
  orgName,
  inviterName,
}: {
  to: string
  inviteUrl: string
  orgName: string
  inviterName?: string | null
}): Promise<SendResult> {
  const invitedBy = inviterName?.trim()
    ? `${escapeHtml(inviterName.trim())} invited you to join`
    : `You've been invited to join`

  return send(
    to,
    `You've been invited to ${orgName}`,
    renderEmail({
      orgName,
      heading: `Join ${orgName}`,
      body: `${invitedBy} <strong>${escapeHtml(orgName)}</strong>. Choose a password to finish setting up your account.`,
      buttonLabel: "Set your password",
      buttonUrl: inviteUrl,
      footerNote: "This link can only be used once and expires after a short time.",
    }),
    "invite email",
  )
}

export async function sendPasswordResetEmail({
  to,
  resetUrl,
  orgName,
}: {
  to: string
  resetUrl: string
  orgName: string
}): Promise<SendResult> {
  return send(
    to,
    `Reset your ${orgName} password`,
    renderEmail({
      orgName,
      heading: "Reset your password",
      body: `Someone asked to reset the password for your <strong>${escapeHtml(orgName)}</strong> account. Choose a new one below. If this wasn't you, you can ignore this email.`,
      buttonLabel: "Choose a new password",
      buttonUrl: resetUrl,
      footerNote: "This link can only be used once and expires after a short time.",
    }),
    "password reset email",
  )
}

export async function sendAccountReadyEmail({
  to,
  orgName,
  signInUrl,
}: {
  to: string
  orgName: string
  signInUrl: string
}): Promise<SendResult> {
  return send(
    to,
    `Your ${orgName} account is ready`,
    renderEmail({
      orgName,
      heading: `Your ${orgName} account is ready`,
      body: `An admin created an account for you at <strong>${escapeHtml(orgName)}</strong> and set your password. They'll share it with you directly — this email never contains it.`,
      buttonLabel: "Sign in",
      buttonUrl: signInUrl,
    }),
    "account ready email",
  )
}
