import { supabase } from "@/lib/supabase"
import type { Buyer, Tag, Group } from "@/lib/supabase"
import { createLogger } from "@/lib/logger"

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
      .eq("sendfox_hidden", false)
      .order("created_at", { ascending: false })

    // Apply filters
    if (filters?.search) {
      const encoded = encodeURIComponent(filters.search)
      query = query.or(
        `fname.ilike.%${encoded}%,lname.ilike.%${encoded}%,email.ilike.%${encoded}%,phone.ilike.%${encoded}%`,
      )
    }

    if (filters?.vip !== undefined) {
      query = query.eq("vip", filters.vip)
    }

    if (filters?.vetted !== undefined) {
      query = query.eq("vetted", filters.vetted)
    }

    if (filters?.minScore) {
      query = query.gte("score", filters.minScore)
    }

    if (filters?.maxScore) {
      query = query.lte("score", filters.maxScore)
    }

    if (filters?.tags && filters.tags.length > 0) {
      query = query.overlaps("tags", filters.tags)
    }

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
  }) {
    let query = supabase.from("buyers").select("*").eq("sendfox_hidden", false)

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

    if (filters.minPrice !== undefined) {
      query = query.gte("asking_price_max", filters.minPrice)
    }
    if (filters.maxPrice !== undefined) {
      query = query.lte("asking_price_min", filters.maxPrice)
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

    if (data?.email) {
      const lists: number[] = []
      if (process.env.SENDFOX_DEFAULT_LIST_ID) {
        lists.push(Number(process.env.SENDFOX_DEFAULT_LIST_ID))
      }
      try {
        const res = await fetch("/api/sendfox/contact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: data.email,
            first_name: data.fname || undefined,
            lists,
          }),
        })
        const sf = await res.json()
        if (sf?.id) {
          await supabase
            .from("buyers")
            .update({ sendfox_contact_id: sf.id })
            .eq("id", data.id)
        }
      } catch (err) {
        log("warn", "Failed to sync contact", { error: err })
      }
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
    const deletedListId = Number(process.env.SENDFOX_DELETED_LIST_ID)
    if (!Number.isInteger(deletedListId)) {
      throw new Error("SENDFOX_DELETED_LIST_ID missing or invalid")
    }

    const { data: buyer, error: fetchErr } = await supabase
      .from("buyers")
      .select("id,email,fname")
      .eq("id", id)
      .single()
    if (fetchErr || !buyer?.email) {
      throw new Error("Buyer not found or missing email")
    }

    const updates = [
      supabase.from("buyer_groups").delete().eq("buyer_id", id),
      supabase
        .from("buyers")
        .update({
          sendfox_hidden: true,
          deleted_at: new Date().toISOString(),
        })
        .eq("id", id),
    ]
    const results = await Promise.all(updates as any)
    const supabaseError = results.find((r: any) => r?.error)?.error
    if (supabaseError) {
      throw new Error(`Supabase error: ${supabaseError.message || "unknown"}`)
    }

    const payload = {
      email: buyer.email,
      first_name: buyer.fname || "Deleted",
      lists: [deletedListId],
    }

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const resp = await fetch("/api/sendfox/contact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        if (!resp.ok) {
          const err = await resp.json().catch(() => ({}))
          console.error("SendFox delete-move failed", err)
          if (resp.status >= 500 && attempt === 0) {
            await new Promise((r) => setTimeout(r, 500))
            continue
          }
        }
        break
      } catch (e) {
        console.error("SendFox delete-move exception", e)
        if (attempt === 0) {
          await new Promise((r) => setTimeout(r, 500))
          continue
        }
      }
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

    try {
      const { data: group } = await supabase
        .from("groups")
        .select("sendfox_list_id")
        .eq("id", groupId)
        .single()
      if (group?.sendfox_list_id) {
        for (const buyerId of buyerIds) {
          const { data: buyer } = await supabase
            .from("buyers")
            .select("email,fname,sendfox_contact_id")
            .eq("id", buyerId)
            .single()
          if (buyer?.email) {
            try {
              const res = await fetch("/api/sendfox/contact", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  email: buyer.email,
                  first_name: buyer.fname || undefined,
                  lists: [group.sendfox_list_id],
                }),
              })
              const sf = await res.json()
              if (sf?.id && !buyer.sendfox_contact_id) {
                await supabase
                  .from("buyers")
                  .update({ sendfox_contact_id: sf.id })
                  .eq("id", buyerId)
              }
            } catch (err) {
              log("warn", "Failed to sync contact to list", { error: err })
            }
          }
        }
      }
    } catch (err) {
      log("warn", "SendFox group sync failed", { error: err })
    }
  }

  // Get buyers count by group
  static async getBuyerCountByGroup(groupId: string) {
    const { count, error } = await supabase
      .from("buyer_groups")
      .select("buyer_id, buyers!inner(id)", { count: "exact", head: true })
      .eq("group_id", groupId)
      .eq("buyers.sendfox_hidden", false)

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
      .eq("buyers.sendfox_hidden", false)

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

    if (error) {
      log("error", "Failed to get total buyer count", { error })
      throw error
    }

    return count || 0
  }

  // Search buyers by name, email, or phone
  static async searchBuyers(query: string) {
    const encoded = encodeURIComponent(query)
      const { data, error } = await supabase
      .from("buyers")
      .select("id, fname, lname, full_name, email, phone")
      .eq("sendfox_hidden", false)
      .or(
        `fname.ilike.%${encoded}%,lname.ilike.%${encoded}%,full_name.ilike.%${encoded}%,email.ilike.%${encoded}%,phone.ilike.%${encoded}%`,
      )
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
      .eq("sendfox_hidden", false)
      .order("full_name", { ascending: true })
      .limit(limit)

    if (error) {
      log("error", "Failed to fetch buyer list", { error })
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
      .eq("buyers.sendfox_hidden", false)

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
      } catch {}
      throw new Error(msg)
    }
  }
}
