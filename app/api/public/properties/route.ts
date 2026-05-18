import { NextRequest, NextResponse } from "next/server"

import { corsHeaders, isOriginAllowed } from "@/lib/public-api/cors"
import { supabaseAdmin } from "@/lib/supabase/admin"

type PropertyRow = {
  id: string
  slug: string
  address: string
  city: string | null
  state: string | null
  zip: string | null
  latitude: number | null
  longitude: number | null
  price: number | null
  down_payment: number | null
  monthly_payment: number | null
  earnest_money: number | null
  bedrooms: number | null
  bathrooms: number | null
  sqft: number | null
  description: string | null
  property_type: string | null
  condition: string | null
  occupancy: string | null
  tags: string[] | null
  created_at: string
  updated_at: string
}

type PropertyImageRow = {
  id: string
  property_id: string
  image_url: string
  sort_order: number
  is_featured: boolean
}

function parseIntParam(v: string | null, fallback: number, min: number, max?: number): number {
  if (!v) return fallback
  const n = Number.parseInt(v, 10)
  if (!Number.isFinite(n)) return fallback
  const boundedMin = Math.max(n, min)
  if (typeof max === "number") return Math.min(boundedMin, max)
  return boundedMin
}

function parseNumberParam(v: string | null): number | null {
  if (!v) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function truncateDescription(text: string | null): string | null {
  if (!text) return null
  return text.length > 250 ? `${text.slice(0, 250)}...` : text
}

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin")
  if (!isOriginAllowed(origin)) {
    return NextResponse.json({ ok: false, error_code: "origin_not_allowed", message: "Origin not allowed" }, { status: 403 })
  }
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin as string) })
}

export async function GET(request: NextRequest) {
  const origin = request.headers.get("origin")
  if (!isOriginAllowed(origin)) {
    return NextResponse.json({ ok: false, error_code: "origin_not_allowed", message: "Origin not allowed" }, { status: 403 })
  }
  const allowedOrigin = origin as string

  try {
    const params = request.nextUrl.searchParams
    const limit = parseIntParam(params.get("limit"), 20, 1, 50)
    const offset = parseIntParam(params.get("offset"), 0, 0)
    const propertyType = params.get("property_type")
    const minPrice = parseNumberParam(params.get("min_price"))
    const maxPrice = parseNumberParam(params.get("max_price"))
    const minBeds = parseNumberParam(params.get("min_beds"))
    const city = params.get("city")

    let countQuery = supabaseAdmin
      .from("properties")
      .select("id", { count: "exact", head: true })
      .eq("status", "available")
      .not("slug", "is", null)
      .is("deleted_at", null)

    let dataQuery = supabaseAdmin
      .from("properties")
      .select("id,slug,address,city,state,zip,latitude,longitude,price,down_payment,monthly_payment,earnest_money,bedrooms,bathrooms,sqft,description,property_type,condition,occupancy,tags,created_at,updated_at")
      .eq("status", "available")
      .not("slug", "is", null)
      .is("deleted_at", null)

    if (propertyType) {
      countQuery = countQuery.eq("property_type", propertyType)
      dataQuery = dataQuery.eq("property_type", propertyType)
    }
    if (minPrice !== null) {
      countQuery = countQuery.gte("price", minPrice)
      dataQuery = dataQuery.gte("price", minPrice)
    }
    if (maxPrice !== null) {
      countQuery = countQuery.lte("price", maxPrice)
      dataQuery = dataQuery.lte("price", maxPrice)
    }
    if (minBeds !== null) {
      countQuery = countQuery.gte("bedrooms", minBeds)
      dataQuery = dataQuery.gte("bedrooms", minBeds)
    }
    if (city) {
      countQuery = countQuery.ilike("city", `%${city}%`)
      dataQuery = dataQuery.ilike("city", `%${city}%`)
    }

    const [{ count, error: countError }, { data, error: dataError }] = await Promise.all([
      countQuery,
      dataQuery.order("created_at", { ascending: false }).range(offset, offset + limit - 1),
    ])

    if (countError) throw countError
    if (dataError) throw dataError

    const rows = (data || []) as PropertyRow[]
    const propertyIds = rows.map((row) => row.id)

    let imagesByProperty = new Map<string, PropertyImageRow[]>()
    if (propertyIds.length > 0) {
      const { data: imageRows, error: imageError } = await supabaseAdmin
        .from("property_images")
        .select("id,property_id,image_url,sort_order,is_featured")
        .in("property_id", propertyIds)
        .order("sort_order", { ascending: true })

      if (imageError) throw imageError

      for (const image of (imageRows || []) as PropertyImageRow[]) {
        const existing = imagesByProperty.get(image.property_id) || []
        existing.push(image)
        imagesByProperty.set(image.property_id, existing)
      }
    }

    const properties = rows.map((row) => {
      const images = imagesByProperty.get(row.id) || []
      const featured = images.find((img) => img.is_featured)
      const primary = featured || images[0] || null

      return {
        ...row,
        description: truncateDescription(row.description),
        primary_image_url: primary?.image_url || null,
        image_count: images.length,
      }
    })

    return NextResponse.json({ ok: true, count: count || 0, properties }, { headers: corsHeaders(allowedOrigin) })
  } catch (error) {
    console.error("[public-properties-list] error", error)
    return NextResponse.json({ ok: false, error_code: "internal_error", message: "Internal server error" }, { status: 500, headers: corsHeaders(allowedOrigin) })
  }
}
