import crypto from "crypto"
import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase/admin" // <-- IMPORTANT (fails loudly if env missing)
import { createLogger } from "@/lib/logger"
import { assertServer } from "@/utils/assert-server"

assertServer()
export const runtime = "nodejs"

const log = createLogger("ses-webhook")

type SnsMessage = {
  Type?: "Notification" | "SubscriptionConfirmation" | "UnsubscribeConfirmation"
  Message?: string
  SubscribeURL?: string
  MessageId?: string
  TopicArn?: string
  Timestamp?: string
  Subject?: string
  Token?: string
  Signature?: string
  SigningCertURL?: string
}

type SesEvent = {
  eventType?: string
  notificationType?: string
  mail?: {
    messageId?: string
    timestamp?: string
    tags?: Record<string, string[]>
  }
  timestamp?: string
}

function safeJsonParse<T>(s: string): T | null {
  try {
    return JSON.parse(s) as T
  } catch {
    return null
  }
}

function buildStringToSign(m: SnsMessage): string {
  const lines: [string, string | undefined][] = []

  if (m.Type === "Notification") {
    lines.push(["Message", m.Message])
    lines.push(["MessageId", m.MessageId])
    if (m.Subject) lines.push(["Subject", m.Subject])
    lines.push(["Timestamp", m.Timestamp])
    lines.push(["TopicArn", m.TopicArn])
    lines.push(["Type", m.Type])
  } else if (m.Type === "SubscriptionConfirmation" || m.Type === "UnsubscribeConfirmation") {
    lines.push(["Message", m.Message])
    lines.push(["MessageId", m.MessageId])
    lines.push(["SubscribeURL", m.SubscribeURL])
    lines.push(["Timestamp", m.Timestamp])
    lines.push(["Token", m.Token])
    lines.push(["TopicArn", m.TopicArn])
    lines.push(["Type", m.Type])
  }

  return lines
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}\n${v}\n`)
    .join("")
}

async function verifySnsSignature(m: SnsMessage): Promise<boolean> {
  // allow disabling during debugging
  if (process.env.AWS_SNS_SKIP_SIGNATURE_VALIDATION === "true") return true

  if (!m.Signature || !m.SigningCertURL) return false
  if (!m.SigningCertURL.startsWith("https://")) return false

  // Basic safety: cert host should be SNS on AWS
  try {
    const u = new URL(m.SigningCertURL)
    if (!u.hostname.startsWith("sns.") || !u.hostname.endsWith(".amazonaws.com")) return false
  } catch {
    return false
  }

  const res = await fetch(m.SigningCertURL)
  if (!res.ok) return false
  const certPem = await res.text()

  const signature = Buffer.from(m.Signature, "base64")
  const verifier = crypto.createVerify("sha1WithRSAEncryption")
  verifier.update(buildStringToSign(m))
  verifier.end()

  return verifier.verify(certPem, signature)
}

function eventName(payload: SesEvent): string {
  return String(payload.eventType || payload.notificationType || "").toLowerCase()
}

function eventTimestamp(payload: SesEvent): string {
  const ts = payload.timestamp || payload.mail?.timestamp
  return ts ? new Date(ts).toISOString() : new Date().toISOString()
}

function extractTag(tags: Record<string, string[]> | undefined, key: string): string | undefined {
  const v = tags?.[key]
  return Array.isArray(v) && v[0] ? v[0] : undefined
}

async function storeEmailEvent(providerMessageId: string | undefined, evt: string, payload: any) {
  const { error } = await supabaseAdmin.from("email_events").insert({
    provider_message_id: providerMessageId || null,
    event_type: evt || null,
    payload,
  })
  if (error) log("error", "Failed to insert email_events", { error })
}

async function updateRecipient(
  evt: string,
  ctx: { timestamp: string; recipientId?: string; providerId?: string },
) {
  const updates: Record<string, any> = {}
  if (evt === "open") updates.opened_at = ctx.timestamp
  if (evt === "click") updates.clicked_at = ctx.timestamp
  if (evt === "delivery") updates.delivered_at = ctx.timestamp
  if (evt === "bounce") {
    updates.bounced_at = ctx.timestamp
    updates.status = "bounced"
  }
  if (evt === "complaint") {
    updates.complained_at = ctx.timestamp
    updates.status = "complained"
  }
  if (evt === "reject") {
    updates.rejected_at = ctx.timestamp
    updates.status = "rejected"
  }
  if (evt === "renderingfailure") updates.rendering_failed_at = ctx.timestamp
  if (evt === "deliverydelay") updates.delivery_delayed_at = ctx.timestamp

  if (!Object.keys(updates).length) return

  let q = supabaseAdmin.from("campaign_recipients").update(updates)
  if (ctx.recipientId) q = q.eq("id", ctx.recipientId)
  else if (ctx.providerId) q = q.eq("provider_id", ctx.providerId)
  else return

  const { error } = await q
  if (error) log("error", "Failed to update campaign_recipients", { error, evt, ctx })
}

async function suppressBuyer(evt: string, buyerId: string | null, timestamp: string) {
  if (!buyerId) return
  const updates: Record<string, any> = {
    can_receive_email: false,
    email_suppressed: true,
  }
  if (evt === "bounce") updates.email_bounced_at = timestamp
  if (evt === "complaint") updates.email_complained_at = timestamp

  const { error } = await supabaseAdmin.from("buyers").update(updates).eq("id", buyerId)
  if (error) log("error", "Failed to suppress buyer", { error, buyerId, evt })
}

export async function POST(req: NextRequest) {
  const expectedTopic = process.env.AWS_SNS_TOPIC_ARN

  const raw = await req.text()
  const sns = safeJsonParse<SnsMessage>(raw)

  if (!sns?.Type) return NextResponse.json({ error: "Invalid SNS message" }, { status: 400 })

  const topicHeader = req.headers.get("x-amz-sns-topic-arn")
  const actualTopic = topicHeader || sns.TopicArn

  if (expectedTopic && actualTopic !== expectedTopic) {
    log("warn", "Topic ARN mismatch", { expectedTopic, actualTopic })
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const okSig = await verifySnsSignature(sns)
  if (!okSig) {
    log("warn", "Invalid SNS signature", { messageId: sns.MessageId })
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 })
  }

  if (sns.Type === "SubscriptionConfirmation") {
    if (sns.SubscribeURL) await fetch(sns.SubscribeURL)
    return NextResponse.json({ ok: true })
  }

  if (sns.Type !== "Notification") return NextResponse.json({ ok: true })

  // SNS delivers the message as a string; for SES it should be JSON.
  const payload = safeJsonParse<SesEvent>(sns.Message || "")
  if (!payload) {
    log("warn", "SNS Notification Message was not JSON", { messageId: sns.MessageId })
    return NextResponse.json({ ok: true })
  }

  const evt = eventName(payload)
  const timestamp = eventTimestamp(payload)
  const providerId = payload.mail?.messageId
  const tags = payload.mail?.tags

  const recipientId = extractTag(tags, "recipient_id")
  const buyerIdTag = extractTag(tags, "buyer_id") || null

  await storeEmailEvent(providerId, evt, payload)
  await updateRecipient(evt, { timestamp, recipientId, providerId })

  if (evt === "bounce" || evt === "complaint") {
    await suppressBuyer(evt, buyerIdTag, timestamp)
  }

  return NextResponse.json({ ok: true })
}
