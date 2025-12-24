import crypto from "crypto"
import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"
import { createLogger } from "@/lib/logger"
import { assertServer } from "@/utils/assert-server"

assertServer()

export const runtime = "nodejs"

const log = createLogger("ses-webhook")
const supabase = supabaseAdmin
const expectedTopicArn = process.env.AWS_SNS_TOPIC_ARN

function validateTopicArn(arn: string | undefined | null) {
  if (!arn) return { valid: true }
  const arnParts = arn.split(":")
  if (arnParts.length < 6 || arnParts[0] !== "arn" || arnParts[2] !== "sns") {
    return { valid: false, reason: "invalid-format" as const }
  }
  const resource = arnParts.slice(5).join(":")
  if (resource.includes(":")) {
    return { valid: false, reason: "subscription-arn" as const }
  }
  const topicPattern = /^arn:aws[a-zA-Z-]*:sns:[a-z0-9-]+:\d{12}:[A-Za-z0-9_-]{1,256}$/
  if (!topicPattern.test(arn)) {
    return { valid: false, reason: "invalid-format" as const }
  }
  return { valid: true }
}

const topicArnValidation = validateTopicArn(expectedTopicArn)

type SnsMessage = {
  Type?: string
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

function parseJson(body: string): any | null {
  try {
    return JSON.parse(body)
  } catch (error) {
    log("warn", "Failed to parse JSON", { error })
    return null
  }
}

function extractTagValue(tags: Record<string, string[]> | undefined, key: string) {
  const values = tags?.[key]
  if (Array.isArray(values) && values.length > 0) return values[0]
  return undefined
}

function eventName(payload: SesEvent): string {
  return (payload.eventType || payload.notificationType || "").toLowerCase()
}

function eventTimestamp(payload: SesEvent): string {
  const ts = payload.timestamp || payload.mail?.timestamp
  return ts ? new Date(ts).toISOString() : new Date().toISOString()
}

function buildStringToSign(message: SnsMessage): string {
  const type = message.Type
  const lines: [string, string | undefined][] = []

  if (type === "Notification") {
    lines.push(["Message", message.Message])
    lines.push(["MessageId", message.MessageId])
    if (message.Subject) lines.push(["Subject", message.Subject])
    lines.push(["Timestamp", message.Timestamp])
    lines.push(["TopicArn", message.TopicArn])
    lines.push(["Type", message.Type])
  } else if (type === "SubscriptionConfirmation" || type === "UnsubscribeConfirmation") {
    lines.push(["Message", message.Message])
    lines.push(["MessageId", message.MessageId])
    lines.push(["SubscribeURL", message.SubscribeURL])
    lines.push(["Timestamp", message.Timestamp])
    lines.push(["Token", message.Token])
    lines.push(["TopicArn", message.TopicArn])
    lines.push(["Type", message.Type])
  }

  return lines
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}\n${value}\n`)
    .join("")
}

async function verifySnsSignature(message: SnsMessage): Promise<boolean> {
  try {
    if (!message.Signature || !message.SigningCertURL) return false
    const certUrl = message.SigningCertURL
    if (!certUrl.startsWith("https://")) return false

    const res = await fetch(certUrl)
    if (!res.ok) return false
    const cert = await res.text()
    const signature = Buffer.from(message.Signature, "base64")
    const verifier = crypto.createVerify("sha1WithRSAEncryption")
    verifier.update(buildStringToSign(message))
    verifier.end()
    const valid = verifier.verify(cert, signature)
    if (!valid) {
      log("warn", "Invalid SNS signature", { messageId: message.MessageId })
    }
    return valid
  } catch (error) {
    log("warn", "SNS signature validation error", { error })
    return true
  }
}

async function confirmSubscription(subscribeUrl?: string) {
  if (!subscribeUrl) return
  try {
    await fetch(subscribeUrl)
    log("info", "Confirmed SNS subscription", { subscribeUrl })
  } catch (error) {
    log("warn", "Failed to confirm SNS subscription", { error })
  }
}

async function storeEmailEvent(input: {
  messageId?: string
  eventType: string
  payload: any
  campaignId?: string
  recipientId?: string
  buyerId?: string
}) {
  if (!supabase) return
  await supabase
    .from("email_events")
    .upsert(
      {
        provider_message_id: input.messageId || null,
        message_id: input.messageId || null,
        event_type: input.eventType || null,
        campaign_id: input.campaignId || null,
        recipient_id: input.recipientId || null,
        buyer_id: input.buyerId || null,
        payload: input.payload,
      },
      { onConflict: "provider_message_id,event_type" },
    )
}

async function updateRecipient(
  eventType: string,
  ctx: { timestamp: string; recipientId?: string; providerId?: string },
) {
  if (!supabase) return
  const updates: Record<string, any> = {}
  if (eventType === "open") updates.opened_at = ctx.timestamp
  if (eventType === "click") updates.clicked_at = ctx.timestamp
  if (eventType === "delivery") updates.delivered_at = ctx.timestamp
  if (eventType === "bounce") {
    updates.bounced_at = ctx.timestamp
    updates.status = "bounced"
  }
  if (eventType === "complaint") {
    updates.complained_at = ctx.timestamp
    updates.status = "complained"
  }
  if (eventType === "reject") {
    updates.rejected_at = ctx.timestamp
    updates.status = "rejected"
  }
  if (eventType === "renderingfailure") updates.rendering_failed_at = ctx.timestamp
  if (eventType === "deliverydelay") updates.delivery_delayed_at = ctx.timestamp
  if (eventType === "unsubscribe" || eventType === "unsub") {
    updates.unsubscribed_at = ctx.timestamp
    updates.status = "unsubscribed"
  }
  if (Object.keys(updates).length === 0) return

  let query = supabase.from("campaign_recipients").update(updates)
  if (ctx.recipientId) {
    query = query.eq("id", ctx.recipientId)
  } else if (ctx.providerId) {
    query = query.eq("provider_id", ctx.providerId)
  } else {
    return
  }
  await query
}

async function findBuyerId(
  buyerTag: string | undefined,
  ctx: { recipientId?: string; providerId?: string },
): Promise<string | null> {
  if (buyerTag) return buyerTag
  if (!supabase) return null
  if (ctx.recipientId) {
    const { data } = await supabase
      .from("campaign_recipients")
      .select("buyer_id")
      .eq("id", ctx.recipientId)
      .maybeSingle()
    return data?.buyer_id ?? null
  }
  if (ctx.providerId) {
    const { data } = await supabase
      .from("campaign_recipients")
      .select("buyer_id")
      .eq("provider_id", ctx.providerId)
      .maybeSingle()
    return data?.buyer_id ?? null
  }
  return null
}

async function suppressBuyer(eventType: string, buyerId: string | null, timestamp: string) {
  if (!supabase || !buyerId) return
  const updates: Record<string, any> = {
    can_receive_email: false,
    email_suppressed: true,
  }
  if (eventType === "bounce") updates.email_bounced_at = timestamp
  if (eventType === "complaint") updates.email_complained_at = timestamp
  await supabase.from("buyers").update(updates).eq("id", buyerId)
}

export async function POST(req: NextRequest) {
  if (!topicArnValidation.valid) {
    log("error", "AWS_SNS_TOPIC_ARN must be a topic ARN, not a subscription ARN", {
      topicArn: expectedTopicArn,
      reason: topicArnValidation.reason,
    })
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
  }

  const providedTopic = req.headers.get("x-amz-sns-topic-arn")
  if (expectedTopicArn && providedTopic !== expectedTopicArn) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const rawBody = await req.text()
  const snsMessage = parseJson(rawBody) as SnsMessage | null
  if (!snsMessage || !snsMessage.Type) {
    return NextResponse.json({ error: "Invalid SNS message" }, { status: 400 })
  }

  const signatureValid = await verifySnsSignature(snsMessage)
  if (!signatureValid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 })
  }

  if (snsMessage.Type === "SubscriptionConfirmation") {
    await confirmSubscription(snsMessage.SubscribeURL)
    return NextResponse.json({ ok: true })
  }

  if (snsMessage.Type !== "Notification") {
    return NextResponse.json({ ok: true })
  }

  const payload = parseJson(snsMessage.Message || "") as SesEvent | null
  if (!payload) {
    return NextResponse.json({ error: "Invalid SES payload" }, { status: 400 })
  }

  const evt = eventName(payload)
  const timestamp = eventTimestamp(payload)
  const messageId = payload.mail?.messageId
  const tags = payload.mail?.tags
  const recipientId = extractTagValue(tags, "recipient_id")
  const buyerIdTag = extractTagValue(tags, "buyer_id")
  const campaignId = extractTagValue(tags, "campaign_id")

  await storeEmailEvent({
    messageId,
    eventType: evt,
    payload,
    campaignId,
    recipientId,
    buyerId: buyerIdTag,
  })
  await updateRecipient(evt, { timestamp, recipientId: recipientId || undefined, providerId: messageId })

  if (evt === "bounce" || evt === "complaint") {
    const buyerId = await findBuyerId(buyerIdTag, { recipientId, providerId: messageId })
    await suppressBuyer(evt, buyerId, timestamp)
  }

  return NextResponse.json({ ok: true })
}

export function GET() {
  if (!topicArnValidation.valid) {
    log("error", "AWS_SNS_TOPIC_ARN must be a topic ARN, not a subscription ARN", {
      topicArn: expectedTopicArn,
      reason: topicArnValidation.reason,
    })
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
