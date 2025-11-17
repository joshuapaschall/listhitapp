import { supabase } from "@/lib/supabase"
import type { Offer } from "@/lib/supabase"

export class OfferService {
  static async getOffers(filters?: {
    buyerId?: string
    propertyId?: string
    status?: string
  }) {
    let query = supabase
      .from("offers")
      .select(
        "*, buyers(id,fname,lname,full_name), properties(id,address,city,state,zip)"
      )
      .order("created_at", { ascending: false })

    if (filters?.buyerId) {
      query = query.eq("buyer_id", filters.buyerId)
    }

    if (filters?.propertyId) {
      query = query.eq("property_id", filters.propertyId)
    }

    if (filters?.status) {
      query = query.eq("status", filters.status)
    }

    const { data, error } = await query

    if (error) {
      console.error("Error fetching offers:", error)
      throw error
    }

    return data as Offer[]
  }

  static async addOffer(offer: Partial<Offer>) {
    const { data, error } = await supabase
      .from("offers")
      .insert([offer])
      .select()
      .single()

    if (error) {
      console.error("Error adding offer:", error)
      throw error
    }

    return data as Offer
  }

  static async updateOffer(id: string, updates: Partial<Offer>) {
    const timestampField =
      updates.status === "accepted"
        ? "accepted_at"
        : updates.status === "rejected"
        ? "rejected_at"
        : updates.status === "withdrawn"
        ? "withdrawn_at"
        : updates.status === "countered"
        ? "countered_at"
        : updates.status === "closed"
        ? "closed_at"
        : updates.status === "submitted"
        ? "submitted_at"
        : undefined

    const updateData: any = { ...updates }
    if (timestampField) {
      updateData[timestampField] = new Date().toISOString()
    }

    const { data, error } = await supabase
      .from("offers")
      .update(updateData)
      .eq("id", id)
      .select()
      .single()

    if (error) {
      console.error("Error updating offer:", error)
      throw error
    }

    return data as Offer
  }

  static async updateOfferStatus(id: string, status: string) {
    const timestampField =
      status === "accepted"
        ? "accepted_at"
        : status === "rejected"
        ? "rejected_at"
        : status === "withdrawn"
        ? "withdrawn_at"
        : status === "countered"
        ? "countered_at"
        : status === "closed"
        ? "closed_at"
        : status === "submitted"
        ? "submitted_at"
        : undefined

    const updates: any = { status }
    if (timestampField) {
      updates[timestampField] = new Date().toISOString()
    }

    const { data, error } = await supabase
      .from("offers")
      .update(updates)
      .eq("id", id)
      .select()
      .single()

    if (error) {
      console.error("Error updating offer:", error)
      throw error
    }

    return data as Offer
  }

  static async deleteOffer(id: string) {
    const { error } = await supabase.from("offers").delete().eq("id", id)

    if (error) {
      console.error("Error deleting offer:", error)
      throw error
    }
  }
}
