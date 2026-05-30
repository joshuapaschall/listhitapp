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
