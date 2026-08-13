import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { supabaseAdmin } from "@/lib/supabase"
import { requireOrgAdmin, requireSameOrgTarget } from "@/lib/auth/admin-guard"
import { PERMISSION_KEYS } from "@/lib/permissions/keys"
import {
  grantsForTemplate,
  PERMISSION_TEMPLATES,
  type PermissionTemplateId,
} from "@/lib/permissions/templates"

const TEMPLATE_IDS = new Set<string>(PERMISSION_TEMPLATES.map((template) => template.id))

export async function POST(request: NextRequest) {
  const cookieStore = cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

  const guard = await requireOrgAdmin(supabase)
  if ("denied" in guard) return guard.denied
  const { ctx } = guard

  const { userId, templateId } = await request.json()
  if (!userId || !templateId) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 })
  }
  if (!TEMPLATE_IDS.has(templateId)) {
    return NextResponse.json({ error: "Invalid template" }, { status: 400 })
  }

  const targetResult = await requireSameOrgTarget(userId, ctx)
  if ("denied" in targetResult) return targetResult.denied

  const grants = new Set(grantsForTemplate(templateId as PermissionTemplateId))
  if (userId === ctx.userId && !grants.has("users.manage")) {
    return NextResponse.json(
      { error: "That preset would remove your own user-management access." },
      { status: 400 },
    )
  }

  // Every key is written with an explicit granted true|false so revocation is
  // recorded rather than implied by row absence.
  const rows = PERMISSION_KEYS.map((permissionKey) => ({
    user_id: userId,
    permission_key: permissionKey,
    granted: grants.has(permissionKey),
  }))

  // See update-permission: the PK is `id`, so the unique constraint on
  // (user_id, permission_key) must be named or the upsert becomes an insert.
  const { error } = await supabaseAdmin
    .from("permissions")
    .upsert(rows, { onConflict: "user_id,permission_key" })
  if (error) {
    console.error("[admin/apply-template] Failed to apply template", { userId, templateId, error })
    return NextResponse.json({ error: "Update failed" }, { status: 500 })
  }

  return NextResponse.json({ ok: true, applied: grants.size })
}
