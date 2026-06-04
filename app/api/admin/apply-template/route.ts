import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { supabaseAdmin } from "@/lib/supabase"
import { requirePermission } from "@/lib/permissions/server"
import { resolveOrgIdForUser } from "@/lib/auth/org-context"
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
  const denied = await requirePermission(supabase, "users.manage")
  if (denied) return denied

  const { userId, templateId } = await request.json()
  if (!userId || !templateId) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 })
  }
  if (!TEMPLATE_IDS.has(templateId)) {
    return NextResponse.json({ error: "Invalid template" }, { status: 400 })
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const orgId = await resolveOrgIdForUser(user.id)
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { data: target } = await supabaseAdmin
    .from("profiles")
    .select("org_id")
    .eq("id", userId)
    .maybeSingle()
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (target.org_id !== orgId) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const grants = new Set(grantsForTemplate(templateId as PermissionTemplateId))
  const rows = PERMISSION_KEYS.map((permissionKey) => ({
    user_id: userId,
    permission_key: permissionKey,
    granted: grants.has(permissionKey),
  }))

  const { error } = await supabaseAdmin.from("permissions").upsert(rows)
  if (error) {
    console.error("[admin/apply-template] Failed to apply template", error)
    return NextResponse.json({ error: "Update failed" }, { status: 500 })
  }

  return NextResponse.json({ ok: true, applied: grants.size })
}
