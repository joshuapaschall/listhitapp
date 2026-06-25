import { NextRequest, NextResponse } from "next/server"
import { requireOrgContext } from "@/lib/auth/org-context"
import { requirePermission } from "@/lib/permissions/server"
import { supabaseAdmin } from "@/lib/supabase"

const BUCKET = "property-images"
const MAX_FILE_SIZE = 10 * 1024 * 1024
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"]

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, context: RouteContext) {
  const { user, orgId, supabase } = await requireOrgContext()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!orgId) return NextResponse.json({ error: "Missing org" }, { status: 400 })

  const denied = await requirePermission(supabase, "properties.manage")
  if (denied) return denied

  const { id: propertyId } = await context.params

  const { data: property, error: propErr } = await supabase
    .from("properties")
    .select("id")
    .eq("id", propertyId)
    .maybeSingle()
  if (propErr || !property) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 })
  }

  let body: { paths?: string[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const paths = Array.isArray(body?.paths) ? body.paths : []
  if (!paths.length) {
    return NextResponse.json({ error: "No paths provided" }, { status: 400 })
  }

  const { data: existingImages } = await supabaseAdmin
    .from("property_images")
    .select("id, sort_order")
    .eq("property_id", propertyId)
    .order("sort_order", { ascending: false })

  const existingCount = existingImages?.length ?? 0
  let nextSortOrder = (existingImages?.[0]?.sort_order ?? -1) + 1
  const uploaded: Array<{
    id: string
    image_url: string
    sort_order: number
    is_featured: boolean
  }> = []
  const errors: string[] = []

  for (const storagePath of paths) {
    // Security: prevent client from inserting URLs to other properties' folders
    if (
      typeof storagePath !== "string" ||
      !storagePath.startsWith(`${propertyId}/`)
    ) {
      errors.push(`Invalid path: ${storagePath}`)
      continue
    }

    const { data: urlData } = supabaseAdmin.storage
      .from(BUCKET)
      .getPublicUrl(storagePath)
    const shouldFeature = existingCount === 0 && uploaded.length === 0

    const { data: imgRecord, error: dbErr } = await supabaseAdmin
      .from("property_images")
      .insert({
        property_id: propertyId,
        image_url: urlData.publicUrl,
        sort_order: nextSortOrder,
        is_featured: shouldFeature,
        org_id: orgId,
      })
      .select("id, image_url, sort_order, is_featured")
      .single()

    if (dbErr) {
      // Clean up the orphaned storage object if DB insert fails
      await supabaseAdmin.storage.from(BUCKET).remove([storagePath])
      errors.push(`${storagePath}: DB insert failed - ${dbErr.message}`)
      continue
    }

    uploaded.push(imgRecord)
    nextSortOrder++
  }

  return NextResponse.json(
    { uploaded, errors },
    { status: errors.length && !uploaded.length ? 400 : 200 },
  )
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { user, orgId, supabase } = await requireOrgContext()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!orgId) return NextResponse.json({ error: "Missing org" }, { status: 400 })

  const denied = await requirePermission(supabase, "properties.manage")
  if (denied) return denied

  const { id: propertyId } = await context.params
  const { imageId } = (await request.json()) as { imageId?: string }
  if (!imageId) return NextResponse.json({ error: "imageId required" }, { status: 400 })

  const { data: img, error: fetchErr } = await supabase.from("property_images").select("*").eq("id", imageId).eq("property_id", propertyId).maybeSingle()
  if (fetchErr || !img) return NextResponse.json({ error: "Image not found" }, { status: 404 })

  const url = new URL(img.image_url)
  const pathParts = url.pathname.split(`/object/public/${BUCKET}/`)
  const storagePath = pathParts[1]
  if (storagePath) await supabaseAdmin.storage.from(BUCKET).remove([storagePath])

  await supabaseAdmin.from("property_images").delete().eq("id", imageId)
  return NextResponse.json({ success: true })
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { user, orgId, supabase } = await requireOrgContext()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!orgId) return NextResponse.json({ error: "Missing org" }, { status: 400 })

  const denied = await requirePermission(supabase, "properties.manage")
  if (denied) return denied

  const { id: propertyId } = await context.params

  // Ownership gate on the session client (RLS scopes to the caller's org); the
  // privileged writes below then run on admin so they're not blocked by RLS.
  const { data: property, error: propErr } = await supabase
    .from("properties")
    .select("id")
    .eq("id", propertyId)
    .maybeSingle()
  if (propErr || !property) return NextResponse.json({ error: "Property not found" }, { status: 404 })

  const body = (await request.json()) as { reorder?: Array<{ id: string; sort_order: number }>; setFeatured?: string }

  if (body.reorder && Array.isArray(body.reorder)) {
    for (const item of body.reorder) {
      await supabaseAdmin.from("property_images").update({ sort_order: item.sort_order }).eq("id", item.id).eq("property_id", propertyId)
    }
    return NextResponse.json({ success: true })
  }

  if (body.setFeatured) {
    await supabaseAdmin.from("property_images").update({ is_featured: false }).eq("property_id", propertyId)
    await supabaseAdmin.from("property_images").update({ is_featured: true }).eq("id", body.setFeatured).eq("property_id", propertyId)
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: "Invalid PATCH body" }, { status: 400 })
}
