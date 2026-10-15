import { assertServer } from "@/utils/assert-server"
import { supabaseAdmin } from "@/lib/supabase"
import { platformEmailConfigured, sendPlatformEmail, type PlatformEmailCategory } from "@/lib/email/send-platform-email"
import { accountReadyEmail, inviteEmail, passwordResetEmail, type RenderedEmail } from "@/lib/email/templates"

assertServer()

/**
 * Account lifecycle emails (invite, password reset, account ready).
 *
 * Every function resolves — none throws. A mail failure is data the caller has
 * to act on: the admin routes surface `emailSent: false` plus the link so an
 * admin can deliver it by hand. Swallowing the error and reporting success is
 * the exact bug this file replaces.
 *
 * Rendering lives in lib/email/templates.ts (renderEmail, ListHit theme);
 * delivery in lib/email/send-platform-email.ts.
 */

export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "https://app.listhit.io"

export type SendResult = { sent: boolean; error?: string }

const NOT_CONFIGURED: SendResult = {
  sent: false,
  error: "RESEND_API_KEY not configured",
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

async function send(to: string, email: RenderedEmail, category: PlatformEmailCategory, label: string): Promise<SendResult> {
  if (!platformEmailConfigured()) {
    console.error(`[account-emails] ${label} not sent — RESEND_API_KEY not configured`, { to })
    return NOT_CONFIGURED
  }
  const result = await sendPlatformEmail({ to, subject: email.subject, html: email.html, text: email.text, category })
  if (!result.sent) console.error(`[account-emails] ${label} failed`, result.error)
  return result
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
  return send(to, inviteEmail({ orgName, inviteUrl, inviterName }), "invite", "invite email")
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
  return send(to, passwordResetEmail({ orgName, resetUrl }), "password_reset", "password reset email")
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
  return send(to, accountReadyEmail({ orgName, signInUrl }), "account_ready", "account ready email")
}
