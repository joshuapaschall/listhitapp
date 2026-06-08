import { apiError } from "@/lib/api-error"
import { NextRequest, NextResponse } from "next/server"
import { requireOrgContext } from "@/lib/auth/org-context"
import { requirePermission } from "@/lib/permissions/server"

export async function POST(request: NextRequest) {
  try {
    const { user, orgId, supabase } = await requireOrgContext()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!orgId) return NextResponse.json({ error: "Missing org" }, { status: 400 })

    const denied = await requirePermission(supabase, "properties.manage")
    if (denied) return denied

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
      // Listings v2: public listing copy vs private notes, publish gate, and
      // the optional listing facts. description is the PUBLIC text — never notes.
      description: body.description ?? null,
      internal_notes: body.internal_notes ?? null,
      show_on_site: body.show_on_site ?? true,
      photo_album_url: body.photo_album_url || null,
      year_built: body.year_built ?? null,
      lot_size: body.lot_size || null,
      mls_number: body.mls_number || null,
      construction_type: body.construction_type || null,
      org_id: orgId,
    }

    const { data, error } = await supabase
      .from("properties")
      .insert([insertData])
      .select()
      .single()

    if (error) {
      console.error("Property insert failed:", error)
      return apiError(error, 400)
    }

    return NextResponse.json({ property: data }, { status: 201 })
  } catch (err) {
    return apiError(err, 500)
  }
}
