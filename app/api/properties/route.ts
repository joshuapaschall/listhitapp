import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase/admin"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    let latitude = body.latitude
    let longitude = body.longitude

    if (latitude == null || longitude == null) {
      try {
        const baseUrl =
          process.env.NEXT_PUBLIC_BASE_URL || `${request.nextUrl.protocol}//${request.nextUrl.host}`
        const geoRes = await fetch(`${baseUrl}/api/geocode`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: [body.address, body.city, body.state, body.zip].filter(Boolean).join(", "),
          }),
        })

        if (geoRes.ok) {
          const geo = await geoRes.json()
          if (geo && geo.latitude != null && geo.longitude != null) {
            latitude = geo.latitude
            longitude = geo.longitude
          }
        }
      } catch (geoErr) {
        console.error("Geocoding failed (non-fatal):", geoErr)
      }
    }

    const insertData = {
      ...body,
      latitude,
      longitude,
      video_link: body.video_link || null,
      tags: body.tags?.length ? body.tags : null,
      website_url: body.website_url || null,
      short_slug: body.short_slug || null,
    }

    const { data, error } = await supabaseAdmin
      .from("properties")
      .insert([insertData])
      .select()
      .single()

    if (error) {
      console.error("Property insert failed:", error)
      return NextResponse.json({ error: error.message, details: error }, { status: 400 })
    }

    return NextResponse.json({ property: data }, { status: 201 })
  } catch (err) {
    console.error("POST /api/properties error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 },
    )
  }
}
