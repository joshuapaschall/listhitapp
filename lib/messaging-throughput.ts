import "server-only"
import { supabaseAdmin } from "@/lib/supabase/admin"

export type PoolSizeSource = "voice_numbers" | "env_fallback" | "default"

export async function getMessagingProfilePoolSize(
  messagingProfileId?: string | null,
): Promise<{ poolSize: number; source: PoolSizeSource }> {
  const profileId = messagingProfileId ?? process.env.TELNYX_MESSAGING_PROFILE_ID
  if (!profileId) return { poolSize: 1, source: "default" }

  const { count, error } = await supabaseAdmin
    .from("voice_numbers")
    .select("phone_number", { count: "exact", head: true })
    .eq("messaging_profile_id", profileId)

  if (error) {
    console.error("getMessagingProfilePoolSize voice_numbers query failed", error)
  }
  if (count && count > 0) return { poolSize: count, source: "voice_numbers" }

  const envFallback = Number(process.env.NEXT_PUBLIC_LISTHIT_POOL_SIZE)
  if (Number.isFinite(envFallback) && envFallback > 0) {
    console.warn(
      "getMessagingProfilePoolSize falling back to NEXT_PUBLIC_LISTHIT_POOL_SIZE; run /api/sync/voice-numbers to populate voice_numbers",
    )
    return { poolSize: envFallback, source: "env_fallback" }
  }

  return { poolSize: 1, source: "default" }
}
