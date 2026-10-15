import { NextRequest, NextResponse } from "next/server"

import { requireOrgContext } from "@/lib/auth/org-context"
import { apiError } from "@/lib/api-error"
import { canClientWriteStep, upsertStepStatus } from "@/lib/onboarding/service"
import { getSetupSummary } from "@/lib/onboarding/outcomes"
import { supabaseAdmin } from "@/lib/supabase"

export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ key: string }> }

export async function POST(request: NextRequest, context: RouteContext) {
  const { user, orgId } = await requireOrgContext()
  if (!user) return apiError("Unauthorized", 401)
  if (!orgId) return apiError("Missing org", 400)

  const { data: profile } = await supabaseAdmin.from("profiles").select("role").eq("id", user.id).maybeSingle()
  const role = (profile as { role?: string } | null)?.role
  if (role !== "owner" && role !== "admin") return apiError("Forbidden", 403)

  const { key } = await context.params

  let body: { status?: unknown }
  try {
    body = await request.json()
  } catch {
    return apiError("Invalid JSON body", 400)
  }

  // Progress is derived from real data; a customer may only skip optional items.
  if (!canClientWriteStep(key, body?.status)) {
    return NextResponse.json({ error: "Only optional items can be skipped." }, { status: 400 })
  }

  try {
    const result = await upsertStepStatus(orgId, key, "skipped")
    if (!result.ok) return apiError(result.error, 400)
    return NextResponse.json(await getSetupSummary(orgId, user.id))
  } catch (err) {
    return apiError(err, 500)
  }
}
