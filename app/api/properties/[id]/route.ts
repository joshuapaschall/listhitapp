import { NextRequest, NextResponse } from "next/server"
import { requireOrgContext } from "@/lib/auth/org-context"
import { requirePermission } from "@/lib/permissions/server"

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { user, orgId, supabase } = await requireOrgContext()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!orgId) return NextResponse.json({ error: "Missing org" }, { status: 400 })

    const denied = await requirePermission(supabase, "properties.manage")
    if (denied) return denied

    const { id } = await context.params
    const body = await request.json()

    const updateData: Record<string, unknown> = {
      ...body,
      video_link: body.video_link || null,
      tags: body.tags?.length ? body.tags : null,
      website_url: body.website_url || null,
      short_slug: body.short_slug || null,
    }

    // Listings v2 fields — persist only when provided so partial PATCHes don't
    // wipe them. show_on_site is a real boolean toggle (true/false both honored).
    if (body.description !== undefined) updateData.description = body.description ?? null
    if (body.internal_notes !== undefined) updateData.internal_notes = body.internal_notes ?? null
    if (body.show_on_site !== undefined) updateData.show_on_site = Boolean(body.show_on_site)
    if (body.photo_album_url !== undefined) updateData.photo_album_url = body.photo_album_url || null
    if (body.year_built !== undefined) updateData.year_built = body.year_built ?? null
    if (body.lot_size !== undefined) updateData.lot_size = body.lot_size || null
    if (body.mls_number !== undefined) updateData.mls_number = body.mls_number || null
    if (body.construction_type !== undefined) updateData.construction_type = body.construction_type || null

    if (
      (body.address || body.city || body.state || body.zip) &&
      body.latitude == null &&
      body.longitude == null
    ) {
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
            updateData.latitude = geo.latitude
            updateData.longitude = geo.longitude
          }
        }
      } catch (geoErr) {
        console.error("Geocoding failed (non-fatal):", geoErr)
      }
    }

    const { data, error } = await supabase
      .from("properties")
      .update(updateData)
      .eq("id", id)
      .select()
      .single()

    if (error) {
      console.error("Property update failed:", error)
      return NextResponse.json({ error: error.message, details: error }, { status: 400 })
    }

    return NextResponse.json({ property: data })
  } catch (err) {
    console.error("PATCH /api/properties/[id] error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 },
    )
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { user, orgId, supabase } = await requireOrgContext()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!orgId) return NextResponse.json({ error: "Missing org" }, { status: 400 })

    const denied = await requirePermission(supabase, "properties.manage")
    if (denied) return denied

    const { id } = await context.params

    const { data: images } = await supabase
      .from("property_images")
      .select("image_url")
      .eq("property_id", id)

    if (images && images.length > 0) {
      const storagePaths = images
        .map((img) => {
          try {
            const url = new URL(img.image_url)
            const parts = url.pathname.split("/object/public/property-images/")
            return parts[1] || null
          } catch {
            return null
          }
        })
        .filter((p): p is string => p !== null)

      if (storagePaths.length > 0) {
        await supabase.storage.from("property-images").remove(storagePaths)
      }
    }

    const { error } = await supabase.from("properties").delete().eq("id", id)

    if (error) {
      console.error("Property delete failed:", error)
      return NextResponse.json({ error: error.message, details: error }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("DELETE /api/properties/[id] error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 },
    )
  }
}
