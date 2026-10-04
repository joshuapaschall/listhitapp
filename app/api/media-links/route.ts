import { NextRequest, NextResponse } from "next/server"
import { requireOrgContext } from "@/lib/auth/org-context"
import { requirePermission } from "@/lib/permissions/server"
import { createShortMediaLink } from "@/services/media-links"

export const runtime = "nodejs"

// Mirrors the key format produced by utils/uploadMedia.ts:
//   `${direction}/${Date.now()}_${crypto.randomUUID()}.${ext}`
const STORAGE_PATH_RE = /^(incoming|outgoing)\/[A-Za-z0-9._-]+$/

const ALLOWED_CONTENT_TYPE_RE = /^(image\/|video\/|audio\/)[A-Za-z0-9!#$&^_.+-]+$|^application\/pdf$/

export async function POST(req: NextRequest) {
  try {
    const { user, orgId, supabase } = await requireOrgContext()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 403 })

    const denied = await requirePermission(supabase, "inbox.send")
    if (denied) return denied

    const { storagePath, contentType } = await req.json()
    if (!storagePath || !contentType) {
      return new Response("storagePath and contentType required", { status: 400 })
    }

    if (typeof storagePath !== "string" || !STORAGE_PATH_RE.test(storagePath)) {
      return new Response("Invalid storagePath", { status: 400 })
    }

    const normalizedContentType =
      typeof contentType === "string" ? contentType.split(";")[0].trim().toLowerCase() : ""
    if (!ALLOWED_CONTENT_TYPE_RE.test(normalizedContentType)) {
      return new Response("Unsupported contentType", { status: 400 })
    }

    const shortUrl = await createShortMediaLink(storagePath, normalizedContentType, orgId)
    return Response.json({ shortUrl })
  } catch (err: any) {
    console.error(err)
    return new Response(err?.message || "Failed to create media link", { status: 500 })
  }
}
