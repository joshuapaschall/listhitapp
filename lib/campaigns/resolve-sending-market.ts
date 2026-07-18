import type { SupabaseClient } from "@supabase/supabase-js"
import { NoSendingPoolError } from "@/lib/sender/campaign-from-pool"

// Resolve the campaign-purpose market a campaign should send from:
//   1. campaign.sending_market_id if set (must be a campaign-purpose market)
//   2. else the org's only campaign-purpose market
//   3. else throw (multiple campaign markets, none chosen)
export async function resolveSendingMarketId(
  client: SupabaseClient,
  orgId: string,
  explicitMarketId: string | null,
): Promise<string> {
  const { data: markets, error } = await client
    .from("markets")
    .select("id")
    .eq("org_id", orgId)
    .eq("purpose", "campaign")
  if (error) throw error
  const ids = (markets ?? []).map((m: any) => m.id)

  if (explicitMarketId) {
    if (!ids.includes(explicitMarketId)) {
      throw new NoSendingPoolError("Selected market isn't a campaign market.")
    }
    return explicitMarketId
  }
  if (ids.length === 1) return ids[0]
  if (ids.length === 0) {
    throw new NoSendingPoolError("No campaign market configured. Create one and add numbers.")
  }
  throw new NoSendingPoolError("You have multiple campaign markets — choose which one sends this campaign.")
}
