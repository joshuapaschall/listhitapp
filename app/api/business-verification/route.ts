import { NextRequest, NextResponse } from "next/server"

import { requireOrgContext } from "@/lib/auth/org-context"
import { apiError } from "@/lib/api-error"
import { supabaseAdmin } from "@/lib/supabase"
import { getVerification, saveVerification } from "@/lib/business-verification/service"

export const dynamic = "force-dynamic"

// Mirror the organization PATCH gate: only owner/admin may write.
async function requireOwnerAdmin(userId: string): Promise<boolean> {
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle()
  const role = profile?.role
  return role === "owner" || role === "admin"
}

export async function GET() {
  const { user, orgId } = await requireOrgContext()
  if (!user) return apiError("Unauthorized", 401)
  if (!orgId) return apiError("Missing org", 400)

  try {
    return NextResponse.json(await getVerification(orgId))
  } catch (err) {
    return apiError(err, 500)
  }
}

export async function PUT(request: NextRequest) {
  const { user, orgId } = await requireOrgContext()
  if (!user) return apiError("Unauthorized", 401)
  if (!orgId) return apiError("Missing org", 400)

  if (!(await requireOwnerAdmin(user.id))) return apiError("Forbidden", 403)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError("Invalid JSON body", 400)
  }

  try {
    const result = await saveVerification(orgId, body)
    if (!result.ok) return apiError(result.error, 400)
    return NextResponse.json(result.state)
  } catch (err) {
    return apiError(err, 500)
  }
}
