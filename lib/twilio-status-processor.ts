import { supabaseAdmin } from "@/lib/supabase"
import { createLogger } from "@/lib/logger"

const log = createLogger("twilio-status-processor")

/**
 * Processes a Twilio outbound message status callback (MessageStatus:
 * queued|sending|sent|delivered|undelivered|failed) and updates the corresponding
 * campaign_recipients row, keyed on `provider_id === MessageSid` — the same
 * provider_id the send path persists. Mirrors processTelnyxStatusEvent's column
 * writes (status / delivered_at / rejected_at / error) so both rails report
 * delivery identically.
 *
 * SIGNATURE VERIFICATION IS THE CALLER'S RESPONSIBILITY. This function assumes
 * the request has already been validated.
 *
 * Returns a Response object that the route handler should return to Twilio.
 */
function isHardFailureStatus(status: string) {
  return status === "failed" || status === "undelivered"
}

export async function processTwilioStatusEvent(params: {
  messageSid: string
  messageStatus: string
  errorCode?: string | null
}): Promise<Response> {
  const messageSid = params.messageSid
  const status = params.messageStatus
  const errorCode = params.errorCode && String(params.errorCode).trim().length ? String(params.errorCode) : null
  log(">>>>>>>>> status <<<<<<<<<", { messageSid, status, errorCode })

  if (!messageSid || !status) {
    return new Response("Missing params", { status: 400 })
  }

  const { data: existing } = await supabaseAdmin
    .from("campaign_recipients")
    .select("id,buyer_id,delivered_at,rejected_at,actual_cost_usd")
    .eq("provider_id", messageSid)
    .maybeSingle()

  if (!existing) {
    console.warn("⚠️ No matching campaign_recipients row for MessageSid:", messageSid)
    return new Response(null, { status: 204 })
  }

  const updates: Record<string, any> = {
    status,
  }

  if (errorCode) {
    updates.error = `Twilio error ${errorCode}`
  } else if (isHardFailureStatus(status)) {
    updates.error = status
  }

  const now = new Date().toISOString()
  if (status === "delivered" && !existing.delivered_at) {
    updates.delivered_at = now
  }
  if (isHardFailureStatus(status) && !existing.rejected_at) {
    updates.rejected_at = now
  }

  // Twilio's status callback carries no cost/segment data (unlike Telnyx's
  // message.finalized), so on delivered we fetch the message resource and
  // backfill actual_segments/actual_cost_usd. Non-fatal — the status update is
  // still written on any fetch error. recipient_carrier is intentionally left
  // null: the Twilio message resource doesn't carry it.
  if (status === "delivered" && !existing.actual_cost_usd) {
    try {
      const { getTwilioClient } = await import("@/lib/providers/twilio/client")
      const msg = await getTwilioClient().messages(messageSid).fetch()
      const segments = Number(msg.numSegments)
      if (Number.isFinite(segments) && segments > 0) updates.actual_segments = segments
      const price = msg.price != null ? Math.abs(Number(msg.price)) : NaN
      // priceUnit is ISO-4217 and Twilio may return it lower- or upper-case
      // ("usd"/"USD") — compare case-insensitively so real USD sends aren't dropped.
      if (Number.isFinite(price) && (!msg.priceUnit || String(msg.priceUnit).toUpperCase() === "USD")) {
        updates.actual_cost_usd = price
      }
    } catch (err) {
      log("cost/segment backfill fetch failed", { messageSid, err })
    }
  }

  const { error } = await supabaseAdmin
    .from("campaign_recipients")
    .update(updates)
    .eq("id", existing.id)

  if (error) {
    console.error("❌ Failed to update campaign recipient:", error)
    return new Response("Error", { status: 500 })
  }

  return new Response(null, { status: 204 })
}
