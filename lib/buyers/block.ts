import { supabaseAdmin } from "@/lib/supabase"

// Reason stamped on the suppression columns when a buyer is blocked. Used on
// unblock to distinguish a manual block from a STOP opt-out / email bounce, so
// unblocking never silently re-enables a channel the buyer opted out of.
const BLOCK_REASON = "manual_block"

export async function blockBuyer(buyerId: string | null | undefined, reason: string = BLOCK_REASON) {
  if (!buyerId) return { error: null }

  const now = new Date().toISOString()
  const { error } = await supabaseAdmin
    .from("buyers")
    .update({
      can_receive_sms: false,
      sms_suppressed: true,
      sms_suppressed_at: now,
      sms_suppressed_reason: BLOCK_REASON,
      can_receive_email: false,
      email_suppressed: true,
      email_suppressed_at: now,
      email_suppressed_reason: BLOCK_REASON,
      blocked_at: now,
      blocked_reason: reason,
    })
    .eq("id", buyerId)

  if (error) {
    console.error("Failed to block buyer", { buyerId, reason, error })
  }

  return { error }
}

export async function unblockBuyer(buyerId: string | null | undefined) {
  if (!buyerId) return { error: null }

  // Read the current suppression reasons so we only re-enable channels the block
  // itself suppressed — STOP opt-outs and bounces stay suppressed.
  const { data: current, error: readError } = await supabaseAdmin
    .from("buyers")
    .select("sms_suppressed_reason, email_suppressed_reason")
    .eq("id", buyerId)
    .single()

  if (readError) {
    console.error("Failed to read buyer for unblock", { buyerId, error: readError })
    return { error: readError }
  }

  const update: Record<string, unknown> = {
    blocked_at: null,
    blocked_reason: null,
  }

  if (current?.sms_suppressed_reason === BLOCK_REASON) {
    update.can_receive_sms = true
    update.sms_suppressed = false
    update.sms_suppressed_at = null
    update.sms_suppressed_reason = null
  }

  if (current?.email_suppressed_reason === BLOCK_REASON) {
    update.can_receive_email = true
    update.email_suppressed = false
    update.email_suppressed_at = null
    update.email_suppressed_reason = null
  }

  const { error } = await supabaseAdmin.from("buyers").update(update).eq("id", buyerId)

  if (error) {
    console.error("Failed to unblock buyer", { buyerId, error })
  }

  return { error }
}
