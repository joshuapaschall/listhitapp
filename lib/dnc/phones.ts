import type { SupabaseClient } from "@supabase/supabase-js"
import { normalizePhone } from "@/lib/dedup-utils"

export type DncPhoneSource = "manual" | "keyword" | "stop" | "imported"

/**
 * Record a phone number on the org's DNC blocklist (dnc_phones).
 * `admin` is the supabaseAdmin (service-role) client; the upsert is explicitly
 * scoped by org_id. No-op on invalid input.
 */
export async function recordDncPhone(
  admin: SupabaseClient,
  orgId: string | null | undefined,
  rawPhone: string | null | undefined,
  source: DncPhoneSource,
  reason?: string | null,
): Promise<void> {
  if (!orgId) return
  const normalized = normalizePhone(rawPhone)
  if (!normalized) return

  const { error } = await admin
    .from("dnc_phones")
    .upsert(
      {
        org_id: orgId,
        normalized_phone: normalized,
        phone_display: rawPhone || normalized,
        source,
        reason: reason ?? null,
      },
      { onConflict: "org_id,normalized_phone", ignoreDuplicates: true },
    )

  if (error) {
    console.error("Failed to record DNC phone", { orgId, normalized, source, error })
  }
}
