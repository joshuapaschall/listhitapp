import { supabaseAdmin } from "@/lib/supabase"

export async function suppressBuyerSms(buyerId: string | null | undefined, reason: string) {
  if (!buyerId) return

  const { error } = await supabaseAdmin
    .from("buyers")
    .update({
      can_receive_sms: false,
      sms_suppressed: true,
      sms_suppressed_at: new Date().toISOString(),
      sms_suppressed_reason: reason,
    })
    .eq("id", buyerId)

  if (error) {
    console.error("Failed to suppress buyer SMS", { buyerId, reason, error })
  }
}

// Disable a bad number in the sending pool so rotation stops handing it out.
// Org-scoped; a no-op when org/e164 is missing.
export async function disableSmsSender(orgId: string | null | undefined, e164: string, reason: string) {
  if (!orgId || !e164) return
  const { error } = await supabaseAdmin
    .from("inbound_numbers")
    .update({ sms_enabled: false })
    .eq("org_id", orgId)
    .eq("e164", e164)
  if (error) {
    console.error("Failed to disable SMS sender", { orgId, e164, reason, error })
  }
}
