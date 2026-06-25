import { NextRequest, NextResponse } from "next/server"
import { requireOrgContext } from "@/lib/auth/org-context"
import { requirePermission } from "@/lib/permissions/server"
import { supabaseAdmin } from "@/lib/supabase"

const BUCKET = "property-images"
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB per file
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"]

type RouteContext = { params: Promise<{ id: string }> }

type IncomingFile = { name: string; type: string; size: number }

type SignedEntry = {
  originalName: string
  path: string
  token: string
  signedUrl: string
}

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

  let body: { files?: IncomingFile[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const files = Array.isArray(body?.files) ? body.files : []
  if (!files.length) {
    return NextResponse.json({ error: "No files provided" }, { status: 400 })
  }

  const signed: SignedEntry[] = []
  const errors: string[] = []

  for (const file of files) {
    if (!file?.name || !file?.type || typeof file.size !== "number") {
      errors.push("Invalid file metadata")
      continue
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      errors.push(`${file.name}: unsupported type ${file.type}`)
      continue
    }
    if (file.size > MAX_FILE_SIZE) {
      errors.push(`${file.name}: exceeds 10MB limit`)
      continue
    }

    const timestamp = Date.now()
    const rand = Math.random().toString(36).slice(2, 8)
    const sanitized = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
    const storagePath = `${propertyId}/${timestamp}-${rand}-${sanitized}`

    const { data, error: signErr } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUploadUrl(storagePath)

    if (signErr || !data) {
      errors.push(
        `${file.name}: failed to create signed URL - ${signErr?.message || "unknown"}`,
      )
      continue
    }

    signed.push({
      originalName: file.name,
      path: data.path,
      token: data.token,
      signedUrl: data.signedUrl,
    })
  }

  return NextResponse.json(
    { signed, errors },
    { status: errors.length && !signed.length ? 400 : 200 },
  )
}
