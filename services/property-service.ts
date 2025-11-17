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
  pageSize?: number
  sortBy?: string
  sortOrder?: "asc" | "desc"
}

export class PropertyService {
  private static async geocodeAddress(property: Partial<Property>) {
    const addressParts = [
      property.address,
      property.city,
      property.state,
      property.zip,
    ]
      .filter(Boolean)
      .join(", ")

    if (!addressParts) {
      return { latitude: null, longitude: null }
    }

    try {
      const baseUrl =
        process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"
      const url =
        typeof window === "undefined"
          ? `${baseUrl}/api/geocode`
          : "/api/geocode"
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: addressParts }),
      })
      if (!res.ok) {
        return { latitude: null, longitude: null }
      }
      const result = await res.json()
      if (result && result.latitude != null && result.longitude != null) {
        return {
          latitude: result.latitude,
          longitude: result.longitude,
        }
      }
    } catch (err) {
      console.error("Geocoding failed", err)
    }
    return { latitude: null, longitude: null }
  }
  // Fetch properties with optional filtering, pagination and sorting
  static async getProperties(
    filters: PropertyFilters = {},
  ): Promise<{ properties: Property[]; totalCount: number }> {
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
      pageSize,
      sortBy = "created_at",
      sortOrder = "desc",
    } = filters

    let query = supabase
      .from("properties")
      .select("*", { count: "exact" })

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
      const encoded = encodeURIComponent(search)
      query = query.or(
        `address.ilike.%${encoded}%,city.ilike.%${encoded}%,state.ilike.%${encoded}%,zip.ilike.%${encoded}%`,
      )
    }

    query = query.order(sortBy, { ascending: sortOrder === "asc" })

    if (page && pageSize) {
      const from = (page - 1) * pageSize
      const to = from + pageSize - 1
      query = query.range(from, to)
    }

    const { data, error, count } = await query

    if (error) {
      console.error("Error fetching properties:", error)
      throw error
    }

    return { properties: (data as Property[]) || [], totalCount: count || 0 }
  }

  // Search properties by address, city, state, or zip
  static async searchProperties(query: string) {
    const encoded = encodeURIComponent(query)
    const { data, error } = await supabase
      .from("properties")
      .select("id, address, city, state, zip")
      .or(
        `address.ilike.%${encoded}%,city.ilike.%${encoded}%,state.ilike.%${encoded}%,zip.ilike.%${encoded}%`,
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
  static async addProperty(property: Partial<Property>) {
    const insertData = {
      ...property,
      video_link: property.video_link || null,
      tags: property.tags?.length ? property.tags : null,
      website_url: property.website_url || null,
      short_slug: property.short_slug || null,
    }

    if (insertData.latitude == null || insertData.longitude == null) {
      const geo = await this.geocodeAddress(insertData)
      insertData.latitude = geo.latitude
      insertData.longitude = geo.longitude
    }

    const { data, error } = await supabase
      .from("properties")
      .insert([insertData])
      .select()
      .single()

    if (error) {
      console.error("Error adding property:", error)
      throw error
    }

    const propertyData = data as Property

    try {
      const baseUrl =
        process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"
      const targetUrl =
        property.website_url || `${baseUrl}/properties/${propertyData.id}`
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
      console.error("Short link creation failed", err)
    }

    return propertyData
  }


  // Update an existing property
  static async updateProperty(id: string, updates: Partial<Property>) {
    const updateData = {
      ...updates,
      video_link: updates.video_link || null,
      tags: updates.tags?.length ? updates.tags : null,
      website_url: updates.website_url || null,
      short_slug: updates.short_slug || null,
    }

    if (
      (updates.address || updates.city || updates.state || updates.zip) &&
      updates.latitude == null &&
      updates.longitude == null
    ) {
      const geo = await this.geocodeAddress({ ...updates })
      updateData.latitude = geo.latitude
      updateData.longitude = geo.longitude
    }
    const { data, error } = await supabase
      .from("properties")
      .update(updateData)
      .eq("id", id)
      .select()
      .single()

    if (error) {
      console.error("Error updating property:", error)
      throw error
    }

    return data as Property
  }

  // Delete a property
  static async deleteProperty(id: string) {
    const { error } = await supabase.from("properties").delete().eq("id", id)

    if (error) {
      console.error("Error deleting property:", error)
      throw error
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

  // Add an image to a property
  static async addImage(
    propertyId: string,
    imageUrl: string,
    sortOrder = 0,
  ) {
    const { data, error } = await supabase
      .from("property_images")
      .insert([{ property_id: propertyId, image_url: imageUrl, sort_order: sortOrder }])
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
