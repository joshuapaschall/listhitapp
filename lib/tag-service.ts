import { supabase } from "@/lib/supabase"
import { createLogger } from "@/lib/logger"

const log = createLogger("tag")

export async function bulkUpdateBuyerTags(
  buyerIds: string[],
  opts: { add?: string[]; remove?: string[] },
): Promise<number> {
  if (!buyerIds.length) return 0

  // The RPC writes names straight into buyers.tags, so anything being added has
  // to be in the org vocabulary first — and stored in its canonical casing.
  let add = opts.add ?? []
  if (add.length) {
    try {
      const res = await fetch("/api/tags/ensure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ names: add }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body?.error || "Failed to create tags")
      add = (body?.names ?? add) as string[]
    } catch (err) {
      log("error", "bulkUpdateBuyerTags: ensure tags failed", { err })
      throw err
    }
  }

  const { data, error } = await supabase.rpc("bulk_update_buyer_tags", {
    p_buyer_ids: buyerIds,
    p_add: add,
    p_remove: opts.remove ?? [],
  })
  if (error) {
    log("error", "bulkUpdateBuyerTags failed", { error })
    throw error
  }
  return (data as number) ?? 0
}

export interface BuyerTagCount { tag: string; count: number }

export async function getBuyerTagCounts(buyerIds: string[]): Promise<BuyerTagCount[]> {
  if (!buyerIds.length) return []
  const { data, error } = await supabase.rpc("buyer_tag_counts", { p_buyer_ids: buyerIds })
  if (error) {
    log("error", "getBuyerTagCounts failed", { error })
    throw error
  }
  return (data as BuyerTagCount[]) ?? []
}
