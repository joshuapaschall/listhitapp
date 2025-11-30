import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"
import { createLogger } from "@/lib/logger"
import { assertServer } from "@/utils/assert-server"

assertServer()

const log = createLogger("sendfox-webhook")
const supabase = supabaseAdmin

type WebhookEvent = {
  type?: string
  event?: string
  email?: string
  data?: any
  timestamp?: string
  recipient_id?: string
  campaign_id?: string
  message_id?: string
}

function normalizeEvents(payload: any): WebhookEvent[] {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.events)) return payload.events
  return [payload]
}

function requireToken(req: NextRequest) {
  const expected = process.env.SENDFOX_WEBHOOK_TOKEN
  if (!expected) return true
  const provided =
    req.headers.get("x-webhook-token") ||
    req.nextUrl.searchParams.get("token") ||
    req.headers.get("authorization")?.replace("Bearer ", "") ||
    ""
  return provided === expected
}

async function findBuyerId(email?: string): Promise<string | null> {
  if (!email || !supabase) return null
  const normalized = email.trim().toLowerCase()
  const { data } = await supabase
    .from("buyers")
    .select("id")
    .eq("email_norm", normalized)
    .maybeSingle()
  return data?.id ?? null
}

async function updateRecipient(
  eventType: string,
  ctx: {
    buyerId: string | null
    recipientId?: string | null
    providerId?: string | null
    campaignId?: string | null
    timestamp: string
  },
) {
  if (!supabase) return
  const updates: Record<string, any> = {}
  if (eventType === "open") updates.opened_at = ctx.timestamp
  if (eventType === "click") updates.clicked_at = ctx.timestamp
  if (eventType === "bounce") updates.bounced_at = ctx.timestamp
  if (eventType === "complaint") updates.complained_at = ctx.timestamp
  if (eventType === "bounce") updates.status = "bounced"
  if (eventType === "complaint") updates.status = "complained"
  if (Object.keys(updates).length === 0) return
  if (!ctx.recipientId && !ctx.providerId && !ctx.buyerId) return

  let query = supabase.from("campaign_recipients").update(updates)
  if (ctx.recipientId) {
    query = query.eq("id", ctx.recipientId)
  } else if (ctx.providerId) {
    query = query.eq("provider_id", ctx.providerId)
  } else if (ctx.buyerId) {
    query = query.eq("buyer_id", ctx.buyerId)
    if (ctx.campaignId) query = query.eq("campaign_id", ctx.campaignId)
  }
  await query
}

async function suppressBuyer(
  eventType: string,
  buyerId: string | null,
  timestamp: string,
) {
  if (!supabase || !buyerId) return
  const updates: Record<string, any> = {
    sendfox_suppressed: true,
    can_receive_email: false,
    sendfox_hidden: true,
  }
  if (eventType === "bounce") updates.sendfox_bounced_at = timestamp
  if (eventType === "complaint") updates.sendfox_complained_at = timestamp
  await supabase.from("buyers").update(updates).eq("id", buyerId)
}

export async function POST(req: NextRequest) {
  if (!requireToken(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const payload = await req.json()
    const events = normalizeEvents(payload)
    const supported = new Set(["open", "click", "bounce", "complaint"])

    for (const evt of events) {
      const eventType = (evt.type || evt.event || "").toLowerCase()
      if (!supported.has(eventType)) continue
      const email = evt.email || evt.data?.email
      const buyerId = await findBuyerId(email)
      const timestamp = evt.timestamp
        ? new Date(evt.timestamp).toISOString()
        : new Date().toISOString()
      const recipientId = evt.data?.recipient_id || evt.recipient_id || null
      const providerId = evt.data?.message_id || evt.data?.id || evt.message_id || null
      const campaignId = evt.data?.campaign_id || evt.campaign_id || null

      await updateRecipient(eventType, {
        buyerId,
        recipientId,
        providerId,
        campaignId,
        timestamp,
      })

      if (eventType === "bounce" || eventType === "complaint") {
        await suppressBuyer(eventType, buyerId, timestamp)
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    log("error", "SendFox webhook error", { message: err?.message, stack: err?.stack })
    return NextResponse.json({ error: err?.message || "error" }, { status: 500 })
  }
}
