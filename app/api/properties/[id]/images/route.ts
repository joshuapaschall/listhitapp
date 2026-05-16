import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase/admin"

const BUCKET = "property-images"
const MAX_FILE_SIZE = 10 * 1024 * 1024
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"]

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, context: RouteContext) {
  const { id: propertyId } = await context.params
  const { data: property, error: propErr } = await supabaseAdmin.from("properties").select("id").eq("id", propertyId).maybeSingle()
  if (propErr || !property) return NextResponse.json({ error: "Property not found" }, { status: 404 })

  const formData = await request.formData()
  const files = formData.getAll("files") as File[]
  if (!files.length) return NextResponse.json({ error: "No files provided" }, { status: 400 })

  const { data: existingImages } = await supabaseAdmin
    .from("property_images")
    .select("sort_order")
    .eq("property_id", propertyId)
    .order("sort_order", { ascending: false })
    .limit(1)

  let nextSortOrder = (existingImages?.[0]?.sort_order ?? -1) + 1
  const uploaded: Array<{ id: string; image_url: string; sort_order: number; is_featured: boolean }> = []
  const errors: string[] = []

  for (const file of files) {
    if (!ALLOWED_TYPES.includes(file.type)) {
      errors.push(`${file.name}: unsupported type ${file.type}`)
      continue
    }
    if (file.size > MAX_FILE_SIZE) {
      errors.push(`${file.name}: exceeds 10MB limit`)
      continue
    }

    const timestamp = Date.now()
    const sanitized = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
    const storagePath = `${propertyId}/${timestamp}-${sanitized}`
    const buffer = Buffer.from(await file.arrayBuffer())

    const { error: uploadErr } = await supabaseAdmin.storage.from(BUCKET).upload(storagePath, buffer, { contentType: file.type, upsert: false })
    if (uploadErr) {
      errors.push(`${file.name}: upload failed - ${uploadErr.message}`)
      continue
    }

    const { data: urlData } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(storagePath)
    const isFirstImage = nextSortOrder === 0 && uploaded.length === 0
    const existingCount = existingImages?.length ?? 0
    const shouldFeature = isFirstImage && existingCount === 0

    const { data: imgRecord, error: dbErr } = await supabaseAdmin
      .from("property_images")
      .insert({ property_id: propertyId, image_url: urlData.publicUrl, sort_order: nextSortOrder, is_featured: shouldFeature })
      .select("id, image_url, sort_order, is_featured")
      .single()

    if (dbErr) {
      await supabaseAdmin.storage.from(BUCKET).remove([storagePath])
      errors.push(`${file.name}: DB insert failed - ${dbErr.message}`)
      continue
    }

    uploaded.push(imgRecord)
    nextSortOrder++
  }

  return NextResponse.json({ uploaded, errors }, { status: errors.length && !uploaded.length ? 400 : 200 })
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { id: propertyId } = await context.params
  const { imageId } = (await request.json()) as { imageId?: string }
  if (!imageId) return NextResponse.json({ error: "imageId required" }, { status: 400 })

  const { data: img, error: fetchErr } = await supabaseAdmin.from("property_images").select("*").eq("id", imageId).eq("property_id", propertyId).maybeSingle()
  if (fetchErr || !img) return NextResponse.json({ error: "Image not found" }, { status: 404 })

  const url = new URL(img.image_url)
  const pathParts = url.pathname.split(`/object/public/${BUCKET}/`)
  const storagePath = pathParts[1]
  if (storagePath) await supabaseAdmin.storage.from(BUCKET).remove([storagePath])

  await supabaseAdmin.from("property_images").delete().eq("id", imageId)
  return NextResponse.json({ success: true })
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id: propertyId } = await context.params
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
