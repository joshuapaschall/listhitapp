import { NextRequest, NextResponse } from "next/server"
import { requireOrgContext } from "@/lib/auth/org-context"

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

// Signed-URL upload for blog featured images. Bytes go browser → Supabase
// Storage directly (never through an API route — Vercel 4.5MB cap). Reuses the
// property-images bucket under a blog/ prefix. Org-scoped via the authed client.
export async function POST(request: NextRequest, context: RouteContext) {
  const { user, orgId, supabase } = await requireOrgContext()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!orgId) return NextResponse.json({ error: "Missing org" }, { status: 400 })

  const { id } = await context.params

  const { data: site, error: siteErr } = await supabase
    .from("sites")
    .select("id")
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle()
  if (siteErr || !site) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 })
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
    const storagePath = `blog/${id}/${timestamp}-${rand}-${sanitized}`

    const { data, error: signErr } = await supabase.storage.from(BUCKET).createSignedUploadUrl(storagePath)

    if (signErr || !data) {
      errors.push(`${file.name}: failed to create signed URL`)
      continue
    }

    signed.push({
      originalName: file.name,
      path: data.path,
      token: data.token,
      signedUrl: data.signedUrl,
    })
  }

  return NextResponse.json({ signed, errors }, { status: errors.length && !signed.length ? 400 : 200 })
}
