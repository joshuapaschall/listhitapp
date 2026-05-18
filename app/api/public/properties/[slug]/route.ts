import { NextRequest, NextResponse } from "next/server"

import { corsHeaders, isOriginAllowed } from "@/lib/public-api/cors"
import { supabaseAdmin } from "@/lib/supabase/admin"

type PropertyImageRow = {
  id: string
  image_url: string
  sort_order: number
  is_featured: boolean
}

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin")
  if (!isOriginAllowed(origin)) {
    return NextResponse.json({ ok: false, error_code: "origin_not_allowed", message: "Origin not allowed" }, { status: 403 })
  }
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin as string) })
}

export async function GET(request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  const origin = request.headers.get("origin")
  if (!isOriginAllowed(origin)) {
    return NextResponse.json({ ok: false, error_code: "origin_not_allowed", message: "Origin not allowed" }, { status: 403 })
  }
  const allowedOrigin = origin as string

  try {
    const params = await context.params
    const slug = params.slug

    const { data: property, error } = await supabaseAdmin
      .from("properties")
      .select("id,slug,address,city,state,zip,latitude,longitude,price,down_payment,monthly_payment,earnest_money,bedrooms,bathrooms,sqft,description,property_type,condition,occupancy,tags,created_at,updated_at")
      .eq("slug", slug)
      .eq("status", "available")
      .not("slug", "is", null)
      .is("deleted_at", null)
      .maybeSingle()

    if (error) throw error

    if (!property) {
      return NextResponse.json(
        { ok: false, error_code: "not_found", message: "Property not found or not available." },
        { status: 404, headers: corsHeaders(allowedOrigin) }
      )
    }

    const { data: images, error: imagesError } = await supabaseAdmin
      .from("property_images")
      .select("id,image_url,sort_order,is_featured")
      .eq("property_id", property.id)
      .order("sort_order", { ascending: true })

    if (imagesError) throw imagesError

    return NextResponse.json(
      {
        ok: true,
        property: {
          ...property,
          images: ((images || []) as PropertyImageRow[]).map((image) => ({
            id: image.id,
            image_url: image.image_url,
            sort_order: image.sort_order,
            is_featured: image.is_featured,
          })),
        },
      },
      { headers: corsHeaders(allowedOrigin) }
    )
  } catch (error) {
    console.error("[public-property-detail] error", error)
    return NextResponse.json({ ok: false, error_code: "internal_error", message: "Internal server error" }, { status: 500, headers: corsHeaders(allowedOrigin) })
  }
}
