import { assertServer } from "@/utils/assert-server"
import { FROM_EMAIL } from "@/lib/resend"

assertServer()

// The one way ListHit sends a transactional email (platform notices and the
// buyer-facing showing/offer notices). Sends html + text through Resend with a
// support reply-to and a category tag. Never throws: a mail failure is a result
// the caller may surface, never an exception that fails the caller's real work.

export type PlatformEmailCategory =
  | "texting_live"
  | "texting_action_required"
  | "admin_awaiting_approval"
  | "website_live"
  | "email_ready"
  | "dns_share"
  | "invite"
  | "password_reset"
  | "account_ready"
  | "showing"
  | "offer"

export type PlatformEmail = {
  to: string
  subject: string
  html: string
  text: string
  category: PlatformEmailCategory
  replyTo?: string
}

export type PlatformSendResult = { sent: boolean; error?: string }

export function supportEmail(): string {
  return (process.env.LISTHIT_SUPPORT_EMAIL || "").trim() || FROM_EMAIL
}

export function platformEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY)
}

export async function sendPlatformEmail(email: PlatformEmail): Promise<PlatformSendResult> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.error(`[platform-email] ${email.category} not sent — RESEND_API_KEY not configured`)
    return { sent: false, error: "RESEND_API_KEY not configured" }
  }
  const to = (email.to || "").trim()
  if (!to) return { sent: false, error: "No recipient" }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [to],
        subject: email.subject,
        html: email.html,
        text: email.text,
        reply_to: email.replyTo || supportEmail(),
        tags: [{ name: "category", value: email.category }],
      }),
    })
    if (!response.ok) {
      const body = await response.text().catch(() => "")
      console.error(`[platform-email] ${email.category} failed`, { status: response.status, body })
      return { sent: false, error: `Resend API error (${response.status})` }
    }
    return { sent: true }
  } catch (err) {
    console.error(`[platform-email] ${email.category} failed`, err)
    return { sent: false, error: String((err as Error)?.message || err) }
  }
}
