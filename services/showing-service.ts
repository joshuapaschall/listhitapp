import type { Showing, ShowingWithRelations } from "@/lib/supabase"

export class ShowingService {
  static async getShowings(filters?: {
    buyerId?: string
    propertyId?: string
    status?: string
    startDate?: string
    endDate?: string
  }): Promise<ShowingWithRelations[]> {
    const search = new URLSearchParams()
    if (filters?.buyerId) search.set("buyerId", filters.buyerId)
    if (filters?.propertyId) search.set("propertyId", filters.propertyId)
    if (filters?.status) search.set("status", filters.status)
    if (filters?.startDate) search.set("startDate", filters.startDate)
    if (filters?.endDate) search.set("endDate", filters.endDate)

    const url = `/api/showings${search.toString() ? `?${search.toString()}` : ""}`
    const response = await fetch(url, { method: "GET" })
    if (!response.ok) throw new Error(`Failed to fetch showings: ${response.status}`)
    return (await response.json()) as ShowingWithRelations[]
  }

  static async addShowing(showing: Partial<Showing>): Promise<ShowingWithRelations> {
    const response = await fetch("/api/showings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(showing),
    })
    if (!response.ok) throw new Error(`Failed to add showing: ${response.status}`)
    return (await response.json()) as ShowingWithRelations
  }

  static async updateShowing(id: string, updates: Partial<Showing>): Promise<ShowingWithRelations> {
    const response = await fetch(`/api/showings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    })
    if (!response.ok) throw new Error(`Failed to update showing ${id}: ${response.status}`)
    return (await response.json()) as ShowingWithRelations
  }

  static async deleteShowing(id: string): Promise<void> {
    const response = await fetch(`/api/showings/${id}`, { method: "DELETE" })
    if (!response.ok) throw new Error(`Failed to delete showing ${id}: ${response.status}`)
  }
}
