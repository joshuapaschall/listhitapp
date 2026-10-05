import { NextResponse } from "next/server"

import { requireOrgContext } from "@/lib/auth/org-context"
import { hasPermission } from "@/lib/permissions/server"
import { ensureTagsExist } from "@/lib/tags/ensure"

export const dynamic = "force-dynamic"

const MAX_NAMES = 500

// Bulk vocabulary top-up for the CSV importer and the bulk tag-add flow.
export async function POST(request: Request) {
  const { user, orgId, supabase } = await requireOrgContext()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 403 })

  const [canEdit, canImport] = await Promise.all([
    hasPermission(supabase, "buyers.edit"),
    hasPermission(supabase, "buyers.import"),
  ])
  if (!canEdit && !canImport) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = (await request.json().catch(() => ({}))) as { names?: unknown }
  if (!Array.isArray(body.names)) {
    return NextResponse.json({ error: "names must be an array" }, { status: 400 })
  }
  if (body.names.length > MAX_NAMES) {
    return NextResponse.json({ error: `At most ${MAX_NAMES} tags at a time.` }, { status: 400 })
  }

  try {
    const names = await ensureTagsExist(orgId, body.names as string[])
    return NextResponse.json({ names })
  } catch (error) {
    console.error("[tags/ensure] failed", { orgId, error })
    return NextResponse.json({ error: "Failed to create tags" }, { status: 500 })
  }
}
