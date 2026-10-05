import { NextResponse } from "next/server"

import { requireOrgContext } from "@/lib/auth/org-context"
import { hasPermission } from "@/lib/permissions/server"
import { supabaseAdmin } from "@/lib/supabase"
import { ensureTagsExist } from "@/lib/tags/ensure"
import { fetchAllPages } from "@/lib/tags/paging"

export const dynamic = "force-dynamic"

const COLOR_RE = /^#[0-9A-Fa-f]{6}$/

// The org's tag vocabulary, for every picker and filter.
export async function GET() {
  const { user, orgId, supabase } = await requireOrgContext()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 403 })

  // Anyone who can see buyers or properties needs to render their tags.
  const [canBuyers, canProperties] = await Promise.all([
    hasPermission(supabase, "buyers.view"),
    hasPermission(supabase, "properties.view"),
  ])
  if (!canBuyers && !canProperties) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { rows, error } = await fetchAllPages((from, to) =>
    supabase
      .from("tags")
      .select("id,name,color,is_protected")
      .eq("org_id", orgId)
      .order("name")
      .range(from, to),
  )

  if (error) {
    console.error("[tags] list failed", { orgId, error })
    return NextResponse.json({ error: "Failed to load tags" }, { status: 500 })
  }

  return NextResponse.json({ tags: rows })
}

// Create a tag (or hand back the existing one, in its own casing).
export async function POST(request: Request) {
  const { user, orgId, supabase } = await requireOrgContext()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 403 })

  const [canEditBuyers, canManageProperties, canManageTags] = await Promise.all([
    hasPermission(supabase, "buyers.edit"),
    hasPermission(supabase, "properties.manage"),
    hasPermission(supabase, "settings.tags"),
  ])
  if (!canEditBuyers && !canManageProperties && !canManageTags) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = (await request.json().catch(() => ({}))) as { name?: unknown; color?: unknown }
  const name = typeof body.name === "string" ? body.name.trim() : ""
  if (!name || name.length > 60) {
    return NextResponse.json({ error: "Enter a tag name between 1 and 60 characters." }, { status: 400 })
  }

  const color = typeof body.color === "string" ? body.color : null
  if (color && !COLOR_RE.test(color)) {
    return NextResponse.json({ error: "Pick a valid color." }, { status: 400 })
  }

  // Was this name already in the vocabulary? Decides whether `color` applies —
  // creating a tag may legitimately return somebody else's existing casing, and
  // we must not recolor their tag as a side effect.
  const { data: before } = await supabaseAdmin
    .from("tags")
    .select("id")
    .eq("org_id", orgId)
    .ilike("name", name)
    .maybeSingle()

  const [canonicalName] = await ensureTagsExist(orgId, [name])
  if (!canonicalName) {
    return NextResponse.json({ error: "Failed to create tag" }, { status: 500 })
  }

  if (color && !before) {
    const { error: colorError } = await supabaseAdmin
      .from("tags")
      .update({ color })
      .eq("org_id", orgId)
      .eq("name", canonicalName)
    if (colorError) {
      console.error("[tags] color set on create failed", { orgId, error: colorError })
    }
  }

  const { data: tag, error } = await supabaseAdmin
    .from("tags")
    .select("id,name,color,is_protected")
    .eq("org_id", orgId)
    .eq("name", canonicalName)
    .maybeSingle()

  if (error || !tag) {
    console.error("[tags] create read-back failed", { orgId, error })
    return NextResponse.json({ error: "Failed to create tag" }, { status: 500 })
  }

  return NextResponse.json({ tag }, { status: before ? 200 : 201 })
}
