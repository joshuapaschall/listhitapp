// One control, one write path. The old pair of routes (update-role +
// apply-template) let the UI set a role and a permission set independently,
// which meant the two could disagree. An access level is the atomic thing an
// admin actually wants to change, so it is one request: permissions first, then
// the role, both through supabaseAdmin.

import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { supabaseAdmin } from "@/lib/supabase"
import { countOrgAdmins, requireOrgAdmin, requireSameOrgTarget } from "@/lib/auth/admin-guard"
import { PERMISSION_KEYS } from "@/lib/permissions/keys"
import { grantsForTemplate, type PermissionTemplateId } from "@/lib/permissions/templates"

const LEVELS = ["admin", "manager", "agent", "viewer", "custom"] as const
type AccessLevel = (typeof LEVELS)[number]

function isAccessLevel(value: unknown): value is AccessLevel {
  return typeof value === "string" && (LEVELS as readonly string[]).includes(value)
}

async function grantedKeysFor(userId: string): Promise<string[]> {
  const { data } = await supabaseAdmin
    .from("permissions")
    .select("permission_key")
    .eq("user_id", userId)
    .eq("granted", true)
  return (data ?? [])
    .map((row) => (row as { permission_key: string | null }).permission_key)
    .filter((key): key is string => Boolean(key))
}

export async function POST(request: NextRequest) {
  const cookieStore = cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

  const guard = await requireOrgAdmin(supabase)
  if ("denied" in guard) return guard.denied
  const { ctx } = guard

  const { userId, level } = await request.json()
  if (!userId || !isAccessLevel(level)) {
    return NextResponse.json({ error: "Invalid level" }, { status: 400 })
  }

  const targetResult = await requireSameOrgTarget(userId, ctx)
  if ("denied" in targetResult) return targetResult.denied
  const { target } = targetResult

  if (userId === ctx.userId) {
    return NextResponse.json(
      { error: "You can't change your own access level." },
      { status: 400 },
    )
  }
  if (target.role === "owner") {
    return NextResponse.json(
      { error: "The owner's access can't be changed here." },
      { status: 400 },
    )
  }
  if (target.role === "admin" && level !== "admin") {
    const admins = await countOrgAdmins(ctx.orgId)
    if (admins <= 1) {
      return NextResponse.json(
        { error: "You can't remove the only admin on this organization." },
        { status: 400 },
      )
    }
  }

  // Permissions first, then the role. If the second write fails the user is
  // left with the narrower of the two states rather than the broader one.
  if (level !== "custom") {
    const grants = new Set(grantsForTemplate(level as PermissionTemplateId))
    // Every key carries an explicit granted true|false so a revocation is
    // recorded rather than implied by row absence.
    const rows = PERMISSION_KEYS.map((permissionKey) => ({
      user_id: userId,
      permission_key: permissionKey,
      granted: grants.has(permissionKey),
    }))

    // See update-permission: the PK is `id`, so the unique constraint on
    // (user_id, permission_key) must be named or the upsert becomes an insert.
    const { error: permError } = await supabaseAdmin
      .from("permissions")
      .upsert(rows, { onConflict: "user_id,permission_key" })
    if (permError) {
      console.error("[admin/set-access-level] permission write failed", {
        userId,
        level,
        error: permError,
      })
      return NextResponse.json({ error: "Update failed" }, { status: 500 })
    }
  }

  const role = level === "admin" ? "admin" : "user"
  const { error: roleError } = await supabaseAdmin
    .from("profiles")
    .update({ role })
    .eq("id", userId)
  if (roleError) {
    console.error("[admin/set-access-level] role write failed", {
      userId,
      level,
      role,
      error: roleError,
    })
    return NextResponse.json({ error: "Update failed" }, { status: 500 })
  }

  return NextResponse.json({ ok: true, role, permissions: await grantedKeysFor(userId) })
}
