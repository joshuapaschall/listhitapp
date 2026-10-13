import { supabaseAdmin } from "@/lib/supabase"
import { formatPhoneE164 } from "@/lib/dedup-utils"
import { isOrgTelnyxPinnedEnv } from "@/lib/providers/sms/routing"

// The rail that owns an org's numbers: the pinned owner org sends from Telnyx
// numbers, every other org from its own Twilio numbers. Pools never mix.
export function numberProviderForOrg(orgId: string): "telnyx" | "twilio" {
  return isOrgTelnyxPinnedEnv(orgId) ? "telnyx" : "twilio"
}

export class NoSendingPoolError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "NoSendingPoolError"
  }
}

// Least-recently-used SMS-enabled number in a campaign market's pool.
// Picks the number with the oldest last_sms_at (nulls first), stamps it now,
// and returns its E.164. Throws NoSendingPoolError if the pool is empty.
export async function pickPoolFromNumber(orgId: string, marketId: string): Promise<string> {
  const provider = numberProviderForOrg(orgId)
  const { data, error } = await supabaseAdmin
    .from("inbound_numbers")
    .select("e164,last_sms_at")
    .eq("org_id", orgId)
    .eq("provider", provider)
    .eq("market_id", marketId)
    .eq("sms_enabled", true)
    .eq("enabled", true)
    .order("last_sms_at", { ascending: true, nullsFirst: true })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  const e164 = formatPhoneE164(data?.e164)
  if (!e164) {
    throw new NoSendingPoolError(
      "No SMS-enabled numbers in the selected sending market. Add numbers or pick a different market.",
    )
  }

  // Stamp so the next recipient rotates to a different number. Best-effort.
  const { error: stampErr } = await supabaseAdmin
    .from("inbound_numbers")
    .update({ last_sms_at: new Date().toISOString() })
    .eq("org_id", orgId)
    .eq("provider", provider)
    .eq("e164", data!.e164)
  if (stampErr) console.error("[sms:from-pool] last_sms_at stamp failed", stampErr)

  return e164
}
