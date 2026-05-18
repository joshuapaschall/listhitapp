// @ts-nocheck
import { NextRequest } from "next/server"
import { supabase } from "@/lib/supabase"
import { verifyTelnyxRequest } from "@/lib/telnyx"

export async function POST(request: NextRequest) {
  const raw = await request.text()
  if (!verifyTelnyxRequest(request, raw)) {
    return new Response("Invalid signature", { status: 403 })
  }

  let body: any
  try {
    body = JSON.parse(raw)
  } catch {
    return new Response("Bad request", { status: 400 })
  }

  const eventType = body?.data?.event_type as string | undefined
  const payload = body?.data?.payload
  console.log(">>>>>>>>> status <<<<<<<<<", { eventType, status: payload?.status })

  const messageId = payload?.id as string | undefined
  const finalToStatus = Array.isArray(payload?.to) && payload.to[0]?.status
    ? String(payload.to[0].status)
    : null
  const status = (finalToStatus ?? payload?.status) as string | undefined
  const errorDetail = payload?.errors?.[0]?.detail as string | undefined

  if (!messageId || !status) {
    return new Response("Missing params", { status: 400 })
  }

  const { data: existing } = await supabase
    .from("campaign_recipients")
    .select("id,delivered_at,rejected_at,delivery_delayed_at,actual_cost_usd")
    .eq("provider_id", messageId)
    .maybeSingle()

  if (!existing) {
    console.warn("⚠️ No matching campaign_recipients row for MessageSid:", messageId)
    return new Response(null, { status: 204 })
  }

  const updates: Record<string, any> = {
    status,
    updated_at: new Date().toISOString(),
  }

  if (errorDetail) {
    updates.error = errorDetail
  } else if (status === "delivery_failed" || status === "sending_failed" || status === "failed" || status === "undelivered") {
    updates.error = status
  }

  const now = new Date().toISOString()
  if (status === "delivered" && !existing.delivered_at) {
    updates.delivered_at = now
  }
  if ((status === "delivery_failed" || status === "sending_failed" || status === "failed") && !existing.rejected_at) {
    updates.rejected_at = now
  }
  if ((status === "delivery_unconfirmed" || status === "unconfirmed") && !existing.delivery_delayed_at) {
    updates.delivery_delayed_at = now
  }

  if (eventType === "message.finalized" && !existing.actual_cost_usd) {
    const costAmountRaw = payload?.cost?.amount
    const costAmount = typeof costAmountRaw === "string" ? Number(costAmountRaw) : (typeof costAmountRaw === "number" ? costAmountRaw : null)
    if (costAmount !== null && Number.isFinite(costAmount)) {
      updates.actual_cost_usd = costAmount
    }
    const parts = typeof payload?.parts === "number" ? payload.parts : null
    if (parts !== null && Number.isFinite(parts)) {
      updates.actual_segments = parts
    }
    const carrier = payload?.to?.[0]?.carrier
    if (typeof carrier === "string" && carrier.length) {
      updates.recipient_carrier = carrier
    }
  }

  const { error } = await supabase
    .from("campaign_recipients")
    .update(updates)
    .eq("id", existing.id)

  if (error) {
    console.error("❌ Failed to update campaign recipient:", error)
    return new Response("Error", { status: 500 })
  }

  return new Response(null, { status: 204 })
}
