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
    .select("id,buyer_id,delivered_at,rejected_at")
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
