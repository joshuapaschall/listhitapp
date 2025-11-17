import { supabase } from "@/lib/supabase"
import type { Showing } from "@/lib/supabase"

export class ShowingService {
  // Get showings with optional filtering
  static async getShowings(filters?: {
    buyerId?: string
    propertyId?: string
    status?: string
    startDate?: string
    endDate?: string
  }) {
    let query = supabase
      .from("showings")
      .select(
        "*, buyers(id,fname,lname,full_name), properties(id,address,city,state,zip)"
      )
      .order("scheduled_at", { ascending: false })

    if (filters?.buyerId) {
      query = query.eq("buyer_id", filters.buyerId)
    }

    if (filters?.propertyId) {
      query = query.eq("property_id", filters.propertyId)
    }

    if (filters?.status) {
      query = query.eq("status", filters.status)
    }

    if (filters?.startDate) {
      query = query.gte("scheduled_at", filters.startDate)
    }

    if (filters?.endDate) {
      query = query.lte("scheduled_at", filters.endDate)
    }

    const { data, error } = await query

    if (error) {
      console.error("Error fetching showings:", error)
      throw error
    }

    return data as Showing[]
  }

  // Add a new showing
  static async addShowing(showing: Partial<Showing>) {
    const { data, error } = await supabase
      .from("showings")
      .insert([showing])
      .select()
      .single()

    if (error) {
      console.error("Error adding showing:", error)
      throw error
    }

    return data as Showing
  }

  // Update an existing showing
  static async updateShowing(id: string, updates: Partial<Showing>) {
    const { data, error } = await supabase
      .from("showings")
      .update(updates)
      .eq("id", id)
      .select()
      .single()

    if (error) {
      console.error("Error updating showing:", error)
      throw error
    }

    return data as Showing
  }

  // Delete a showing
  static async deleteShowing(id: string) {
    const { error } = await supabase.from("showings").delete().eq("id", id)

    if (error) {
      console.error("Error deleting showing:", error)
      throw error
    }
  }
}
