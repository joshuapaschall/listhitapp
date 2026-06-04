import { supabase } from "@/lib/supabase"
import type { Buyer, Tag, Group } from "@/lib/supabase"
import { createLogger } from "@/lib/logger"
import { applyAttributeConditions } from "@/lib/segments/apply-filters"
import type { AttributeCondition } from "@/lib/segments/types"

const log = createLogger("buyer")

export class BuyerService {
  // Get all buyers with optional filtering
  static async getBuyers(filters?: {
    search?: string
    tags?: string[]
    vip?: boolean
    vetted?: boolean
    minScore?: number
    maxScore?: number
  }) {
    let query = supabase
      .from("buyers")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })

    // Apply filters
    if (filters?.search) {
      // Sanitize PostgREST OR-list delimiters (don't URL-encode — that corrupts the ilike pattern).
      const safe = filters.search.trim().replace(/[,()]/g, " ").replace(/\s+/g, " ").trim()
      if (safe) {
        query = query.or(
          `fname.ilike.%${safe}%,lname.ilike.%${safe}%,email.ilike.%${safe}%,phone.ilike.%${safe}%`,
        )
      }
    }

    // Attribute predicates flow through the one shared engine primitive so this
    // service applies the same filters as the Buyers list and the engine. Note
    // this service's tag filter is has-ANY (overlaps → operator "contains"),
    // preserving its existing behavior.
    const attributeConditions: AttributeCondition[] = []
    if (filters?.vip !== undefined) attributeConditions.push({ kind: "attribute", field: "vip", operator: "is", value: filters.vip })
    if (filters?.vetted !== undefined) attributeConditions.push({ kind: "attribute", field: "vetted", operator: "is", value: filters.vetted })
    if (filters?.minScore) attributeConditions.push({ kind: "attribute", field: "score", operator: "gte", value: filters.minScore })
    if (filters?.maxScore) attributeConditions.push({ kind: "attribute", field: "score", operator: "lte", value: filters.maxScore })
    if (filters?.tags && filters.tags.length > 0) attributeConditions.push({ kind: "attribute", field: "tags", operator: "contains", value: filters.tags })
    query = applyAttributeConditions(query, attributeConditions)

    const { data, error } = await query

    if (error) {
      log("error", "Failed to fetch buyers", { error })
      throw error
    }

    return data as Buyer[]
  }

  // Fetch buyers matching location, property type and price range
  static async getBuyersByCriteria(filters: {
    city?: string
    state?: string
    propertyType?: string
    minPrice?: number
    maxPrice?: number
    tags?: string[]
    dealType?: "cash" | "creative"
  }) {
    let query = supabase.from("buyers").select("*").is("deleted_at", null)

    if (filters.city && filters.state) {
      query = query.overlaps("locations", [`${filters.city}, ${filters.state}`])
    } else if (filters.city) {
      query = query.overlaps("locations", [filters.city])
    } else if (filters.state) {
      query = query.overlaps("locations", [filters.state])
    }

    if (filters.propertyType) {
      query = query.overlaps("property_type", [filters.propertyType])
    }

    // Tag-based fit is best-effort (tags are free-form) — prefer buyers whose
    // tags overlap the property's tags / chosen buyer-fit hint.
    if (filters.tags && filters.tags.length > 0) {
      query = query.overlaps("tags", filters.tags)
    }

    // Creative deals: buyers' budget range is cash-oriented, so the price range
    // would wrongly exclude creative-finance buyers. Match on location +
    // property_type + tag overlap only for those.
    if (filters.dealType !== "creative") {
      if (filters.minPrice !== undefined) {
        query = query.gte("asking_price_max", filters.minPrice)
      }
      if (filters.maxPrice !== undefined) {
        query = query.lte("asking_price_min", filters.maxPrice)
      }
    }

    const { data, error } = await query.order("created_at", { ascending: false })

    if (error) {
      log("error", "Failed to fetch matching buyers", { error })
      throw error
    }

    return (data || []) as Buyer[]
  }

  // Get all tags
  static async getTags() {
    const { data, error } = await supabase.from("tags").select("*").order("name")

    if (error) {
      log("error", "Failed to fetch tags", { error })
      throw error
    }

    return data as Tag[]
  }

  // Get all groups
  static async getGroups() {
    const { data, error } = await supabase.from("groups").select("*").order("name")

    if (error) {
      log("error", "Failed to fetch groups", { error })
      throw error
    }

    return data as Group[]
  }

  // Add a new buyer
  static async addBuyer(buyer: Partial<Buyer>, ipAddress?: string) {
    const { data, error } = await supabase.from("buyers").insert([buyer]).select().single()

    if (error) {
      log("error", "Failed to add buyer", { error })
      throw error
    }

    return data as Buyer
  }

  // Update a buyer
  static async updateBuyer(id: string, updates: Partial<Buyer>) {
    const { data, error } = await supabase.from("buyers").update(updates).eq("id", id).select().single()

    if (error) {
      log("error", "Failed to update buyer", { error })
      throw error
    }

    return data as Buyer
  }

  // Delete a buyer
  static async deleteBuyer(id: string) {
    const updates = [
      supabase.from("buyer_groups").delete().eq("buyer_id", id),
      supabase
        .from("buyers")
        .update({
          deleted_at: new Date().toISOString(),
        })
        .eq("id", id),
    ]
    const results = await Promise.all(updates as any)
    const supabaseError = results.find((r: any) => r?.error)?.error
    if (supabaseError) {
      throw new Error(`Supabase error: ${supabaseError.message || "unknown"}`)
    }

    return { success: true }
  }

  static async deleteBuyers(ids: string[]) {
    const limit = 5
    for (let i = 0; i < ids.length; i += limit) {
      const batch = ids.slice(i, i + limit)
      await Promise.all(batch.map((id) => BuyerService.deleteBuyer(id)))
    }
  }

  // Add buyers to a group
  static async addBuyersToGroup(buyerIds: string[], groupId: string) {
    const records = buyerIds.map((buyerId) => ({
      buyer_id: buyerId,
      group_id: groupId,
    }))
    const { error } = await supabase.from("buyer_groups").insert(records)
    if (error) {
      log("error", "Failed to add buyers to group", { error })
      throw error
    }
  }
  // Get buyers count by group
  static async getBuyerCountByGroup(groupId: string) {
    const { count, error } = await supabase
      .from("buyer_groups")
      .select("buyer_id, buyers!inner(id)", { count: "exact", head: true })
      .eq("group_id", groupId)
      .is("buyers.deleted_at", null)

    if (error) {
      log("error", "Failed to get buyer count", { error })
      throw error
    }

    return count || 0
  }

  // Get buyer counts for all groups
  static async getBuyerCountsByGroup() {
    const { data, error } = await supabase
      .from("buyer_groups")
      .select("group_id, buyers!inner(id)")
      .is("buyers.deleted_at", null)

    if (error) {
      log("error", "Failed to get buyer counts", { error })
      throw error
    }

    const counts: Record<string, number> = {}
    ;(data || []).forEach((row) => {
      counts[row.group_id] = (counts[row.group_id] || 0) + 1
    })
    return counts
  }

  // Get total buyer count
  static async getTotalBuyerCount() {
    const { count, error } = await supabase
      .from("buyers")
      .select("*", { count: "exact", head: true })
      .is("deleted_at", null)

    if (error) {
      log("error", "Failed to get total buyer count", { error })
      throw error
    }

    return count || 0
  }

  // Search buyers by name, email, or phone
  static async searchBuyers(query: string) {
    const raw = query.trim()
    // Strip PostgREST OR-list delimiters so they can't break the filter syntax.
    const safe = raw.replace(/[,()]/g, " ").replace(/\s+/g, " ").trim()
    const digits = raw.replace(/\D/g, "")
    const tokens = safe.split(" ").filter(Boolean)

    if (!safe && digits.length < 3) return [] as Buyer[]

    const ors: string[] = []
    if (safe) {
      ors.push(`full_name.ilike.%${safe}%`, `email.ilike.%${safe}%`)
      if (tokens.length === 1) {
        ors.push(`fname.ilike.%${tokens[0]}%`, `lname.ilike.%${tokens[0]}%`)
      } else if (tokens.length >= 2) {
        const first = tokens[0]
        const last = tokens[tokens.length - 1]
        ors.push(`and(fname.ilike.%${first}%,lname.ilike.%${last}%)`)
        ors.push(`and(fname.ilike.%${last}%,lname.ilike.%${first}%)`)
      }
    }
    if (digits.length >= 3) {
      ors.push(
        `phone_norm.ilike.%${digits}%`,
        `phone2_norm.ilike.%${digits}%`,
        `phone3_norm.ilike.%${digits}%`,
      )
    }

    if (!ors.length) return [] as Buyer[]

    const { data, error } = await supabase
      .from("buyers")
      .select("id, fname, lname, full_name, email, phone")
      .is("deleted_at", null)
      .or(ors.join(","))
      .order("full_name", { ascending: true })
      .limit(20)

    if (error) {
      log("error", "Failed to search buyers", { error })
      throw error
    }

    return (data || []) as Buyer[]
  }

  // Retrieve a lightweight list of buyers for selectors
  static async listBuyers(limit = 20) {
    const { data, error } = await supabase
      .from("buyers")
      .select("id, fname, lname, full_name, email, phone")
      .is("deleted_at", null)
      .order("full_name", { ascending: true })
      .limit(limit)

    if (error) {
      log("error", "Failed to fetch buyer list", { error })
      throw error
    }

    return (data || []) as Buyer[]
  }

  static async getBuyersByIds(ids: string[]) {
    if (ids.length === 0) return [] as Buyer[]
    const { data, error } = await supabase
      .from("buyers")
      .select("id, fname, lname, full_name, email, phone")
      .in("id", ids)
      .is("deleted_at", null)

    if (error) {
      log("error", "Failed to fetch buyers by ids", { error })
      throw error
    }

    return (data || []) as Buyer[]
  }

  // Get unique buyer ids for a list of groups
  static async getBuyerIdsForGroups(groupIds: string[]) {
    if (groupIds.length === 0) return [] as string[]
    const { data, error } = await supabase
      .from("buyer_groups")
      .select("buyer_id, buyers!inner(id)")
      .in("group_id", groupIds)
      .is("buyers.deleted_at", null)

    if (error) {
      log("error", "Failed to fetch group buyers", { error })
      throw error
    }

    const ids = Array.from(new Set((data || []).map((r) => r.buyer_id)))
    return ids
  }

  static async unsubscribeBuyer(id: string) {
    const res = await fetch(`/api/buyers/${id}/unsubscribe`, {
      method: "POST",
    })
    if (!res.ok) {
      let msg = "Failed to unsubscribe"
      try {
        const data = await res.json()
        if (data?.error) msg = data.error
      } catch (err) {
        console.error("buyer-service: failed to parse unsubscribe error response:", err)
      }
      throw new Error(msg)
    }
  }
}
