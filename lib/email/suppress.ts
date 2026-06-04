import { supabaseAdmin } from "@/lib/supabase"

export async function suppressBuyerEmail(buyerId: string | null | undefined, reason: string) {
  if (!buyerId) return

  const now = new Date().toISOString()
  const { error } = await supabaseAdmin
    .from("buyers")
    .update({
      can_receive_email: false,
      email_suppressed: true,
      email_suppressed_at: now,
      email_suppressed_reason: reason,
      is_unsubscribed: true,
      unsubscribed_at: now,
    })
    .eq("id", buyerId)

  if (error) {
    console.error("Failed to suppress buyer email", { buyerId, reason, error })
  }
}
