import { supabase } from "@/lib/supabase"
import type { Property, PropertyImage, PropertyBuyer } from "@/lib/supabase"
import { createShortLink } from "./shortio-service"

export interface PropertyFilters {
  status?: string
  city?: string
  state?: string
  minPrice?: number
  maxPrice?: number
  propertyType?: string
  minBedrooms?: number
  maxBedrooms?: number
  minBathrooms?: number
  maxBathrooms?: number
  search?: string
  page?: number
  perPage?: number
  sortBy?: string
  sortOrder?: "asc" | "desc"
}

export class PropertyService {
  private static buildIlikePattern(value: string) {
    const sanitized = value.replace(/[%]/g, "").replace(/[(),]/g, " ").trim()
    return `%${sanitized}%`
  }
  // Fetch properties with optional filtering, pagination and sorting
  static async getProperties(
    filters: PropertyFilters = {},
  ): Promise<{ properties: Property[]; totalCount: number; totalPages: number }> {
    const {
      status,
      city,
      state,
      minPrice,
      maxPrice,
      propertyType,
      minBedrooms,
      maxBedrooms,
      minBathrooms,
      maxBathrooms,
      search,
      page,
      perPage = 10,
      sortBy = "created_at",
      sortOrder = "desc",
    } = filters

    let query = supabase
      .from("properties")
      .select("*, property_images(id, image_url, sort_order, is_featured)", { count: "exact" })

    if (status) {
      query = query.eq("status", status)
    }

    if (city) {
      query = query.ilike("city", `%${city}%`)
    }

    if (state) {
      query = query.eq("state", state)
    }

    if (minPrice !== undefined) {
      query = query.gte("price", minPrice)
    }

    if (maxPrice !== undefined) {
      query = query.lte("price", maxPrice)
    }

    if (propertyType) {
      query = query.eq("property_type", propertyType)
    }

    if (minBedrooms !== undefined) {
      query = query.gte("bedrooms", minBedrooms)
    }

    if (maxBedrooms !== undefined) {
      query = query.lte("bedrooms", maxBedrooms)
    }

    if (minBathrooms !== undefined) {
      query = query.gte("bathrooms", minBathrooms)
    }

    if (maxBathrooms !== undefined) {
      query = query.lte("bathrooms", maxBathrooms)
    }

    if (search) {
      const searchPattern = this.buildIlikePattern(search)
      query = query.or(
        `address.ilike.${searchPattern},city.ilike.${searchPattern},state.ilike.${searchPattern},zip.ilike.${searchPattern}`,
      )
    }

    query = query.order(sortBy, { ascending: sortOrder === "asc" })

    const safePage = Math.max(1, page || 1)
    const safePerPage = Math.max(1, perPage)
    const from = (safePage - 1) * safePerPage
    const to = from + safePerPage - 1
    query = query.range(from, to)

    const { data, error, count } = await query

    if (error) {
      console.error("Error fetching properties:", error)
      throw error
    }

    const totalCount = count || 0
    const totalPages = Math.max(1, Math.ceil(totalCount / safePerPage))

    return { properties: (data as Property[]) || [], totalCount, totalPages }
  }

  // Search properties by address, city, state, or zip
  static async searchProperties(query: string) {
    const searchPattern = this.buildIlikePattern(query)
    const { data, error } = await supabase
      .from("properties")
      .select("id, address, city, state, zip")
      .or(
        `address.ilike.${searchPattern},city.ilike.${searchPattern},state.ilike.${searchPattern},zip.ilike.${searchPattern}`,
      )
      .order("created_at", { ascending: false })
      .limit(20)

    if (error) {
      console.error("Error searching properties:", error)
      throw error
    }

    return data as Property[]
  }

  // Retrieve a lightweight list of all properties for selectors
  static async listAllProperties() {
    const { data, error } = await supabase
      .from("properties")
      .select("id, address, city, state, zip")
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching property list:", error)
      throw error
    }

    return data as Property[]
  }

  // Fetch a single property by ID
  static async getProperty(id: string) {
    const { data, error } = await supabase
      .from("properties")
      .select("*")
      .eq("id", id)
      .maybeSingle()

    if (error && error.message !== "Row not found") {
      console.error("Error fetching property:", error)
      throw error
    }

    return data as Property | null
  }

  // Find a property by its address (used for deduplication)
  static async findByAddress(
    address: string,
    city?: string | null,
    zip?: string | null,
  ) {
    let query = supabase.from("properties").select("*")

    if (address) {
      query = query.ilike("address", `%${address}%`)
    }
    if (city) {
      query = query.ilike("city", `%${city}%`)
    }
    if (zip) {
      query = query.ilike("zip", `%${zip}%`)
    }

    const { data, error } = await query.limit(1).maybeSingle()

    if (error && error.message !== "Row not found") {
      console.error("Error fetching property by address:", error)
      throw error
    }

    return data as Property | null
  }

  // Create a new property
  static async addProperty(property: Partial<Property>): Promise<Property> {
    const res = await fetch("/api/properties", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(property),
    })
    const body = await res.json().catch(() => ({ error: "Failed to parse response" }))
    if (!res.ok) {
      console.error("addProperty failed:", res.status, body)
      throw new Error(body.error || `Add property failed with status ${res.status}`)
    }

    const propertyData = body.property as Property

    try {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || window.location.origin
      const targetUrl = property.website_url || `${baseUrl}/properties/${propertyData.id}`
      const { shortURL, path, idString } = await createShortLink(
        targetUrl,
        property.short_slug || undefined,
      )
      const updated = await this.updateProperty(propertyData.id, {
        short_url_key: path,
        short_url: shortURL,
        short_slug: path,
        shortio_link_id: idString,
      })
      return updated
    } catch (err) {
      console.error("Short link creation failed (non-fatal):", err)
    }

    return propertyData
  }

  // Update an existing property
  static async updateProperty(id: string, updates: Partial<Property>): Promise<Property> {
    const res = await fetch(`/api/properties/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    })
    const body = await res.json().catch(() => ({ error: "Failed to parse response" }))
    if (!res.ok) {
      console.error("updateProperty failed:", res.status, body)
      throw new Error(body.error || `Update property failed with status ${res.status}`)
    }
    return body.property as Property
  }

  // Delete a property
  static async deleteProperty(id: string): Promise<void> {
    const res = await fetch(`/api/properties/${id}`, {
      method: "DELETE",
    })
    const body = await res.json().catch(() => ({ error: "Failed to parse response" }))
    if (!res.ok) {
      console.error("deleteProperty failed:", res.status, body)
      throw new Error(body.error || `Delete property failed with status ${res.status}`)
    }
  }

  // Get images for a property
  static async getImages(propertyId: string) {
    const { data, error } = await supabase
      .from("property_images")
      .select("*")
      .eq("property_id", propertyId)
      .order("sort_order")

    if (error) {
      console.error("Error fetching property images:", error)
      throw error
    }

    return data as PropertyImage[]
  }


  // Upload image files for a property via the API route
  static async uploadImages(propertyId: string, files: File[]): Promise<{ uploaded: PropertyImage[]; errors: string[] }> {
    const formData = new FormData()
    for (const file of files) formData.append("files", file)
    const res = await fetch(`/api/properties/${propertyId}/images`, { method: "POST", body: formData })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Upload failed" }))
      throw new Error(err.error || "Upload failed")
    }
    return res.json() as Promise<{ uploaded: PropertyImage[]; errors: string[] }>
  }

  // Delete a property image via the API route
  static async deleteImageViaApi(propertyId: string, imageId: string): Promise<void> {
    const res = await fetch(`/api/properties/${propertyId}/images`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageId }),
    })
    if (!res.ok) throw new Error("Failed to delete image")
  }

  // Reorder images via the API route
  static async reorderImages(propertyId: string, reorder: Array<{ id: string; sort_order: number }>): Promise<void> {
    const res = await fetch(`/api/properties/${propertyId}/images`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reorder }),
    })
    if (!res.ok) throw new Error("Failed to reorder images")
  }

  // Set featured image via the API route
  static async setFeaturedImage(propertyId: string, imageId: string): Promise<void> {
    const res = await fetch(`/api/properties/${propertyId}/images`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ setFeatured: imageId }),
    })
    if (!res.ok) throw new Error("Failed to set featured image")
  }
  // Add an image to a property
  static async addImage(
    propertyId: string,
    imageUrl: string,
    sortOrder = 0,
    isFeatured = false,
  ) {
    const { data, error } = await supabase
      .from("property_images")
      .insert([{ property_id: propertyId, image_url: imageUrl, sort_order: sortOrder, is_featured: isFeatured }])
      .select()
      .single()

    if (error) {
      console.error("Error adding property image:", error)
      throw error
    }

    return data as PropertyImage
  }

  // Update a property image
  static async updateImage(id: string, updates: Partial<PropertyImage>) {
    const { data, error } = await supabase
      .from("property_images")
      .update(updates)
      .eq("id", id)
      .select()
      .single()

    if (error) {
      console.error("Error updating property image:", error)
      throw error
    }

    return data as PropertyImage
  }

  // Delete a property image
  static async deleteImage(id: string) {
    const { error } = await supabase.from("property_images").delete().eq("id", id)

    if (error) {
      console.error("Error deleting property image:", error)
      throw error
    }
  }

  // Add a buyer to a property
  static async addBuyerToProperty(propertyId: string, buyerId: string) {
    const { error } = await supabase
      .from("property_buyers")
      .insert([{ property_id: propertyId, buyer_id: buyerId }])

    if (error) {
      console.error("Error adding buyer to property:", error)
      throw error
    }
  }

  // Remove a buyer from a property
  static async removeBuyerFromProperty(propertyId: string, buyerId: string) {
    const { error } = await supabase
      .from("property_buyers")
      .delete()
      .eq("property_id", propertyId)
      .eq("buyer_id", buyerId)

    if (error) {
      console.error("Error removing buyer from property:", error)
      throw error
    }
  }

  // Get buyer IDs associated with a property
  static async getPropertyBuyers(propertyId: string) {
    const { data, error } = await supabase
      .from("property_buyers")
      .select("buyer_id")
      .eq("property_id", propertyId)

    if (error) {
      console.error("Error fetching property buyers:", error)
      throw error
    }

    return (data || []).map((row) => row.buyer_id) as string[]
  }

  // Get property IDs associated with a buyer
  static async getBuyerProperties(buyerId: string) {
    const { data, error } = await supabase
      .from("property_buyers")
      .select("property_id")
      .eq("buyer_id", buyerId)

    if (error) {
      console.error("Error fetching buyer properties:", error)
      throw error
    }

    return (data || []).map((row) => row.property_id) as string[]
  }
}
