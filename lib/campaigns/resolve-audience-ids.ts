import { applyChannelEligibility } from "@/lib/segments/eligibility"
import { fetchAllRows, fetchRowsByIdChunks } from "@/lib/supabase-fetch-all"

export interface ResolveAudienceIdsInput {
  supabase: any // session client (RLS) OR service-role client
  orgId: string
  channel: "email" | "sms"
  buyerIds?: string[]
  groupIds?: string[]
}

/**
 * The single source of truth for "who is in this audience". Used by BOTH the
 * /api/campaigns/audience/count preview endpoint and the /api/campaigns/send
 * dispatch path, so the number the operator sees equals the number that mails.
 *
 * Paginates past PostgREST's 1000-row cap, chunks the id filter, gates every row
 * on the shared channel-eligibility predicate, and org-scopes both queries.
 * Errors propagate — each caller attaches its own status code.
 */
export async function resolveAudienceIds(input: ResolveAudienceIdsInput): Promise<string[]> {
  const { supabase, orgId, channel, buyerIds, groupIds } = input

  const idSet = new Set<string>(buyerIds ?? [])

  if (groupIds?.length) {
    const groupRows = await fetchAllRows<{ buyer_id: string }>(
      () =>
        applyChannelEligibility(
          supabase
            .from("buyer_groups")
            .select("buyer_id, buyers!inner(id)")
            .eq("org_id", orgId)
            .in("group_id", groupIds),
          channel,
          "buyers.",
        ),
      "buyer_id",
    )
    for (const row of groupRows) idSet.add(row.buyer_id)
  }

  const ids = Array.from(idSet)
  if (ids.length === 0) return []

  const allowed = await fetchRowsByIdChunks<{ id: string }>(
    ids,
    (chunk) =>
      applyChannelEligibility(
        supabase.from("buyers").select("id").eq("org_id", orgId).in("id", chunk),
        channel,
      ),
  )
  return allowed.map((r) => r.id)
}
