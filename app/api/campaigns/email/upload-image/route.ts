import { NextRequest, NextResponse } from "next/server"
import { requireOrgContext } from "@/lib/auth/org-context"

const BUCKET = "email-assets"
const MAX_FILE_SIZE = 10 * 1024 * 1024
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/gif"]

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  const { user, orgId, supabase } = await requireOrgContext()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!orgId) return NextResponse.json({ error: "Missing org" }, { status: 400 })

  try {
    await supabase.storage.createBucket(BUCKET, { public: true })
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : ""
    if (!message.includes("already exists")) {
      return NextResponse.json({ error: "Failed to create bucket" }, { status: 500 })
    }
  }

  const body = (await request.json()) as { name?: string; type?: string; size?: number }

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
  const path = `campaigns/email/${timestamp}-${rand}-${sanitized}`

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path)

  if (error || !data) {
    return NextResponse.json({ error: error?.message || "Failed to sign upload URL" }, { status: 500 })
  }

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path)

  return NextResponse.json({ path: data.path, token: data.token, signedUrl: data.signedUrl, publicUrl: urlData.publicUrl })
}
