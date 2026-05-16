import type { Offer, OfferWithRelations } from "@/lib/supabase"

export class OfferService {
  static async getOffers(filters?: {
    buyerId?: string
    propertyId?: string
    status?: string
  }): Promise<OfferWithRelations[]> {
    const params = new URLSearchParams()
    if (filters?.buyerId) params.set("buyerId", filters.buyerId)
    if (filters?.propertyId) params.set("propertyId", filters.propertyId)
    if (filters?.status) params.set("status", filters.status)

    const res = await fetch(`/api/offers?${params.toString()}`)
    if (!res.ok) throw new Error("Failed to fetch offers")
    return res.json()
  }

  static async getOffer(id: string): Promise<OfferWithRelations> {
    const res = await fetch(`/api/offers/${id}`)
    if (!res.ok) throw new Error("Failed to fetch offer")
    return res.json()
  }

  static async addOffer(offer: Partial<Offer>): Promise<OfferWithRelations> {
    const res = await fetch("/api/offers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(offer),
    })
    if (!res.ok) throw new Error("Failed to create offer")
    return res.json()
  }

  static async updateOffer(id: string, updates: Partial<Offer>): Promise<OfferWithRelations> {
    const res = await fetch(`/api/offers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    })
    if (!res.ok) throw new Error("Failed to update offer")
    return res.json()
  }

  static async updateOfferStatus(id: string, status: string): Promise<OfferWithRelations> {
    return OfferService.updateOffer(id, { status })
  }

  static async deleteOffer(id: string): Promise<void> {
    const res = await fetch(`/api/offers/${id}`, { method: "DELETE" })
    if (!res.ok) throw new Error("Failed to delete offer")
  }
}
