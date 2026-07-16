import { NextRequest, NextResponse } from "next/server"
import { requireOrgContext } from "@/lib/auth/org-context"
import { supabaseAdmin } from "@/lib/supabase"

const BUCKET = "email-assets"
const MAX_FILE_SIZE = 10 * 1024 * 1024
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/gif"]

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  const { user, orgId } = await requireOrgContext()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!orgId) return NextResponse.json({ error: "Missing org" }, { status: 400 })

  let body: { name?: string; type?: string; size?: number }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  if (!body.name || !body.type || typeof body.size !== "number") {
    return NextResponse.json({ error: "Invalid file metadata" }, { status: 400 })
  }
  if (!ALLOWED_TYPES.includes(body.type)) {
    return NextResponse.json({ error: "Unsupported file type" }, { status: 400 })
  }
  if (body.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File too large" }, { status: 400 })
  }

  const timestamp = Date.now()
  const rand = Math.random().toString(36).slice(2, 8)
  const sanitized = body.name.replace(/[^a-zA-Z0-9._-]/g, "_")
  const path = `${orgId}/campaigns/email/${timestamp}-${rand}-${sanitized}`

  const { data, error: signErr } = await supabaseAdmin.storage.from(BUCKET).createSignedUploadUrl(path)

  if (signErr || !data) {
    console.error("[email-upload-image] sign failed", { bucket: BUCKET, path, error: signErr })
    return NextResponse.json(
      { error: "Failed to prepare image upload", details: signErr?.message },
      { status: 500 },
    )
  }

  const { data: urlData } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path)

  return NextResponse.json({ path: data.path, token: data.token, signedUrl: data.signedUrl, publicUrl: urlData.publicUrl })
}
