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
