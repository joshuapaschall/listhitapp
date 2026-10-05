import { NextResponse } from "next/server"

import { requireOrgContext } from "@/lib/auth/org-context"
import { requirePermission } from "@/lib/permissions/server"
import { supabaseAdmin } from "@/lib/supabase"
import { tagRpcErrorResponse } from "@/lib/tags/rpc-errors"

export const dynamic = "force-dynamic"

const COLOR_RE = /^#[0-9A-Fa-f]{6}$/

type RouteParams = { params: { id: string } }

export async function PATCH(request: Request, { params }: RouteParams) {
  const { user, orgId, supabase } = await requireOrgContext()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 403 })

  const denied = await requirePermission(supabase, "settings.tags")
  if (denied) return denied

  const body = (await request.json().catch(() => ({}))) as { name?: unknown; color?: unknown }
  const hasName = typeof body.name === "string"
  const hasColor = typeof body.color === "string"
  if (!hasName && !hasColor) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 })
  }

  // Rename goes through the cascade — it rewrites buyers, properties, segments
  // and draft campaigns in one transaction.
  if (hasName) {
    const { error } = await supabaseAdmin.rpc("tag_rename", {
      p_org_id: orgId,
      p_tag_id: params.id,
      p_new_name: body.name as string,
    })
    if (error) return tagRpcErrorResponse(error, { orgId, tagId: params.id, action: "rename" })
  }

  // Color touches nothing but the tag row, so it is a plain scoped update and is
  // allowed on protected tags.
  if (hasColor) {
    const color = body.color as string
    if (!COLOR_RE.test(color)) {
      return NextResponse.json({ error: "Pick a valid color." }, { status: 400 })
    }
    const { data, error } = await supabaseAdmin
      .from("tags")
      .update({ color })
      .eq("org_id", orgId)
      .eq("id", params.id)
      .select("id")
      .maybeSingle()

    if (error) {
      console.error("[tags] color update failed", { orgId, tagId: params.id, error })
      return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
    }
    if (!data) {
      return NextResponse.json({ error: "That tag no longer exists." }, { status: 404 })
    }
  }

  const { data: tag } = await supabaseAdmin
    .from("tags")
    .select("id,name,color,is_protected")
    .eq("org_id", orgId)
    .eq("id", params.id)
    .maybeSingle()

  return NextResponse.json({ ok: true, tag: tag ?? null })
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { user, orgId, supabase } = await requireOrgContext()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 403 })

  const denied = await requirePermission(supabase, "settings.tags")
  if (denied) return denied

  const { error } = await supabaseAdmin.rpc("tag_delete", {
    p_org_id: orgId,
    p_tag_id: params.id,
  })
  if (error) return tagRpcErrorResponse(error, { orgId, tagId: params.id, action: "delete" })

  return NextResponse.json({ ok: true })
}
