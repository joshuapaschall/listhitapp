import { NextResponse } from "next/server"

import { apiError } from "@/lib/api-error"
import { requireOrgContext } from "@/lib/auth/org-context"
import { normalizeEmail } from "@/lib/dedup-utils"
import { htmlToPlainText } from "@/lib/email/plain-text"
import { sanitizeEmailHtml } from "@/lib/email/sanitize-html"
import { SenderNotVerifiedError } from "@/lib/email-sender-resolver"
import { INCOMPLETE_ADDRESS_MESSAGE } from "@/lib/org-identity"
import { getOrgIdentity } from "@/lib/org-identity.server"
import { hasPermission } from "@/lib/permissions/server"
import { isOrgTelnyxPinnedEnv } from "@/lib/providers/sms/routing"
import { sendSesEmail } from "@/lib/ses"
import { supabaseAdmin } from "@/lib/supabase"
import { appendUnsubscribeFooter, buildUnsubscribeUrl } from "@/lib/unsubscribe"

export const dynamic = "force-dynamic"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MAX_SUBJECT_LENGTH = 200
const MAX_EXTRA_RECIPIENTS = 10
const SENDER_NOT_VERIFIED = "That sender isn't verified for your organization."

const BUYER_COLUMNS =
  "id,fname,lname,full_name,email,can_receive_email,email_suppressed,is_unsubscribed,unsubscribed_at,deleted_at"

type BuyerRow = {
  id: string
  fname: string | null
  lname: string | null
  full_name: string | null
  email: string | null
  can_receive_email: boolean | null
  email_suppressed: boolean | null
  is_unsubscribed: boolean | null
  unsubscribed_at: string | null
  deleted_at: string | null
}

type Sender = { fromEmail: string; fromName?: string; replyTo?: string }

const badRequest = (error: string) => NextResponse.json({ error }, { status: 400 })

function stringList(value: unknown): string[] | null {
  if (value == null) return []
  if (!Array.isArray(value) || value.some((v) => typeof v !== "string")) return null
  return value.map((v: string) => v.trim()).filter(Boolean)
}

// Same email opt-out definition the campaign engine gates on (lib/segments/eligibility.ts),
// plus the explicit unsubscribe markers set by lib/email/suppress.ts.
function isOptedOut(buyer: BuyerRow) {
  return (
    buyer.can_receive_email === false ||
    Boolean(buyer.email_suppressed) ||
    Boolean(buyer.is_unsubscribed) ||
    buyer.unsubscribed_at != null ||
    buyer.deleted_at != null
  )
}

function buyerDisplayName(buyer: BuyerRow) {
  return buyer.full_name?.trim() || `${buyer.fname || ""} ${buyer.lname || ""}`.trim() || buyer.email || "This buyer"
}

async function findBuyersByEmail(orgId: string, emails: string[]): Promise<BuyerRow[]> {
  const norms = [...new Set(emails.map((e) => normalizeEmail(e)).filter((e): e is string => Boolean(e)))]
  if (!norms.length) return []
  const { data, error } = await supabaseAdmin
    .from("buyers")
    .select(BUYER_COLUMNS)
    .eq("org_id", orgId)
    .in("email_norm", norms)
  if (error) throw error
  return (data || []) as BuyerRow[]
}

async function resolveSender(orgId: string, senderId: string): Promise<Sender> {
  if (senderId === "owner-env") {
    const envFromEmail = process.env.AWS_SES_FROM_EMAIL?.trim()
    if (!isOrgTelnyxPinnedEnv(orgId) || !envFromEmail) throw new SenderNotVerifiedError(SENDER_NOT_VERIFIED)
    return { fromEmail: envFromEmail, fromName: process.env.AWS_SES_FROM_NAME?.trim() || undefined }
  }

  const { data: sender, error } = await supabaseAdmin
    .from("email_senders")
    .select("id,from_email,from_name,reply_to,domain_id")
    .eq("id", senderId)
    .eq("org_id", orgId)
    .maybeSingle<{ id: string; from_email: string; from_name: string | null; reply_to: string | null; domain_id: string }>()
  if (error) throw error
  if (!sender) throw new SenderNotVerifiedError(SENDER_NOT_VERIFIED)

  const { data: domain, error: domainError } = await supabaseAdmin
    .from("email_domains")
    .select("id,status")
    .eq("id", sender.domain_id)
    .eq("org_id", orgId)
    .maybeSingle<{ id: string; status: string | null }>()
  if (domainError) throw domainError
  if (domain?.status !== "verified") throw new SenderNotVerifiedError(SENDER_NOT_VERIFIED)

  return {
    fromEmail: sender.from_email,
    fromName: sender.from_name?.trim() || undefined,
    replyTo: sender.reply_to?.trim() || undefined,
  }
}

export async function POST(request: Request) {
  const { user, orgId, supabase } = await requireOrgContext()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!orgId) return NextResponse.json({ error: "Organization context missing" }, { status: 403 })

  const allowed =
    (await hasPermission(supabase, "inbox.send")) ||
    (await hasPermission(supabase, "campaigns.send_email"))
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden", missingPermission: "inbox.send" }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const senderId = typeof body?.senderId === "string" ? body.senderId.trim() : ""
  const to = typeof body?.to === "string" ? body.to.trim() : ""
  const subject = typeof body?.subject === "string" ? body.subject.trim() : ""
  const rawHtml = typeof body?.html === "string" ? body.html : ""
  const buyerId = typeof body?.buyerId === "string" && body.buyerId ? body.buyerId : null
  const cc = stringList(body?.cc)
  const bcc = stringList(body?.bcc)

  if (!senderId) return badRequest("Pick a sender.")
  if (!EMAIL_RE.test(to)) return badRequest("Enter a valid recipient email address.")
  if (!cc || !bcc) return badRequest("Cc and Bcc must be lists of email addresses.")
  const extras = [...cc, ...bcc]
  const invalidExtra = extras.find((e) => !EMAIL_RE.test(e))
  if (invalidExtra) return badRequest(`"${invalidExtra}" isn't a valid email address.`)
  if (extras.length > MAX_EXTRA_RECIPIENTS) return badRequest(`You can add at most ${MAX_EXTRA_RECIPIENTS} Cc/Bcc recipients.`)
  if (!subject) return badRequest("Add a subject.")
  if (subject.length > MAX_SUBJECT_LENGTH) return badRequest(`Subject must be ${MAX_SUBJECT_LENGTH} characters or fewer.`)
  const html = sanitizeEmailHtml(rawHtml)
  if (!htmlToPlainText(html)) return badRequest("Write a message before sending.")

  try {
    const sender = await resolveSender(orgId, senderId)

    const identity = await getOrgIdentity(orgId)
    if (!identity?.hasCompleteAddress) {
      return NextResponse.json(
        { error: INCOMPLETE_ADDRESS_MESSAGE, code: "missing_business_address" },
        { status: 400 },
      )
    }

    let buyer: BuyerRow | null = null
    if (buyerId) {
      const { data, error } = await supabaseAdmin
        .from("buyers")
        .select(BUYER_COLUMNS)
        .eq("id", buyerId)
        .eq("org_id", orgId)
        .maybeSingle<BuyerRow>()
      if (error) throw error
      if (!data) return NextResponse.json({ error: "Buyer not found" }, { status: 404 })
      buyer = data
    }

    // Every buyer matching the To address — not just the first — so a duplicate
    // record that opted out still blocks the send.
    const toMatches = await findBuyersByEmail(orgId, [to])
    if (!buyer) buyer = toMatches[0] ?? null
    const toOptOut = [buyer, ...toMatches].find((b): b is BuyerRow => Boolean(b && isOptedOut(b)))
    if (toOptOut) {
      return NextResponse.json(
        { error: `${buyerDisplayName(toOptOut)} has opted out of email. You can't email them.`, code: "recipient_opted_out" },
        { status: 409 },
      )
    }

    if (extras.length) {
      const extraMatches = await findBuyersByEmail(orgId, extras)
      const optedOut = extraMatches.find(isOptedOut)
      if (optedOut) {
        const address = extras.find((e) => normalizeEmail(e) === normalizeEmail(optedOut.email)) || optedOut.email
        return NextResponse.json(
          { error: `${address} has opted out of email. You can't email them.`, code: "recipient_opted_out" },
          { status: 409 },
        )
      }
    }

    const unsubscribeUrl = buyer ? buildUnsubscribeUrl({ buyerId: buyer.id, email: to }) : undefined
    const footerUnsubscribeUrl = unsubscribeUrl ?? `mailto:${sender.fromEmail}?subject=Unsubscribe`
    const htmlWithFooter = appendUnsubscribeFooter(html, {
      unsubscribeUrl: footerUnsubscribeUrl,
      physicalAddress: identity.addressSingleLine,
    })
    const plain = htmlToPlainText(html)

    let messageId: string | undefined
    try {
      const result = await sendSesEmail({
        to,
        cc,
        bcc,
        subject,
        html: htmlWithFooter,
        text: plain,
        fromEmail: sender.fromEmail,
        fromName: sender.fromName,
        replyTo: sender.replyTo,
        unsubscribeUrl,
        tags: { org_id: orgId, buyer_id: buyer?.id, type: "direct", sender_user: user.id },
      })
      messageId = result.MessageId
    } catch (err) {
      return apiError(err, 502, "The email provider rejected this message. Try again or pick another sender.")
    }

    if (buyer) {
      // The email is already out; a failed history write must not report a failed send.
      try {
        const { error } = await supabaseAdmin.from("email_messages").insert({
          org_id: orgId,
          buyer_id: buyer.id,
          thread_id: `ses:${messageId ?? "unknown"}`,
          subject,
          preview: plain.slice(0, 200),
          sent_at: new Date().toISOString(),
        })
        if (error) throw error
      } catch (err) {
        console.error("[send-direct] failed to log email_messages row", { buyerId: buyer.id }, err)
      }
    }

    return NextResponse.json({ ok: true, messageId: messageId ?? null })
  } catch (err) {
    if (err instanceof SenderNotVerifiedError) {
      return NextResponse.json({ error: err.message }, { status: 403 })
    }
    return apiError(err, 500)
  }
}
