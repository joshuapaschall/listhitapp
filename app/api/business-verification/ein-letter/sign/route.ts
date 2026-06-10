import { NextRequest, NextResponse } from "next/server"

import { requireOrgContext } from "@/lib/auth/org-context"
import { apiError } from "@/lib/api-error"
import { supabaseAdmin } from "@/lib/supabase"

export const dynamic = "force-dynamic"

const BUCKET = "business-verification"
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB per file
const ALLOWED_TYPES = ["application/pdf", "image/png", "image/jpeg"]

type IncomingFile = { name: string; type: string; size: number }

type SignedEntry = {
  originalName: string
  path: string
  token: string
  signedUrl: string
}

// Owner/admin gate, mirroring the organization PATCH role check.
async function requireOwnerAdmin(userId: string): Promise<boolean> {
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle()
  const role = profile?.role
  return role === "owner" || role === "admin"
}

export async function POST(request: NextRequest) {
  const { user, orgId } = await requireOrgContext()
  if (!user) return apiError("Unauthorized", 401)
  if (!orgId) return apiError("Missing org", 400)

  if (!(await requireOwnerAdmin(user.id))) return apiError("Forbidden", 403)

  let body: { files?: IncomingFile[] }
  try {
    body = await request.json()
  } catch {
    return apiError("Invalid JSON body", 400)
  }

  const files = Array.isArray(body?.files) ? body.files : []
  if (!files.length) return apiError("No files provided", 400)

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
    const storagePath = `${orgId}/${timestamp}-${rand}-${sanitized}`

    const { data, error: signErr } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUploadUrl(storagePath)

    if (signErr || !data) {
      errors.push(`${file.name}: failed to create signed URL - ${signErr?.message || "unknown"}`)
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
